# docs/decisions/ — Catatan Keputusan (ADR) repo kit lintasAI

> Folder ini menyimpan **catatan keputusan teknis non-sepele** untuk repo kit INI (dogfood —
> selama ini kit mengirim template ADR ke project klien lewat `templates/decisions/`, tapi
> repo-nya sendiri belum memakainya).
>
> **Format + panduan lengkap** (kapan bikin ADR, penomoran, status lifecycle) = sumber tunggal di
> [`templates/decisions/README.md`](../../templates/decisions/README.md) — jangan diduplikasi di sini.
> Bikin ADR baru: salin [`templates/decisions/_TEMPLATE.md`](../../templates/decisions/_TEMPLATE.md)
> → `docs/decisions/ADR-<NNN>-<slug>.md`.

## Daftar ADR

| No | Judul | Status | Tanggal |
|----|-------|--------|---------|
| [ADR-001](ADR-001-percepatan-modifikasi-tanpa-indeks-graf.md) | Percepatan task modifikasi **tanpa** indeks/graf simbol otomatis | Accepted | 2026-06-19 |
| [ADR-002](ADR-002-runtime-hook-powershell-vs-node.md) | Runtime hook/robot — Node.js (override owner) | Accepted | 2026-06-20 |
| [ADR-003](ADR-003-migrasi-bertahap-powershell-ke-node.md) | Migrasi bertahap PowerShell → Node (Strangler Fig) — kunci 5 keputusan | Accepted | 2026-06-21 |
| [ADR-004](ADR-004-konsolidasi-besar-ke-node.md) | Konsolidasi BESAR ke Node (~98%) — pensiun PS kecuali shim Windows-asli (memperluas appetite ADR-003) | Accepted | 2026-06-22 |
| [ADR-005](ADR-005-jalur-tim-100-persen-node.md) | Jalur tim 100% Node — MOTW+penjaga junction+penulis versi `bump` diport (supersede klaim "MOTW shim PS permanen" di ADR-004); PS jadi cadangan | Accepted | 2026-06-25 |
