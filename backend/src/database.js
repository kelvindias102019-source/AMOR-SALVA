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
  const{data,error}=await db.from('donations').update(patch).eq('external_reference',ref).select().maybeSingle();
  if(error)throw error;
  return data;
}

export async function getDonation(ref){
  if(!db)return null;
  const{data,error}=await db.from('donations')
    .select('external_reference,status,amount_cents,paid_at,pix_expires_at')
    .eq('external_reference',ref).maybeSingle();
  if(error)throw error;
  return data;
}

export async function paidTotal(){
  if(!db)return 0;
  const{data,error}=await db.rpc('get_paid_donation_total');
  if(!error)return Number(data||0)/100;
  const fallback=await db.from('donations').select('amount_cents').eq('status','COMPLETED').limit(10000);
  if(fallback.error)throw fallback.error;
  return(fallback.data||[]).reduce((total,row)=>total+(Number(row.amount_cents||0)/100),0);
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
  const{error}=await db.from('webhook_events').insert({
    provider:'bravopay',provider_event_id:eventId,event_type:eventType,payload
  });
  if(error?.code==='23505')return {duplicate:true};
  if(error)throw error;
  return {duplicate:false};
}
