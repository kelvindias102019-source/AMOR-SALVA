# Pixel UTMify

O código original fornecido pela UTMify está inserido diretamente no `<head>` do `frontend/index.html`.

Pixel ID decodificado: `6a72bc280a5131ed00239393`.

A CSP da Vercel autoriza o script inline somente pelo hash SHA-256 e libera o CDN da UTMify.

Hash CSP: `sha256-gmytPIvH6/GIy7InOPBOaNrva/TmtQhC+Uv8B3fnQe4=`

O arquivo externo local `frontend/public/utmify-pixel.js` foi removido para evitar carregamento duplicado e para que o verificador da UTMify encontre o snippet diretamente no HTML.
