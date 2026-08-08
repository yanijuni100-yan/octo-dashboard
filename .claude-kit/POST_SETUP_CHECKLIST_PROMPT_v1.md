> ## INI FILE BUAT AI BACA — JALUR `npm create lintasai` (TIPIS, MERUJUK SUMBER TUNGGAL)
>
> File ini dipanggil otomatis oleh `setup-pola-b.ps1` closing message (v1.5.7+) untuk **paksa AI lanjut workflow** setelah install kit selesai.
>
> **v1.6.2 — popup disatukan**: file ini **TIDAK lagi mendefinisikan popup sendiri**.
> Definisi popup (Setup Mode, Audit, Ukuran Tim + Bentuk Kode, Pending Action Items) =
> **sumber tunggal di `.claude-kit/JALANKAN_KIT.md` Bagian 2-7**. File ini cuma
> menjalankan pre-cek lalu **mengeksekusi flow di sana** — supaya 2 jalur (npx vs paste-manual)
> mustahil melenceng (dulu sempat beda: file ini punya Team Mode/Bulk/Skenario sendiri).
>
> **Manual paste kalau**:
> - Sesi AI tutup di tengah workflow (mis. kompaksi, restart) — paste ini supaya AI resume.
> - Setup install pakai v1.5.6 atau lebih lama — paste ini setelah `npm create lintasai`.

---

# POST_SETUP_CHECKLIST_PROMPT_v1 — Auto-Trigger Phase 6+ Setelah Install Kit

