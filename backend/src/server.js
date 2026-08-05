import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import {createPix,getDeposit} from './veopag.js';
import {insertDonation,updateDonation,getDonation,getPendingDonations,paidTotal,getRandomTestPayer,registerWebhookEvent,claimMetaPurchase,markMetaPurchaseSent,markMetaPurchaseFailed} from './database.js';
import {isMetaCapiConfigured,sendMetaPurchase} from './meta.js';

const app=express();
app.set('trust proxy',1);
app.disable('x-powered-by');
const origins=String(process.env.FRONTEND_ORIGINS||'').split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean);
const allowedAmounts=[10,20,30,50,70,100,150,200,300,500,700,1000,1500,2000];
const production=process.env.NODE_ENV==='production';

app.use(helmet({crossOriginResourcePolicy:false,contentSecurityPolicy:false}));
app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');next();});
app.use(cors({
  origin(origin,cb){
    if(!origin)return cb(null,true);
    return origins.includes(origin.replace(/\/$/,''))?cb(null,true):cb(new Error('CORS_BLOCKED'));
  },methods:['GET','POST','OPTIONS'],allowedHeaders:['Content-Type'],maxAge:600,credentials:false
}));

const globalLimiter=memoryRateLimit({windowMs:60_000,limit:120,message:'Muitas solicitações. Aguarde um momento.'});
const createLimiter=memoryRateLimit({windowMs:15*60_000,limit:Number(process.env.PIX_RATE_LIMIT||5),message:'Muitas tentativas de gerar PIX. Aguarde alguns minutos.'});
const statusLimiter=memoryRateLimit({windowMs:60_000,limit:30,message:'Muitas consultas. Aguarde um momento.'});
app.use('/api',globalLimiter);

app.get('/health',(_,res)=>res.json({ok:true,service:'maria-sonia-ana-julia',provider:'veopag',webhook:'/webhooks/veopag',metaCapi:isMetaCapiConfigured()}));

async function dispatchMetaPurchase(externalReference){
  if(!isMetaCapiConfigured()){
    logError('meta_capi',{code:'META_CAPI_NOT_CONFIGURED'});
    return {sent:false,reason:'not_configured'};
  }
  let claimed;
  try{
    claimed=await claimMetaPurchase(externalReference);
    if(!claimed)return {sent:false,reason:'already_sent_or_claimed'};
    const result=await sendMetaPurchase(claimed);
    await markMetaPurchaseSent(externalReference,{eventId:result.eventId,response:result.response});
    console.log('meta_purchase_sent',{externalReference,eventId:result.eventId,eventsReceived:result.response?.events_received});
    return {sent:true,eventId:result.eventId};
  }catch(error){
    try{await markMetaPurchaseFailed(externalReference,error);}catch(dbError){logError('meta_capi_mark_failed',dbError,{externalReference});}
    logError('meta_capi',error,{externalReference});
    return {sent:false,reason:'send_failed'};
  }
}

async function veopagWebhookHandler(req,res){
  try{
    const raw=Buffer.isBuffer(req.body)?req.body.toString('utf8'):String(req.body||'');
    if(!verifyVeoPagWebhook(req,raw))return res.status(401).json({error:'Não autorizado.'});
    const event=JSON.parse(raw);
    if(String(event?.type||'')!=='Deposit')return res.sendStatus(204);
    const externalReference=String(event?.external_id||'');
    const transactionId=String(event?.transaction_id||'');
    const status=mapStatus(event?.status);
    if(!externalReference||!transactionId)return res.status(400).json({error:'Webhook inválido.'});

    const eventId=`${transactionId}:${String(event?.status||'UNKNOWN').toUpperCase()}`;
    const registration=await registerWebhookEvent({eventId,eventType:`Deposit.${event?.status||'UNKNOWN'}`,payload:event});
    // Mesmo em retry/duplicata, reaplica a atualização idempotente.
    // Isso evita perder a confirmação caso uma tentativa anterior tenha registrado
    // o webhook, mas falhado antes de atualizar a doação ou enviar a CAPI.
    if(registration.duplicate){
      console.log('veopag_webhook_duplicate_retry',{externalReference,transactionId,status});
    }

    const patch={
      status,
      provider:'veopag',
      provider_transaction_id:transactionId,
      fee_cents:event?.fee==null?null:Math.round(Number(event.fee)*100),
      provider_payload:event,
      updated_at:new Date().toISOString()
    };
    if(status==='COMPLETED')patch.paid_at=event?.updated_at||new Date().toISOString();
    await updateDonation(externalReference,patch);
    if(status==='COMPLETED')await dispatchMetaPurchase(externalReference);
    return res.sendStatus(204);
  }catch(error){
    logError('veopag_webhook',error);
    return res.status(400).json({error:'Webhook inválido.'});
  }
}
app.post('/webhooks/veopag',express.raw({type:'application/json',limit:'256kb'}),veopagWebhookHandler);
app.post('/api/webhooks/veopag',express.raw({type:'application/json',limit:'256kb'}),veopagWebhookHandler);

