import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
}

export const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function createDonation(row) {
  const { data, error } = await db.from('donations').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateDonationByExternalId(externalId, patch) {
  const { data, error } = await db
    .from('donations')
    .update(patch)
    .eq('external_id', externalId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function findDonation(externalId) {
  const { data, error } = await db
    .from('donations')
    .select('*')
    .eq('external_id', externalId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findDonationByGenerationKey(generationKey) {
  const { data, error } = await db
    .from('donations')
    .select('*')
    .eq('generation_key', generationKey)
    .in('status', ['CREATING', 'PENDING'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function countRecentGenerations(requesterHash, sinceIso) {
  const { count, error } = await db
    .from('donations')
    .select('id', { count: 'exact', head: true })
    .eq('requester_hash', requesterHash)
    .gte('created_at', sinceIso);
  if (error) throw error;
  return Number(count || 0);
}

export async function claimPaymentProfile() {
  const { data, error } = await db.rpc('claim_payment_profile');
  if (error) throw error;
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}

export async function saveGenerationAudit(row) {
  const { error } = await db.from('payment_generation_audit').insert(row);
  if (error) throw error;
}

export async function saveWebhookEvent(event) {
  const transaction = event?.data || {};
  const { error } = await db.from('webhook_events').insert({
    event_id: event.id,
    event_type: event.type,
    transaction_id: transaction.id,
    external_id: transaction.external_reference ?? null,
    status: transaction.status || event.type,
    payload: event,
  });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

export async function getCampaignSummary(initialAmount, goal, displayPercentage = 20) {
  const { data, error } = await db
    .from('donations')
    .select('amount')
    .eq('status', 'COMPLETED');
  if (error) throw error;
  const newTotal = (data ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const raised = initialAmount + newTotal;
  return {
    raised,
    goal,
    percentage: Math.max(0, Math.min(100, Number(displayPercentage) || 20)),
    calculatedPercentage: goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0,
  };
}

export async function getPublicSupporters(limit = 12) {
  const { data, error } = await db
    .from('donations')
    .select('public_name,amount,paid_at')
    .eq('status', 'COMPLETED')
    .eq('show_public', true)
    .eq('display_mode', 'supporter')
    .not('public_name', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}


export async function getRecentConfirmedActivity(limit = 20) {
  const { data, error } = await db
    .from('donations')
    .select('public_name,show_public,display_mode,amount,paid_at')
    .eq('status', 'COMPLETED')
    .eq('display_mode', 'popup')
    .order('paid_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((item) => ({
    public_name: item.show_public && item.public_name ? item.public_name : 'Uma pessoa',
    amount: Number(item.amount || 0),
    paid_at: item.paid_at,
  }));
}


export async function getSupporterLikeStatuses(supporterKeys, voterHash) {
  const keys = [...new Set(
    (supporterKeys ?? [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .slice(0, 30)
  )];

  if (keys.length === 0) return [];

  const [totalsResult, votesResult] = await Promise.all([
    db
      .from('supporter_like_totals')
      .select('supporter_key,like_count')
      .in('supporter_key', keys),
    db
      .from('supporter_like_votes')
      .select('supporter_key')
      .eq('voter_hash', voterHash)
      .in('supporter_key', keys),
  ]);

  if (totalsResult.error) throw totalsResult.error;
  if (votesResult.error) throw votesResult.error;

  const totals = new Map(
    (totalsResult.data ?? []).map((item) => [
      item.supporter_key,
      Math.max(0, Math.min(50, Number(item.like_count || 0))),
    ])
  );

  const likedKeys = new Set(
    (votesResult.data ?? []).map((item) => item.supporter_key)
  );

  return keys.map((supporterKey) => ({
    supporterKey,
    count: totals.get(supporterKey) ?? 0,
    liked: likedKeys.has(supporterKey),
  }));
}

export async function setSupporterLike(supporterKey, voterHash, liked) {
  const { data, error } = await db.rpc('set_supporter_like', {
    p_supporter_key: String(supporterKey || '').trim(),
    p_voter_hash: String(voterHash || '').trim(),
    p_liked: Boolean(liked),
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;

  return {
    liked: Boolean(result?.liked),
    count: Math.max(0, Math.min(50, Number(result?.like_count || 0))),
    maxReached: Boolean(result?.max_reached),
  };
}

export async function getPendingForReconciliation() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from('donations')
    .select('external_id,status')
    .eq('status', 'PENDING')
    .lt('updated_at', cutoff)
    .limit(50);
  if (error) throw error;
  return data ?? [];
}
