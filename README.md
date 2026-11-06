# Düz Okey Masası

Arkadaşlarımla farklı yerlerdeyken de aynı masaya oturabilelim diye hazırladığım, tarayıcıdan oynanan **normal Okey** oyunu. 101 değil; taşları ıstakada dizip elini tamamlayınca son taşı atarak bitiriyorsun.

**[Oyunu aç](https://duz-okey-masa-2026.tamer3535.chatgpt.site)**

## Nasıl oynanır?

İsmini ve avatarını seçip bir oda kuruyorsun. Çıkan bağlantıyı arkadaşlarına gönderiyorsun; herkes gelince oyunu başlatıyorsun. Masada **1, 2, 3 veya 4 gerçek oyuncu** olabilir. Boş kalan koltuklara botlar oturur. Dört arkadaş geldiğinde masa tamamen gerçek oyunculardan oluşur.

## Oyunda neler var?

- Taşları sürükleyerek dizebildiğin iki sıralı ıstaka
- Her oyuncunun yanında ayrı atılan taş alanı
- Botların hamlelerini gösteren animasyonlar, sıra uyarıları ve ses efektleri
- Masada emoji gönderme ve sekiz çizim avatar seçeneği
- Normal Okey perleri, serileri ve çiftle bitiş için oyun kontrolü
- Aynı tarayıcıdan yeni oda kurulduğunda eski oda bağlantısının kapanması

## Teknik yapı

Arayüzü React, Next.js ve TypeScript ile hazırladım. Oyun kuralları ve oda işlemleri sunucu tarafında çalışıyor; oda bilgileri Cloudflare D1'de saklanıyor. Istakada yaptığın dizilim ise kendi tarayıcında kalıyor.

## Yerelde çalıştırma

Node.js 22.13 veya üzeri gerekli. Bağımlılıkları kurup projeyi derledikten sonra yerel veritabanı tablolarını oluşturabilirsin:

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_previous_thunderbolt_ross.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_lazy_killraven.sql
npm start -- --port 8788
```

Oyun `http://127.0.0.1:8788` adresinde açılır. Kuralları `node --experimental-strip-types tests/game.mjs`, ıstakayı `node --experimental-strip-types tests/rack.mjs` ile test edebilirsin. Sunucu çalışırken `node tests/http.mjs` oda akışını kontrol eder.

Bu GitHub deposu canlı oyunun kaynak kopyasıdır. Buraya gönderilen değişiklikler oyunu otomatik olarak güncellemez.
