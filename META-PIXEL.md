# Meta Pixel — Página da Sônia

Pixel integrado: `2279794442426700`

Eventos configurados:

- `PageView`: carregamento da página;
- `InitiateCheckout`: abertura do modal de doação;
- `AddPaymentInfo`: PIX gerado;
- `Purchase`: pagamento confirmado pelo status do backend.

O evento `Purchase` usa o identificador externo da cobrança como `eventID` e é disparado uma única vez por sessão para cada pagamento.

## Validação

Após publicar, use a extensão Meta Pixel Helper e a área **Testar eventos** do Gerenciador de Eventos da Meta.
