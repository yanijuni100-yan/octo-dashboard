# Stack Versions Reference - lintasAI

> Tempat rujukan TUNGGAL untuk version requirement (rujukan manusia/AI — BUKAN ditarik otomatis oleh kode; verifikasi angka via `npm view`, lihat catatan di bawah).
> Update file ini saat upgrade major version framework.
> Konsumen: STACK_GUIDE.md, FRONTEND.md, STACK_DETECTION_PATTERN.md, dst.
> Last updated: 2026-06-05

## Required Versions (Minimum Supported)

> ⚠️ Kolom **"Tested"** = patch terakhir yang diketahui aman saat file ini ditulis, BUKAN angka yang harus di-pin buta. Sebelum upgrade, **selalu cek versi rilis aktual** (`npm view <pkg> version`) — angka di bawah bisa sudah ketinggalan.

| Stack | Minimum | Recommended | Tested (verify saat upgrade) |
|---|---|---|---|
| Node.js | 18.x | 20.x LTS | 20.x |
| Next.js | 14.x | 16.x | 16.x |
| React | 18.x | 19.x | 19.x |
| Prisma | 5.x | 7.x | 7.x |
| Tailwind | 3.x | 4.x | 4.x |
| TypeScript | 5.x | 5.x | 5.x |
| NextAuth | v4 | v4 | 4.x |

## Version Compatibility Matrix

| lintasAI version | Next.js | Prisma | Notes |
|---|---|---|---|
| v1.0.0 | 14-16 | 5-7 | Default akses stack |
| v1.1.0+ | 17+ | 8+ | Future |

## Update Policy

- Patch bumps (Next 16.2 → 16.3): auto-supported
- Minor bumps (Next 16 → 17): test in staging dulu
- Major bumps: kit version bump + migration guide
