import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import {createPix} from './bravopay.js';
import {insertDonation,updateDonation,getDonation,paidTotal,getRandomTestPayer,registerWebhookEvent} from './database.js';

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

app.get('/health',(_,res)=>res.json({ok:true,service:'amor-salva'}));

async function bravoWebhookHandler(req,res){
  try{
    const raw=Buffer.isBuffer(req.body)?req.body.toString('utf8'):String(req.body||'');
    const signature=req.get('BravoPay-Signature')||req.get('X-Bravopay-Signature')||'';
    if(!verifyBravoSignature(raw,signature,process.env.BRAVOPAY_WEBHOOK_SECRET))return res.status(401).json({error:'Não autorizado.'});
    const event=JSON.parse(raw);
    const transaction=event?.data?.transaction||event?.data||event?.transaction||event;
    const externalReference=transaction?.external_reference||transaction?.externalReference||null;
    const timestamp=extractSignatureTimestamp(signature);
    const eventId=String(event?.id||event?.event_id||`${transaction?.id||externalReference||'unknown'}:${event?.type||transaction?.status||'event'}:${timestamp}`);
    const registration=await registerWebhookEvent({eventId,eventType:String(event?.type||transaction?.status||'unknown'),payload:event});
    if(registration.duplicate)return res.json({received:true,duplicate:true});
    if(externalReference){
      const patch={status:mapStatus(transaction?.status||event?.type),provider_transaction_id:transaction?.id||transaction?.transaction_id||null,updated_at:new Date().toISOString()};
      if(patch.status==='COMPLETED')patch.paid_at=transaction?.paid_at||transaction?.paidAt||new Date().toISOString();
      await updateDonation(externalReference,patch);
    }
    return res.json({received:true});
  }catch(error){
    logError('webhook',error);
    return res.status(400).json({error:'Webhook inválido.'});
  }
}
app.post('/webhooks/bravopay',express.raw({type:'application/json',limit:'256kb'}),bravoWebhookHandler);
app.post('/api/webhooks/bravopay',express.raw({type:'application/json',limit:'256kb'}),bravoWebhookHandler);

app.use(express.json({limit:'32kb',strict:true}));

app.post('/api/donations/create',createLimiter,requireJson,requireAllowedOrigin,async(req,res)=>{
  const requestId=crypto.randomUUID();
  try{
    if(req.body?.website)return res.status(400).json({error:'Solicitação inválida.'});
    const amount=Number(req.body?.amount);
    if(!allowedAmounts.includes(amount))return res.status(422).json({error:'Valor de doação inválido.'});
    if(!process.env.BRAVOPAY_API_KEY)return res.status(503).json({error:'Pagamento temporariamente indisponível.'});
    const turnstileOk=await verifyTurnstile(req.body?.turnstileToken,req.ip);
    if(!turnstileOk)return res.status(403).json({error:'Não foi possível validar a solicitação. Atualize a página e tente novamente.'});

    const useTestPayers=!production&&String(process.env.USE_TEST_PAYERS||'false').toLowerCase()==='true';
    const submittedName=cleanText(req.body?.name,100);
    const testPayer=useTestPayers?await getRandomTestPayer():null;
    const customer=testPayer?{name:testPayer.full_name,email:testPayer.email,phone:testPayer.phone,cpf:testPayer.cpf}:{name:submittedName||'Doador anônimo'};
    const externalId=`amor_${Date.now()}_${crypto.randomBytes(12).toString('hex')}`;
    const transaction=await createPix({amount,customer,externalReference:externalId,tracking:safeTracking(req.body)});
    const pixCode=transaction?.pix?.copy_paste||transaction?.pix?.copyPaste||transaction?.pix_code||null;
    if(!pixCode)throw new Error('PIX_CODE_MISSING');
    const qrImage=await QRCode.toDataURL(pixCode,{margin:1,width:640,errorCorrectionLevel:'M'});
    await insertDonation({
      external_reference:externalId,provider:'bravopay',provider_transaction_id:transaction?.id||null,
      amount_cents:Math.round(amount*100),status:mapStatus(transaction?.status),donor_name:customer.name||null,
      donor_email:customer.email||null,donor_phone:customer.phone||null,donor_document:customer.cpf||null,
      show_public:!useTestPayers&&Boolean(submittedName)&&req.body?.showPublic===true,pix_copy_paste:pixCode,
      pix_expires_at:transaction?.pix?.expires_at||transaction?.pix?.expiresAt||null,
      metadata:{test_payer:useTestPayers,request_id:requestId},...safeTracking(req.body),
      created_at:new Date().toISOString(),updated_at:new Date().toISOString()
    });
    return res.json({externalId,amount,qrImage,pixCode,expiresAt:transaction?.pix?.expires_at||transaction?.pix?.expiresAt||null});
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
function safeTracking(body={}){const out={};for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','ttclid'])out[k]=cleanText(body[k],200)||null;return out;}
async function verifyTurnstile(token,ip){
  const enabled=String(process.env.TURNSTILE_ENABLED||'false').toLowerCase()==='true';
  if(!enabled)return true;
  if(!process.env.TURNSTILE_SECRET_KEY||!token)return false;
  try{const form=new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:String(token),remoteip:String(ip||'')});const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form,signal:AbortSignal.timeout(8000)});const data=await response.json();return data?.success===true;}catch{return false;}
}
function mapStatus(value){const status=String(value||'').toUpperCase();if(['PAID','APPROVED','COMPLETED','TRANSACTION.PAID','PAYMENT.PAID'].some(x=>status.includes(x)))return'COMPLETED';if(['FAILED','EXPIRED','CANCELED','CANCELLED','REFUNDED','CHARGEBACK'].some(x=>status.includes(x)))return'FAILED';return'PENDING';}
function extractSignatureTimestamp(header){const match=String(header||'').match(/(?:^|,)\s*t=(\d+)/);return match?Number(match[1]):0;}
function verifyBravoSignature(raw,header,secret){try{if(!secret||!header)return false;const parts=Object.fromEntries(header.split(',').map(part=>{const i=part.indexOf('=');return i===-1?[part.trim(),'']:[part.slice(0,i).trim(),part.slice(i+1).trim()]}));const timestamp=Number(parts.t);const received=parts.v1||'';if(!timestamp||!received||Math.abs(Date.now()/1000-timestamp)>300)return false;const expected=crypto.createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex');const a=Buffer.from(expected,'utf8');const b=Buffer.from(received,'utf8');return a.length===b.length&&crypto.timingSafeEqual(a,b);}catch{return false;}}
function logError(scope,error,extra={}){console.error(scope,{...extra,name:error?.name||'Error',code:error?.code||error?.message||'unknown',status:error?.status||undefined});}
app.listen(process.env.PORT||10000,()=>console.log(`Amor Salva backend ativo na porta ${process.env.PORT||10000}`));