app.use(express.json({limit:'32kb',strict:true}));

app.post('/api/donations/create',createLimiter,requireJson,requireAllowedOrigin,async(req,res)=>{
  const requestId=crypto.randomUUID();
  try{
    if(req.body?.website)return res.status(400).json({error:'Solicitação inválida.'});
    const amount=Number(req.body?.amount);
    if(!allowedAmounts.includes(amount))return res.status(422).json({error:'Valor de doação inválido.'});
    if(!process.env.VEOPAG_CLIENT_ID||!process.env.VEOPAG_CLIENT_SECRET)return res.status(503).json({error:'Pagamento temporariamente indisponível.'});
    const turnstileOk=await verifyTurnstile(req.body?.turnstileToken,req.ip);
    if(!turnstileOk)return res.status(403).json({error:'Não foi possível validar a solicitação. Atualize a página e tente novamente.'});

    const useTestPayers=!production&&String(process.env.USE_TEST_PAYERS||'false').toLowerCase()==='true';
    const submittedName=cleanText(req.body?.name,100);
    const testPayer=useTestPayers?await getRandomTestPayer():null;
    const payer=testPayer
      ?{name:testPayer.full_name,email:testPayer.email,phone:testPayer.phone,document:testPayer.cpf}
      :{
        name:submittedName||process.env.VEOPAG_DEFAULT_PAYER_NAME||'Pagamento Digital',
        email:process.env.VEOPAG_DEFAULT_PAYER_EMAIL||'noreply@pagamento.digital',
        document:process.env.VEOPAG_DEFAULT_PAYER_DOCUMENT||'',
        phone:process.env.VEOPAG_DEFAULT_PAYER_PHONE||undefined
      };
    if(!payer.document)throw new Error('VEOPAG_DEFAULT_PAYER_DOCUMENT_MISSING');
    const externalId=`amor_${Date.now()}_${crypto.randomBytes(12).toString('hex')}`;
    const callbackUrl=String(process.env.VEOPAG_WEBHOOK_URL||'').trim()||undefined;
    const transaction=await createPix({amount,payer,externalReference:externalId,callbackUrl,tracking:safeTracking(req.body)});
    const pixCode=transaction.pixCode;
    const qrImage=await QRCode.toDataURL(pixCode,{margin:1,width:640,errorCorrectionLevel:'M'});
    await insertDonation({
      external_reference:externalId,provider:'veopag',provider_transaction_id:transaction.transactionId,
      amount_cents:Math.round(amount*100),fee_cents:transaction.fee==null?null:Math.round(transaction.fee*100),
      status:mapStatus(transaction.status),donor_name:payer.name||null,
      donor_email:payer.email||null,donor_phone:payer.phone||null,donor_document:payer.document||null,
      show_public:!useTestPayers&&Boolean(submittedName)&&req.body?.showPublic===true,pix_copy_paste:pixCode,
      metadata:{test_payer:useTestPayers,request_id:requestId,idempotent:transaction.idempotent},
      provider_payload:transaction.raw,...safeTracking(req.body),
      fbp:cleanText(req.body?.fbp,255)||null,
      fbc:cleanText(req.body?.fbc,500)||null,
      client_ip_address:String(req.ip||'').replace(/^::ffff:/,'').slice(0,64)||null,
      client_user_agent:cleanText(req.get('user-agent'),1000)||null,
      event_source_url:cleanEventSourceUrl(req.body?.event_source_url),
      meta_event_id:externalId,
      created_at:new Date().toISOString(),updated_at:new Date().toISOString()
    });
    return res.json({externalId,amount,qrImage,pixCode,expiresAt:null});
  }catch(error){
    logError('create_donation',error,{requestId});
    return res.status(502).json({error:'Não foi possível gerar o PIX agora. Tente novamente em alguns instantes.',requestId});
  }
});

