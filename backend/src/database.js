import {createClient} from '@supabase/supabase-js';

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;

export const db=url&&key
  ?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  :null;

export async function insertDonation(row){
  if(!db)throw new Error('DATABASE_NOT_CONFIGURED');
  const{data,error}=await db.from('donations').insert(row).select().single();
  if(error)throw error;
  return data;
}

export async function updateDonation(ref,patch){
  if(!db)return null;
  const{data,error}=await db.from('donations')
    .update(patch)
    .eq('external_reference',ref)
    .select()
    .maybeSingle();
  if(error)throw error;
  return data;
}

export async function getDonation(ref){
  if(!db)return null;
  const{data,error}=await db.from('donations')
    .select('*')
    .eq('external_reference',ref)
    .maybeSingle();
  if(error)throw error;
  return data;
}

export async function getPendingDonations(){
  if(!db)return [];
  const cutoff=new Date(Date.now()-10*60_000).toISOString();
  const{data,error}=await db.from('donations')
    .select('external_reference,status,updated_at')
    .eq('provider','veopag')
    .in('status',['PENDING','PROCESSING','QUEUE'])
    .lt('updated_at',cutoff)
    .order('updated_at',{ascending:true})
    .limit(50);
  if(error)throw error;
  return data||[];
}

export async function paidTotal(){
  if(!db)return 0;
  const{data,error}=await db.rpc('get_paid_donation_total');
  if(!error)return Number(data||0)/100;

  const fallback=await db.from('donations')
    .select('amount_cents')
    .eq('status','COMPLETED')
    .limit(10000);
  if(fallback.error)throw fallback.error;

  return(fallback.data||[]).reduce(
    (total,row)=>total+(Number(row.amount_cents||0)/100),
    0
  );
}

export async function getRandomTestPayer(){
  if(!db)throw new Error('DATABASE_NOT_CONFIGURED');
  const{data,error}=await db.rpc('get_random_test_payer');
  if(error)throw error;
  const payer=Array.isArray(data)?data[0]:data;
  if(!payer)throw new Error('TEST_PAYER_NOT_FOUND');
  return payer;
}

export async function registerWebhookEvent({eventId,eventType,payload}){
  if(!db)return {duplicate:false};

  const transactionId=
    payload?.transaction_id||
    payload?.transactionId||
    payload?.data?.transaction_id||
    payload?.data?.transactionId||
    null;

  const externalReference=
    payload?.external_id||
    payload?.external_reference||
    payload?.externalReference||
    payload?.data?.external_id||
    payload?.data?.external_reference||
    null;

  const status=String(
    payload?.status||payload?.data?.status||''
  ).toUpperCase()||null;

  const{error}=await db.from('veopag_webhook_events').insert({
    provider:'veopag',
    provider_event_id:eventId,
    transaction_id:transactionId,
    external_reference:externalReference,
    event_type:eventType,
    status,
    signature_valid:true,
    payload,
    processed_at:new Date().toISOString()
  });

  if(error?.code==='23505')return {duplicate:true};
  if(error)throw error;
  return {duplicate:false};
}

export async function claimMetaPurchase(externalReference){
  if(!db)return null;
  const reference=String(externalReference||'');
  const donation=await getDonation(reference);
  if(!donation||donation.status!=='COMPLETED'||donation.meta_event_sent_at)return null;

  const lastAttempt=donation.meta_event_last_attempt_at
    ?Date.parse(donation.meta_event_last_attempt_at)
    :0;
  const staleProcessing=donation.meta_event_status==='PROCESSING'&&
    (!Number.isFinite(lastAttempt)||lastAttempt<Date.now()-10*60_000);
  const canClaim=!donation.meta_event_status||
    donation.meta_event_status==='PENDING'||
    donation.meta_event_status==='FAILED'||
    staleProcessing;
  if(!canClaim)return null;

  const{data,error}=await db.from('donations')
    .update({
      meta_event_id:donation.meta_event_id||reference,
      meta_event_status:'PROCESSING',
      meta_event_attempts:Number(donation.meta_event_attempts||0)+1,
      meta_event_last_attempt_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    })
    .eq('external_reference',reference)
    .eq('status','COMPLETED')
    .eq('meta_event_attempts',Number(donation.meta_event_attempts||0))
    .is('meta_event_sent_at',null)
    .select('*')
    .maybeSingle();
  if(error)throw error;
  return data||null;
}

export async function markMetaPurchaseSent(externalReference,{eventId,response}){
  if(!db)return null;
  const{data,error}=await db.from('donations')
    .update({
      meta_event_id:eventId,
      meta_event_status:'SENT',
      meta_event_sent_at:new Date().toISOString(),
      meta_event_response:response||{},
      meta_event_error:null,
      updated_at:new Date().toISOString()
    })
    .eq('external_reference',externalReference)
    .select()
    .maybeSingle();
  if(error)throw error;
  return data;
}

export async function markMetaPurchaseFailed(externalReference,error){
  if(!db)return null;
  const details={
    name:error?.name||'Error',
    code:error?.code||null,
    status:error?.status||null,
    message:String(error?.message||'META_CAPI_ERROR').slice(0,1000),
    response:error?.response||null
  };
  const{data, error:dbError}=await db.from('donations')
    .update({
      meta_event_status:'FAILED',
      meta_event_error:details,
      updated_at:new Date().toISOString()
    })
    .eq('external_reference',externalReference)
    .select()
    .maybeSingle();
  if(dbError)throw dbError;
  return data;
}
