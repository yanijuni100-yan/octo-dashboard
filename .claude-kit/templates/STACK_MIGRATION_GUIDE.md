# templates/STACK_MIGRATION_GUIDE.md - Panduan Migrasi Stack (Advanced)

> Versi 1 · 2026-06-03
> **POST-LAUNCH ADVANCED.** Default tim pakai Vercel - file ini cuma untuk fase migrasi spesifik (cost Vercel over-budget, butuh background worker persistent, atau butuh WebSocket long-lived).

---

## 1. Pengantar

File ini = **pendamping `STACK_GUIDE.md`** untuk fase migrasi vendor hosting.

**JANGAN baca file ini di Day 0-1.** Staff IT non-programmer fase awal cukup pakai Vercel + Supabase sesuai `STACK_GUIDE.md` section 3.

**Baru relevan kalau:**

- Bill Vercel sudah lewat budget (umumnya >$100/bulan untuk satu project) DAN owner sudah verifikasi penyebabnya bukan misconfiguration (mis. ISR revalidate kekecilan, image optimization mati).
- Butuh **background worker persistent** (Vercel function = serverless, mati setelah HTTP response selesai → tidak cocok untuk job antrian panjang, polling DB terus-menerus, dll.).
- Butuh **WebSocket / Server-Sent Events long-lived connection** (Vercel Edge punya batasan koneksi durasi pendek).
- Owner sudah baca Decision Matrix di `STACK_GUIDE.md` section 9 dan memutuskan pindah.

> *Background worker* = proses yang jalan terus-menerus di server (bukan response per request HTTP). Contoh: pengirim email batch, scraper jadwal, queue processor.

---

## 2. Railway Migration Guide

Kapan pilih Railway:

- Butuh background worker persistent + cron native gratis.
- Mau tetap pakai stack Docker-portable (tidak vendor-lock seperti Vercel Edge).
- Tim sudah familiar Nixpacks atau Dockerfile.

### 2.1. Provision

1. https://railway.app → New Project → Deploy from GitHub.
2. Add PostgreSQL plugin (klik **+ New** → Database → PostgreSQL).
3. Connection string auto-inject ke service via `${{ Postgres.DATABASE_URL }}`.

### 2.2. Env Vars

Service → Variables → tambah satu per satu, atau import dari `.env`.

```text
DATABASE_URL = ${{ Postgres.DATABASE_URL }}
NEXT_PUBLIC_SITE_URL = https://akses.up.railway.app
```

### 2.3. Dockerfile vs Nixpacks

- **Nixpacks** (default) - auto-detect Next.js, no config. Pilih ini dulu.
- **Dockerfile** - kalau butuh dependency native (ImageMagick, FFmpeg, Chromium).

Contoh Dockerfile Next.js minimal:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Note: aktifkan `output: 'standalone'` di `next.config.js`.

### 2.4. Background Worker + Cron Native

Railway dukung worker service terpisah dari web. Add **+ New Service** → pilih repo yang sama, set start command beda:

```text
Web service:    npm run start    (= next start)
Worker service: npm run worker   (= node dist/worker.js)
```

Cron: pakai package `node-cron` di worker service, atau Railway **Cron Job** (klik service → Settings → Cron Schedule).

### 2.5. Healthcheck Endpoint

Railway monitor `GET /api/health` (configurable). Bikin route:

```ts
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', ts: Date.now() })
}
```

---

## 3. Render Migration Guide (Alternative)

Mirip Railway, tapi UI beda + pricing model beda. Pilih Render kalau:

- Mau spending limit ketat (Render lebih predictable per service).
- Tim sudah familiar Render (mis. pakai untuk proyek lain).

### 3.1. Web Service + DB Terpisah

1. https://render.com → New → **PostgreSQL** → pilih region + plan.
2. New → **Web Service** → connect GitHub repo.
3. Connection string DB di-copy manual ke env var `DATABASE_URL`.

### 3.2. Build / Start Command

```text
Build Command: npm ci && npm run build
Start Command: npm run start
```

Untuk Next.js standalone:

```text
Start Command: node .next/standalone/server.js
```

### 3.3. Background Worker + Cron

- **Background Worker**: New → Background Worker → set start command sama dengan worker proyek (mis. `npm run worker`).
- **Cron Job**: New → Cron Job → schedule pakai sintaks cron (`0 */6 * * *` = tiap 6 jam) + command (`npm run cron:cleanup`).

---

## 4. Checklist Pre-Migration (Sebelum Pindah dari Vercel)

Sebelum eksekusi migrasi, pastikan:

- [ ] Sudah verifikasi bill Vercel bukan akibat misconfiguration (cek `Project → Usage`, bandingkan dengan optimasi: ISR revalidate, image optimization, function region).
- [ ] Sudah baca `STACK_GUIDE.md` section 9 (Decision Matrix) dan paham trade-off vendor lock-in.
- [ ] Backup DB Supabase aktif (Settings → Database → Backups).
- [ ] Rollback plan siap: kalau migrasi gagal, balik ke Vercel via DNS switch (TTL DNS ≤5 menit sebelum cutover).
- [ ] Custom domain SSL siap di vendor baru (Railway/Render auto-handle, tapi propagation DNS bisa 1-24 jam).
- [ ] Env vars sensitif sudah di-copy ke vendor baru dan di-mark Sensitive/Secret.
- [ ] Tim yang punya akses Vercel sudah diberi akses Railway/Render (least privilege).

---

## 5. Referensi Eksternal

- Railway docs: https://docs.railway.app
- Render docs: https://render.com/docs
- Decision Matrix vendor: `templates/STACK_GUIDE.md` section 9
- Default workflow (sebelum migrasi): `templates/STACK_GUIDE.md` section 3 (Vercel Setup)

---

> **Update file ini** tiap kali ada perubahan flow Railway/Render (UI dashboard, pricing tier, atau best practice). Catat di `CHANGELOG.md` kit + bump versi.
