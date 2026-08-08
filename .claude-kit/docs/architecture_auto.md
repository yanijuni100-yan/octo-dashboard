# docs/architecture_auto.md — Registry semua file .md di docs/ (TOC)

> Auto-maintained oleh AI · Versi 1 · 2026-06-24
> Baca ini untuk tahu **dokumen mana relevan** dengan task (READ-MINIMAL §7.3) — JANGAN baca semua docs.
> Peta makro repo (struktur folder + alur) ada di [architecture.md](architecture.md).

## Top-level (docs/)
- [PETA_SUMBER_KEBENARAN.md](PETA_SUMBER_KEBENARAN.md) — Di mana tiap fakta tinggal + apakah benar 1-sumber sejati
- [RESEP_PERUBAHAN.md](RESEP_PERUBAHAN.md) — Berkas mana ikut bergerak per jenis perubahan + cara jalankan robot
- [preflight.md](preflight.md) — Gerbang pra-rilis 1-perintah (`npm run preflight`)
- [env-check.md](env-check.md) — Robot "Pemeriksa Lingkungan Setara" (`kit doctor --env`) — akar "beda di client"
- [parity-check.md](parity-check.md) — Alat banding Node vs PowerShell (`parity-check`) — deteksi kalau Node diam-diam beda di client
- [perf-budget.md](perf-budget.md) — Robot anggaran ukuran halaman Next.js (`npx lintasai perf-budget`)
- [BUKU_PELAJARAN.md](BUKU_PELAJARAN.md) — Lesson Ledger: tiap bug yang lolos → penjaga permanen
- [project-manifest.md](project-manifest.md) — Kartu identitas project (`project.lintas.jsonc` / `.psd1`)
- [split-guard.md](split-guard.md) — Robot anti-bocor `.env` saat pecah-repo
- [unicode-safety-check.md](unicode-safety-check.md) — Robot pemindai "huruf-tipuan" Unicode
- [risk-gate.md](risk-gate.md) — Palang Rem aksi berisiko (hook PreToolUse, opt-in)
- [install-secret-hook.md](install-secret-hook.md) — Pasang penjaga rahasia pre-commit OTOMATIS saat install
- [repo-board.md](repo-board.md) — Papan status lintas-repo (cuma-baca)
- [SIGNED_RELEASE.md](SIGNED_RELEASE.md) — Verifikasi GPG signed release
- [NPX_INSTALL.md](NPX_INSTALL.md) — Panduan install lewat npm
- [CLAUDE_CODE_MEDIATED_INSTALL.md](CLAUDE_CODE_MEDIATED_INSTALL.md) — Install tanpa PowerShell (via Claude Code)
- [FAST_SMOKE.md](FAST_SMOKE.md) — SOP smoke test cepat
- [AUDIT_HISTORY.md](AUDIT_HISTORY.md) — Riwayat audit kit

## decisions/ (ADR — keputusan teknis non-sepele)
- [decisions/README.md](decisions/README.md) — Panduan kapan tulis ADR
- [decisions/ADR-001-percepatan-modifikasi-tanpa-indeks-graf.md](decisions/ADR-001-percepatan-modifikasi-tanpa-indeks-graf.md) — Tolak indeks/graf simbol otomatis untuk percepatan modifikasi
- [decisions/ADR-002-runtime-hook-powershell-vs-node.md](decisions/ADR-002-runtime-hook-powershell-vs-node.md) — Runtime hook/robot: PowerShell 5.1 (opt-in) vs Node
- [decisions/ADR-003-migrasi-bertahap-powershell-ke-node.md](decisions/ADR-003-migrasi-bertahap-powershell-ke-node.md) — Migrasi bertahap PS→Node (Strangler Fig)
- [decisions/ADR-004-konsolidasi-besar-ke-node.md](decisions/ADR-004-konsolidasi-besar-ke-node.md) — Konsolidasi besar ke Node (~98%), pensiunkan PowerShell kecuali shim Windows-asli
- [decisions/ADR-005-jalur-tim-100-persen-node.md](decisions/ADR-005-jalur-tim-100-persen-node.md) — Jalur tim 100% Node: MOTW+penjaga junction+penulis versi diport, PS jadi cadangan

## plans/ (rencana internal — TIDAK terbit ke npm)
- [plans/POLA_REPO_AMAN.md](plans/POLA_REPO_AMAN.md) — Struktur repo + database aman untuk tim non-programmer
- [plans/migrasi-besar-node-program.md](plans/migrasi-besar-node-program.md) — Roadmap gelombang migrasi besar ke Node
- [plans/migrasi-powershell-ke-node.md](plans/migrasi-powershell-ke-node.md) — Rencana migrasi bertahap PS→Node
- [plans/migrasi-cetak-biru-implementasi.md](plans/migrasi-cetak-biru-implementasi.md) — Cetak-biru implementasi migrasi
- [plans/keputusan-per-elemen-node-vs-ps.md](plans/keputusan-per-elemen-node-vs-ps.md) — Keputusan Node vs PowerShell per-elemen
- [plans/palang-rem-otomatis.md](plans/palang-rem-otomatis.md) — Rancangan Palang Rem (risk-gate) pinjaman ECC
- [plans/BUKU_PELAJARAN_DAN_PREFLIGHT.md](plans/BUKU_PELAJARAN_DAN_PREFLIGHT.md) — Cetak-biru Buku Pelajaran + gerbang preflight (anti-bug-berulang)
- [plans/install-senyap-dan-command-v1.md](plans/install-senyap-dan-command-v1.md) — USULAN: install senyap + workflow jadi slash-command + anti-timpa aturan client (WP1-4, D1-5)
- [plans/ECC_BORROW_LIST.md](plans/ECC_BORROW_LIST.md) — Daftar onderdil ECC layak-pinjam ke lintasAI
