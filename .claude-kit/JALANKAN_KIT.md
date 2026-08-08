> ## INI FILE BUAT AI BACA, BUKAN KAMU!
>
> **Halo staff baru!** Kalau kamu **bukan programmer**, JANGAN baca isi file ini - bikin pusing dan nggak perlu. Langsung buka **`MULAI_DI_SINI.md`** (1 halaman, bahasa awam).
>
> **Cara pakai file ini (4 langkah):**
> 1. Buka **Claude Code** (aplikasi AI-nya).
> 2. **Copy seluruh isi file ini**: tekan `Ctrl+A` (select all) lalu `Ctrl+C` (copy).
> 3. **Paste ke chat Claude Code**: tekan `Ctrl+V` lalu Enter.
> 4. **Selesai** - AI auto-execute semua langkah di bawah.
>
> **Total waktu**: ~5 menit kamu copy-paste + AI kerja sendiri.

---

> ## 📌 SUMBER TUNGGAL ISI POPUP
>
> File ini = **satu-satunya tempat** definisi popup setup (Setup Mode, Audit,
> Ukuran Tim + Bentuk Kode, Pending Action Items). Jalur `npm create lintasai` (`POST_SETUP_CHECKLIST_PROMPT_v1.md`)
> **TIDAK** mendefinisikan popup sendiri — ia **menjalankan popup yang didefinisikan DI SINI**.
> Tujuannya: isi popup mustahil melenceng antar-2 jalur (dulu sempat beda).
>
> - **Jalur utama** (staff non-programmer): `npm create lintasai` → closing kit
>   panggil `POST_SETUP_CHECKLIST_PROMPT_v1.md` → file itu menjalankan Bagian 2-7 file INI.
> - **Jalur cadangan** (kalau pasang gagal / sesi putus): owner paste file ini manual → flow sama persis.

---

Tolong jalankan setup Pola B kit AI di proyek ini. Aku sudah copy folder `claude-ai-rules-kit/` (atau versi terbaru di-extract dari zip / di-clone dari GitHub) ke root proyek.

Eksekusi workflow ini end-to-end (rename folder, run script, write skeleton `docs/` + file tim `.github/`, scan struktur proyek read-only). AI proceed dengan defaults tanpa nanya tiap step REGULER. **Tampilkan PETA LANGKAH dulu (Bagian 0)**, lalu jalankan **beberapa popup utama** sesuai kondisi project (cara pasang, ukuran tim, audit, pecah-repo — yang relevan saja); tiap selesai langkah, umumkan kesimpulan + langkah berikutnya. Destructive ops tetap WAJIB konfirmasi 1x.

> **Confirmation Policy (auto-confirm mode)**: Sesuai user auto-confirm preference: AI proceed dengan defaults tanpa nanya tiap step REGULER. Beberapa popup utama (cara pasang, ukuran tim, audit, pecah-repo — yang relevan saja) yang require explicit input. Destructive ops (delete, force-push, rm -rf, DROP, prisma migrate prod) tetap WAJIB konfirmasi 1x walau auto-confirm aktif. Lihat `CLAUDE_universal_v1.md` section 8.1 (AI Anti-Prompt-Injection Rules) untuk detail.

> Catatan: Claude Code IDE mungkin tetap nanya YES/NO untuk tool call individu (PowerShell, Edit) tergantung permission setting kamu (centang "Always allow" kalau muncul). Itu IDE-level, bukan dari prompt ini.

---

## Klarifikasi Terminologi Popup (BACA DULU — Anti-Misinterpretation)

> v1 · 2026-06-08 · Lintasai punya **2 sistem popup** yang sering tertukar. Dokumen ini pakai keduanya — kenali bedanya supaya tidak salah expect.

### Tipe A — **AI Popup dalam chat** (pertanyaan dari AI di sesi Claude Code)

- **Apa**: pertanyaan pilihan dari AI ke user. **2 bentuk tampil (v1.11.0 — "popup klik dulu, teks cadangan")**:
  - **A-klik (UTAMA — WAJIB kalau tersedia)**: AI pakai tool popup-pilihan native Claude Code (`AskUserQuestion`) → muncul **kotak pilihan yang BISA DIKLIK**. User tinggal **klik** jawabannya — tidak perlu baca blok teks panjang, tidak perlu ketik angka.
  - **A-teks (CADANGAN)**: HANYA kalau tool popup tidak tersedia (harness non-Claude-Code / tool error) → AI tulis blok pertanyaan teks (markdown numbered list), user balas ketik **digit `1` / `2` / `3` / `Enter`** atau token seperti `[skip]` / `[cancel]`.
- **Medium**: dalam chat/IDE Claude Code — kotak pilihan klik (A-klik) atau teks (A-teks). **TIDAK ADA window Windows terpisah yang pop up**.
- **Trigger**: prompt MD yang AI execute (mis. `JALANKAN_KIT.md`, `AUDIT_POST_SETUP_PROMPT_v1.md`).
- **Contoh di kit**:
  - `JALANKAN_KIT.md` **Popup #1 / #2 / #3** (Setup Mode / Audit / Ukuran Tim + Bentuk Kode)
  - `CLAUDE_universal_v1.md` section 4.4 Audit (popup tawar audit READ-ONLY — detail di `LINTASAI_WORKFLOWS_v1.md` §4.4)
  - `CLAUDE_universal_v1.md` section 4.5 Update Strategy (popup confirm 3-option ya/nanti/batal)
- **Headless-safe**: aman jalan via SSH / Server Core / CI — mode A-teks (fallback) cuma text di chat, tidak butuh display.
- **Auto-confirm mode**: AI **TETAP wajib tunggu user reply** untuk Tipe A (sesuai section 8.1 anti-prompt-injection). Cuma destructive ops yang force konfirmasi.

### Tipe B — **WPF GUI Popup** (Windows native dialog, mouse-click)

- **Apa**: PowerShell script (`setup-pola-b.ps1`, `install-windows.ps1`, helper di `lib/popup-helpers.ps1`) tampilkan **window Windows native** (WPF) → user **klik tombol mouse** atau ketik di text field GUI.
- **Medium**: Windows desktop window (visual dialog box), bukan chat text.
- **Trigger**: PS script eksekusi via `Show-LintasChoicePopup`, `Show-LintasYesNoPopup`, `Show-LintasInputPopup`, `Show-LintasNumberedChoicePopup`, `Show-LintasInfoPopup`, `Show-LintasSecurityChoicePopup`.
- **Contoh di kit**:
  - `setup-pola-b.ps1`: AGENTS.md choice (Skip/Overwrite/Backup), email input, "Buka VS Code?", Tip dialog
  - `docs/CLAUDE_CODE_MEDIATED_INSTALL.md` Step 3 "5x klik popup"
- **Auto-fallback**: kalau detect headless (no display) → **collapse ke `Read-Host` console mode** dengan **default safe choice** terpilih otomatis (`-NoGui` switch atau env detect). Lihat troubleshoot section "Popup tidak muncul" di `docs/CLAUDE_CODE_MEDIATED_INSTALL.md` L94.
- **Auto-confirm mode**: AI **tidak bisa bypass** Tipe B karena ini level OS dialog. User WAJIB klik manual (atau script jalan pakai default).

### Quick-Reference: di file ini "popup" merujuk ke yang mana?

| File | Default makna "popup" | Catatan |
|---|---|---|
| `JALANKAN_KIT.md` | **Tipe A** AI Popup dalam chat | Semua "Popup #1/#2/#3" = **popup klik** (`AskUserQuestion`) kalau tersedia; fallback teks ketik-angka. Tidak ada window Windows terpisah. |
| `CLAUDE_universal_v1.md` section 4.4 / 4.5 / 14 | **Tipe A** AI Popup dalam chat | Mis. popup audit/update = kotak klik (`AskUserQuestion`) kalau tersedia; fallback teks ketik-angka di chat. |
| `CLAUDE_universal_v1.md` section 14.1 | **Keduanya** (UNIFIED convention) | Aturan format konsisten untuk Tipe A + Tipe B. |
| `docs/CLAUDE_CODE_MEDIATED_INSTALL.md` | **Tipe B** WPF GUI | Semua "klik popup" = window Windows native (mouse-click). |
| `MULAI_DI_SINI.md` L119 | **Keduanya** (generic FAQ) | Aturan defensif: ragu = STOP, tanya owner Discord. |
| PS scripts (`setup-pola-b.ps1`, `install-windows.ps1`, `lib/popup-helpers.ps1`) | **Tipe B** WPF GUI dengan auto-fallback Read-Host | Headless = console mode, default safe. |

### Rule of Thumb (kalau ragu)

