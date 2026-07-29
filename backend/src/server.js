import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import QRCode from 'qrcode';
import { z } from 'zod';
import {
  createDonation,
  findDonation,
  claimPaymentProfile,
  countRecentGenerations,
  findDonationByGenerationKey,
  getCampaignSummary,
  getPendingForReconciliation,
  getPublicSupporters,
  getRecentConfirmedActivity,
  getSupporterLikeStatuses,
  saveGenerationAudit,
  saveWebhookEvent,
  setSupporterLike,
  updateDonationByExternalId,
} from './database.js';
import { createPixTransaction, queryPixTransaction, readableBravoPayError, normalizeBravoPayStatus } from './bravopay.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const appVersion = 'sonia-bravopay-2026-07-27-v2';
const port = Number(process.env.PORT || 10000);
const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const allowedFrontendOrigins = String(process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
const campaignGoal = Number(process.env.CAMPAIGN_GOAL || 35000);
const campaignDisplayPercentage = 20;
const campaignInitialAmount = Number(process.env.CAMPAIGN_INITIAL_AMOUNT || 3500);
const allowedAmounts = Object.freeze([5, 20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500, 2000]);
const allowedStatuses = new Set(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CHARGEBACK']);
const statusCheckCache = new Map();
const generationWindowMs = 10 * 60 * 1000;
const generationLimitPerWindow = 5;
const auditHashSecret = process.env.AUDIT_HASH_SECRET || process.env.BRAVOPAY_WEBHOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function hashAuditValue(value) {
  return crypto.createHmac('sha256', auditHashSecret).update(String(value || '')).digest('hex');
}

function getRequesterHash(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
  return hashAuditValue(`ip:${ip}`);
}

function getLikeVoterHash(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';
  return hashAuditValue(`supporter-like:${ip}:${userAgent}`);
}

function getGenerationKey(requesterHash, amount) {
  const bucket = Math.floor(Date.now() / generationWindowMs);
  return hashAuditValue(`pix:${requesterHash}:${amount}:${bucket}`);
}

async function buildPixResponse(donation, reused = false) {
  if (!donation?.qrcode_emv) return null;
  const qrImage = await QRCode.toDataURL(donation.qrcode_emv, {
    width: 340,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  return {
    externalId: donation.external_id,
    transactionId: donation.transaction_id,
    status: donation.status,
    amount: Number(donation.amount),
    pixCode: donation.qrcode_emv,
    qrImage,
    reused,
  };
}

async function writeAuditSafe(row) {
  try {
    await saveGenerationAudit(row);
  } catch (error) {
    console.error('Falha ao registrar auditoria:', error.message);
  }
}

if (!publicBaseUrl.startsWith('https://')) {
  console.warn('PUBLIC_BASE_URL deve ser uma URL HTTPS pública para o webhook funcionar.');
}

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://www.facebook.com'],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://connect.facebook.net'],
      connectSrc: ["'self'", 'https://www.facebook.com', 'https://connect.facebook.net'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));
app.use(compression());

// Permite que somente o frontend publicado na Vercel consuma a API.
app.use((req, res, next) => {
  const origin = req.get('origin');

  if (origin && allowedFrontendOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    if (!origin || !allowedFrontendOrigins.includes(origin)) {
      return res.status(403).end();
    }
    return res.status(204).end();
  }

  return next();
});

function safeEqualHex(a, b) {
  try {
    const first = Buffer.from(String(a || ''), 'hex');
    const second = Buffer.from(String(b || ''), 'hex');
    return first.length > 0 && first.length === second.length && crypto.timingSafeEqual(first, second);
  } catch {
    return false;
  }
}

function validateBravoPayWebhook(rawBody, headerValue) {
  const secret = String(process.env.BRAVOPAY_WEBHOOK_SECRET || '').trim();
  if (!secret || !headerValue) return false;

  const parts = Object.fromEntries(
    String(headerValue)
      .split(',')
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value)
  );

  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return safeEqualHex(parts.v1, expected);
}

app.post('/api/webhooks/bravopay', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
  const rawBody = req.body.toString('utf8');
  const signature = req.header('BravoPay-Signature') || req.header('X-Bravopay-Signature') || '';

  if (!validateBravoPayWebhook(rawBody, signature)) {
    return res.status(401).json({ error: 'Assinatura do webhook inválida.' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'JSON inválido.' });
  }

  const transactionEvents = new Set([
    'transaction.created',
    'transaction.paid',
    'transaction.refunded',
    'transaction.chargeback',
    'transaction.expired',
    'transaction.failed',
  ]);

  if (!event?.id || !transactionEvents.has(event.type) || !event?.data?.id) {
    return res.status(200).json({ ignored: true });
  }

  try {
    const isNew = await saveWebhookEvent(event);
    if (!isNew) return res.status(200).json({ duplicate: true });

    const transaction = event.data;
    const externalId = transaction.external_reference;
    if (!externalId) return res.status(200).json({ ignored: true, reason: 'missing_external_reference' });

    const status = normalizeBravoPayStatus(transaction.status);
    const patch = {
      transaction_id: transaction.id,
      status,
      fee: transaction.fee_cents == null ? null : Number(transaction.fee_cents) / 100,
      gateway_payload: event,
    };

    if (status === 'COMPLETED') patch.paid_at = transaction.paid_at || new Date().toISOString();
    if (['COMPLETED', 'FAILED', 'REFUNDED', 'CHARGEBACK'].includes(status)) patch.generation_key = null;

    await updateDonationByExternalId(externalId, patch);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Falha no webhook BravoPay:', error);
    return res.status(500).json({ error: 'Falha interna.' });
  }
});

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false }));