app.get('/api/donations/:id/status',statusLimiter,requireAllowedOrigin,async(req,res)=>{
  try{
    const id=String(req.params.id||'');
    if(!/^amor_\d+_[a-f0-9]{24}$/.test(id))return res.status(400).json({error:'Identificador inválido.'});
    const donation=await getDonation(id);
    if(!donation)return res.status(404).json({error:'Doação não encontrada.'});
    if(donation.status==='COMPLETED'&&!donation.meta_event_sent_at)dispatchMetaPurchase(id).catch(()=>{});
    return res.json({status:donation.status,amount:Number(donation.amount_cents||0)/100});
  }catch(error){logError('donation_status',error);return res.status(500).json({error:'Falha ao consultar pagamento.'});}
});

app.get('/api/campaign',async(_,res)=>{
  try{const goal=Number(process.env.CAMPAIGN_GOAL||130000);const initial=Number(process.env.CAMPAIGN_INITIAL_AMOUNT||27847);const raised=initial+await paidTotal();return res.json({goal,raised,percentage:Number(((raised/goal)*100).toFixed(1))});}
  catch(error){logError('campaign_total',error);return res.json({goal:130000,raised:27847,percentage:21.4});}
});
app.use((err,req,res,next)=>{if(err?.message==='CORS_BLOCKED')return res.status(403).json({error:'Origem não autorizada.'});if(err instanceof SyntaxError)return res.status(400).json({error:'JSON inválido.'});next(err);});
app.use((_,res)=>res.status(404).json({error:'Rota não encontrada.'}));


function memoryRateLimit({windowMs,limit,message}){
  const hits=new Map();
  const timer=setInterval(()=>{const now=Date.now();for(const[k,v]of hits)if(v.reset<=now)hits.delete(k);},Math.min(windowMs,60_000));
  timer.unref?.();
  return(req,res,next)=>{
    const key=String(req.ip||req.socket?.remoteAddress||'unknown');
    const now=Date.now();
    let entry=hits.get(key);
    if(!entry||entry.reset<=now)entry={count:0,reset:now+windowMs};
    entry.count+=1;hits.set(key,entry);
    res.setHeader('RateLimit-Limit',String(limit));
    res.setHeader('RateLimit-Remaining',String(Math.max(0,limit-entry.count)));
    res.setHeader('RateLimit-Reset',String(Math.ceil(entry.reset/1000)));
    if(entry.count>limit){res.setHeader('Retry-After',String(Math.ceil((entry.reset-now)/1000)));return res.status(429).json({error:message});}
    next();
  };
}

