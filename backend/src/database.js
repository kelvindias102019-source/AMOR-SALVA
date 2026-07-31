import {createClient} from '@supabase/supabase-js';

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;

export const db=url&&key
  ?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  :null;

// Tabela principal em português: public.pagamentos
export async function insertDonation(row){
  if(!db)throw new Error('DATABASE_NOT_CONFIGURED');
  const{data,error}=await db.from('pagamentos').insert(row).select().single();
  if(error)throw error;
  return data;
}

export async function updateDonation(ref,patch){
  if(!db)return null;
  const{data,error}=await db
    .from('pagamentos')
    .update(patch)
    .eq('external_reference',ref)
    .select()
    .maybeSingle();
  if(error)throw error;
  return data;
}

export async function getDonation(ref){
  if(!db)return null;
  const{data,error}=await db
    .from('pagamentos')
    .select('external_reference,status,amount_cents,paid_at,pix_expires_at')
    .eq('external_reference',ref)
    .maybeSingle();
  if(error)throw error;
  return data;
}

export async function paidTotal(){
  if(!db)return 0;

  // A função SQL foi mantida com este nome para preservar compatibilidade.
  const{data,error}=await db.rpc('get_paid_donation_total');
  if(!error)return Number(data||0)/100;

  const fallback=await db
    .from('pagamentos')
    .select('amount_cents')
    .eq('status','COMPLETED')
    .limit(10000);
  if(fallback.error)throw fallback.error;

  return(fallback.data||[]).reduce(
    (total,row)=>total+(Number(row.amount_cents||0)/100),
    0
  );
}

// Mantido apenas para ambiente de desenvolvimento legado.
// Em produção, USE_TEST_PAYERS deve permanecer false.
export async function getRandomTestPayer(){
  if(!db)throw new Error('DATABASE_NOT_CONFIGURED');
  const{data,error}=await db.rpc('get_random_test_payer');
  if(error)throw error;
  const payer=Array.isArray(data)?data[0]:data;
  if(!payer)throw new Error('TEST_PAYER_NOT_FOUND');
  return payer;
}

// Tabela exclusiva em português: public.eventos_webhook_veopag
export async function registerWebhookEvent({eventId,eventType,payload}){
  if(!db)return {duplicate:false};

  const providerEvent=payload?.provider_event||{};
  const verified=payload?.verified_status||{};

  const transactionId=
    verified?.transactionId||
    verified?.transaction_id||
    verified?.id||
    providerEvent?.transactionId||
    providerEvent?.transaction_id||
    providerEvent?.id||
    null;

  const externalReference=
    verified?.external_id||
    verified?.externalId||
    verified?.external_reference||
    providerEvent?.external_id||
    providerEvent?.externalId||
    providerEvent?.external_reference||
    null;

  const status=String(
    verified?.status||providerEvent?.status||eventType||''
  ).toUpperCase()||null;

  const{error}=await db.from('eventos_webhook_veopag').insert({
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
