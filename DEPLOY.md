# Deploy

## 1. GitHub
Envie a pasta inteira para um repositório.

## 2. Supabase
1. Crie um projeto.
2. Abra SQL Editor.
3. Execute `supabase/setup.sql`.
4. Copie Project URL e Service Role Key.

## 3. Render
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check: `/health`
- Copie e preencha as variáveis de `backend/.env.example`.

## 4. BravoPay
Cadastre o webhook:
`https://SEU-BACKEND.onrender.com/api/webhooks/bravopay`

## 5. Vercel
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Variável: `VITE_API_BASE_URL=https://SEU-BACKEND.onrender.com`


## VSL
O vídeo da campanha está em `frontend/public/assets/historia-amor-salva.mp4`. A barra abaixo do vídeo usa progresso visual não linear e só chega a 100% quando o vídeo termina.


## REVISÃO TÉCNICA FINAL

- A captura Meta aceita estados `PENDING`, `FAILED` e processamento travado.
- A reivindicação usa `meta_event_attempts` como trava otimista para reduzir disparos concorrentes.
- Webhooks duplicados são reprocessados de forma idempotente, evitando perda de confirmação após falha parcial.
- `META_API_VERSION` foi atualizado para `v24.0`; confirme no painel da Meta antes de futuros upgrades.
