# Calium

Calium, Türkçe altyazılı ve dublaj anime içeriklerini keşfetmeye ve izlemeye odaklanan; sosyal özellikler, izleme odaları, gerçek zamanlı bildirimler ve PWA desteği içeren modern bir Next.js uygulamasıdır.

---

## Dil / Language

- [Türkçe](#türkçe)
- [English](#english)

---

# Türkçe

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Öne Çıkan Özellikler](#öne-çıkan-özellikler)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Proje Yapısı](#proje-yapısı)
- [Gereksinimler](#gereksinimler)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Veritabanı](#veritabanı)
- [Çalıştırma Komutları](#çalıştırma-komutları)
- [Gerçek Zamanlı Özellikler](#gerçek-zamanlı-özellikler)
- [Anizium Entegrasyonu](#anizium-entegrasyonu)
- [PWA ve SEO](#pwa-ve-seo)
- [Güvenlik Notları](#güvenlik-notları)
- [Yasal](#yasal)
- [Doğrulama ve Kalite Kontrol](#doğrulama-ve-kalite-kontrol)
- [Dağıtım](#dağıtım)
- [Geliştirme Notları](#geliştirme-notları)

## Genel Bakış

Calium, anime keşfi ve izleme deneyimini sosyal özelliklerle birleştiren bir web platformudur. Uygulama; katalog, arama, yayın takvimi, tür sayfaları, favoriler, izleme geçmişi, kullanıcı listeleri, profil sayfaları, arkadaşlık sistemi, bildirimler ve beraber izleme odaları gibi modüllerden oluşur.

Uygulama Next.js App Router mimarisi üzerine kuruludur. Sunucu tarafında Prisma ile SQLite veritabanı kullanılır. Gerçek zamanlı bildirim, presence ve oda senkronizasyonu için özel Node.js sunucusu ve WebSocket katmanı bulunur.

## Öne Çıkan Özellikler

- Anime katalog, arama, son eklenenler, popüler içerikler ve tür sayfaları.
- Anime detay sayfaları, benzer anime önerileri ve oyuncu/kadro alanları.
- Vidstack tabanlı HLS oynatıcı.
- Türkçe altyazı/dublaj odaklı kullanıcı deneyimi.
- Mobil jestler, seek overlay, altyazı görünüm ayarları ve oynatıcı tercihleri.
- Favoriler ve izleme geçmişi.
- Kullanıcı listeleri, liste beğenileri ve paylaşılabilir profil/listeler.
- Kullanıcı hesapları, profil ayarları, gizlilik tercihleri ve avatar seçenekleri.
- Arkadaşlık/takip sistemi, takip istekleri ve kullanıcı arama.
- Gerçek zamanlı bildirimler ve çevrim içi durum göstergesi.
- Beraber izleme odaları, oda davetleri, public/private odalar ve host kontrollü playback.
- Admin paneli, kullanıcı yönetimi, moderasyon ve istatistik sayfaları.
- PWA manifest, service worker, mobil ikonlar ve install uyumluluğu.
- SEO metadata, sitemap, robots ve JSON-LD desteği.

## Teknoloji Yığını

- **Framework:** Next.js 16.2.4
- **UI:** React 19, TypeScript, Tailwind CSS 4
- **Veritabanı:** SQLite + Prisma 6
- **Kimlik Doğrulama:** JWT, HTTP-only cookie, bcryptjs
- **Gerçek Zamanlı Katman:** `ws` WebSocket sunucusu
- **Video Oynatıcı:** Vidstack, HLS.js
- **Form/Veri Doğrulama:** Zod
- **UI Yardımcıları:** Radix UI, Lucide React, Framer Motion
- **Tema:** next-themes
- **Dağıtım:** PM2, GitHub Actions, VPS odaklı akış

## Proje Yapısı

```text
.
├── .github/workflows/        # GitHub Actions dağıtım akışı
├── prisma/                   # Prisma şeması ve migration dosyaları
├── public/                   # Statik varlıklar, PWA ikonları ve service worker
├── scripts/                  # Yardımcı scriptler
├── src/app/                  # Next.js App Router sayfaları ve API route'ları
├── src/components/           # UI, anime, player, sosyal ve oda bileşenleri
├── src/hooks/                # Client hook'ları
├── src/lib/                  # Auth, veritabanı, Anizium, realtime ve yardımcı modüller
├── src/server/ws/            # WebSocket auth, hub ve message handler dosyaları
├── ecosystem.config.cjs      # PM2 yapılandırması
├── next.config.ts            # Next.js yapılandırması
├── package.json              # Scriptler ve bağımlılıklar
└── server.mjs                # Custom Next.js + WebSocket sunucusu
```

## Gereksinimler

- Node.js 20 veya üzeri önerilir.
- npm.
- SQLite destekli çalışma ortamı.
- Anizium upstream erişimi için gerekli environment değerleri veya Worker proxy.
- Gerçek zamanlı özellikler için custom server çalıştırma yetkisi.

## Kurulum

1. Bağımlılıkları yükleyin:

```bash
npm install
```

`postinstall` sırasında Prisma Client otomatik üretilir.

2. Ortam dosyasını oluşturun:

```bash
cp .env.example .env.local
```

Bu repoda örnek ortam dosyası yoksa `.env.local` dosyasını elle oluşturup [Ortam Değişkenleri](#ortam-değişkenleri) bölümündeki değerleri ekleyin.

3. Veritabanı şemasını uygulayın:

```bash
npx prisma migrate deploy
```

Geliştirme sırasında hızlı senkronizasyon için şu komut da kullanılabilir:

```bash
npx prisma db push
```

4. Geliştirme sunucusunu başlatın:

```bash
npm run dev:ws
```

Gerçek zamanlı bildirim, presence ve oda özelliklerini test etmek için `npm run dev` yerine `npm run dev:ws` kullanın.

## Ortam Değişkenleri

Aşağıdaki değerleri `.env.local` içinde tanımlayın.

### Zorunlu temel değişkenler

```env
DATABASE_URL="file:./data/dev.db"
JWT_SECRET="uzun-ve-rastgele-bir-secret"
```

### Site ve SEO

```env
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
SITE_URL="http://localhost:3000"
NEXT_PUBLIC_DISCORD_URL=""
NEXT_PUBLIC_INSTAGRAM_URL=""
NEXT_PUBLIC_TIKTOK_URL=""
NEXT_PUBLIC_X_URL=""
NEXT_PUBLIC_YOUTUBE_URL=""
```

### Anizium upstream doğrudan mod

Doğrudan upstream isteklerinde bu iki değer gereklidir:

```env
ANIZIUM_CF_CONTROL=""
ANIZIUM_USER_SESSION=""
ANIZIUM_USER_AGENT=""
TMDB_API_KEY=""
```

### Anizium Worker/proxy modu

Worker/proxy modu aktifse uygulama upstream isteklerini Worker URL üzerinden yapar. Bu modda `ANIZIUM_CF_CONTROL` ve `ANIZIUM_USER_SESSION` uygulama tarafında zorunlu değildir; proxy tarafında yönetilebilir.

```env
ANIZIUM_WORKER_URL=""
ANIZIUM_PROXY_KEY=""
```

Yerel proxy scripti için:

```env
PORT="3002"
PROXY_API_KEY=""
ANIZIUM_ASSET_CACHE_CONTROL="public, max-age=86400, stale-while-revalidate=604800"
```

### Sunucu

```env
NODE_ENV="development"
PORT="3000"
HOSTNAME="0.0.0.0"
TRUST_PROXY="0"
```

`TRUST_PROXY=1`, rate limit için `x-forwarded-for` başlığını güvenilir kabul eder. Yalnızca güvenilir reverse proxy arkasında etkinleştirin.

## Veritabanı

Proje Prisma ile SQLite kullanır. Şema `prisma/schema.prisma` dosyasındadır.

Ana modeller:

- `User`: hesap, profil, rol ve gizlilik tercihleri.
- `Preference`: tema, altyazı ve oynatıcı tercihleri.
- `Favorite`: kullanıcı favorileri.
- `HistoryItem`: izleme geçmişi ve devam etme bilgileri.
- `UserList`, `ListItem`, `ListLike`: kullanıcı listeleri ve liste beğenileri.
- `Follow`, `FollowRequest`, `Block`: sosyal grafik.
- `Room`, `RoomMember`, `RoomInvite`: beraber izleme odaları.
- `Activity`, `Notification`: aktivite ve bildirim kayıtları.

Sık kullanılan komutlar:

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db push
npx prisma studio
```

## Çalıştırma Komutları

`package.json` içinde tanımlı scriptler:

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Standart Next.js geliştirme sunucusunu başlatır. WebSocket push özellikleri için yeterli değildir. |
| `npm run dev:turbo` | Next.js geliştirme sunucusunu başlatır. |
| `npm run dev:ws` | Custom Node.js sunucusunu development modunda başlatır. WebSocket için önerilir. |
| `npm run proxy:anizium` | Yerel Anizium proxy scriptini `.env.local` ile çalıştırır. |
| `npm run tunnel:anizium` | Cloudflared tüneli ile yerel proxy için geçici public URL açar. |
| `npm run build` | Production build alır. |
| `npm run start` | Standart Next.js production sunucusunu başlatır. WebSocket push için önerilmez. |
| `npm run start:ws` | Custom Node.js sunucusunu production modunda başlatır. |
| `npm run lint` | ESLint kontrolü çalıştırır. |
| `npm run grant-admin` | Kullanıcıya admin yetkisi vermek için yardımcı script çalıştırır. |

## Gerçek Zamanlı Özellikler

Calium gerçek zamanlı işlemler için custom server kullanır:

- WebSocket endpoint: `/ws`
- Geliştirme: `npm run dev:ws`
- Production: `npm run start:ws`

Bu katman şunları sağlar:

- Kullanıcı presence durumu.
- Bildirimlerin anlık iletilmesi.
- Takipçilere event yayma.
- Oda üyeliği ve oda içi playback mesajları.
- Host kontrollü beraber izleme senkronizasyonu.

Standart `next dev` veya `next start` ile API route'ları çalışır, ancak server-to-client WebSocket push işlemleri bilinçli olarak no-op davranabilir.

## Anizium Entegrasyonu

Anizium istekleri merkezi client üzerinden yürür. Bu katman:

- Tek sabit Anizium API endpoint'ini kullanır.
- Cache TTL değerlerini uygular.
- Direct mode için gerekli upstream header'larını ekler.
- Worker/proxy mode için `ANIZIUM_WORKER_URL` değerini kullanır.
- Asset proxy ve subtitle/image isteklerini yönetir.
- Timeout davranışı sağlar.

Yeni Anizium entegrasyonları eklenirken doğrudan `fetch` yerine proje içindeki Anizium client yardımcıları kullanılmalıdır.

## PWA ve SEO

PWA desteği:

- Web manifest.
- Service worker.
- Apple touch icon ve farklı boyutlarda ikonlar.
- Mobile web app metadata.
- Theme color ve viewport tanımları.

SEO desteği:

- Merkezi site adı, başlık ve açıklama.
- Open Graph ve Twitter card metadata.
- JSON-LD WebSite ve Organization şemaları.
- Sitemap ve robots route'ları.
- Canonical URL üretimi.

## Güvenlik Notları

- Oturum cookie'si HTTP-only ve SameSite Lax olarak ayarlanır.
- JWT imzalama için güçlü `JWT_SECRET` kullanılmalıdır.
- Parolalar bcryptjs ile hashlenir.
- State-changing `/api/*` istekleri için same-origin `Origin`/`Referer` kontrolü vardır.
- `/api/auth/*` rotaları bu CSRF katmanından hariçtir; rate limit ve parola doğrulama kullanır.
- Production ortamında secret değerleri repoya eklenmemelidir.
- `TRUST_PROXY=1` yalnızca güvenilir reverse proxy arkasında kullanılmalıdır.
- Anizium credential değerleri gizli tutulmalıdır.
- Notification kayıtları oluşturulurken realtime push ile tutarlılık için merkezi notification helper kullanılmalıdır.

## Yasal

Bu proje yalnızca eğitim, kişisel öğrenim, yazılım mimarisi incelemesi ve teknik araştırma amaçlarıyla geliştirilmiştir. Calium'un amacı; Next.js App Router, Prisma, WebSocket tabanlı gerçek zamanlı iletişim, PWA davranışları, kullanıcı oturumu yönetimi ve modern medya oynatıcı entegrasyonları gibi teknik konuları örnek bir uygulama üzerinden göstermektir.

Calium herhangi bir video, görsel, altyazı, anime bölümü veya telif hakkına tabi medya içeriğini kendi deposunda barındırmaz, dağıtmaz, çoğaltmaz veya yeniden lisanslamaz. Uygulama içinde görüntülenen veya erişilen üçüncü taraf kaynaklar, ilgili üçüncü taraf servislerin kendi altyapıları, kullanım koşulları ve erişim politikaları kapsamında değerlendirilmelidir.

Üçüncü taraf kaynak sağlayıcılardan veri çekme akışı, yalnızca ilgili kaynağa erişim yetkisi bulunan ve gerekli oturum/erişim bilgilerine sahip kullanıcılar veya ortamlar için tasarlanmıştır. Bu kapsamda `user-session`, upstream erişim başlıkları, API anahtarları veya benzeri kimlik bilgileri repoda sağlanmaz; kullanıcı ya da dağıtımı yapan kişi tarafından yasal ve yetkili şekilde temin edilmelidir. Bu proje, erişim yetkisi olmayan kullanıcılar için içerik erişimi sağlamayı, ücretli/korumalı alanları aşmayı, DRM veya benzeri teknik koruma önlemlerini devre dışı bırakmayı amaçlamaz.

Worker/proxy veya asset proxy mekanizmaları, yalnızca ağ yönlendirmesi, geliştirme kolaylığı, istek standardizasyonu, cache yönetimi ve erişim başlıklarının merkezi yönetimi gibi teknik amaçlarla belgelenmiştir. Bu mekanizmalar, üçüncü taraf servislerin kullanım şartlarını ihlal etmek, yetkisiz erişim sağlamak veya içerik sahiplerinin haklarını aşmak için kullanılmamalıdır.

Projeyi çalıştıran, dağıtan veya değiştiren kişi/kuruluş; bulunduğu ülkenin mevzuatına, üçüncü taraf servislerin kullanım koşullarına, telif hakkı ve lisans hükümlerine uymaktan tek başına sorumludur. Herhangi bir üçüncü taraf hak sahibinin talebi, içerik kaldırma bildirimi veya erişim kısıtlaması durumunda gerekli teknik ve idari aksiyonların alınması dağıtımı yapan kişinin sorumluluğundadır.

Bu README'deki açıklamalar hukuki danışmanlık niteliği taşımaz. Projenin herhangi bir ortamda kullanımı veya dağıtımı öncesinde ilgili mevzuat, lisanslar ve servis koşulları ayrıca değerlendirilmelidir.

## Doğrulama ve Kalite Kontrol

Bu projede ayrı bir test runner yapılandırması bulunmamaktadır. Değişiklikleri kontrol etmek için şu komutları kullanın:

```bash
npm run lint
npm run build
```

Gerçek zamanlı özellikler doğrulanırken uygulamayı custom server ile çalıştırın:

```bash
npm run dev:ws
```

## Dağıtım

Repo içinde VPS odaklı dağıtım akışı bulunur:

- GitHub Actions deploy workflow'u `master` branch push işlemlerinde çalışır.
- VPS üzerinde `/opt/calium` dizinine geçer.
- `npm ci` ile bağımlılıkları kurar.
- `prisma migrate deploy` ve `prisma db push` çalıştırır.
- Production build alır.
- PM2 sürecini yeniden başlatır.

PM2 yapılandırması `ecosystem.config.cjs` içindedir ve production için `server.mjs` çalıştırır. WebSocket özelliklerinin production'da çalışması için PM2 sürecinin `server.mjs` üzerinden başlaması gerekir.

## Geliştirme Notları

- Next.js App Router ve config değişikliklerinde mevcut proje sürümü olan Next.js 16.2.4 davranışlarına göre hareket edin.
- API cevaplarında `{ success, ... }` şekli korunmalıdır.
- Kullanıcıya gösterilen hata mesajları Türkçe tutulmalıdır.
- Normal API auth için `requireUser()` kullanın.
- Yalnızca parola hash'i gereken endpoint'lerde `requireUserWithPassword()` kullanın.
- Favori ve geçmiş yazımlarında mevcut `animes:*changed` event'leri tetiklenmelidir.
- Realtime özelliklerde `src/lib/realtime/socket.ts` ve `src/lib/realtime/push.ts` katmanları kullanılmalıdır.
- Bildirimler doğrudan Prisma ile değil, realtime push davranışıyla uyumlu merkezi helper üzerinden oluşturulmalıdır.

---

# English

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Available Scripts](#available-scripts)
- [Realtime Features](#realtime-features)
- [Anizium Integration](#anizium-integration)
- [PWA and SEO](#pwa-and-seo)
- [Security Notes](#security-notes)
- [Legal Notice](#legal-notice)
- [Validation and Quality Checks](#validation-and-quality-checks)
- [Deployment](#deployment)
- [Development Notes](#development-notes)

## Overview

Calium is a modern anime streaming and discovery web application focused on Turkish-subtitled and dubbed anime content. It combines anime browsing, playback, watch history, favorites, custom user lists, profiles, social features, realtime notifications, and watch-together rooms.

The application is built with the Next.js App Router. Prisma and SQLite are used for persistence. A custom Node.js server powers WebSocket-based realtime notifications, presence, and room synchronization.

## Key Features

- Anime catalog, search, latest releases, top content, and genre pages.
- Anime detail pages with similar recommendations and cast sections.
- Vidstack-based HLS video player.
- Turkish subtitle/dub focused user experience.
- Mobile gestures, seek overlay, caption styling, and player preferences.
- Favorites and watch history.
- User lists, list likes, and shareable profiles/lists.
- User accounts, profile settings, privacy preferences, and avatar options.
- Friend/follow system, follow requests, and user search.
- Realtime notifications and presence indicators.
- Watch-together rooms, room invites, public/private rooms, and host-controlled playback.
- Admin dashboard, user management, moderation, and statistics pages.
- PWA manifest, service worker, mobile icons, and install support.
- SEO metadata, sitemap, robots, and JSON-LD support.

## Tech Stack

- **Framework:** Next.js 16.2.4
- **UI:** React 19, TypeScript, Tailwind CSS 4
- **Database:** SQLite + Prisma 6
- **Authentication:** JWT, HTTP-only cookies, bcryptjs
- **Realtime Layer:** `ws` WebSocket server
- **Video Player:** Vidstack, HLS.js
- **Validation:** Zod
- **UI Utilities:** Radix UI, Lucide React, Framer Motion
- **Theme:** next-themes
- **Deployment:** PM2, GitHub Actions, VPS-oriented workflow

## Project Structure

```text
.
├── .github/workflows/        # GitHub Actions deployment workflow
├── prisma/                   # Prisma schema and migrations
├── public/                   # Static assets, PWA icons, and service worker
├── scripts/                  # Utility scripts
├── src/app/                  # Next.js App Router pages and API routes
├── src/components/           # UI, anime, player, social, and room components
├── src/hooks/                # Client hooks
├── src/lib/                  # Auth, database, Anizium, realtime, and utility modules
├── src/server/ws/            # WebSocket auth, hub, and message handlers
├── ecosystem.config.cjs      # PM2 configuration
├── next.config.ts            # Next.js configuration
├── package.json              # Scripts and dependencies
└── server.mjs                # Custom Next.js + WebSocket server
```

## Requirements

- Node.js 20 or newer is recommended.
- npm.
- SQLite-capable runtime environment.
- Required environment values or a Worker proxy for Anizium upstream access.
- Ability to run the custom server for realtime features.

## Installation

1. Install dependencies:

```bash
npm install
```

Prisma Client is generated automatically during `postinstall`.

2. Create the environment file:

```bash
cp .env.example .env.local
```

If this repository does not include an example environment file, create `.env.local` manually and add the values listed in [Environment Variables](#environment-variables).

3. Apply the database schema:

```bash
npx prisma migrate deploy
```

For quick development synchronization, you may also use:

```bash
npx prisma db push
```

4. Start the development server:

```bash
npm run dev:ws
```

Use `npm run dev:ws` instead of `npm run dev` when testing realtime notifications, presence, and room behavior.

## Environment Variables

Define the following values in `.env.local`.

### Required base variables

```env
DATABASE_URL="file:./data/dev.db"
JWT_SECRET="a-long-random-secret"
```

### Site and SEO

```env
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
SITE_URL="http://localhost:3000"
NEXT_PUBLIC_DISCORD_URL=""
NEXT_PUBLIC_INSTAGRAM_URL=""
NEXT_PUBLIC_TIKTOK_URL=""
NEXT_PUBLIC_X_URL=""
NEXT_PUBLIC_YOUTUBE_URL=""
```

### Direct Anizium upstream mode

Direct upstream requests require these two values:

```env
ANIZIUM_CF_CONTROL=""
ANIZIUM_USER_SESSION=""
ANIZIUM_USER_AGENT=""
TMDB_API_KEY=""
```

### Anizium Worker/proxy mode

When Worker/proxy mode is enabled, the application sends upstream requests through the Worker URL. In this mode, `ANIZIUM_CF_CONTROL` and `ANIZIUM_USER_SESSION` do not have to be provided to the application process and may be handled by the proxy instead.

```env
ANIZIUM_WORKER_URL=""
ANIZIUM_PROXY_KEY=""
```

For the local proxy script:

```env
PORT="3002"
PROXY_API_KEY=""
ANIZIUM_ASSET_CACHE_CONTROL="public, max-age=86400, stale-while-revalidate=604800"
```

### Server

```env
NODE_ENV="development"
PORT="3000"
HOSTNAME="0.0.0.0"
TRUST_PROXY="0"
```

`TRUST_PROXY=1` makes rate limiting trust the `x-forwarded-for` header. Enable it only behind a trusted reverse proxy.

## Database

The project uses Prisma with SQLite. The schema lives in `prisma/schema.prisma`.

Main models:

- `User`: account, profile, role, and privacy preferences.
- `Preference`: theme, caption, and player preferences.
- `Favorite`: user favorites.
- `HistoryItem`: watch history and resume information.
- `UserList`, `ListItem`, `ListLike`: user lists and list likes.
- `Follow`, `FollowRequest`, `Block`: social graph.
- `Room`, `RoomMember`, `RoomInvite`: watch-together rooms.
- `Activity`, `Notification`: activity and notification records.

Common commands:

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db push
npx prisma studio
```

## Available Scripts

Scripts defined in `package.json`:

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the standard Next.js development server. Not enough for WebSocket push behavior. |
| `npm run dev:turbo` | Starts the Next.js development server. |
| `npm run dev:ws` | Starts the custom Node.js server in development mode. Recommended for WebSocket features. |
| `npm run proxy:anizium` | Runs the local Anizium proxy script with `.env.local`. |
| `npm run tunnel:anizium` | Opens a temporary public URL for the local proxy through Cloudflared. |
| `npm run build` | Creates a production build. |
| `npm run start` | Starts the standard Next.js production server. Not recommended for WebSocket push. |
| `npm run start:ws` | Starts the custom Node.js server in production mode. |
| `npm run lint` | Runs ESLint. |
| `npm run grant-admin` | Runs the helper script for granting admin privileges to a user. |

## Realtime Features

Calium uses a custom server for realtime behavior:

- WebSocket endpoint: `/ws`
- Development: `npm run dev:ws`
- Production: `npm run start:ws`

This layer provides:

- User presence state.
- Realtime notification delivery.
- Event broadcasting to followers.
- Room membership and in-room playback messages.
- Host-controlled watch-together synchronization.

With the standard `next dev` or `next start` process, API routes still work, but server-to-client WebSocket pushes may intentionally behave as no-ops.

## Anizium Integration

Anizium requests go through the central client layer. This layer:

- Fetches the domain list and falls back to a fallback domain.
- Applies cache TTL values.
- Adds required upstream headers for direct mode.
- Uses `ANIZIUM_WORKER_URL` for Worker/proxy mode.
- Handles asset proxy and subtitle/image requests.
- Provides timeout and retry behavior.

When adding new Anizium integrations, use the project Anizium client helpers instead of direct `fetch` calls.

## PWA and SEO

PWA support:

- Web manifest.
- Service worker.
- Apple touch icon and multiple icon sizes.
- Mobile web app metadata.
- Theme color and viewport definitions.

SEO support:

- Central site name, title, and description.
- Open Graph and Twitter card metadata.
- JSON-LD WebSite and Organization schemas.
- Sitemap and robots routes.
- Canonical URL generation.

## Security Notes

- Session cookies are HTTP-only and SameSite Lax.
- Use a strong `JWT_SECRET` for JWT signing.
- Passwords are hashed with bcryptjs.
- State-changing `/api/*` requests are protected with same-origin `Origin`/`Referer` checks.
- `/api/auth/*` routes are excluded from this CSRF layer and use rate limiting plus password checks.
- Do not commit production secrets to the repository.
- Use `TRUST_PROXY=1` only behind a trusted reverse proxy.
- Keep Anizium credential values private.
- Create notifications through the central notification helper to keep persistence and realtime push behavior consistent.

## Legal Notice

This project is developed solely for educational purposes, personal learning, software architecture review, and technical research. Calium is intended to demonstrate concepts such as the Next.js App Router, Prisma, WebSocket-based realtime communication, PWA behavior, user session handling, and modern media player integrations within an example application.

Calium does not host, distribute, reproduce, or re-license any video, image, subtitle, anime episode, or other copyrighted media content in this repository. Any third-party resources displayed or accessed through the application should be considered subject to the infrastructure, terms of service, and access policies of the relevant third-party providers.

The data retrieval flow from third-party source providers is designed only for users or environments that already have authorized access to the relevant source and possess the required session/access information. Accordingly, `user-session` values, upstream access headers, API keys, or similar credentials are not provided in the repository; they must be obtained legally and with proper authorization by the user or the deploying party. This project is not intended to provide content access to unauthorized users, bypass paid/protected areas, or disable DRM or similar technical protection measures.

Worker/proxy and asset proxy mechanisms are documented only for technical purposes such as network routing, development convenience, request standardization, cache management, and centralized handling of access headers. These mechanisms must not be used to violate third-party service terms, obtain unauthorized access, or circumvent the rights of content owners.

Any person or organization running, deploying, or modifying this project is solely responsible for complying with the laws of their jurisdiction, third-party service terms, copyright rules, and license obligations. In the event of any request from a third-party rights holder, takedown notice, or access restriction, the deploying party is responsible for taking the necessary technical and administrative actions.

The statements in this README do not constitute legal advice. Before using or deploying this project in any environment, applicable laws, licenses, and service terms should be reviewed independently.

## Validation and Quality Checks

This project currently does not include a dedicated test runner configuration. Use the following commands for validation:

```bash
npm run lint
npm run build
```

When validating realtime features, run the app through the custom server:

```bash
npm run dev:ws
```

## Deployment

The repository includes a VPS-oriented deployment workflow:

- The GitHub Actions deploy workflow runs on pushes to the `master` branch.
- It changes into `/opt/calium` on the VPS.
- It installs dependencies with `npm ci`.
- It runs `prisma migrate deploy` and `prisma db push`.
- It creates a production build.
- It restarts the PM2 process.

The PM2 configuration is defined in `ecosystem.config.cjs` and runs `server.mjs` in production. Realtime features require the production process to start through `server.mjs`.

## Development Notes

- Follow the behavior of the checked-in Next.js 16.2.4 version when changing App Router or configuration code.
- Preserve the `{ success, ... }` API response shape.
- Keep user-facing error messages in Turkish.
- Use `requireUser()` for normal API authentication.
- Use `requireUserWithPassword()` only for endpoints that need the password hash.
- Favorite/history writes should dispatch the existing `animes:*changed` events.
- Realtime features should use the `src/lib/realtime/socket.ts` and `src/lib/realtime/push.ts` layers.
- Notifications should be created through the central helper instead of direct Prisma writes when realtime delivery is expected.