- **Lihat siapa yang execute** → AI execute prompt MD = Tipe A. PowerShell execute `.ps1` = Tipe B.
- **Lihat verb yang dipakai** → "klik opsi DI DALAM chat / ketik `1`/`2` balas chat" = Tipe A. "window Windows TERPISAH muncul, klik tombol" = Tipe B.
- **Lihat headless behavior** → "always works via SSH" = Tipe A. "auto-fallback ke Read-Host kalau headless" = Tipe B.
- **Lihat nama function** → `Show-Lintas*Popup` PS function = Tipe B selalu. `AskUserQuestion` / markdown numbered list di chat = Tipe A selalu.

### Owner-facing Expectation Setting

Saat owner paste `JALANKAN_KIT.md` ke Claude Code chat: AI akan menampilkan Popup #1 sebagai **kotak pilihan yang bisa DIKLIK** (fitur kotak-pilihan bawaan Claude Code) — owner tinggal klik jawaban. Kalau yang muncul justru blok teks `[1]/[2]/[3]`, itu mode cadangan — balas dengan ketik angka di chat. **JANGAN tunggu window Windows terpisah.** Popup Tipe B (jendela Windows terpisah, mirip kotak "Save As" di Word) baru muncul saat `setup-pola-b.ps1` jalan (Bagian 1 step 4) untuk AGENTS.md choice + email input + "Buka VS Code?" — itu dijalankan skrip PowerShell, bukan AI di chat.

### Cara Tampil Popup (WAJIB — berlaku untuk SEMUA popup Tipe A: Popup #1/#2/#3, popup Bagian 6 & 7, DAN popup Tipe A di file lain — audit / update / split-repo / lifecycle)

> v1.11.0 · Feedback owner 2026-06-12: blok teks panjang ketik-angka TIDAK terasa seperti "popup" buat staf non-programmer — yang diharapkan = kotak pilihan klik.

