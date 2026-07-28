# Amor Salva — Campanha Solidária

Projeto mobile-first remodelado a partir do HTML e das imagens enviados.

## Estrutura
- `frontend/`: Vite para Vercel.
- `backend/`: Node/Express para Render.
- `supabase/`: banco de dados.

## Pagamento
A página não exibe PIX copia e cola. O doador escolhe um valor e recebe apenas o QR Code PIX.

Valores disponíveis: R$ 10, R$ 30, R$ 50, R$ 100, R$ 200, R$ 300, R$ 500, R$ 700 e R$ 1.000.

## Supabase
Execute `supabase/setup.sql` no SQL Editor.

## Render
Root Directory: `backend`

Configure as variáveis presentes em `backend/.env.example`.

Webhook BravoPay:
`https://SEU-BACKEND.onrender.com/api/webhooks/bravopay`

## Vercel
Root Directory: `frontend`

Configure:
`VITE_API_BASE_URL=https://SEU-BACKEND.onrender.com`


## VSL
O vídeo da campanha está em `frontend/public/assets/historia-amor-salva.mp4`. A barra abaixo do vídeo usa progresso visual não linear e só chega a 100% quando o vídeo termina.
