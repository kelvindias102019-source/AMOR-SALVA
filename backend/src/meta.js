import crypto from 'node:crypto';

function clean(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function unixSeconds(value) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : Math.floor(Date.now() / 1000);
}

function buildFbc(donation) {
  const existing = clean(donation?.fbc);
  if (existing) return existing;
  const fbclid = clean(donation?.fbclid);
  if (!fbclid) return null;
  const created = donation?.created_at ? Date.parse(donation.created_at) : Date.now();
  const timestamp = Number.isFinite(created) ? created : Date.now();
  return `fb.1.${timestamp}.${fbclid}`;
}

function buildUserData(donation) {
  const userData = {
    external_id: [sha256(donation.external_reference)],
  };

  const fbp = clean(donation.fbp);
  const fbc = buildFbc(donation);
  const ip = clean(donation.client_ip_address);
  const userAgent = clean(donation.client_user_agent);

  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;

  // Não usa o e-mail/telefone padrão do pagador VeoPag como dado de correspondência.
  // Só adicione em/ph se esses dados forem coletados diretamente do usuário com base legal.
  return userData;
}

export function isMetaCapiConfigured() {
  const enabled = String(process.env.META_CAPI_ENABLED || 'false').toLowerCase() === 'true';
  return Boolean(
    enabled &&
    clean(process.env.META_PIXEL_ID) &&
    clean(process.env.META_CAPI_ACCESS_TOKEN) &&
    clean(process.env.META_API_VERSION)
  );
}

export async function sendMetaPurchase(donation) {
  if (!isMetaCapiConfigured()) {
    throw new Error('META_CAPI_NOT_CONFIGURED');
  }

  const pixelId = clean(process.env.META_PIXEL_ID);
  const accessToken = clean(process.env.META_CAPI_ACCESS_TOKEN);
  const apiVersion = clean(process.env.META_API_VERSION);
  const eventId = clean(donation.meta_event_id) || clean(donation.external_reference);
  const sourceUrl = clean(donation.event_source_url) || clean(process.env.META_EVENT_SOURCE_URL);
  const amount = Number(donation.amount_cents || 0) / 100;

  if (!eventId || !sourceUrl || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('META_CAPI_INVALID_DONATION');
  }

  const event = {
    event_name: 'Purchase',
    event_time: unixSeconds(donation.paid_at || donation.updated_at),
    event_id: eventId,
    action_source: 'website',
    event_source_url: sourceUrl,
    user_data: buildUserData(donation),
    custom_data: {
      currency: 'BRL',
      value: Number(amount.toFixed(2)),
    },
  };

  const body = { data: [event] };
  const testEventCode = clean(process.env.META_TEST_EVENT_CODE);
  if (testEventCode) body.test_event_code = testEventCode;

  const endpoint = `https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(pixelId)}/events`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env.META_CAPI_TIMEOUT_MS || 12000)),
  });

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok || responseBody?.error) {
    const error = new Error(responseBody?.error?.message || `META_CAPI_HTTP_${response.status}`);
    error.status = response.status;
    error.code = responseBody?.error?.code || 'META_CAPI_ERROR';
    error.response = responseBody;
    throw error;
  }

  return {
    eventId,
    payload: body,
    response: responseBody,
  };
}
