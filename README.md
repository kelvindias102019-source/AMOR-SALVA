# Vaquinha da Sônia — BravoPay

Estrutura:

- `frontend/`: Vite para Vercel.
- `backend/`: Node/Express para Render.
- `supabase/`: banco, RPCs e migração.

Integração de pagamento:

- criação: `POST https://bravopay.club/api/v1/transactions`;
- autenticação: `Authorization: Bearer BRAVOPAY_API_KEY`;
- webhook: `/api/webhooks/bravopay`;
- assinatura: HMAC-SHA256 com o segredo `whsec_...`;
- confirmação adicional: consulta da transação pela API.

Leia `DEPLOY.md` antes de publicar. Chaves da BravoPay e a SERVICE_ROLE do Supabase ficam somente no Render.
