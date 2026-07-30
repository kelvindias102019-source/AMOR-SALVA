const BASE_URL = String(process.env.VEOPAG_API_URL || 'https://api.veopag.com').replace(/\/$/, '');
const TIMEOUT_MS = Math.min(Math.max(Number(process.env.VEOPAG_TIMEOUT_MS || 12000), 3000), 30000);
const TOKEN_TTL_MS = Math.min(Math.max(Number(process.env.VEOPAG_TOKEN_CACHE_MINUTES || 55), 5), 55) * 60_000;

let cachedToken = null;
let cachedUntil = 0;
let loginPromise = null;

function timeoutSignal() {
  return AbortSignal.timeout(TIMEOUT_MS);
}

async function parseJson(response) {
  const raw = await response.text();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

async function authenticate({ force = false } = {}) {
  const now = Date.now();
  if (!force && cachedToken && now < cachedUntil) return cachedToken;
  if (!force && loginPromise) return loginPromise;

  loginPromise = (async () => {
    const clientId = process.env.VEOPAG_CLIENT_ID;
    const clientSecret = process.env.VEOPAG_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('VEOPAG_CREDENTIALS_MISSING');

    let response;
    try {
      response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
        signal: timeoutSignal()
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('VEOPAG_AUTH_TIMEOUT');
      throw new Error('VEOPAG_AUTH_UNAVAILABLE');
    }

    const data = await parseJson(response);
    if (!response.ok || !data?.token) {
      const error = new Error(response.status === 429 ? 'VEOPAG_AUTH_RATE_LIMITED' : 'VEOPAG_AUTH_REJECTED');
      error.status = response.status;
      throw error;
    }

    cachedToken = String(data.token);
    cachedUntil = Date.now() + TOKEN_TTL_MS;
    return cachedToken;
  })();

  try { return await loginPromise; }
  finally { loginPromise = null; }
}

async function apiRequest(path, { method = 'GET', body, retry401 = true } = {}) {
  const token = await authenticate();
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: timeoutSignal()
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('VEOPAG_TIMEOUT');
    throw new Error('VEOPAG_UNAVAILABLE');
  }

  if (response.status === 401 && retry401) {
    cachedToken = null;
    cachedUntil = 0;
    await authenticate({ force: true });
    return apiRequest(path, { method, body, retry401: false });
  }

  const data = await parseJson(response);
  if (!response.ok) {
    console.error('VeoPag request failed', {
      path,
      status: response.status,
      code: data?.code || data?.error_code || data?.message || 'unknown'
    });
    const error = new Error('VEOPAG_REJECTED');
    error.status = response.status;
    throw error;
  }
  return { data, status: response.status };
}

export async function createPix({ amount, payer, externalReference, callbackUrl, tracking = {} }) {
  const body = {
    amount: Number(Number(amount).toFixed(2)),
    external_id: externalReference,
    clientCallbackUrl: callbackUrl || undefined,
    payer: {
      name: payer?.name,
      email: payer?.email,
      document: String(payer?.document || '').replace(/\D/g, ''),
      phone: payer?.phone ? String(payer.phone).replace(/\D/g, '') : undefined
    },
    utm_source: tracking.utm_source || undefined,
    utm_medium: tracking.utm_medium || undefined,
    utm_campaign: tracking.utm_campaign || undefined,
    utm_content: tracking.utm_content || undefined,
    utm_term: tracking.utm_term || undefined,
    platform: 'META'
  };
  if (!body.clientCallbackUrl) delete body.clientCallbackUrl;
  Object.keys(body.payer).forEach((key) => body.payer[key] == null && delete body.payer[key]);
  Object.keys(body).forEach((key) => body[key] == null && delete body[key]);

  const { data, status } = await apiRequest('/api/payments/deposit', { method: 'POST', body });
  const source = data?.qrCodeResponse || data;
  const transactionId = source?.transactionId || source?.transaction_id;
  const pixCode = source?.qrcode;
  if (!transactionId || !pixCode) throw new Error('VEOPAG_PIX_RESPONSE_INVALID');

  return {
    transactionId: String(transactionId),
    externalReference: source?.external_id || externalReference,
    status: source?.status || 'PENDING',
    pixCode: String(pixCode),
    amount: Number(source?.amount ?? amount),
    fee: source?.fee == null ? null : Number(source.fee),
    idempotent: status === 200 || data?.idempotent === true,
    raw: data
  };
}

export async function getDeposit(externalReference) {
  const params = new URLSearchParams({ external_id: externalReference });
  const { data } = await apiRequest(`/api/transactions/deposit?${params.toString()}`);
  return data?.deposit || data?.transaction || data;
}
