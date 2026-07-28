# Integração BravoPay — Instituto Amor Salva

## Endpoint do webhook

Cadastre na BravoPay:

`https://amor-salva-1.onrender.com/webhooks/bravopay`

Método esperado: `POST`.

## Variáveis no Render

```env
BRAVOPAY_API_URL=https://bravopay.club/api/v1
BRAVOPAY_API_KEY=bp_live_GERE_UMA_NOVA_CHAVE
BRAVOPAY_WEBHOOK_SECRET=whsec_GERE_UM_NOVO_SEGREDO
BRAVOPAY_PIX_EXPIRES_IN=3600
FRONTEND_ORIGINS=https://institutodoacao.online,https://www.institutodoacao.online
```

A chave e o segredo que foram enviados na conversa devem ser revogados e substituídos.

Não existe `BRAVOPAY_PRODUCT_ID`: a cobrança é criada com o valor escolhido na landing page.

## Testes

1. Abra `https://amor-salva-1.onrender.com/health`.
2. Confirme que aparece `provider: bravopay` e `webhook: /webhooks/bravopay`.
3. Gere uma doação de R$ 10,00.
4. Confirme que o modal mostra QR Code e PIX copia e cola.
5. Faça um pagamento de teste.
6. Confira no Supabase se o status mudou de `PENDING` para `COMPLETED`.

## Deploy

No Render, salve as variáveis e faça `Manual Deploy > Deploy latest commit`.
Na Vercel, confirme `VITE_API_BASE_URL=https://amor-salva-1.onrender.com` e faça um redeploy.
