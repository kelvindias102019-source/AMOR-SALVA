# Configuração rápida da BravoPay

1. Gere a API Key no painel da BravoPay. Ela começa com `bp_live_`.
2. No Render, configure `BRAVOPAY_API_KEY`.
3. Cadastre no painel o webhook:
   `https://SEU-BACKEND.onrender.com/api/webhooks/bravopay`
4. O painel fornecerá um segredo `whsec_...`. Configure-o como `BRAVOPAY_WEBHOOK_SECRET` no Render.
5. Não coloque nenhuma dessas chaves na Vercel ou no GitHub.

A URL base já está configurada como `https://bravopay.club/api/v1`.
