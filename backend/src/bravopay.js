import axios from 'axios';

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

const api = axios.create({
  baseURL: String(process.env.BRAVOPAY_API_URL || 'https://bravopay.club/api/v1').replace(/\/$/, ''),
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${required('BRAVOPAY_API_KEY')}`,
    ...extra,
  };
}

function normalizeStatus(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PAID') return 'COMPLETED';
  if (normalized === 'PENDING' || normalized === 'PROCESSING') return 'PENDING';
  if (normalized === 'REFUNDED') return 'REFUNDED';
  if (normalized === 'CHARGEBACK') return 'CHARGEBACK';
  if (normalized === 'EXPIRED' || normalized === 'FAILED') return 'FAILED';
  return 'PENDING';
}

function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

export async function createPixTransaction({
  amount,
  externalReference,
  customer,
  description,
  metadata,
  utm,
}) {
  const productId = String(process.env.BRAVOPAY_PRODUCT_ID || '').trim();
  const expiresIn = Number(process.env.BRAVOPAY_PIX_EXPIRES_IN || 3600);

  const payload = {
    amount_cents: Math.round(Number(amount) * 100),
    method: 'pix',
    customer: compactObject({
      email: customer?.email,
      name: customer?.name,
      cpf: customer?.document,
      phone: customer?.phone,
    }),
    description: String(description || 'Doação para a campanha da Sônia').slice(0, 300),
    external_reference: String(externalReference).slice(0, 120),
    metadata: compactObject(metadata),
    expires_in: Math.max(60, Math.min(86400, expiresIn)),
    utm: compactObject(utm),
    ...(productId ? { product_id: productId } : {}),
  };

  const { data } = await api.post('/transactions', payload, {
    headers: authHeaders({ 'Idempotency-Key': externalReference }),
  });

  const pixCode = data?.pix?.copy_paste || data?.pix?.qr_code;
  if (!data?.id || !pixCode) {
    throw new Error('A BravoPay não retornou uma cobrança PIX válida.');
  }

  return {
    transactionId: data.id,
    status: normalizeStatus(data.status),
    qrcode: pixCode,
    expiresAt: data.pix?.expires_at || null,
    fee: data.fee_cents == null ? null : Number(data.fee_cents) / 100,
    raw: data,
  };
}

export async function queryPixTransaction(transactionId) {
  if (!transactionId) return null;
  const { data } = await api.get(`/transactions/${encodeURIComponent(transactionId)}`, {
    headers: authHeaders(),
  });

  return {
    transactionId: data?.id || transactionId,
    externalReference: data?.external_reference || null,
    status: normalizeStatus(data?.status),
    paidAt: data?.paid_at || null,
    expiresAt: data?.pix?.expires_at || null,
    fee: data?.fee_cents == null ? null : Number(data.fee_cents) / 100,
    raw: data,
  };
}

export function readableBravoPayError(error) {
  const gatewayError = error.response?.data?.error;
  const details = gatewayError?.details;
  const firstDetail = details && typeof details === 'object'
    ? Object.values(details).flat().find(Boolean)
    : null;

  const publicMessages = {
    unauthorized: 'A chave da BravoPay foi recusada. Revise BRAVOPAY_API_KEY no Render.',
    forbidden: 'A chave da BravoPay não possui permissão para criar cobranças.',
    validation_error: firstDetail || gatewayError?.message || 'A BravoPay recusou os dados da cobrança.',
    product_not_found: 'O BRAVOPAY_PRODUCT_ID não pertence a esta conta.',
    product_inactive: 'O produto configurado na BravoPay está inativo.',
    rate_limited: 'Muitas cobranças foram solicitadas. Aguarde um instante e tente novamente.',
    acquirer_error: 'A rede PIX está temporariamente indisponível. Tente novamente.',
  };

  const code = gatewayError?.code;
  const message = publicMessages[code]
    || (error.code === 'ECONNABORTED' ? 'A BravoPay demorou para responder. Tente novamente.' : null)
    || 'Não foi possível gerar o PIX neste momento.';

  const sourceStatus = Number(error.response?.status || 502);
  const status = sourceStatus >= 400 && sourceStatus < 600 ? sourceStatus : 502;
  return { message: String(message), status };
}

export { normalizeStatus as normalizeBravoPayStatus };
