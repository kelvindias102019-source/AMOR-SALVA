# Implantação segura — Amor Salva

## 1. Rotacione as credenciais antes do deploy
Troque a API key e o webhook secret da BravoPay e a service role do Supabase. Não reutilize credenciais da campanha anterior e não salve segredos no GitHub, Vercel ou frontend.

## 2. Render
Configure as variáveis conforme `backend/.env.example`. Use `NODE_ENV=production`, `USE_TEST_PAYERS=false` e `TURNSTILE_ENABLED=true`.

## 3. Cloudflare Turnstile
Crie um widget para `institutodoacao.online` e `www.institutodoacao.online`.
- Site key pública: Vercel, variável `VITE_TURNSTILE_SITE_KEY`.
- Secret key: Render, variável `TURNSTILE_SECRET_KEY`.

## 4. Supabase
Execute `supabase/security-hardening.sql` no SQL Editor. O script não apaga pagamentos.

## 5. Vercel
Configure:
- `VITE_API_BASE_URL=https://amor-salva-1.onrender.com`
- `VITE_TURNSTILE_SITE_KEY=<site key>`

Faça novo deploy para que as variáveis VITE sejam incorporadas ao build.

## 6. BravoPay
Cadastre apenas:
`https://amor-salva-1.onrender.com/webhooks/bravopay`

## 7. Testes
- `/health` deve retornar somente estado básico, sem configuração interna.
- Mais de 5 criações por IP em 15 minutos deve retornar HTTP 429.
- POST sem Origin permitido deve retornar HTTP 403.
- POST sem Turnstile válido deve retornar HTTP 403.
- Webhook duplicado deve retornar `{received:true,duplicate:true}`.
- Erros no navegador não devem mostrar nomes de tabelas, colunas ou respostas completas do gateway.