function requireJson(req,res,next){if(!req.is('application/json'))return res.status(415).json({error:'Formato não suportado.'});next();}
function requireAllowedOrigin(req,res,next){const origin=String(req.get('origin')||'').replace(/\/$/,'');if(!origin||!origins.includes(origin))return res.status(403).json({error:'Origem não autorizada.'});next();}
function cleanText(value,max){return String(value||'').replace(/[<>\u0000-\u001F]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
function cleanEventSourceUrl(value){try{const url=new URL(String(value||process.env.META_EVENT_SOURCE_URL||''));if(!['https:','http:'].includes(url.protocol))return null;return `${url.origin}${url.pathname}`.slice(0,1000);}catch{return String(process.env.META_EVENT_SOURCE_URL||'').trim()||null;}}
function safeTracking(body={}){const out={};for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','ttclid'])out[k]=cleanText(body[k],200)||null;return out;}
async function verifyTurnstile(token,ip){
  const enabled=String(process.env.TURNSTILE_ENABLED||'false').toLowerCase()==='true';
  if(!enabled)return true;
  if(!process.env.TURNSTILE_SECRET_KEY||!token)return false;
  try{const form=new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:String(token),remoteip:String(ip||'')});const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form,signal:AbortSignal.timeout(8000)});const data=await response.json();return data?.success===true;}catch{return false;}
}
function mapStatus(value){const status=String(value||'').toUpperCase();if(['PAID','APPROVED','COMPLETED','TRANSACTION.PAID','PAYMENT.PAID'].some(x=>status.includes(x)))return'COMPLETED';if(['FAILED','EXPIRED','CANCELED','CANCELLED','REFUNDED','CHARGEBACK'].some(x=>status.includes(x)))return'FAILED';return'PENDING';}
function verifyVeoPagWebhook(req,raw){
  try{
    const expectedCallbackToken=String(process.env.VEOPAG_CALLBACK_TOKEN||'');
    if(expectedCallbackToken){
      const authorization=String(req.get('Authorization')||'');
      const receivedToken=authorization.startsWith('Bearer ')?authorization.slice(7):'';
      if(!timingSafeStringEqual(expectedCallbackToken,receivedToken))return false;
    }

    const secret=String(process.env.VEOPAG_WEBHOOK_SIGNATURE||'');
    if(!secret)return Boolean(expectedCallbackToken);
    const timestamp=Number(req.get('X-Webhook-Timestamp'));
    const received=String(req.get('X-Webhook-Signature')||'');
    if(!timestamp||!received||Math.abs(Math.floor(Date.now()/1000)-timestamp)>300)return false;
    const expected=crypto.createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex');
    return timingSafeStringEqual(expected,received);
  }catch{return false;}
}
function timingSafeStringEqual(a,b){
  const x=Buffer.from(String(a||''),'utf8');
  const y=Buffer.from(String(b||''),'utf8');
  return x.length===y.length&&crypto.timingSafeEqual(x,y);
}
function logError(scope,error,extra={}){
  console.error(scope,{
    ...extra,
    name:error?.name||'Error',
    code:error?.code||'unknown',
    status:error?.status||error?.response?.status||undefined,
    message:String(error?.message||'').slice(0,1000),
    providerCode:error?.response?.error?.code||error?.response?.code||undefined,
    providerMessage:error?.response?.error?.message||error?.response?.message||undefined
  });
}
async function reconcilePendingDonations(){
  try{
    const pending=await getPendingDonations();
    for(const donation of pending){
      try{
        const remote=await getDeposit(donation.external_reference);
        const status=mapStatus(remote?.status);
        if(status===donation.status)continue;
        const patch={
          status,
          provider_transaction_id:remote?.transaction_id||remote?.transactionId||undefined,
          fee_cents:remote?.fee==null?undefined:Math.round(Number(remote.fee)*100),
          provider_payload:remote,
          updated_at:new Date().toISOString()
        };
        Object.keys(patch).forEach((key)=>patch[key]===undefined&&delete patch[key]);
        if(status==='COMPLETED')patch.paid_at=remote?.updated_at||new Date().toISOString();
        await updateDonation(donation.external_reference,patch);
        if(status==='COMPLETED')await dispatchMetaPurchase(donation.external_reference);
      }catch(error){logError('reconcile_item',error,{externalReference:donation.external_reference});}
    }
  }catch(error){logError('reconcile_pending',error);}
}
const reconciliationTimer=setInterval(reconcilePendingDonations,Number(process.env.VEOPAG_RECONCILE_INTERVAL_MS||300000));
reconciliationTimer.unref?.();
setTimeout(reconcilePendingDonations,15000).unref?.();

app.listen(process.env.PORT||10000,()=>console.log(`Backend Maria Sônia e Ana Júlia ativo na porta ${process.env.PORT||10000}`));
