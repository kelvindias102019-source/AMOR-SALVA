# Pixel UTMify

O frontend usa o pixel UTMify informado pelo proprietário da campanha.

- Bootstrap local: `frontend/public/utmify-pixel.js`
- Script carregado pela UTMify: `https://cdn.utmify.com.br/scripts/pixel/pixel.js`
- Pixel ID decodificado do snippet: `6a72bc280a5131ed00239393`
- A Meta CAPI própria do backend fica desativada por padrão com `META_CAPI_ENABLED=false`.

No Render, mantenha `META_CAPI_ENABLED=false` para evitar envio duplicado de Purchase.
A UTMify ainda precisa estar conectada ao Pixel correto da Meta e configurada para enviar vendas aprovadas.