1. **Kalau tool popup-pilihan native tersedia** (di Claude Code: `AskUserQuestion`) → AI **WAJIB** render tiap popup lewat tool itu: 1 pertanyaan per popup, label singkat (detail panjang masuk description tiap opsi), **opsi recommended ditaruh PERTAMA + akhiran "(rekomendasi)"** — pakai kata yang SAMA dengan label blok teks (label IDENTIK antar mode, selaras RULE-7; JANGAN ganti jadi "(Recommended)" Inggris).
2. **Maks 4 opsi UTAMA per pertanyaan.** Opsi meta (`[skip]`/`[cancel]`/`[help]`) **TIDAK ikut dihitung dan JANGAN dijadikan opsi klik tersendiri** — di mode klik user memakai "Other" (ketik `skip`/`cancel`/`help`); sebut singkat di teks pertanyaan kalau perlu. Kalau opsi utama >4 → pecah jadi 2 pertanyaan. Pertanyaan **multi-pilih** (mis. sub-menu PILIH SENDIRI pilih kategori) → pakai mode multi-pilih tool; kalau daftarnya terbuka/panjang → tanya sebagai teks bebas (bukan popup pilihan).
3. **Blok teks `[1]/[2]/[3]` di tiap Bagian = ISI KANONIK + fallback** — sumber kebenaran label & makna opsi. Dipakai persis apa adanya HANYA kalau tool popup tidak tersedia. **JANGAN render dobel** (popup klik + blok teks sekaligus = membingungkan).
4. **Mode klik TIDAK punya tombol Enter/default** — user wajib klik salah satu. Konsekuensi: (a) baris "Default (Enter/kosong) → [N]" hanya berlaku di mode teks; (b) opsi yang jadi default di mode teks WAJIB dipindah ke posisi PERTAMA + "(rekomendasi)" saat dirender klik; (c) khusus **popup destruktif/berisiko** (yang di mode teks sengaja menaruh opsi aman BUKAN di [1] supaya user ketik angka eksplisit): di mode klik **opsi AMAN ditaruh PERTAMA + "(rekomendasi)"** dan opsi berisiko paling BAWAH — satu klik salah lebih gampang terjadi daripada salah ketik angka.
5. **Default dinamis MENANG atas urutan blok teks**: kalau popup punya auto-deteksi (RULE-4b — mis. Popup #2 "Enter = auto-deteksi"), jalankan deteksinya DULU sebelum popup, lalu taruh HASIL deteksi sebagai opsi pertama "(rekomendasi)". Urutan kanonik blok teks = cadangan kalau deteksi gagal.
6. **Bahasa tampilan WAJIB awam (per §2.1 CLAUDE_universal)**: SEMUA teks yang AI tampilkan ke user — pertanyaan popup, label & description opsi, pesan status, laporan — WAJIB bahasa non-programmer. Kalau blok kanonik masih mengandung jargon mentah (mis. "monorepo", "split repo", "business logic", "commit ke docs/"), AI WAJIB **menerjemahkannya saat merender** (jargon → padanan awam + analogi singkat kalau perlu) — **makna, jumlah, dan nomor opsi TIDAK berubah**. Contoh: "monorepo" → "1 repo berisi semua bagian aplikasi"; "split repo" → "pecah aplikasi jadi beberapa repo terpisah"; "business logic" → "logika bisnis (aturan main aplikasi)".

---

## WORKFLOW (lakukan otomatis tanpa konfirmasi tambahan AI-side, kecuali popup yang ditandai)

### Bagian 0 - Tampilkan PETA LANGKAH dulu (WAJIB — biar user tahu posisi)

> v1.16.0 · Feedback owner 2026-06-14: staf non-programmer bingung "sekarang di langkah mana + apa berikutnya". AI WAJIB tampilkan peta langkah SEBELUM mulai, lalu umumkan posisi tiap pindah bagian. Tujuan: alur terasa seperti rangkaian popup yang jelas (pilih → dikerjakan → ditawari lagi), bukan hal-hal yang jalan diam-diam.

0a. **Sebelum mulai**, AI tampilkan peta langkah ringkas (bahasa awam). Sesuaikan jumlah langkah dengan kondisi project — bagian conditional yang TIDAK muncul (audit/rapikan/pecah-repo untuk project kosong) jangan dihitung. **WAJIB sebelum menampilkan: (a) ganti `X` dengan jumlah langkah NYATA untuk kondisi project ini — JANGAN tampilkan huruf `X`; (b) untuk project KOSONG, langkah 3 (audit) + 5 (rapikan/pecah) hilang → renumber JADI urutan RAPAT (1,2,3...), JANGAN tampilkan nomor berlubang yang bikin staff kira ada langkah gagal/terlewat.**
```
🗺️ Pemasangan lintasAI - peta langkah (kira-kira X langkah):
  1. Pasang kit + aturan tim (otomatis, ~1 menit)
  2. POPUP: pilih cara pasang (lengkap / cepat / pilih-sendiri)
  3. POPUP: audit menyeluruh? (HANYA kalau project sudah ada kodenya — kalau kosong, langkah ini hilang & nomor digeser rapat)
     - denah project + database & catatan dibuat NANTI di langkah akhir, biar tidak 2x kerja
  4. POPUP: ukuran tim + bentuk kode
     [1] tetap 1 tempat + rapikan kode bertingkat (ringan->sedang->berat)  - cocok 1 orang
     [2] pecah per-lapisan: 2-3 repo (FE + BE, shared opsional) 🧪 BETA    - cocok tim 3-5+
     [3] microservice: 1 repo per wilayah rahasia (contoh 6-10) 🧪 BETA    - cocok tim 15-30+
         (🧪 [2]+[3] = BETA: mesin pecah-repo belum diuji penuh di GitHub nyata — saran "uji di project coba-coba dulu" + detail muncul saat tiba di langkah 5)
         (📐 jumlah repo IKUT jumlah wilayah rahasia + kelompok tim, BUKAN angka tetap — sumber: docs/plans/POLA_REPO_AMAN.md)
         (⚠️ project KOSONG: pecah 3-repo / microservice dari nol BELUM otomatis — AI jelaskan jalan sementara saat tiba di sini)
  5. Kerja otomatis: rapikan / pecah kode sesuai pilihan #4 (HANYA kalau ada kodenya — kalau kosong, langkah ini hilang)
  6. Buat catatan kode tiap file - 2 versi: 👨‍💻 programmer + 🙂 bahasa awam
     (+ denah project + denah database) - di langkah akhir biar cocok dengan kode final
  7. Laporan daftar tugas-menunggu (tiap tugas ada popup-nya)
Kita mulai dari langkah 1. Aku kabari tiap pindah langkah.
```

0b. **Tiap selesai 1 langkah**, AI WAJIB tutup dengan kesimpulan 1-baris bahasa awam + **penunjuk posisi "Langkah N dari M"** + sebut langkah berikutnya (§4.7 aturan 4): *"✅ Selesai Langkah N dari M: <hasil singkat>. Berikutnya (Langkah N+1 dari M): <popup/kerja apa>."* JANGAN lompat langkah tanpa pemberitahuan, JANGAN biarkan ada tugas besar jalan tanpa user tahu sedang apa.

### Bagian 1 - Setup teknis (auto, no popup)

1. Konfirmasi folder kit (`claude-ai-rules-kit/` atau nama serupa, atau `.claude-kit/` kalau clone dari GitHub) ada di root proyek.
2. Rename folder jadi `.claude-kit/` kalau belum (PowerShell `Rename-Item`). Kalau hasil clone, biasanya sudah `.claude-kit/`.
3. **Kalau hasil clone**: penghapusan `.claude-kit/.git/` (supaya tidak konflik dengan git proyek user) **dilakukan OTOMATIS oleh `setup-pola-b.ps1`** (fungsi `Remove-GitMetadata` — aman, idempoten, terbatas ke `.claude-kit/.git` saja). AI **TIDAK perlu** menjalankan `Remove-Item -Recurse -Force` manual: itu perintah hapus-paksa (aksi merusak yang menurut aturan kit butuh konfirmasi) dan rawan salah-target kalau folder belum di-rename / posisi kerja salah.
4. Jalankan `.\.claude-kit\setup-pola-b.ps1 -Force` via PowerShell. **Pengaman `AGENTS.md` (penting untuk project setengah-jadi):** kalau project SUDAH punya `AGENTS.md` bermakna (tulisan tim / dari tool AI lain — BUKAN format lintasAI), AI WAJIB tampilkan popup dulu SEBELUM pakai `-Force`: `[1] Cadangkan lalu ganti (rekomendasi — file lamamu disimpan otomatis sebagai cadangan ber-timestamp, lalu AGENTS.md lintasAI dipasang supaya aturannya kebaca) / [2] Pertahankan yang lama (konsekuensi: aturan lintasAI tidak terpasang penuh)`. JANGAN timpa diam-diam (§14.1 + §1.1). Kalau `AGENTS.md` belum ada / masih kosong → `-Force` langsung aman. Kalau kena Execution Policy: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` dulu — ini **cuma melonggarkan aturan untuk jendela PowerShell itu saja (hilang saat ditutup), bukan mematikan keamanan Windows permanen**.
5. Tunjukkan output script (setup-pola-b.ps1 auto-copy file skeleton + 35 file tim profesional ke proyek by default).
6. Verifikasi: `AGENTS.md` di root tergenerate + file inti `.claude-kit/` ter-copy + file skeleton `docs/` ada + **35 file tim** (angka 35 dijaga robot konsistensi; rincian per folder lihat step 16). Hindari mematok jumlah file inti/skeleton di sini — kalau butuh angka pasti, hitung dari `lib/kit-files.psd1` (sumber tunggal) supaya tak basi saat kit bertambah.
7. Baca `AGENTS.md` + `.claude-kit/CLAUDE_universal_v1.md` (terutama seksi 4.1 Tinjauan lintasAI Divisi + 4.2 Pattern-Driven + 4.3 Guided Step-by-Step + 7.1-7.5 dokumentasi) untuk load aturan.

### Bagian 2 - POPUP UTAMA #1: Setup Mode

> **Sebelum show popup**, AI auto-detect stack via `templates/STACK_DETECTION_PATTERN.md` + kematangan project + monorepo state. Hasil deteksi dipakai untuk Popup #2 (audit) conditional + menyusun opsi & default Popup #3 (ukuran tim + bentuk kode).

8. **AI WAJIB tanya user** (Popup #1 — tampilkan sebagai **popup klik** per "Cara Tampil Popup" di atas; blok di bawah = isi kanonik + fallback teks):

```
🎯 Pemasangan lintasAI - Pilih cara (Enter = LENGKAP, disarankan):

[1] LENGKAP (rekomendasi) ⭐ DEFAULT — staff langsung dapat peta proyek + denah database yang akurat, tanpa celah catatan (paling pas kalau project sudah punya banyak kode)
    ✅ Pasang kit + aturan tim
    ✅ Bikin catatan project + denah database lengkap:
       • Project KOSONG/fresh    -> dibuat SEKARANG (~30-60 menit)
       • Project SUDAH ADA ISInya -> denah database SEKARANG; catatan KODE
         dibuat di AKHIR, setelah audit + rapikan/pecah (biar tidak cepat basi)
    ✅ Staff dapat peta lengkap yang AKURAT (cocok dengan kode final)
[2] CEPAT
    ✅ Pasang kit + aturan tim
    ✅ Catatan dibuat OTOMATIS saat dibutuhkan (~5 menit)
    ⚠️ Konsekuensi: peta proyek + denah lengkap BELUM dibuat di awal — muncul
       sepotong-sepotong saat dibutuhkan (cocok kalau mau cepat jalan dulu)
[3] PILIH SENDIRI
    Atur per bagian (untuk yang sudah paham) — kamu pilih sendiri bagian mana
    yang dibuat; konsekuensi: bisa ada yang kelewat kalau belum hafal

Ketik angka: ___ (kosong/Enter = 1 LENGKAP)
```

9. Tunggu jawaban user (auto-confirm: kosong/Enter → "1" = LENGKAP, disarankan):
   - **"1" / Enter / kosong** ⭐ DEFAULT → Mode LENGKAP. Lanjut Popup #2 (audit). Bulk-bootstrap catatan + denah dijalankan sesuai Bagian 4b/6 (project KOSONG: di Bagian 4b; project MATANG: di AKHIR Bagian 6, sesudah audit + rapikan/pecah).
   - **"2"** → Mode CEPAT. Lanjut Popup #2. Bulk-bootstrap di-defer (LAZY-GENERATE per-file aktif).
   - **"3"** → Mode PILIH SENDIRI. Lanjut Popup #2, lalu tampilkan **sub-menu PILIH SENDIRI** (popup multi-pilih per "Cara Tampil Popup" poin 2 — user boleh centang lebih dari satu kategori catatan yang mau dibuat sekarang): **[ ] Auth/login · [ ] Database · [ ] Keamanan · [ ] API/route · [ ] Entry point (main/app/layout) · [ ] Modul fitur (folder `features/`/`modules/`)**. Yang dicentang dibuatkan catatannya sekarang; sisanya pakai LAZY-GENERATE per-file saat disentuh nanti. Kalau daftar kategori project terlalu panjang/terbuka → tanya sebagai teks bebas (kategori mana yang diprioritaskan).

### Bagian 3 - POPUP UTAMA #2: Audit menyeluruh? (conditional — cuma kalau project SUDAH ADA kodenya)

> **Pindah urutan (v1.43.0, permintaan owner):** audit kini ditanya SEBELUM keputusan bentuk-kode (Bagian 4), supaya temuannya jadi bahan pertimbangan saat memilih rapikan vs pecah. **denah project + denah database + catatan kode SENGAJA tidak dibuat sekarang** — SEMUA dibuat di langkah AKHIR (Bagian 6) biar cocok dengan kode final + tidak 2x kerja.

10. **AI auto-detect kematangan project** mengikuti kriteria `templates/STACK_DETECTION_PATTERN.md` — **MATURE (sudah ada kodenya) kalau SALAH SATU (OR) terpenuhi**: folder dashboard/halaman dengan 3+ subfolder · ATAU schema database dengan 5+ model/tabel · ATAU `src/lib/` dengan 10+ file · ATAU 5+ route API · ATAU aset merek custom (logo/favicon non-default) · ATAU jelas banyak file kode nyata berfitur. (Hitung **file kode nyata** `.ts/.tsx/.js/.py/.go/dst` — JANGAN hitung tes/config/auto-generated.) Project disebut **FRESH/kosong** hanya kalau hampir SEMUA tanda itu TIDAK ada (mis. `src/app/` cuma `page.tsx`+`layout.tsx`, tak ada schema, `src/lib/` ≤1-2 file). **Pakai kriteria OR ini — JANGAN pakai ambang kaku "≥90 file DAN semua syarat" (bikin project nyata ukuran sedang kelewat audit).**
- **Project FRESH/kosong** → lewati Popup #2 audit (tak ada kode untuk diaudit), langsung ke Bagian 4 — **TAPI sebut singkat ke user** ("project masih kosong, audit dilewati; nanti otomatis ditawarkan begitu ada kode"). JANGAN lewati diam-diam tanpa kabar.
- **Ragu / MIXED** (ada sebagian tanda tapi belum jelas matang) → **JANGAN lewati diam-diam**. TANYA user: "project-mu sepertinya sudah ada isinya tapi belum besar — mau diaudit?" Default ke MENAWARKAN, bukan melewati.

11. **Kalau project matang, AI WAJIB tanya** (Popup #2 — tampilkan sebagai **popup klik** per "Cara Tampil Popup" di atas; blok di bawah = isi kanonik + fallback teks):

```
🔍 Project kamu sudah ada kodenya (terdeteksi: folder/halaman/database sudah terisi fitur nyata yang jalan).

Mau audit menyeluruh dulu? (diperiksa dari 11 sisi, 5-10 menit, mode aman cuma-baca)
Catatan: denah project + database + catatan kode dibuat NANTI di langkah akhir (biar cocok kode final, tidak 2x).

Pilihan:
  [1] Ya, audit menyeluruh sekarang (cek 11 sisi, 5-10 menit) (rekomendasi, default) — mumpung baru dipasang, sekali cek langsung ketahuan yang perlu dibenahi; mode aman cuma-baca
  [2] Tidak, lewati audit (bisa dijalankan kapan saja nanti: ketik "audit project")
Default (Enter/kosong) -> [1] Ya
```

12. Tunggu jawaban (auto-confirm mode teks: kosong/Enter → [1]; di mode klik user wajib klik salah satu):
   - **"1" / "Y" / Enter / kosong** ⭐ DEFAULT → Eksekusi `AUDIT_POST_SETUP_PROMPT_v1.md` (mode aman cuma-baca). **11 sisi diperiksa** (saat lapor ke user pakai bahasa awam ini, JANGAN salin istilah Inggris): perapian kode, keamanan, tes otomatis, database, kirim-ke-server, kecepatan, tampilan/frontend, kemudahan-pakai (UI/UX), SEO, kelengkapan catatan, kesiapan staf baru. Tiap temuan dicek-silang dengan sikap skeptis (biar tidak mengada-ada), lalu diurut dari risiko rendah → tinggi (3 tingkat) + analogi non-programmer. **Temuan audit jadi BAHAN untuk Popup #3 (Bagian 4)** — kalau audit nemu banyak peluang rapikan, AI sebut itu saat menawarkan opsi [1] (tetap 1 tempat + rapikan).
   - **"2" / "N" / [skip]** → Lewati audit; lanjut ke Bagian 4. (Audit bisa dijalankan kapan saja nanti: ketik "audit project" / paste `AUDIT_POST_SETUP_PROMPT_v1.md` / "periksa seluruh kode".)

### Bagian 4 - POPUP UTAMA #3: Ukuran tim + bentuk kode (gabungan — v1.43.0)

> **Gabung 2 pertanyaan lama jadi 1 (v1.43.0, permintaan owner):** dulu "ukuran tim" (Popup #2 lama) dan "pecah-repo" (Bagian 6 lama) ditanya terpisah. Sekarang DIGABUNG — ukuran tim diturunkan dari pilihan bentuk-kode (lebih sedikit klik + bentuk-repo langsung nyambung dengan ukuran tim).
> **Auto-detect dulu** (sebelum popup): `Get-MonorepoState -ProjectRoot $PWD` (`lib/project-detect.ps1`) → `IsMonorepo` + `MonorepoFlavor` + `Confidence`; `Test-PostSplitState` → kalau `IsPostSplit=true` (marker `.claude-kit/.split-state` / AGENTS.md post-split / sibling repos) maka opsi pecah TIDAK relevan (sudah terpecah) — pakai versi RINGKAS (13a). **Dynamic re-order (RULE-4b):** taruh opsi paling relevan di [1]; default kit = opsi [1] (tetap 1 tempat + rapikan) — JANGAN geser ke pecah kecuali sinyal KUAT (roster ≥5 / monorepo besar multi-tim).

13a. **Project KOSONG / fresh** (belum ada kode) ATAU **bukan monorepo / sudah terpecah** → tampilkan **versi RINGKAS** (cuma ukuran tim; opsi **PECAH** dilewati — tak relevan). ⚠️ **PENTING:** "RINGKAS" melewati opsi **PECAH** saja, **BUKAN RAPIKAN**. Kalau project **punya kode** (non-monorepo / sudah-terpecah / borderline), tawaran **Refactor Bertingkat tetap WAJIB muncul** lewat langkah **14d (JAMINAN)** di bawah — hanya project BENAR-BENAR kosong yang tak ditawari refactor (+ sebut "ditawarkan begitu ada kode"):
```
🏗️ Tim kamu berapa orang? (pilih sesuai RENCANA 3-6 bulan ke depan)

[1] TIM KECIL (rekomendasi) ⭐ DEFAULT — pilihan teraman saat ragu; panduan tim aktif tanpa ribet, gampang naik level nanti
    → 1-5 orang (atau rencana rekrut 3-6 bulan ke depan).
[2] TIM BESAR / BERKEMBANG
    → 5+ orang (atau rencana tumbuh ke sana). Disiapkan untuk pecah-repo begitu ada kode.
[3] SENDIRI
    → kamu sendiri, belum ada rencana nambah staff.

Ketik angka: ___ (kosong/Enter = auto-deteksi; cadangan 1 TIM KECIL)
```

> **Catatan jujur — project KOSONG yang mau langsung BANYAK folder/repo** (S1: backend+frontend; S3: microservice engine→backend→dashboard — masing-masing ber-lintasAI): jalur otomatis "dari nol langsung beberapa folder" **BELUM ADA**. Mesin pecah-repo (Bagian 5c) baru bekerja dari kode yang **sudah ada** (status masih BETA — lihat Bagian 5c). AI **WAJIB terus terang** ini ke user — JANGAN diam seolah sudah otomatis. Jalan sementara yang disarankan: **(a)** bangun dulu 1 tempat (monorepo) lalu pecah saat sudah ada kode; **ATAU (b)** owner minta AI menyiapkan folder-folder itu **manual DARI AWAL** (AI bikin kerangka tiap folder kosong + `AGENTS.md` dari template peran yang sesuai — `BACKEND`/`FRONTEND`/`SHARED`, atau `ENGINE`/`DASHBOARD` untuk microservice — + `CLAUDE.md` loader + `.env.example` aman per peran, satu per satu). ⚠️ **Catatan:** `SPLIT_REPO_PREPROVISION_v1.md` dirancang untuk **memecah monolith yang SUDAH ada** (langkahnya membaca `package.json`/`.claude-kit/` monolith) — JANGAN dipakai mentah untuk project kosong; pakai hanya sebagai **acuan pengaman `.env`** (frontend NOL rahasia) + jalankan robot `split-guard` di tiap folder hasil. 🏢 Analogi: mesin "pindah rumah" sudah ada, tapi mesin "bangun rumah dari tanah kosong" belum — sementara ini bangun manual atau bangun 1 tempat dulu, baru pindah.

13b. **Project SUDAH ADA kodenya + masih monorepo** (IsMonorepo=true, IsPostSplit=false) → tampilkan **versi PENUH** (ukuran tim + bentuk kode digabung):
```
🏗️ Tim kamu berapa orang + mau bentuk kodenya seperti apa? (pilih sesuai RENCANA 3-6 bulan ke depan)

[1] Tetap 1 tempat (monorepo) + rapikan kode bertingkat (rekomendasi) ⭐ DEFAULT — kode tetap 1 tempat, dirapikan bertahap 🟢 ringan → 🟡 sedang → 🔴 berat (boleh berhenti di temuan berat yang krusial). Cocok kerja SENDIRI / project kecil.
[2] Pecah per-lapisan jadi 2-3 tempat-kode: <project>-frontend / <project>-backend (+ <project>-shared OPSIONAL → boleh 2 repo) — cocok TIM 3-5+ staff. Staf tampilan TIDAK bisa tak-sengaja ubah kode mesin; review per-bagian lebih fokus.
[3] Microservice — varian shared-database: 1 repo per WILAYAH RAHASIA + backend + dashboard (jumlah repo IKUT kebutuhan, BUKAN angka tetap; contoh tim besar 6-10; 1 DB bersama; nama nyesuai fitur project-mu) — cocok TIM 15-30+ staff. Akses BISA dipisah per layanan (setelah owner set izin repo + CODEOWNERS — TIDAK otomatis dari sekadar memecah folder) + rilis tiap bagian mandiri.

Ketik angka: ___ (kosong/Enter = 1, tetap 1 tempat + rapikan)
```
> **Nama tempat-kode opsi [2]/[3] = AUTO-DETEKSI dari fitur project, BUKAN nama paku-mati.** Untuk [3], AI turunkan nama dari kapabilitas yang terdeteksi (mis. project SEO → `-seoanalysis`/`-domain`; project toko → `-katalog`/`-pembayaran`). Nama spesifik di atas cuma CONTOH — sesuaikan dengan project nyata.

14. **Derive ukuran tim + tindakan bentuk-kode dari jawaban** — ⚠️ versi PENUH (13b) dan versi RINGKAS (13a) punya **urutan opsi BERBEDA**, jadi dipetakan TERPISAH (jangan dicampur — salah-petakan = solo dev ditagih pengaturan tim besar / tim malah skip CODEOWNERS):

**Versi PENUH (13b — project berkode + monorepo):**
| Jawaban 13b | Ukuran tim | Tindakan bentuk-kode |
|---|---|---|
| [1] tetap 1 tempat + rapikan | SENDIRI / kecil | tetap monorepo → Bagian 5 rapikan bertingkat |
| [2] pecah per-lapisan | TIM KECIL | Bagian 5 split **per-Lapisan** (2-3 repo, shared opsional) |
| [3] microservice (varian shared-DB) | TIM BESAR | Bagian 5 split **per-Kapabilitas** (jumlah repo ikut wilayah rahasia + tim) |

**Versi RINGKAS (13a — project kosong / sudah terpecah; cuma tanya ukuran tim, tak ada tindakan bentuk-kode):**
| Jawaban 13a | Ukuran tim |
|---|---|
| [1] TIM KECIL | TIM KECIL |
| [2] TIM BESAR / BERKEMBANG | TIM BESAR |
| [3] SENDIRI | SENDIRI |

- **SENDIRI** → file tim `.github/` ikut terpasang tapi "tidur" (aktif kapan saja rekrut staff, alur 14b). Skip CODEOWNERS setup. Reminder kunci-API kalau pakai DB.
- **TIM KECIL / TIM BESAR** → file tim + `docs/CLAUDE_TEAM_GUIDE.md` aktif. Ingatkan isi CODEOWNERS username asli + `ANTHROPIC_API_KEY` + branch protection.
- **Catatan pengaman (WAJIB untuk TIM KECIL/BESAR)**: alur "minta persetujuan sebelum gabung" BARU TERKUNCI setelah owner mengaktifkan **branch protection** (pelindung jalur utama — pagar GitHub yang menolak perubahan langsung tanpa review). Kit hanya MENDETEKSI + menyarankan, TIDAK bisa mengaktifkannya sendiri (GitHub → Settings → Branches, atau `.github/scripts/setup-branch-protection.ps1`). 🏢 Analogi: kit pasang papan "wajib lapor satpam"; palang pintunya owner yang turunkan.

14b. **Ganti ukuran tim / bentuk belakangan (alur resmi)**: kapan pun user chat *"ubah ukuran tim jadi SENDIRI/TIM KECIL/TIM BESAR"* atau *"pecah repo sekarang"* → AI WAJIB: (1) terapkan ulang arahan step 14 + action items step 18 untuk level BARU — naik level = tagih CODEOWNERS + kunci API + branch protection; turun level = berhenti menagih, **JANGAN hapus file apa pun**; (2) catat 1 baris di `AGENTS.md`; (3) lapor ringkas. File tim TIDAK perlu di-copy ulang (sudah terpasang sejak setup, tinggal "dibangunkan").
   - **TAMBAHAN (deteksi-otomatis)** → kalau project **SETENGAH JADI** (sudah ada code existing) terdeteksi, tawaran "Rapikan ke Standar Tim" (`PROJECT_LIFECYCLE_PROMPT_v1.md` Stage 4) sudah tergabung di opsi [1] popup 13b.

14c. **Anti-spam guard pecah-repo (sebelum tawarkan opsi pecah)**: AI WAJIB cek — `docs/decisions/*permanent-monorepo*.md` ada → opsi pecah JANGAN ditawarkan (user sudah commit tetap monorepo, pakai versi RINGKAS 13a); `docs/MIGRATION_REMINDER.md` <7 hari + pilihan terakhir "Tunda" → boleh diringkas; `.claude-kit/.split-state` ada → sudah terpecah (versi RINGKAS 13a). Kalau user pilih [1] tetap-1-tempat lalu minta "tetap 1 tempat selamanya" → catat `docs/decisions/<tgl>-permanent-monorepo.md`.

14d. **JAMINAN TAWARAN REFACTOR (WAJIB — jangan sampai terlewat).** Tawaran **Refactor Bertingkat** (🟢 ringan → 🟡 sedang → 🔴 berat, paling aman dulu) WAJIB muncul sebagai **popup** untuk SETIAP project yang punya **KODE NYATA** (≥1 kandidat kode terdeteksi via auto-detect / scan Bagian 4b) — **apa pun bentuk repo-nya**: monorepo / **non-monorepo** / **sudah-terpecah** / deteksi **borderline**. Aturan:
- **Sudah ditawarkan** via Popup #3 13b [1] (monorepo + rapikan) ATAU audit Popup #2 [3] → cukup, JANGAN dobel.
- **BELUM ditawarkan** (project non-monorepo / sudah-terpecah / audit dilewati / 13a RINGKAS padahal ADA kode) → AI **WAJIB** tampilkan popup klik ini (per "Cara Tampil Popup"):
```
Project-mu sudah ada kodenya. Mau aku bantu rapikan kode bertingkat (paling aman dulu)?
[1] Ya, mulai dari 🟢 ringan (rekomendasi) — bertahap, tiap tingkat ada popup-nya, bisa berhenti kapan saja
[2] Nanti saja (kapan pun ketik "rapikan kode bertingkat")
[stop] Lewati
Default (Enter/kosong) -> [1] Ya, mulai dari ringan
```
  → "[1]" masuk **Mode Refactor Bertingkat** (`CLAUDE_universal_v1.md` §4.11 + `LINTASAI_WORKFLOWS_v1.md` §4.2) + Safety Net (branch + commit kecil + lint/build/test lulus sebelum naik tingkat).
- **Project BENAR-BENAR kosong** (0 kandidat kode) → lewati + WAJIB sebut: *"Belum ada kode, jadi rapikan-bertingkat ditawarkan otomatis begitu ada kode nanti."*
- **RAGU / borderline / Confidence rendah TAPI ada tanda kode** → **DEFAULT TAWARKAN** (jalankan popup di atas), JANGAN lewati diam-diam (sejalan prinsip audit Bagian 3 "JANGAN lewati diam-diam").

🚨 **LARANGAN:** AI TIDAK BOLEH menutup Fase B untuk project ber-kode tanpa tawaran refactor ini pernah muncul. Ini jaminan anti-"popup refactor hilang" (akar: dulu refactor cuma ditawarkan untuk monorepo-berkode 13b → project setengah-jadi yang salah-terdeteksi kosong/non-monorepo kehilangan tawaran).

### Bagian 4b - Sapa user + announce aturan + action items + scan (auto, no popup)

15. Sapa user Bahasa Indonesia ramah, sebut versi kit aktif + kondisi aktif (mode Popup #1 + ukuran tim/bentuk Popup #3).
- **Kalau proyek masih nyaris-kosong**: AI WAJIB beri tahu JELAS, jangan diam: "Proyekmu masih kosong, jadi peta proyek + berkas tim belum dibuat sekarang — nanti otomatis dibuat begitu ada kode. Aturan tim tetap aktif lewat `CLAUDE.md`." Jangan biarkan user mengira setup gagal hanya karena folder `docs/`/`.github/` belum muncul.

16. **AI auto-execute file tim copy + scan read-only** (tanpa popup tambahan):
- File tim ter-copy oleh setup script (anti-overwrite, **35 file tim**: 8 di .github (4 robot workflow + 2 skrip + CODEOWNERS + PR template) + 27 di docs (panduan tim, glossary, playbook keamanan, peta ancaman, kontrol-akses, contoh peta-konsistensi 2 format, contoh Buku Pelajaran, ADR template, panduan verifikasi rilis, operasi database aman, observability produksi)). Daftar persisnya = variabel `$teamFiles` di `setup-pola-b.ps1` (sumber tunggal — jangan tulis ulang daftar di sini supaya tidak cepat basi; angka 35/8/27 di dokumen dijaga otomatis oleh robot `lib/consistency-check.ps1`).
- **UNIVERSAL ADAPTIVE SCAN** (read-only, no cap): auto-detect tech stack dari manifest, glob recursive folder source umum, pattern CRITICAL (auth / db / security / api / entry / feature domain), filter skip auto-generated, hitung total kandidat per kategori + per subfolder. **Catatan v1.43.0: scan ini READ-ONLY untuk tahu isi project — pembuatan denah/catatan TIDAK di sini, tapi di Bagian 6 (akhir).**
- **Bulk-bootstrap derive dari Popup #1**: "1" LENGKAP → semua catatan dibuat (project FRESH/kosong: SEKARANG; project MATANG: ditunda ke Bagian 6 biar cocok kode final). "2" CEPAT → SKIP, LAZY-GENERATE per-file aktif. "3" PILIH SENDIRI → sub-menu kategori. **WAJIB lapor progres** saat bulk jalan (per 5-10 berkas, bahasa awam) — jangan layar diam.

17. Umumkan **4 aturan dokumentasi tim profesional** (`CLAUDE_universal_v1.md` seksi 7.1-7.4) - **WAJIB untuk SEMUA kondisi**:
- **7.1 AUTO-SYNC** - tiap edit code yang punya `docs/<basename>.md`, AI WAJIB update `.md` di sesi yang sama.
- **7.2 LAZY-GENERATE** - tiap buat/edit file kode PENTING (auth/database/keamanan) yang belum ada catatan `.md`, AI **menawarkan** bikin catatannya satu-per-satu.
- **7.3 READ-MINIMAL** - AI baca peta proyek (`docs/architecture.md` + `docs/architecture_auto.md`) DULU, lalu pilih hanya catatan yang relevan (cherry-pick = ambil yang perlu saja).
- **7.4 ARCHITECTURE REGISTRY** - `docs/architecture.md` = peta makro user-edit + `docs/architecture_auto.md` = registry TOC AI-maintained.

18. Arahkan user ke action items berdasarkan ukuran tim (hasil derive Popup #3):
- **TIM KECIL / TIM BESAR**: edit `.github/CODEOWNERS` (ganti placeholder → GitHub username asli) + setup `ANTHROPIC_API_KEY` di GitHub Secrets + **aktifkan branch protection** (lihat "Catatan pengaman" step 14 — tanpa ini alur minta-persetujuan TIDAK terkunci). Baca `docs/CLAUDE_TEAM_GUIDE.md` + `docs/PROMPT_LIBRARY.md`. **WAJIB arahkan ke `docs/OWNER_SETUP_CHECKLIST.md`.** **Juga sebut peringatan 2 robot gagal-merah** (sama seperti path SENDIRI (b)+(c)): `ai-review.yml` butuh `ANTHROPIC_API_KEY`, `backup-schemas.yml` (harian) butuh `DATABASE_URL_BACKUP` — tanda merahnya BUKAN kode kamu salah.
- **SENDIRI**: skip CODEOWNERS setup. Reminder kalau pakai DB: setup PostgreSQL role per `docs/MCP_SETUP.md`. **WAJIB AI sebut 3 hal**: (a) file tim ikut terpasang tapi "tidur" — aktif kapan pun rekrut staff (alur 14b); (b) **peringatan kunci API**: robot review PR (`.github/workflows/ai-review.yml`) jalan otomatis saat PR pertama — tanpa `ANTHROPIC_API_KEY` dia gagal dengan tanda silang merah (itu robotnya belum dikasih kunci, BUKAN kode kamu salah). Pasang kunci dulu sebelum PR pertama, atau abaikan tanda merahnya sampai kunci dipasang; (c) **peringatan robot backup harian**: `.github/workflows/backup-schemas.yml` jalan terjadwal tiap malam — tanpa secret `DATABASE_URL_BACKUP` + edit `SCHEMAS_TO_BACKUP` dia gagal merah (BUKAN kode kamu salah — DAN artinya backup BELUM jalan). Matikan workflow itu atau pasang secretnya (lihat `docs/MCP_SETUP.md`). 🏢 kayak alarm asap yang bunyi terus karena baterainya belum dipasang — bukan ada kebakaran, tapi juga belum melindungi.

18a. **Adaptive commit guidance**: setup-pola-b.ps1 closing auto-detect branch protection via `Test-MainBranchProtected`. AI surface guidance sesuai: main ter-protect → pakai branch + PR (`git checkout -b chore/setup-lintasai-kit` → push → `gh pr create --fill`); main unprotected → direct commit OK; tak bisa detect (gh CLI missing / no remote / no auth) → recommend branch + PR (safe default).
18b. **Package manager guidance**: pakai command yang DETECTED via `Get-PackageManager` (`lib/project-detect.ps1`) — mis. `pnpm install` di project pnpm, BUKAN `npm install` yang corrupt lockfile.

### Bagian 5 - Kerja otomatis: rapikan / pecah kode sesuai Popup #3 (kalau ada kodenya)

> Urutan prinsip (tetap): audit (Bagian 3) MENEMUKAN peluang → Bagian 5 MENGERJAKAN (rapikan / pecah) → catatan kode (Bagian 6) memotret hasil FINAL. Kalau catatan dibuat sebelum kode dirapikan, pasti basi. **Project KOSONG/fresh: lewati Bagian 5 (tak ada kode untuk dirapikan/dipecah), langsung Bagian 6.**

> **WAJIB sebelum mengubah kode existing (pengaman "simpan dulu"):** AI cek `git status`. Kalau ada perubahan menggantung (belum di-commit) → popup ramah: `[1] Simpan dulu kerjamu (commit) sebelum aku rapikan (rekomendasi — biar perubahanmu tidak tercampur ke rapikan, gampang dibatalkan) / [2] Lanjut saja (perubahan yang belum tersimpan akan ikut tercampur ke branch rapikan)`. JANGAN langsung ubah kode di atas perubahan yang belum tersimpan. 🏢 kayak "Save" dulu di Google Docs sebelum orang lain ikut ngedit.

19. **Eksekusi sesuai pilihan Popup #3 (Bagian 4)** — hanya kalau project punya kode:

19a. **Pilihan [1] tetap 1 tempat → Rapikan kode bertingkat (Mode Refactor Bertingkat)**: pakai mesin `CLAUDE_universal_v1.md` §4.11 + `LINTASAI_WORKFLOWS_v1.md` §4.2. Peluang dikelompokkan 🟢 Ringan → 🟡 Sedang → 🔴 Berat, ditawarkan **tingkat demi tingkat (paling aman dulu)** — tiap tingkat 1 popup (`[1] kerjakan semua di tingkat ini / [2] pilih satu-satu / [3] lewati ke tingkat berikut / [stop]`) + Safety Net (salinan kerja terpisah + simpanan kecil yang bisa dibalik + cek otomatis lulus dulu sebelum naik tingkat) + Gerbang Pra-Rilis §4.6. Sebelum 🟡/🔴 (sentuh perilaku): cek tes dulu + pahami pemanggil. Naik 1 tingkat per langkah, JANGAN loncat; 🔴 Berat = persetujuan eksplisit + Tahan Penggabungan, boleh berhenti di temuan krusial. Kalau tidak ada peluang / user [stop] → sebut singkat "tidak ada perapian kode, lanjut". (Staff juga bisa memicu mode ini kapan saja dengan frasa "rapikan kode bertingkat" — lepas dari alur pemasangan ini.)

19b. **Pilihan [2]/[3] pecah-repo → jalankan `SPLIT_REPO_MIGRATION_PROMPT_v1.md`** (detail di Bagian 5c). [2] = per-Lapisan (2-3 repo: frontend/backend, shared opsional); [3] = per-Kapabilitas (jumlah repo ikut wilayah rahasia + tim, nama auto-deteksi). Jumlah repo = ikut kebutuhan, bukan angka tetap (sumber: `docs/plans/POLA_REPO_AMAN.md`). Kalau audit (Bagian 3) menemukan peluang rapikan, AI sarankan rapikan dulu (19a) SEBELUM pecah, supaya yang dipindah ke repo baru sudah bersih.

---

### Bagian 5c - Detail eksekusi pecah-repo (kalau Popup #3 = [2] atau [3])

> Keputusan PECAH vs TETAP sudah diambil di Popup #3 (Bagian 4). Bagian ini cuma detail EKSEKUSI-nya. Popup pecah-repo per-tier yang lama (SENDIRI / TIM KECIL / TIM BESAR terpisah) sudah DIGABUNG ke Popup #3 (v1.43.0) — tidak ditanya dua kali.

20. **Sebelum eksekusi**, AI sudah punya hasil `Get-MonorepoState` + `Test-PostSplitState` (dijalankan di Bagian 4). Kalau `IsMonorepo=false` → tidak ada yang dipecah (lewati Bagian 5c). Kalau `IsPostSplit=true` → sudah terpecah; cek further-split trigger (backend/frontend file >500 atau Prisma model >50) lalu lewati.

20a. **Jalankan `SPLIT_REPO_MIGRATION_PROMPT_v1.md`** sesuai pilihan Popup #3:

> 🧪 **STATUS BETA — WAJIB sampaikan ke user sebelum eksekusi pecah-repo (jujur).** Mesin pecah-repo ([2] 3-repo + [3] 6-10-repo) **belum diuji end-to-end di GitHub nyata** (`SPLIT_REPO_MIGRATION_PROMPT_v1.md:1`). Arsitektur + pengamannya solid (Tahap 0 cuma salin — kode asli TIDAK disentuh + bisa dibatalkan; anti-bocor `.env`; idempotency-guard), **TAPI** AI WAJIB beri tahu user: *"Fitur pecah-repo masih BETA — uji dulu di repo coba-coba / project tiruan, JANGAN langsung di project produksi penting."* + minta konfirmasi. **Catatan [3] multi-repo:** belum ada jalur "dari project KOSONG" (semua = migrasi dari kode yang sudah ada); kalau project masih kosong, sarankan bangun monorepo dulu baru pecah. Pengaman akses (CODEOWNERS + kunci-main + izin-clone) **TIDAK otomatis** dari sekadar memecah folder — owner WAJIB set manual di GitHub.

- **[2] = per-Lapisan (2-3 repo)**: `<project>-frontend` / `<project>-backend` (+ `<project>-shared` OPSIONAL → boleh 2 repo). Paling sederhana, cocok mayoritas tim 3-5+.
- **[3] = per-Kapabilitas (jumlah repo ikut wilayah rahasia + tim, BUKAN angka tetap)**: `<project>-dashboard` / `<project>-shared` / `<project>-core` / `<project>-<kapabilitas>`×N — **nama `<kapabilitas>` AUTO-DETEKSI dari fitur project** (mis. project SEO → `-seoanalysis`/`-domain`; toko → `-katalog`/`-pembayaran`). Pilih [3] hanya kalau ada bounded context jelas + butuh isolasi tim per-kapabilitas. Penamaan standar + aturan detail di Mode Selector file itu.
- **Tahap 0 dulu** (aman, bisa dibatalkan): bikin folder salinan berdampingan, kode asli TIDAK disentuh. Sisa tahapnya di `SPLIT_REPO_MIGRATION_PROMPT_v1.md`.

20b. **Anti-spam guard** (sudah dicek di Bagian 4 langkah 14c — ulang sebagai pengaman): `docs/decisions/*permanent-monorepo*.md` ada → jangan eksekusi pecah; `docs/MIGRATION_REMINDER.md` <7 hari + pilihan terakhir "Tunda" → ringkas; `.claude-kit/.split-state` ada → sudah terpecah. Kalau user pilih [1] tetap-1-tempat di Popup #3 → tidak ada eksekusi pecah di sini (langsung Bagian 6).

20c. **WAJIB verifikasi "aplikasi masih jalan" (kalau Bagian 5 mengubah kode existing)** — JANGAN lapor "✅ selesai" tanpa ini (Gerbang Pra-Rilis §4.6):
- Deteksi package manager + skrip yang ADA (`Get-PackageManager` + baca `package.json`/`Makefile`). **Buktikan perintahnya benar-benar jalan (exit-code sukses)** — JANGAN hardcode `pnpm` (pakai yang terdeteksi: `npm`/`pnpm`/`yarn`).
- Jalankan **build + tes yang ADA** + minta owner smoke-test 3-5 alur kritis (login / halaman utama / transaksi inti).
- Kalau project **belum punya** skrip build/tes → JANGAN klaim "aman/lulus" (0 dari 0 tes = rasa-aman-palsu). Lapor jujur: "app belum punya cek otomatis; tolong jalankan `<perintah dev terdeteksi>` lalu buka halaman utama untuk pastikan masih jalan" (status-jujur-lingkungan §4.6).

---

### Bagian 6 - Catatan kode 2-versi + denah project + denah database (di AKHIR, kalau ada kodenya)

> **Prinsip (tetap):** dokumentasi = foto kondisi akhir. Denah project + denah database + catatan kode SEMUA dibuat di SINI — SETELAH audit (Bagian 3) + rapikan/pecah (Bagian 5), supaya cocok dengan kode FINAL + tidak 2x kerja (permintaan owner v1.43.0). 🏢 Analogi: jangan bikin katalog gudang yang sebentar lagi ditata ulang — rapikan dulu, baru foto-katalog.

21. **Kalau** Popup #1 = [1] LENGKAP **DAN** project ada kodenya — di langkah AKHIR ini, pada kondisi kode TERKINI (sesudah rapikan/pecah):
- **Denah project (peta proyek)** → isi `docs/architecture.md` dari hasil scan struktur NYATA: Tujuan / Stack / Struktur Folder / Entry Points / Modul Inti / ENV / Konvensi — **ganti SEMUA `[TBD]`** dengan isi sebenarnya. (Skeleton `templates/architecture.md` disalin KOSONG saat pasang; LANGKAH INI yang mengisinya — bukan dibiarkan `[TBD]`. JANGAN lapor "peta proyek dibuat" di step 23 kalau masih ada `[TBD]`.)
- **Denah database** (DB schema scan, kalau pakai DB): `prisma/schema.prisma` / `db/schema.ts` / `models/*` / `migrations/*` / `@Entity` → `docs/db-schema.md` (denah + diagram hubungan) via `templates/DB_SCHEMA_SCAN_PROMPT.md`. **Pagar aman**: baca STRUKTUR saja, JANGAN baca `.env`/secret, JANGAN salin data pribadi asli (PII). Kalau tidak ada file schema → lapor "denah database tidak ditemukan; kalau pakai DB, tunjukkan file schema-nya" (jangan diam).
- **Catatan kode tiap file PENTING** (bulk-bootstrap `PROJECT_LIFECYCLE_PROMPT_v1.md` Stage 2) pada kondisi TERKINI. Kalau tadi MEMECAH (split) → bikin catatan di **tiap repo/folder hasil pecah** (3 repo per-Lapisan: backend/frontend/shared, ATAU 6-10 repo per-Kapabilitas sesuai pilihan Popup #3), BUKAN di monolith lama — jangan ada repo hasil-pecah yang terlewat tak dapat catatan. **WAJIB lapor progres** (per 5-10 berkas, bahasa awam) — jangan layar diam.

22. **Tiap catatan kode = 2 VERSI dalam 1 berkas (v1.43.0, permintaan owner)** — supaya berguna untuk developer DAN dimengerti orang awam:
- **👨‍💻 Untuk programmer**: bagian teknis akurat (Tujuan / Cara Pakai / Input-Output / Dependensi / Catatan edge-case + `path:baris`) — format standar `templates/_PATTERNS.md` + `templates/_EXAMPLE.md`.
- **🙂 Untuk non-programmer**: 1 blok ringkas "Apa ini, pakai bahasa sehari-hari" + analogi (sehari-hari + tools digital populer) — supaya owner/staff awam paham fungsi berkas tanpa baca kode.
- Selaras `CLAUDE_universal_v1.md` §7.8 (dokumen 2-POV) + §4.1 (gaya 2 sudut pandang). Sumber kebenaran format = `templates/_PATTERNS.md`.

23. Lapor hasil ke user pakai bahasa non-programmer (mis. "✅ Denah database + 12 catatan kode (2 versi: programmer + awam) dibuat di folder `docs/`").
- **Untuk project FRESH/kosong**: Bagian 6 ini di-skip — catatan kode sudah dibuat lebih awal (Bagian 4b, karena tak ada audit/rapikan/pecah yang perlu ditunggu).

---

### Bagian 7 - WAJIB lapor Pending Action Items (tier-aware popup-per-item)

> **Catatan sejarah (sejak v1.6.2):** Bagian 7 dipindah dari `POST_SETUP_CHECKLIST_PROMPT_v1.md`
> ke sini supaya jalur `npm create lintasai` maupun paste-manual pakai daftar yang SAMA (sumber tunggal).

Sebelum tutup workflow, AI WAJIB lapor daftar item yang perlu owner tindak lanjut (skip yang tidak relevan stack). **WAJIB arahkan owner/lead ke `docs/OWNER_SETUP_CHECKLIST.md`** — checklist 1 halaman semua tugas teknis sekali-pasang (bahasa non-programmer):

```markdown
## 📋 Daftar Tugas Menunggu (perlu owner kerjakan manual)

| # | Tugas | Tier | Perilaku AI | Perkiraan waktu |
|---|---|---|---|---|
| 1 | Edit `.github/CODEOWNERS`: ganti placeholder (nama contoh sementara) → GitHub username staff yang asli | **B** | Lapor saja (owner manual via GitHub) | 5 menit/staff |
| 2 | Pasang `ANTHROPIC_API_KEY` (kunci API robot review kode) di GitHub Secrets (brankas rahasia GitHub) | **B** | Lapor saja (owner manual via GitHub) | 2 menit |
| 3 | Buat denah struktur database (DB schema scan) → `docs/db-schema.md` (kalau terdeteksi pakai database/ORM apa pun — Prisma/Drizzle/TypeORM/SQLAlchemy/dll, bukan cuma Prisma) | **A** | **WAJIB popup tawarkan jalankan** (mode aman cuma-baca, ~15 menit) | 15 menit |
| 4 | Pasang RLS di Supabase (aturan siapa boleh lihat baris data mana — kalau 1 aplikasi dipakai banyak perusahaan/klien sekaligus) | **C** | **WAJIB popup konfirmasi HARD + ketik-persis (verbatim)**; uji di staging dulu, owner yang eksekusi (lihat aturan Tier C di bawah) | 1-2 jam |
| 5 | Pecah-repo (monorepo split) — Tahap 0 persiapan cepat (kalau terdeteksi penanda MULTI): bikin 3 folder salinan berdampingan, kode asli tidak disentuh. Lihat `SPLIT_REPO_MIGRATION_PROMPT_v1.md`. | **A** | **WAJIB popup tawarkan jalankan Tahap 0** (~30-60 menit, bisa dibatalkan — kode asli tetap utuh) | 30-60 menit |
| 6 | Sambungkan bot ke channel chat Discord | **C** | **WAJIB popup konfirmasi HARD** (menyentuh layanan di luar project ini) | 30 menit |
| 7 | Rapikan catatan ke sub-folder docs/ (kalau `docs/` >30 file ATAU `src/lib/` punya >=3 file penting/CRITICAL) | **A** | **WAJIB popup tawarkan jalankan** (risikonya rendah, ~30 menit) | 30 menit |

Keterangan Tier: **A** = AI bisa kerjakan langsung · **B** = harus owner kerjakan manual · **C** = AI bisa tapi risikonya tinggi.
```

**Untuk tim split-repo** (sesudah Stage 0): nyalakan rambu skala-besar di tiap repo —
**kunci pengaman gabung** (`.github/scripts/setup-branch-protection.ps1`, default SIMULASI) +
**gabung-otomatis-aman** (`.github/workflows/auto-merge-shared.yml`). Detail di
`SPLIT_REPO_MIGRATION_PROMPT_v1.md` + `CROSS_REPO_TYPES_PIPELINE.md`.
> **WAJIB popup-per-item, JANGAN cuma disebut di catatan ini supaya tidak terlewat** (ini pengaman Cyber-Security/DevOps paling dasar untuk skala-besar): kunci-pengaman-gabung = **Tier A** — AI WAJIB tawarkan via popup "coba SIMULASI dulu (tidak mengubah apa pun)" tiap kali tim memilih pecah-repo. Tanpa ini, repo tim 20-30 staff bisa jalan tanpa kunci gabung (ada yang push langsung ke main / gabung tanpa cek tes lulus → versi utama tim rusak).

**Aturan tier-aware popup-per-item** (WAJIB, bukan "lapor tabel diam"):

- **Tier A (AI bisa execute LANGSUNG)** — WAJIB tawarkan via popup. Pilihan: `[1] Ya, jalankan sekarang` (rekomendasi — risikonya rendah, bisa AI kerjakan langsung tanpa repot owner) / `[2] Nanti aja` / `[3] Jangan`. Default kalau diam: `[2] Nanti aja`. (Catatan untuk AI: kalau item TIDAK relevan stack project, JANGAN tawarkan sama sekali — jangan tampilkan rekomendasi yang tak cocok. Jangan tulis "(rekomendasi kalau cocok)" di label — §14.1 RULE-8 minta "(rekomendasi)" tanpa syarat di [1].)
- **Tier B (AI tidak bisa execute)** — Lapor saja: "⚠️ WAJIB owner manual via [tempat]: [action]. [1-baris kenapa penting + analogi tools digital]." Tidak ada popup.
- **Tier C (AI bisa tapi risk tinggi)** — WAJIB popup KONFIRMASI HARD. Pilihan: `[1] Ya, aku paham risikonya` / `[2] Nanti aja` (rekomendasi — pilihan paling aman; risikonya tinggi, lebih baik ditunda sampai owner benar-benar siap) / `[3] Jangan`. Default: `[2] Nanti aja`.
  - 🚨 **KHUSUS item yang MENGUBAH database/server PRODUKSI (mis. pasang RLS):** klik lunak `[1]` TIDAK CUKUP (`CLAUDE_universal_v1.md` §8.2 Aturan 5 mewajibkan konfirmasi ketik-persis untuk migrasi/perubahan DB produksi). WAJIB 3 pengaman: **(a)** user harus **mengetik FRASA PERSIS (verbatim)** untuk lanjut — mis. ketik `PASANG RLS PRODUKSI` (bukan cuma "ya"/klik); **(b)** deskripsi opsi `[1]` sebutkan **blast radius** dalam bahasa awam ("salah pasang = app down semua klien ATAU data klien A bocor ke klien B"); **(c)** AI **HANYA MEMANDU** langkahnya — owner sendiri yang menjalankan, dan **WAJIB di lingkungan uji (staging) dulu, JANGAN langsung produksi** (§8.2 Aturan 3: verifikasi/setup tetap cuma-baca, AI dilarang menjalankan perubahan ke DB live). Selaras `docs/OWNER_SETUP_CHECKLIST.md` C2. 🏢 Analogi: pasang kunci baru di brankas yang sedang dipakai semua klien — jangan dicoba langsung di brankas asli; latih di brankas contoh dulu, dan butuh tanda-tangan basah, bukan cuma anggukan.

---

## Aturan AI selama workflow ini

- **Auto-confirm mode (per user preference)** dari user paste prompt → lakukan tiap step REGULER langsung tanpa nanya. Untuk **destructive ops** (delete, force-push, rm -rf, DROP, prisma migrate prod) AI WAJIB tanya 1x walau auto-confirm aktif (lihat `CLAUDE_universal_v1.md` section 8.1). JANGAN minta konfirmasi AI-side tambahan untuk step reguler **kecuali**:
  - **Popup #1** (Bagian 2, Step 8 - WAJIB tanya Setup Mode [1] LENGKAP / [2] CEPAT / [3] PILIH SENDIRI).
  - **Popup #2 CONDITIONAL** (Bagian 3, Step 11 - Audit menyeluruh; HANYA muncul kalau project sudah ada kodenya — kriteria OR di Bagian 3 step 10: ada dashboard/schema/lib/route/aset-merek, bukan boilerplate. Kalau FRESH/kosong → lewati + sebut singkat; kalau RAGU → tanya user. JANGAN skip diam-diam).
  - **Popup #3** (Bagian 4, Step 13 - WAJIB tanya Ukuran Tim + Bentuk Kode. Versi PENUH [1] tetap 1 tempat+rapikan / [2] pecah 3 repo / [3] multi-repo untuk project berkode+monorepo; versi RINGKAS [1] TIM KECIL / [2] TIM BESAR / [3] SENDIRI untuk project kosong / sudah terpecah. Default TIM KECIL / tetap-1-tempat).
  - **BOOTSTRAP FASE** (per-file approval optional - pakai mode "approve all per kategori" untuk efisiensi).
- Auto-decide tanpa popup untuk:
  - **Bulk-bootstrap mode** → derive dari Popup #1 (CEPAT = skip bulk, LENGKAP = bulk semua; **untuk project MATANG, LENGKAP = catatan kode + denah SELALU dibuat di Bagian 6 (akhir) setelah audit + rapikan + pecah — tanpa popup pilihan**, PILIH SENDIRI = sub-menu).
  - **Eksekusi pecah-repo** → derive dari pilihan Popup #3 (Bagian 4): [1] tetap 1 tempat = tidak pecah; [2] = split per-Lapisan 2-3 repo (shared opsional); [3] = split per-Kapabilitas (jumlah repo ikut wilayah rahasia + tim). Eksekusi detail di Bagian 5c. Opsi MIGRATION lama dihapus v1.6.6 — project lama dideteksi otomatis.
  - **Audit komprehensif** → Popup #2 (Bagian 3): muncul kalau project ada kodenya, skip kalau kosong.
- Kalau ERROR yang gak bisa di-fix sendiri, lapor + saran fix.
- JANGAN ubah file di `.claude-kit/` (read-only).
- Anti-overwrite di `docs/` + `.github/`: file existing di-skip, tidak ditimpa.
- **Default Full (1)** kalau user jawab kosong/Enter di Popup #1. Filosofi: untuk owner-grade onboarding + staff non-programmer, Enter = Full = langsung dapat peta proyek + denah database (no docs-gap friction di Day 0). User yang mau setup ringan pilih "2" Quick eksplisit (LAZY-GENERATE per-file tetap aktif, bulk bisa di-trigger nanti).
- **Default Yes (Y)** kalau user jawab kosong/Enter di Popup #2 (audit) conditional. Filosofi: context masih hangat dari setup, audit comprehensive 5-10 menit = high-leverage moment.
- **Default TIM KECIL / tetap-1-tempat** kalau user jawab kosong/Enter di Popup #3 (ukuran tim + bentuk kode). Stack + monorepo detection menyusun opsi; SENDIRI / pecah-repo = pilihan manual, bukan saran otomatis.
- IDE permission prompt (PowerShell/Edit YES-NO) di luar kontrol prompt ini.
- Semua respons AI ke user dalam **Bahasa Indonesia** (sesuai aturan global).

---

## Untuk Staff Baru (Day 0 Pertama Kali Pakai lintasAI)

Setelah selesai workflow di atas, kalau kamu **staff IT non-programmer baru pertama kali pakai lintasAI**, AI akan auto-trigger **Guided Step-by-Step Pattern** (`CLAUDE_universal_v1.md` section 4.3):

- 6 phase universal (Foundation → Reading → Project Context → Environment Setup → First Micro-Task → Daily Work Starts)
- Wait-for-confirm pattern: AI minta kamu konfirm tiap step sebelum lanjut, tidak overwhelm
- Berlaku universal untuk SEMUA project (akses, bigseo, pbn-monitor, dst.)
- Phase 2 (reading GLOSSARY + SECURITY_PLAYBOOK) cuma sekali per staff - di-skip kalau pernah baca

Trigger conditions: detect `architecture.md` fresh-generated, `AGENTS.md` placeholder belum filled, atau user eksplisit ngomong "halo aku staff baru".

Detail lengkap di `CLAUDE_universal_v1.md` seksi 4.3.

---

Mulai dari langkah 1 sekarang.
