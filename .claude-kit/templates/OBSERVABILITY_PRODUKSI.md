# templates/OBSERVABILITY_PRODUKSI.md - Pasang "Alarm" supaya App Tak Error Diam-Diam di Produksi

> Versi 1 · 2026-06-27 · Untuk app produksi (Next.js / Python / Supabase, deploy Vercel/Railway/Render).
> Pelengkap, BUKAN pengganti: setup tool dasar = `SPLIT_REPO_TOOLS_SETUP.md` §12 (Sentry 3-baris) · backup DB = `backup-schemas.yml` · standar log = `CLAUDE_universal_v1.md` §5. File ini **mengangkat observability jadi standar wajib-sebelum-online** + langkah konkret 3 pilar.

## Tujuan & kapan dipakai

Dipakai **sebelum app dipakai user sungguhan** (atau saat staff bilang *"mau online"*, *"deploy ke produksi"*, *"app sering error tapi nggak tahu kenapa"*). Tujuan: app **memberi tahu kita saat ada masalah**, bukan kita baru tahu dari komplain user.

- 👨‍🎓 **Junior:** *observability* = kemampuan tahu "apa yang terjadi di dalam app saat jalan di produksi" lewat 3 pilar: **error tracking** (tangkap exception otomatis), **structured logging** (log ber-`trace-id` yang bisa dilacak antar-service), **healthcheck/uptime** (endpoint `/health` + monitor). Tanpa ini, *silent failure* (gagal diam-diam) bisa berjam-jam tak terdeteksi. Aturan §5 sudah mewajibkan "log terstruktur + jangan telan error" — file ini langkah konkretnya.
- 🙂 **Non-programmer:** ini seperti **alarm kebakaran + CCTV** untuk aplikasi. Kalau ada yang rusak menimpa pengguna, kamu **langsung dapat kabar** (bukan nunggu pelanggan komplain). Tanpa ini, app yang error itu seperti toko yang kebakaran di malam hari tanpa alarm.

---

## Kenapa WAJIB (bukan opsional) untuk app powerful

App tanpa observability = **terbang tanpa instrumen**: kelihatan jalan, tapi saat satu fitur diam-diam gagal (pembayaran nyangkut, form tak terkirim, query lambat), tak ada yang tahu sampai user marah / transaksi hilang. Untuk app yang dipakai user real, ini **bug jangka panjang paling mahal** karena tak terlihat. Maka: nyalakan **sebelum** online, bukan setelah ada insiden.

---

## 3 Pilar (pasang berurutan, dari yang paling penting)

### Pilar 1 — Error Tracking (tangkap error user otomatis) 🥇

```bash
# Next.js (frontend + API routes)
npm install --save @sentry/nextjs
npx @sentry/wizard@latest -i nextjs    # otomatis bikin config + sourcemap

# Python (FastAPI / Django)
pip install "sentry-sdk[fastapi]"      # atau sentry-sdk[django]
```
```python
# Python: init sekali di entry point (main.py / settings.py)
import sentry_sdk
sentry_sdk.init(dsn="<SENTRY_DSN>", traces_sample_rate=0.1, environment="production")
```
- Tiap error di produksi → Sentry tangkap *stack trace* (jejak baris error) + langkah reproduksi + kirim alert (email/Slack) ke owner.
- **WAJIB:** `environment` dibedakan (production/staging) supaya error staging tak bikin panik. `SENTRY_DSN` taruh di env, **jangan** di kode.

### Pilar 2 — Structured Logging + trace-id (log yang bisa dilacak) 🥈

```ts
// Next.js: pakai pino (atau console JSON) — log = objek, bukan string acak
import pino from "pino";
export const log = pino({ level: process.env.LOG_LEVEL ?? "info" });
// tiap request beri trace-id, teruskan ke log + ke backend (header x-trace-id)
log.info({ traceId, userId, route: "/api/checkout" }, "checkout dimulai");
```
- 👨‍🎓 *trace-id* = nomor seri unik per-request, ikut di semua log lintas-service → saat ada error, kamu bisa rangkai "apa yang terjadi" dari frontend → backend → DB. Level: `info` (aksi sukses penting), `warn` (anomali), `error` (gagal perlu tindak lanjut).
- 🚨 **JANGAN log secret/PII mentah** (password, token, nomor kartu, KTP) — §8. Mask: `email=a***@x.com`.

### Pilar 3 — Healthcheck + Uptime monitor 🥉

```ts
// Next.js App Router: app/api/health/route.ts
export async function GET() {
  // cek dependensi kritis (DB ping) — return 200 kalau sehat, 503 kalau tidak
  return Response.json({ status: "ok", time: new Date().toISOString() });
}
```
- Daftarkan URL `/api/health` ke uptime monitor (UptimeRobot/BetterStack/Vercel) → dapat alert kalau app mati. (Railway/Render: set healthcheck path di config deploy.)

---

## Checklist "sebelum online" (centang dulu)

- [ ] Sentry aktif di frontend **dan** backend, `environment` dibedakan, DSN di env (bukan kode).
- [ ] Log terstruktur + `trace-id` di entry point & jalur error; level benar; **tak ada secret/PII** ter-log.
- [ ] Endpoint `/health` ada + terdaftar di uptime monitor.
- [ ] Alert routing jelas (siapa dapat notif saat GENTING — email/Slack owner).
- [ ] (Opsional) error-rate threshold → alert kalau lonjakan error.

---

## 🙂 Untuk non-programmer (ringkas)

Berkas ini = cara memasang **alarm + CCTV** di aplikasi sebelum dibuka untuk pelanggan. Tiga lapis: (1) **alarm error** — langsung kabari kamu kalau ada yang rusak menimpa pengguna; (2) **buku catatan otomatis** — rekam apa yang terjadi biar gampang dilacak saat ada masalah; (3) **detak jantung** — pantau apakah app masih hidup. Mirip **toko yang punya alarm, CCTV, dan satpam** — bukan toko yang baru tahu kemalingan pas buka pagi.