> v1.6.2 · 2026-06-10 · WAJIB AI eksekusi setelah `setup-pola-b.ps1` / `npm create lintasai` selesai.
>
> Per `CLAUDE_universal_v1.md` Section 4.3b Phase 5b (Auto-Trigger Post-Setup Checklist) + Section 4.4 (Audit Post-Setup Pattern auto-trigger condition #1).

## Konteks: Kenapa file ini ada

Bug ditemukan saat dogfood test akses 2026-06-08: AI yang menjalankan `npm create lintasai` via Bash tool **stop di "Status: SIAP NGODING"** tanpa lanjut ke Phase 6+ (popup setup, Bulk-bootstrap docs, Audit Post-Setup, dst). User dapet kit ter-install tapi workflow lanjutan tidak ter-trigger.

Fix v1.5.7: closing kit installer sekarang include **explicit AI checklist** (panggil file ini).

Fix v1.6.2: file ini **tidak lagi punya popup sendiri** — dulu definisinya beda dari `JALANKAN_KIT.md` (drift). Sekarang satu sumber.

---

## CHECKLIST WAJIB (AI eksekusi urut, jangan skip)

### [0] WAJIB PRE-SEND CHECKLIST tiap response substantive

SEBELUM AI tutup tiap response di sesi ini (bukan cuma final laporan, TAPI tiap response substantive — code change, ship/release, audit findings, multi-phase workflow), AI WAJIB run PRE-SEND CHECKLIST 4 kategori:

1. **Inline narasi antar tool call** — jelaskan jargon dengan bahasa awam (analogi singkat opsional)
2. **Update Todos** — label content + activeForm bebas jargon mentah
3. **Body final response** — jargon di kemunculan pertama WAJIB dijelaskan dengan bahasa awam (analogi opsional)
4. **Tinjauan lintasAI Divisi (junior-programmer + non-programmer)** — tiap divisi WAJIB 2 sudut pandang: 👨‍🎓 Junior-programmer (teknis, jargon dijelaskan singkat) + 🙂 Non-Programmer (penjelasan bahasa awam 1 kalimat; analogi singkat opsional — tidak wajib 3-lapis). Heading literal **tanpa angka divisi**: "🎯 Tinjauan lintasAI Divisi"

Detail PRE-SEND CHECKLIST: lihat `CLAUDE_universal_v1.md` Section 2.1.1 + Reference Card translasi jargon di Section 2.1.

**Indicator violation**: kalau output punya >3 jargon teknis yang dibiarkan mentah tanpa penjelasan awam → STOP, rewrite SEMUA, baru kirim.

### [1] Auto-detect: project setengah-jadi vs fresh

> **SUMBER TUNGGAL kriteria deteksi = `JALANKAN_KIT.md` Bagian 3 step 10** (kriteria OR semantik). JANGAN definisikan ambang angka sendiri di sini — dulu sempat beda dari step 10 (`src/lib` 3 vs 10) + memakai perintah Unix yang gagal di Windows; di-fix v1.43.1.

AI WAJIB deteksi pakai **tool berkas Claude Code (`Glob` / `Grep` / `Read`), BUKAN perintah shell mentah.** Perintah Unix `find` / `grep` / `wc` GAGAL di PowerShell (shell utama Windows): `find` → `find.exe` Windows (alat cari-TEKS, bukan cari-file) → "File not found", `grep` / `wc` tidak ada → hasilnya **0 PALSU** yang bikin project setengah-jadi salah-vonis "kosong" → audit dilewati (= kegagalan inti yang ini perbaiki).

Cara deteksi (tool-agnostik, jalan di Windows & non-Windows):
- **File kode nyata**: `Glob` pola seperti `src/**/*.{ts,tsx,js,jsx,py,go,rb,php}` (sesuaikan folder kode project) — JANGAN hitung tes/config/auto-generated.
- **Database**: `Glob` / `Read` `prisma/schema.prisma` · `db/schema.ts` · `models/*` · `migrations/*` · `@Entity` → hitung jumlah model/tabel.
- **Shared lib**: `Glob` `src/lib/**`.
- **Halaman / route / aset merek**: `Glob` folder dashboard/halaman, route API, logo/favicon custom (non-default).

Vonis **MATURE (setengah-jadi)** kalau **SALAH SATU (OR)** kriteria step 10 `JALANKAN_KIT.md` terpenuhi (folder dashboard 3+ subfolder · ATAU 5+ model/tabel DB · ATAU `src/lib/` 10+ file · ATAU 5+ route API · ATAU aset merek custom · ATAU jelas banyak file kode nyata berfitur). **JANGAN pakai ambang kaku** (step 10 melarangnya — bikin project ukuran sedang kelewat audit).

> **FAIL-SAFE (WAJIB):** kalau scan GALAT atau hasilnya 0 yang mencurigakan untuk project yang seharusnya ada isinya → **JANGAN simpulkan "kosong".** Pakai kriteria OR + kalau ragu **TANYA user**. Default = **MENAWARKAN audit, bukan melewati** (selaras `JALANKAN_KIT.md` Bagian 3 baris 176-177 "JANGAN lewati diam-diam").

Lapor ke user: *"Sepertinya project-mu **sudah jalan separuh** (ada N berkas kode, M tabel database). Jadi aku akan jelaskan agak lengkap dulu."* (atau "project masih kosong/baru" kalau tanda-tandanya minimal). Hasil deteksi ini dipakai untuk default popup di Bagian 2/3 `JALANKAN_KIT.md` + menentukan apakah menawarkan Stage 4 Rapikan (kalau ada code existing) atau Stage 1 Kickoff (kalau benar-benar kosong).

### [2] WAJIB jalankan popup flow dari SUMBER TUNGGAL (`JALANKAN_KIT.md`)

> **JANGAN definisikan popup di sini.** Baca `.claude-kit/JALANKAN_KIT.md` lalu **jalankan apa adanya**:
>
> - **Bagian 2 — Popup #1 Setup Mode** (LENGKAP / CEPAT / PILIH SENDIRI).
> - **Bagian 3 — Popup #2 Audit menyeluruh** (conditional, cuma muncul kalau project SUDAH ADA kodenya; denah + catatan ditunda ke akhir biar tak 2x — v1.43.0).
> - **Bagian 4 — Popup #3 Ukuran Tim + Bentuk Kode** (gabungan — v1.43.0; **default & posisi [1] = tetap 1 tempat + rapikan / TIM KECIL**). Versi PENUH (project berkode + monorepo): [1] tetap 1 tempat+rapikan / [2] pecah 3 repo / [3] microservice 6-10 (varian shared-database). Versi RINGKAS (kosong / sudah terpecah): cuma ukuran tim. Skenario adopsi DIDETEKSI OTOMATIS (setengah jadi → tawaran Rapikan tergabung di opsi [1]; kosong → Stage 1 Kickoff).
> - **Bagian 5 / 5c — eksekusi rapikan / pecah-repo** (derive dari pilihan Popup #3, kalau ada kode).
>
> Tampilkan tiap popup sebagai **popup klik** (tool `AskUserQuestion` — kotak pilihan bisa diklik) kalau tool tersedia; opsi rekomendasi di posisi PERTAMA + "(rekomendasi)". Fallback HANYA kalau tool tak ada: chat-text numbered list (user balas ketik angka). Aturan lengkap: `JALANKAN_KIT.md` > "Cara Tampil Popup". Baris "Default (Enter/kosong) → [N]" hanya berlaku di mode teks — mode klik tidak punya Enter, opsi default dipindah ke posisi pertama "(rekomendasi)".

### [3] Eksekusi sesuai pilihan user

Mapping eksekusi (Setup Mode × Audit × Ukuran Tim + Bentuk Kode) **sudah didefinisikan lengkap di `JALANKAN_KIT.md`** (Bagian 2 step 9, Bagian 3 step 12, Bagian 4 step 14, Bagian 5/5c step 19-20). Ikuti itu — jangan bikin mapping baru di sini.

### [4] WAJIB tawarkan Audit Post-Setup (Section 4.4 #1)

Audit ditawarkan via `JALANKAN_KIT.md` Bagian 3 (Popup #2). Kalau user pilih "ya" → execute `AUDIT_POST_SETUP_PROMPT_v1.md` (mode aman cuma-baca, scan multi-dimensi, output diurut risiko rendah→tinggi dengan penjelasan bahasa awam non-programmer).

### [5] WAJIB lapor Pending Action Items

> **Definisi + tabel 7-row + aturan tier-aware popup-per-item = SUMBER TUNGGAL di `JALANKAN_KIT.md` Bagian 7.**
> Jalankan Bagian 7 itu — jangan duplikasi tabelnya di sini. (Sebelum v1.6.2 tabel ada di 2 tempat dan sempat beda; sekarang satu sumber.)

---

## Cara skip checklist (kalau user veteran / re-run install)

User boleh ketik di awal sesi:
- `skip post-setup checklist` → AI lewati semua, langsung "siap kerja"
- `cuma popup 3 / cuma audit` → AI execute selective sub-step
- `verbose post-setup` → AI execute full workflow + extra explanation per step (untuk staff baru)

Default kalau user diam: AI execute full workflow [1] → [5] dengan default tiap popup.

---

## [6] LARANGAN

- AI **TIDAK BOLEH** stop di "Status: SIAP NGODING" tanpa lapor checklist (1-5) di atas.
- AI **TIDAK BOLEH** mendefinisikan popup versi sendiri di sini — WAJIB jalankan definisi `JALANKAN_KIT.md` (sumber tunggal). Mendefinisikan ulang = bikin drift (bug yang di-fix v1.6.2).
- AI **TIDAK BOLEH** cuma "lapor tabel diam" untuk langkah [5] — WAJIB tier-aware popup-per-item (`JALANKAN_KIT.md` Bagian 7).
- AI **TIDAK BOLEH** auto-execute Tier A/C action tanpa popup confirm user — selalu tanya dulu.

---

## Cross-reference

- `.claude-kit/JALANKAN_KIT.md` — **SUMBER TUNGGAL** popup (Bagian 2-7)
- `.claude-kit/CLAUDE_universal_v1.md` Section 4.3b Phase 5b (Auto-Trigger Post-Setup)
- `.claude-kit/CLAUDE_universal_v1.md` Section 4.4 trigger condition #1 (audit auto-offer)
- `.claude-kit/PROJECT_LIFECYCLE_PROMPT_v1.md` Stage 1/2/4
- `.claude-kit/AUDIT_POST_SETUP_PROMPT_v1.md` (lengkap audit workflow)
- `.claude-kit/SPLIT_REPO_MIGRATION_PROMPT_v1.md` (split + rambu skala-besar: kunci pengaman gabung + gabung-otomatis-aman)
- `.claude-kit/templates/MIGRATE_TO_SUBFOLDER_PROMPT_v1.md`
- `.claude-kit/templates/DB_SCHEMA_SCAN_PROMPT.md`
- `.claude-kit/templates/RLS_SETUP_PROMPT.md`
- `.claude-kit/templates/DISCORD_BOT_INTEGRATION.md`
