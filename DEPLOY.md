# Deploy — Vercel + Render + Supabase + BravoPay

## 1. Supabase

Projeto novo: execute `supabase/setup.sql` no SQL Editor.

Projeto já usado pela versão anterior: faça backup e execute `supabase/migrar-para-bravopay.sql`. Confira se as outras tabelas/funções já existem.

Depois insira o perfil real em `payment_profiles`. CPF/CNPJ e telefone devem conter somente números.

## 2. Render — backend

Crie um Web Service com:

- Root Directory: `backend`
- Build Command: `npm ci --omit=dev`
- Start Command: `npm start`
- Health Check: `/health`

Variáveis obrigatórias:

```env
PUBLIC_BASE_URL=https://SEU-BACKEND.onrender.com
BRAVOPAY_API_URL=https://bravopay.club/api/v1
BRAVOPAY_API_KEY=bp_live_...
BRAVOPAY_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
AUDIT_HASH_SECRET=gere-uma-chave-aleatoria-longa
FRONTEND_ORIGIN=https://SEU-FRONT.vercel.app,https://seu-subdominio.vaakinha.online
CAMPAIGN_GOAL=35000
CAMPAIGN_INITIAL_AMOUNT=3500
CAMPAIGN_NAME=Vaquinha da Sônia
```

Opcionais:

```env
BRAVOPAY_PRODUCT_ID=prd_...
BRAVOPAY_PIX_EXPIRES_IN=3600
```

Teste:

```text
https://SEU-BACKEND.onrender.com/health
```

## 3. BravoPay — webhook

No painel da BravoPay, em Integrações/Webhooks, cadastre:

```text
https://SEU-BACKEND.onrender.com/api/webhooks/bravopay
```

Copie o segredo `whsec_...` fornecido ao cadastrar a URL e coloque em `BRAVOPAY_WEBHOOK_SECRET` no Render. Não invente esse segredo.

## 4. Vercel — frontend

Importe o mesmo repositório usando:

- Root Directory: `frontend`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Variável:

```env
VITE_API_BASE_URL=https://SEU-BACKEND.onrender.com
```

Após alterar variável, faça Redeploy.

## 5. Teste de ponta a ponta

1. Abra a land publicada.
2. Gere um PIX de R$ 5,00.
3. Confira a linha em `donations` com status `PENDING`.
4. Pague o PIX.
5. Confira o webhook no Render e a mudança para `COMPLETED`.
