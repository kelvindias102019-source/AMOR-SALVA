import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import {createPix} from './bravopay.js';
import {insertDonation,updateDonation,getDonation,paidTotal} from './database.js';

const app=express();
const origins=String(process.env.FRONTEND_ORIGINS||'')
  .split(',').map(x=>x.trim()).filter(Boolean);
const allowedAmounts=[10,20,30,50,70,100,150,200,300,500,700,1000,1500,2000];

app.use(helmet({crossOriginResourcePolicy:false}));
app.use(cors({origin:(origin,cb)=>!origin||origins.includes(origin)?cb(null,true):cb(new Error('Origem não permitida'))}));

app.get('/health',(_,res)=>res.json({ok:true,service:'amor-salva',provider:'bravopay',webhook:'/webhooks/bravopay'}));

async function bravoWebhookHandler(req,res){
  try{
    const raw=Buffer.isBuffer(req.body)?req.body.toString('utf8'):String(req.body||'');
    const signature=req.get('BravoPay-Signature')||req.get('X-Bravopay-Signature')||'';
    if(!verifyBravoSignature(raw,signature,process.env.BRAVOPAY_WEBHOOK_SECRET)){
      return res.status(401).json({error:'Assinatura inválida'});
    }

    const event=JSON.parse(raw);
    const transaction=event?.data?.transaction||event?.data||event?.transaction||event;
    const externalReference=transaction?.external_reference||transaction?.externalReference||null;

    if(externalReference){
      await updateDonation(externalReference,{
        status:mapStatus(transaction?.status||event?.type),
        provider_id:transaction?.id||transaction?.transaction_id||null,
        paid_at:transaction?.paid_at||transaction?.paidAt||null,
        updated_at:new Date().toISOString()
      });
    }

    return res.json({received:true});
  }catch(error){
    console.error('BravoPay webhook',error);
    return res.status(400).json({error:'Webhook inválido'});
  }
}

app.post('/webhooks/bravopay',express.raw({type:'application/json'}),bravoWebhookHandler);
// Alias mantido para compatibilidade com versões anteriores.
app.post('/api/webhooks/bravopay',express.raw({type:'application/json'}),bravoWebhookHandler);

app.use(express.json({limit:'200kb'}));

app.post('/api/donations/create',async(req,res)=>{
  try{
    const amount=Number(req.body.amount);
    if(!allowedAmounts.includes(amount)){
      return res.status(422).json({error:'Valor de doação inválido.'});
    }

    if(!process.env.BRAVOPAY_API_KEY){
      return res.status(503).json({error:'Pagamento ainda não configurado.'});
    }

    const name=String(req.body.name||'').trim().slice(0,100);
    const externalId=`amor_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const transaction=await createPix({
      amount,
      name,
      externalReference:externalId,
      tracking:req.body
    });

    const pixCode=transaction?.pix?.copy_paste||transaction?.pix?.copyPaste||transaction?.pix_code||null;
    if(!pixCode) throw new Error('A BravoPay não retornou o código PIX.');

    const qrImage=await QRCode.toDataURL(pixCode,{margin:1,width:640,errorCorrectionLevel:'M'});

    await insertDonation({
      external_reference:externalId,
      provider_id:transaction?.id||null,
      amount,
      status:mapStatus(transaction?.status),
      donor_name:name||null,
      show_public:Boolean(name)&&req.body.showPublic===true,
      created_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    });

    return res.json({
      externalId,
      amount,
      qrImage,
      pixCode,
      expiresAt:transaction?.pix?.expires_at||transaction?.pix?.expiresAt||null
    });
  }catch(error){
    console.error('Create donation',error);
    return res.status(502).json({error:error.message||'Não foi possível gerar o pagamento.'});
  }
});

app.get('/api/donations/:id/status',async(req,res)=>{
  try{
    const donation=await getDonation(req.params.id);
    if(!donation) return res.status(404).json({error:'Doação não encontrada.'});
    return res.json({status:donation.status,amount:donation.amount});
  }catch(error){
    console.error('Donation status',error);
    return res.status(500).json({error:'Falha ao consultar pagamento.'});
  }
});

app.get('/api/campaign',async(_,res)=>{
  try{
    const goal=Number(process.env.CAMPAIGN_GOAL||130000);
    const initial=Number(process.env.CAMPAIGN_INITIAL_AMOUNT||27847);
    const raised=initial+await paidTotal();
    return res.json({goal,raised,percentage:Number(((raised/goal)*100).toFixed(1))});
  }catch{
    return res.json({goal:130000,raised:27847,percentage:21.4});
  }
});

app.use((_,res)=>res.status(404).json({error:'Rota não encontrada.'}));

function mapStatus(value){
  const status=String(value||'').toUpperCase();
  if(['PAID','APPROVED','COMPLETED','TRANSACTION.PAID','PAYMENT.PAID'].some(x=>status.includes(x))) return 'COMPLETED';
  if(['FAILED','EXPIRED','CANCELED','CANCELLED','REFUNDED','CHARGEBACK'].some(x=>status.includes(x))) return 'FAILED';
  return 'PENDING';
}

function verifyBravoSignature(raw,header,secret){
  try{
    if(!secret||!header) return false;
    const parts=Object.fromEntries(header.split(',').map(part=>{
      const index=part.indexOf('=');
      return index===-1?[part.trim(),'']:[part.slice(0,index).trim(),part.slice(index+1).trim()];
    }));
    const timestamp=Number(parts.t);
    const received=parts.v1||'';
    if(!timestamp||!received||Math.abs(Date.now()/1000-timestamp)>300) return false;
    const expected=crypto.createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex');
    const a=Buffer.from(expected,'utf8');
    const b=Buffer.from(received,'utf8');
    return a.length===b.length&&crypto.timingSafeEqual(a,b);
  }catch{
    return false;
  }
}

app.listen(process.env.PORT||10000,()=>{
  console.log(`Amor Salva backend ativo na porta ${process.env.PORT||10000}`);
});
