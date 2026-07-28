import {createClient} from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
export const db=url&&key?createClient(url,key,{auth:{persistSession:false}}):null;
export async function insertDonation(row){if(!db)return row;const{data,error}=await db.from('donations').insert(row).select().single();if(error)throw error;return data}
export async function updateDonation(ref,patch){if(!db)return null;const{data,error}=await db.from('donations').update(patch).eq('external_reference',ref).select().maybeSingle();if(error)throw error;return data}
export async function getDonation(ref){if(!db)return null;const{data,error}=await db.from('donations').select('*').eq('external_reference',ref).maybeSingle();if(error)throw error;return data}
export async function paidTotal(){if(!db)return 0;const{data,error}=await db.from('donations').select('amount').eq('status','COMPLETED');if(error)throw error;return(data||[]).reduce((a,x)=>a+Number(x.amount||0),0)}
