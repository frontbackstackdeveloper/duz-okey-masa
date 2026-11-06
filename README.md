# Düz Okey Masası

Arkadaşlarla bağlantı üzerinden oynanabilen dört kişilik normal Okey oyunu. Eksik koltuklara botlar katılır.

**Canlı oyun:** https://duz-okey-masa-2026.tamer3535.chatgpt.site

## Özellikler

- Oda bağlantısıyla katılma; 2 veya 3 gerçek oyuncuyla oynayabilme
- Sunucu tarafında dağıtım, sıra, okey ve bitiş kontrolü
- Eksik koltuklar için bot oyuncular
- İki sıralı, sürükle bırak destekli ıstaka
- Oyuncu başına atılan taş alanı, hamle animasyonları, sesler ve emojiler
- Sekiz çizim avatar; kişisel fotoğraf içermez
- Aynı tarayıcıda yeni oda açıldığında eski oda bağlantısını kapatma

## Teknoloji

Next.js / React, TypeScript, Cloudflare Workers ve D1. Canlı sürüm ChatGPT Sites üzerinde barındırılır. Oda durumları D1 veritabanında, oyuncunun ıstaka dizilimi tarayıcıda saklanır.

## Yerelde çalıştırma

Node.js 22.13+ gerekir.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_previous_thunderbolt_ross.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_lazy_killraven.sql
npm start -- --port 8788
```

Ardından `http://127.0.0.1:8788` adresini açın. Testler: `node --experimental-strip-types tests/game.mjs`, `node --experimental-strip-types tests/rack.mjs` ve çalışan yerel sunucuda `node tests/http.mjs`.

Bu depo canlı Sites projesinin kaynak kodu için ayrı bir vitrin kopyasıdır; GitHub'a gönderilen değişiklikler canlı oyunu otomatik güncellemez. `.openai/hosting.json` içindeki proje kimliği bu kopyada kaldırılmıştır.
