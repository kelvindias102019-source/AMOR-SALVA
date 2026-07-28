# Pagadores fictícios aleatórios

1. Execute no Supabase o SQL `amor-salva-pagadores-ficticios-realistas.sql`.
2. No Render, adicione `USE_TEST_PAYERS=true`.
3. Faça um novo deploy do backend.
4. Cada PIX usará um registro aleatório retornado por `get_random_test_payer()`.
5. Para desligar, altere para `USE_TEST_PAYERS=false` e reinicie o serviço.

Use apenas em teste/homologação. Não mantenha pagadores sintéticos ativos em produção.
