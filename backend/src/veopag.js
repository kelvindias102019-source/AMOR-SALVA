import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.veopag.com',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

let cachedToken = null;
let cachedUntil = 0;
let tokenPromise = null;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

export async function getVeoPagToken(force = false) {
  const now = Date.now();
  if (!force && cachedToken && now < cachedUntil) return cachedToken;
  if (!force && tokenPromise) return tokenPromise;

  tokenPromise = api
    .post('/api/auth/login', {
      client_id: required('VEOPAG_CLIENT_ID'),
      client_secret: required('VEOPAG_CLIENT_SECRET'),
    })
    .then(({ data }) => {
      if (!data?.token) throw new Error('A VeoPag não retornou token.');
      cachedToken = data.token;
      cachedUntil = Date.now() + 55 * 60 * 1000;
      return cachedToken;
    })
    .finally(() => {
      tokenPromise = null;
    });

  return tokenPromise;
}

async function authorizedRequest(config, retry = true) {
  const token = await getVeoPagToken();
  try {
    return await api.request({
      ...config,
      headers: { ...config.headers, Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    if (retry && error.response?.status === 401) {
      cachedToken = null;
      cachedUntil = 0;
      const freshToken = await getVeoPagToken(true);
      return api.request({
        ...config,
        headers: { ...config.headers, Authorization: `Bearer ${freshToken}` },
      });
    }
    throw error;
  }
}

export async function createPixDeposit(payload) {
  const { data, status } = await authorizedRequest({
    method: 'POST',
    url: '/api/payments/deposit',
    data: payload,
  });

  if (status === 201 && data?.qrCodeResponse) {
    return {
      transactionId: data.qrCodeResponse.transactionId,
      status: data.qrCodeResponse.status,
      qrcode: data.qrCodeResponse.qrcode,
      amount: Number(data.qrCodeResponse.amount),
      fee: data.qrCodeResponse.fee == null ? null : Number(data.qrCodeResponse.fee),
      raw: data,
    };
  }

  if (status === 200 && data?.idempotent) {
    return {
      transactionId: data.transaction_id,
      status: data.status,
      qrcode: data.qrcode,
      amount: Number(data.amount),
      fee: data.fee == null ? null : Number(data.fee),
      raw: data,
    };
  }

  throw new Error('Resposta inesperada da VeoPag ao criar cobrança.');
}

export async function queryPixDeposit(externalId) {
  const { data } = await authorizedRequest({
    method: 'GET',
    url: '/api/transactions/deposit',
    params: { external_id: externalId },
  });
  return data?.deposit ?? null;
}

export function readableVeoPagError(error) {
  const message = error.response?.data?.message || error.message || 'Erro ao comunicar com a VeoPag.';
  const status = Number(error.response?.status || 502);
  return { message, status: status >= 400 && status < 600 ? status : 502 };
}