const donationSchema = z.object({
  amount: z.coerce.number().refine((value) => allowedAmounts.includes(value), 'Valor não permitido.'),
  name: z.string().trim().max(100).optional().default(''),
  showPublic: z.boolean().optional().default(false),
  utm_source: z.string().max(255).optional(),
  utm_medium: z.string().max(64).optional(),
  utm_campaign: z.string().max(255).optional(),
  utm_content: z.string().max(255).optional(),
  utm_term: z.string().max(255).optional(),
  fbclid: z.string().max(500).optional(),
  gclid: z.string().max(500).optional(),
  ttclid: z.string().max(500).optional(),
}).superRefine((value, ctx) => {
  if (value.showPublic && value.name.length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['name'], message: 'Informe seu nome para aparecer nos apoiadores.' });
  }
});

function publicFirstName(name) {
  return name.trim().split(/\s+/)[0].slice(0, 40);
}

app.post('/api/donations/create', async (req, res) => {
  const parsed = donationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos.' });
  }

  const input = parsed.data;
  const requesterHash = getRequesterHash(req);
  const userAgentHash = hashAuditValue(`ua:${req.get('user-agent') || ''}`);
  const generationKey = getGenerationKey(requesterHash, input.amount);

  try {
    const reusable = await findDonationByGenerationKey(generationKey);
    if (reusable) {
      const response = await buildPixResponse(reusable, true);
      if (response) {
        await writeAuditSafe({
          event_type: 'REUSED',
          external_id: reusable.external_id,
          amount: input.amount,
          payment_profile_id: reusable.payment_profile_id,
          requester_hash: requesterHash,
          user_agent_hash: userAgentHash,
          details: { reason: 'same_ip_amount_window' },
        });
        return res.status(200).json(response);
      }
      return res.status(409).json({ error: 'Este PIX já está sendo gerado. Aguarde alguns segundos e tente novamente.' });
    }

    const sinceIso = new Date(Date.now() - generationWindowMs).toISOString();
    const recentCount = await countRecentGenerations(requesterHash, sinceIso);
    if (recentCount >= generationLimitPerWindow) {
      await writeAuditSafe({
        event_type: 'BLOCKED',
        external_id: null,
        amount: input.amount,
        payment_profile_id: null,
        requester_hash: requesterHash,
        user_agent_hash: userAgentHash,
        details: { reason: 'rate_limit', recentCount },
      });
      return res.status(429).json({ error: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de gerar outro PIX.' });
    }

    const paymentProfile = await claimPaymentProfile();
    if (!paymentProfile) {
      return res.status(503).json({ error: 'Nenhum perfil de pagamento está ativo no Supabase.' });
    }

    const externalId = `sonia-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    try {
      await createDonation({
        external_id: externalId,
        amount: input.amount,
        status: 'CREATING',
        donor_name: input.name || null,
        donor_email: null,
        donor_document_last4: null,
        public_name: input.showPublic && input.name ? publicFirstName(input.name) : null,
        show_public: input.showPublic,
        payment_profile_id: paymentProfile.id,
        requester_hash: requesterHash,
        generation_key: generationKey,
        utm_source: input.utm_source || null,
        utm_medium: input.utm_medium || null,
        utm_campaign: input.utm_campaign || null,
        utm_content: input.utm_content || null,
        utm_term: input.utm_term || null,
      });
    } catch (error) {
      if (error.code === '23505') {
        const concurrent = await findDonationByGenerationKey(generationKey);
        const response = await buildPixResponse(concurrent, true);
        if (response) return res.status(200).json(response);
        return res.status(409).json({ error: 'Este PIX já está sendo gerado. Aguarde alguns segundos e tente novamente.' });
      }
      throw error;
    }

    try {
      const deposit = await createPixTransaction({
        amount: input.amount,
        externalReference: externalId,
        customer: {
          name: paymentProfile.payer_name,
          email: paymentProfile.payer_email,
          document: paymentProfile.payer_document,
          phone: paymentProfile.payer_phone,
        },
        description: `Doação de R$ ${Number(input.amount).toFixed(2)} para a campanha da Sônia`,
        metadata: { campaign: 'sonia', source: 'landing_page' },
        utm: {
          source: input.utm_source,
          medium: input.utm_medium,
          campaign: input.utm_campaign,
          content: input.utm_content,
          term: input.utm_term,
          fbclid: input.fbclid,
          gclid: input.gclid,
          ttclid: input.ttclid,
        },
      });

      const updated = await updateDonationByExternalId(externalId, {
        transaction_id: deposit.transactionId,
        status: allowedStatuses.has(deposit.status) ? deposit.status : 'PENDING',
        fee: deposit.fee,
        qrcode_emv: deposit.qrcode,
        gateway_payload: deposit.raw,
      });

      await writeAuditSafe({
        event_type: 'CREATED',
        external_id: externalId,
        amount: input.amount,
        payment_profile_id: paymentProfile.id,
        requester_hash: requesterHash,
        user_agent_hash: userAgentHash,
        details: { profile_rotated: true },
      });

      const response = await buildPixResponse(updated, false);
      return res.status(201).json(response);
    } catch (error) {
      console.error('Erro ao criar doação:', error.response?.data || error);
      try {
        await updateDonationByExternalId(externalId, {
          status: 'FAILED',
          generation_key: null,
          gateway_payload: error.response?.data || { message: error.message },
        });
      } catch {}
      await writeAuditSafe({
        event_type: 'FAILED',
        external_id: externalId,
        amount: input.amount,
        payment_profile_id: paymentProfile.id,
        requester_hash: requesterHash,
        user_agent_hash: userAgentHash,
        details: { message: error.message },
      });
      const readable = readableBravoPayError(error);
      return res.status(readable.status).json({ error: readable.message });
    }
  } catch (error) {
    console.error('Erro na proteção de geração PIX:', error);
    return res.status(500).json({ error: 'Não foi possível iniciar o pagamento.' });
  }
});

async function refreshPendingStatus(donation) {
  if (!donation || donation.status !== 'PENDING') return donation;
  const lastCheck = statusCheckCache.get(donation.external_id) || 0;
  if (Date.now() - lastCheck < 10000) return donation;
  statusCheckCache.set(donation.external_id, Date.now());

  const gateway = await queryPixTransaction(donation.transaction_id);
  if (!gateway?.status || !allowedStatuses.has(gateway.status)) return donation;
  if (gateway.status === donation.status) return donation;

  return updateDonationByExternalId(donation.external_id, {
    status: gateway.status,
    ...((gateway.status === 'COMPLETED' || gateway.status === 'FAILED') ? { generation_key: null } : {}),
    fee: gateway.fee == null ? donation.fee : Number(gateway.fee),
    transaction_id: gateway.transactionId || donation.transaction_id,
    paid_at: gateway.status === 'COMPLETED' ? (gateway.paidAt || new Date().toISOString()) : donation.paid_at,
    gateway_payload: gateway,
  });
}

app.get('/api/donations/:externalId/status', async (req, res) => {
  try {
    let donation = await findDonation(req.params.externalId);
    if (!donation) return res.status(404).json({ error: 'Doação não encontrada.' });
    donation = await refreshPendingStatus(donation);
    return res.json({ status: donation.status, amount: Number(donation.amount), paidAt: donation.paid_at });
  } catch (error) {
    console.error('Erro ao consultar status:', error);
    return res.status(500).json({ error: 'Não foi possível consultar o pagamento.' });
  }
});

const supporterLikeStatusSchema = z.object({
  supporterKeys: z
    .array(z.string().trim().min(1).max(160))
    .max(30),
});

const supporterLikeActionSchema = z.object({
  supporterKey: z.string().trim().min(1).max(160),
  liked: z.boolean(),
});

app.post('/api/supporters/likes/status', async (req, res) => {
  const parsed = supporterLikeStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Lista de apoiadores inválida.' });
  }

  try {
    const voterHash = getLikeVoterHash(req);
    const supporters = await getSupporterLikeStatuses(
      parsed.data.supporterKeys,
      voterHash
    );

    return res.json({
      maxLikes: 50,
      supporters,
    });
  } catch (error) {
    console.error('Erro ao consultar curtidas dos apoiadores:', error);
    return res.status(500).json({ error: 'Não foi possível carregar as curtidas.' });
  }
});

app.post('/api/supporters/like', async (req, res) => {
  const parsed = supporterLikeActionSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Curtida inválida.' });
  }

  try {
    const voterHash = getLikeVoterHash(req);
    const result = await setSupporterLike(
      parsed.data.supporterKey,
      voterHash,
      parsed.data.liked
    );

    return res.json({
      supporterKey: parsed.data.supporterKey,
      liked: result.liked,
      count: result.count,
      maxLikes: 50,
      maxReached: result.maxReached,
    });
  } catch (error) {
    console.error('Erro ao atualizar curtida do apoiador:', error);
    return res.status(500).json({ error: 'Não foi possível atualizar a curtida.' });
  }
});

app.get('/api/campaign', async (_req, res) => {
  try {
    const [summary, supporters, recentActivity] = await Promise.all([
      getCampaignSummary(campaignInitialAmount, campaignGoal, campaignDisplayPercentage),
      getPublicSupporters(),
      getRecentConfirmedActivity(20),
    ]);
    return res.json({ ...summary, percentage: summary.calculatedPercentage, supporters, recentActivity });
  } catch (error) {
    console.error('Erro no resumo da campanha:', error);
    return res.status(500).json({ error: 'Não foi possível carregar a campanha.' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, version: appVersion, gateway: 'bravopay' }));
app.get('/api/version', (_req, res) => res.json({
  ok: true,
  version: appVersion,
  gateway: 'bravopay',
  routes: [
    'POST /api/donations/create',
    'GET /api/donations/:externalId/status',
    'POST /api/webhooks/bravopay',
    'GET /api/campaign',
  ],
}));
app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

async function reconcilePending() {
  try {
    const pending = await getPendingForReconciliation();
    for (const row of pending) {
      try {
        const current = await findDonation(row.external_id);
        await refreshPendingStatus(current);
      } catch (error) {
        console.error(`Reconciliação falhou para ${row.external_id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Falha na reconciliação:', error);
  }
}

setInterval(reconcilePending, 5 * 60 * 1000).unref();
app.listen(port, () => {
  console.log(`Servidor BravoPay ${appVersion} rodando na porta ${port}`);
  console.log('Rota PIX ativa: POST /api/donations/create');
  console.log('Webhook ativo: POST /api/webhooks/bravopay');
});
