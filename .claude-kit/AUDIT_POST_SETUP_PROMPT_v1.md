Tolong jalankan AUDIT KOMPREHENSIF di proyek ini, dengan ANALOGI NON-PROGRAMMER di setiap finding (biar staff IT non-programmer paham). Paste prompt ini = implicit consent untuk audit READ-ONLY (scan multi-dimensional, tidak ada file proyek yang diubah). User confirm dulu sebelum execute fix apapun.

> Cocok dijalankan SETELAH `JALANKAN_KIT.md` selesai (bulk-bootstrap docs sudah jadi → AI sudah load context lengkap → audit hasilnya akurat). Bisa juga standalone kapan saja setelah setup awal.

---

## Filosofi audit ini

1. **READ-ONLY by default** - audit cuma SCAN + LAPORAN. Tidak ada `Edit`, `Write`, atau `Bash` destruktif. User pegang kontrol penuh "mau fix yang mana".
2. **Multi-dimensional** - bukan cuma "refactor code". Cek 11 dimensi: Refactor / Security / QA-Test / Database / DevOps / Performance / Frontend-Webdesign / UI-UX-a11y / SEO / Docs gap / Onboarding readiness. (11 dimensi = peta penuh ke 8 divisi WAJIB `LINTASAI_WORKFLOWS_v1.md` §4.13 — termasuk Frontend, Webdesign, UI/UX, SEO yang sering web app setengah-jadi punya banyak.)
3. **Ranked low → high risk** - staff non-programmer butuh tahu "mana yang aman dikerjakan dulu". Quick wins yang risk merusak system = LOW jadi prioritas. HIGH RISK (auth/encryption/data migration) di-defer sampai test foundation siap.
4. **Analogi non-programmer di SETIAP finding** - istilah programming (N+1, race condition, IDOR, transaction) WAJIB punya analogi sehari-hari (kantor, lemari arsip, ATM, tukang pos, brankas). Lihat `docs/ANALOGI_LIBRARY.md` untuk style guide.
5. **Cek-silang skeptis per temuan + jujur kalau belum tuntas** (istilah internal: "adversarial verify") - anggap temuan salah dulu (`is_real=false`) kalau belum 100% yakin. Cegah AI mengarang/menggelembungkan jumlah temuan. **DAN sebaliknya:** kalau pemeriksa-silang gagal jalan (server sempat membatasi permintaan), JANGAN tampilkan laporan yang kelihatan "bersih" — sebut terus terang "X dari Y temuan belum sempat dicek-silang" dan tandai yang belum dicek sebagai **BELUM DICEK-SILANG**. Ke user ceritakan pakai bahasa hasil, BUKAN istilah teknis ini.

---

## WORKFLOW (lakukan otomatis tanpa konfirmasi tambahan AI-side, kecuali Popup #1 + Popup #2 di akhir)

### Bagian 1 - Pre-audit verification

1. Verify project sudah di-setup pakai lintasAI:
   - `AGENTS.md` ada di root proyek
   - `docs/architecture_auto.md` ada (registry TOC)
   - `.claude-kit/` folder ada di root
2. Read `AGENTS.md` + relevant section `CLAUDE_universal_v1.md` (terutama section 4.4 Audit Post-Setup Pattern + 13 Glossary).
3. Read `docs/architecture.md` + `docs/architecture_auto.md` (READ-MINIMAL - paham landscape, BUKAN baca semua `.md`).
4. Cek memory snapshot relevan (project-* memories) untuk konteks yang AI dulu pelajari.

### Bagian 2 - Multi-Dimensional Audit (paralel via Workflow tool)

5. **Jalankan Workflow tool dengan auditor per dimensi — TAPI PER GELOMBANG, BUKAN sekaligus** (maks 4 auditor serempak; 11 dimensi = 3 gelombang):

   > **Kenapa per gelombang (jangan 8 auditor + ~43 cek-silang serempak):** server kadang sebentar membatasi permintaan ("temporarily limiting requests" — INI BUKAN limit pemakaianmu, cuma rem sesaat dari server). Saat itu sebagian pemanggilan **balik kosong (gagal diam-diam)**; laporan tetap bisa tersusun tapi mayoritas temuan jadi BELUM dicek-silang dan hasilnya kelihatan "bersih" padahal belum tuntas (menyesatkan). 🏢 Analogi: kirim 50 staf ke 1 pintu lift sempit bareng → separuh kejepit pintu dan balik tanpa naik; naikkan 4 orang per gelombang lebih aman.
   > **Kalau ada dimensi auditor yang balik kosong (gagal sesaat):** JANGAN dilewati diam-diam — ulang gelombang kecil untuk dimensi itu (maks 2x). Kalau tetap kosong, catat sebagai **"belum sempat diperiksa"** dan WAJIB disebut di laporan akhir (step 7), jangan dianggap "bersih".

| Dimensi | Fokus utama |
|---|---|
| 🧹 **Refactor** | File >300 baris yang bisa dipecah, duplicate logic 3+ tempat, helper opportunity, magic numbers, type safety, unused exports |
| 🔒 **Security** | Missing rate-limit di endpoint sensitive, IDOR risk, missing authz check post-auth, audit log gap, secret handling, input validation, session hijack, OWASP Top 10 |
| ✅ **QA/Test** | HIGH RISK files tanpa test, hot path tanpa test, edge case yang ada di docs tapi tanpa test, regression risk untuk refactor candidate |
| 🗄️ **Database** | N+1 query patterns, missing indexes, cascade behavior risk, multi-tenant isolation, transaction missing, hot path query inefficiency |
| ☁️ **DevOps** | Backup strategy adequacy, monitoring/alerting, cost optimization, deployment safety, cron dependency risk, env var drift, CI/CD gap |
| ⚡ **Performance** | Bundle size, serverless cold start, DB query perf, cache strategy gap, image optimization, API response time |
| 🎨 **Frontend/Webdesign** | 4 state UI (loading/empty/error/success), escape XSS konten user, reuse komponen, virtualisasi list >50, design token (warna/jarak/font bukan nilai mentah berulang), konsistensi komponen |
| 👥 **UI/UX + a11y** | Kontras < 4.5:1, fokus keyboard tak terlihat, target tap < 44px, label/alt hilang, error global (bukan per-field), microcopy jargon, alur membingungkan |
| 📈 **SEO** | Title/meta deskripsi hilang/dobel per halaman, heading tak semantik, slug tak bersih, OG tag share hilang, sitemap/robots.txt, redirect 301 saat URL berubah, Core Web Vitals |
| 📚 **Docs gap** | File CRITICAL belum ter-cover bulk-bootstrap, ADR yang harus ditulis, architecture.md `[TBD]` fields, glossary domain terms missing |
| 🎓 **Onboarding** | PostgreSQL role per-staff, env var sharing flow, GitHub access policy, ANTHROPIC_API_KEY, Claude Code install panduan, "good first issue" backlog, eskalasi tree. **(Cek = baca KONFIGURASI/DOKUMEN saja: ada/tidaknya role/env var — DILARANG konek/SELECT ke DB live (§8.2 Aturan 3) atau menampilkan NILAI secret/.env (§8.1 #6); laporkan ada/tidaknya, bukan isinya.)** |

Setiap auditor lapor 5-15 finding dengan struktur:

```json
{
  "dimension": "string",
  "title": "<teknis singkat>",
  "severity": "critical|high|medium|low|info",
  "file": "<path>",
  "line": "<approximate range>",
  "description": "<apa masalahnya>",
  "why_problem": "<kenapa ini masalah>",
  "impact": "<konsekuensi kalau dibiarkan>",
  "fix_steps": ["step 1", "step 2", ...],
  "fix_effort": "5min|30min|2hr|8hr+|multi-day",
  "blast_radius": "single-file|module|cross-module|system-wide",
  "risk_of_introducing_bug": "low|medium|high",
  "verify_strategy": ["lint", "build", "test ...", "manual smoke test ..."],
  "rollback": "<perintah kembalikan ke versi sebelumnya>"
}
```

> **Pemetaan label WAJIB saat tampil ke user** (severity internal 5-nilai → label tampil 3-tingkat, per §2.1 #7): `critical` + `high` → **GENTING** · `medium` → **PENTING** · `low` + `info` → **RAPIKAN**. Nilai Inggris di JSON = kosakata kerja internal antar-auditor; DILARANG tampil mentah ke user.

6. **Cek-silang skeptis per temuan — PER GELOMBANG KECIL + ULANG yang gagal** (Workflow phase 2):
   - Untuk SETIAP temuan, jalankan 1 pemeriksa dengan anggapan awal temuan SALAH (`is_real=false`) sampai terbukti benar. Pemeriksa baca file yang dimaksud, konfirmasi temuan nyata (bukan mengada-ada), cek tingkat keseriusan tepat (jangan dilebih-lebihkan/dikecilkan), cek `fix_steps` masuk akal + `risk_of_introducing_bug` akurat.
   - **JALANKAN PER GELOMBANG: maksimal 8 pemeriksa sekaligus**, bukan semua ~40 sekali tembak. Habiskan satu gelombang, lanjut gelombang berikut, sampai semua temuan kebagian pemeriksa.
   - **WAJIB ada loop ulang (retry) untuk pemeriksa yang balik kosong.** Kumpulkan temuan yang pemeriksanya gagal (balik kosong), lalu jalankan gelombang ulang HANYA untuk yang gagal itu. Ulangi sampai semua berhasil ATAU sudah 3 putaran ulang. 🏢 Analogi: kayak absen kelas — yang belum jawab dipanggil ulang sampai semua terjawab, bukan langsung dianggap "semua hadir".
   - **WAJIB hitung jujur:** simpan 2 angka — `dicoba` (berapa temuan yang seharusnya dicek-silang) dan `berhasil` (berapa yang pemeriksanya benar-benar jalan + memberi kesimpulan). Angka ini dipakai di step 7 + Bagian 9.

   Contoh pola (gambaran langkah, BUKAN kode jadi — sesuaikan dengan alat Workflow yang ada; ingat: tidak boleh pakai jam/acak di skrip, dan auto-resume `resumeFromRunId` memakai-ulang hasil pemanggilan yang sudah berhasil):

   ```
   temuan = gabungan semua temuan dari semua auditor dimensi
   sisa   = temuan          // yang belum berhasil dicek-silang
   hasil  = []              // kesimpulan pemeriksa yang berhasil

   untuk putaran = 1..4 (1 putaran awal + maks 3 ulang):
       kalau sisa kosong: berhenti
       // pecah 'sisa' jadi kelompok @ maks 8, jalankan tiap kelompok berurutan
       untuk tiap kelompok-8 dari sisa:
           keluaran = jalankan-pemeriksa-paralel(kelompok-8)   // sebagian bisa balik kosong
           untuk tiap (temuan, k) di keluaran:
               kalau k tidak kosong: hasil.tambah(k); coret temuan dari sisa
       // 'sisa' sekarang = hanya yang masih gagal -> diulang di putaran berikut

   dicoba   = jumlah(temuan)
   berhasil = jumlah(hasil)
   belum    = sisa            // ini yang TETAP gagal walau sudah diulang
   ```

   > **Kalau setelah 3 putaran ulang masih ada yang gagal:** JANGAN dibuang diam-diam, JANGAN dianggap aman. Tandai temuan-temuan itu **BELUM DICEK-SILANG (UNVERIFIED)** dan tetap tampilkan apa adanya (lihat step 7). Sarankan ke user: lanjutkan audit dari hasil yang sudah ada (auto-resume) untuk menyelesaikan sisa pemeriksaan — server biasanya cuma membatasi sesaat.

7. **Susun hasil berperingkat + GERBANG KEJUJURAN** (Workflow phase 3):

   **GERBANG KEJUJURAN (WAJIB, sebelum menyusun laporan apa pun):** bandingkan `berhasil` vs `dicoba`.
   - Kalau `berhasil < dicoba` (ada temuan yang belum sempat dicek-silang) → laporan WAJIB dibuka dengan baris status **"⚠️ Audit BELUM TUNTAS: <belum> dari <dicoba> temuan belum sempat dicek-silang (server sempat membatasi permintaan sesaat)."** dan tiap temuan yang belum dicek diberi tanda **"BELUM DICEK-SILANG (UNVERIFIED)"**. DILARANG menyatakan audit "bersih / aman / tuntas".
   - Kalau ada dimensi auditor yang gagal jalan (step 5) → sebut juga: **"Dimensi <nama> belum sempat diperiksa."**
   - Temuan yang belum dicek-silang **TIDAK BOLEH dihapus diam-diam** dari laporan — tampilkan apa adanya dengan tanda UNVERIFIED, supaya user tahu ada bagian yang belum kelar.
   - **"Nol temuan itu sah" tetap berlaku** — TAPI hanya boleh dibilang "bersih" kalau `berhasil == dicoba` DAN semua dimensi berhasil diperiksa. Bersih-palsu karena pemeriksa gagal jalan ≠ bersih.

   Lalu susun peringkat seperti biasa:
   - **Tier 1 LOW RISK first**: findings dengan `risk_of_introducing_bug=low`, sort by effort ascending. Ini quick wins yang aman dikerjakan duluan.
   - **Tier 2 MEDIUM RISK after Tier 1**: findings dengan `risk_of_introducing_bug=medium`. Butuh test foundation Tier 1 dulu.
   - **Tier 3 HIGH RISK hold merge**: findings dengan `risk_of_introducing_bug=high`. Branch protection ON, paired review, smoke test prod 5+ menit.

   > **Cara lanjutkan dari hasil yang sudah ada (anti-mulai-dari-nol):** kalau audit terpaksa diulang karena server tadi membatasi, lanjutkan dari hasil sebelumnya (`resumeFromRunId`) — pemeriksaan yang SUDAH berhasil dipakai ulang (tidak diulang dari awal), jadi yang dijalankan ulang HANYA yang tadi gagal. Lebih cepat + hemat. 🏢 Analogi: kayak isi formulir online yang ke-save otomatis — pas internet putus lalu buka lagi, kamu lanjut dari kolom terakhir, bukan ngisi ulang dari atas.

### Bagian 3 - Translate findings ke ANALOGI non-programmer

8. **WAJIB**: tiap finding di-augment dengan format ini (Bahasa Indonesia ramah, junior-friendly):

```markdown
**[N] <Title teknis singkat>**
- 📖 **Analogi**: <bahasa sehari-hari, pakai contoh kantor/Excel/lemari arsip/ATM/tukang pos/brankas>
- 🎯 **Kenapa penting**: <1-2 kalimat awam, no jargon>
- 🛠 **Cara perbaiki**: <petunjuk cepat, sebut file/baris dan langkah kasarnya>
- ⏱ <perkiraan waktu> · 🚦 <GENTING/PENTING/RAPIKAN> · ⚠ Risiko bikin rusak: <RENDAH/SEDANG/TINGGI>
```

**Sumber analogi (opsional)**: `docs/ANALOGI_LIBRARY.md` berisi 32 jargon dengan bahan analogi (sehari-hari + tools digital populer + contoh) — dipakai **kalau mau** menyertakan 1 analogi. Tabel ringkas + style guide tools digital di `LINTASAI_WORKFLOWS_v1.md` §4.4.

**Penjelasan bahasa awam WAJIB per finding yang memuat jargon** (1 kalimat yang mudah dipahami — jargon TIDAK dibiarkan mentah). **1 analogi singkat OPSIONAL** — TIDAK wajib 3-lapis/contoh konkret. Bahan analogi kalau mau pakai *(disederhanakan per keputusan owner 2026-06-25)*:
1. **🏢 Sehari-hari**: kantor / dapur / lemari arsip / loket bank (universal)
2. **📱 Tools digital populer**: Tokopedia / Gojek / WhatsApp / BCA mobile / Excel / Google Drive / Notion / Discord / dll. (Indonesia-context)
3. **🎯 Contoh konkret**: kapan situasi muncul di proyek user (1 kalimat)

Contoh quick reference (lihat `docs/ANALOGI_LIBRARY.md` untuk 32 jargon lengkap):

| Jargon | 🏢 Sehari-hari | 📱 Tools digital |
|---|---|---|
| N+1 query | Tukang pos antar 30 surat satu-satu padahal punya 30 motor | **Tokopedia** checkout 20 barang satu-satu vs masukin keranjang |
| Missing rate-limit | Loket bank tanpa antrian, 1 orang spam 1000x/menit | **BCA mobile** pencet kirim OTP unlimited → spam SMS korban |
| Race condition | 2 orang nyamber stapler bersama di detik sama | **Shopee flash sale** stok 1, 2 orang klik "Beli" detik sama |
| IDOR | Loker arsip nomor urut, ganti #47→#48 buka loker bos | **Tokopedia** ganti `invoice=12345`→`12346` muncul invoice orang lain |
| God Component | Staff serabutan urus semua (kasir + telepon + gudang + laporan) | **Excel** 1 workbook isi stok+gaji+absensi+pivot semua tumpuk |
| Memory leak | Staff dapur ambil piring kotor gak pernah cuci, dapur penuh | **WhatsApp** chat masuk dengan foto/video gak dihapus, storage penuh |
| Tahan Penggabungan (HOLD MERGE) | Laporan keuangan rapi tapi belum boleh masuk arsip sebelum bos cap | **BCA mobile** transfer di atas limit → tunggu OTP |

Untuk istilah BARU yang belum di `docs/ANALOGI_LIBRARY.md`, AI cukup jelaskan dengan bahasa awam 1 kalimat (1 analogi singkat opsional) + boleh suggest tambah ke library via LAZY-GENERATE.

### Bagian 4 - Susun Rencana Pengerjaan Bertahap

9. Group findings jadi Tahap berdasarkan urgency + dependencies:

- **Tahap 0 - MENDESAK** (~30 menit): finding dengan severity=critical DAN risk_of_bug=low DAN fix_effort=5min. Prioritas "hentikan pendarahan dulu" (backup rusak, kebocoran rahasia, dst.)
- **Tahap 1 - Perbaikan Cepat (Quick Wins)** (1-2 hari): semua Tier 1 dengan fix_effort ≤ 30min, behavior unchanged
- **Tahap 2 - Pondasi Cek Otomatis (Test Foundation)** (3-5 hari): semua test gap untuk HIGH RISK files + docs polish. **WAJIB sebelum Tahap 3.**
- **Tahap 3 - Refactor Sedang (menyentuh perilaku) + Penyiapan Staff Baru (Onboarding)** (1-2 minggu): touch behavior, cross-module refactor, onboarding setup
- **Tahap 4+ - Refactor Berat / Risiko Tinggi** (1-2 minggu per finding): paired review, Tahan Penggabungan (HOLD MERGE), branch protection

> Catatan istilah: "Sedang/Berat" di sini = **tingkat USAHA/RISIKO pengerjaan** (sumbu keseriusan, `templates/REFACTOR_STANDARD.md`), BUKAN "Tingkat 1/2/3" Tangga Refactor (sumbu STRUKTUR: Refactoring in-place / Modular Monolith / Repository Split — `LINTASAI_WORKFLOWS_v1.md` §4.2). Dua sumbu berbeda; jangan tertukar.

### Bagian 5 - Popup #1: Pilih tier (READONLY preview)

10. **AI WAJIB tanya user** dengan `AskUserQuestion` (atau format teks setara di IDE lain). Posisi: setelah Workflow synthesize selesai, sebelum tampil detail.
   **Mode klik**: render **4 opsi utama [1]-[4] saja** — `[skip]` JANGAN jadi opsi klik tersendiri (melebihi batas 4 opsi tool); user yang mau skip pakai "Other" (ketik `skip`). Aturan lengkap: `JALANKAN_KIT.md` > "Cara Tampil Popup".

```
MODE AMAN: <N> temuan audit siap ditampilkan dengan analogi non-programmer.
Status sekarang: MODE AMAN (cuma melihat-lihat, belum ada file proyek yang diubah).

Pilih kelompok tingkat risiko (tier) mana yang mau dilihat detailnya?

Pilihan:
  [1] Semua tier + rencana pengerjaan terstruktur (rekomendasi, default) ⭐ DEFAULT — biar dapat gambaran utuh sekali lihat, tidak ada yang terlewat
      → Output paling panjang tapi paling lengkap.
      → Cocok dijadikan daftar tugas induk yang bisa dipantau terus di docs/decisions/.
      → Cocok untuk owner: lihat gambaran utuh buat menyusun rencana kerja sebelum rekrut staff.
  [2] Tier 1 - Mudah (<X> item, ~<E1> jam total kerja)
      → Perbaikan ringan: <sample categories>
      → Risiko merusak sistem: RENDAH
  [3] Tier 2 - Sedang (<Y> item, ~<E2> hari)
      → Perapian kode yang nyambung ke banyak bagian sekaligus (cross-module): <sample categories>
      → Risiko: SEDANG. Wajib pasang pondasi cek otomatis (Tahap 2) dulu.
  [4] Tier 3 - Hati-hati (<Z> item, ~<E3> hari per temuan)
      → Perapian bagian paling sensitif — auth/encryption/schema (sistem login / penguncian data / struktur database): <sample>
      → Risiko: TINGGI. Perubahan ditahan, tidak digabung sebelum owner setuju (Tahan Penggabungan (HOLD MERGE)). Dikerjakan setelah Tahap 1-2 stabil.
  [skip] Lewati audit, lanjut kerjaan lain
Default (Enter/kosong) -> [1] Semua tier
```

11. Tunggu jawaban user:
   - **"1" / Enter / kosong** ⭐ DEFAULT (DISARANKAN) → tampilkan SEMUA tier + rencana pengerjaan bertahap.
   - **"2"** → tampilkan Tier 1 dengan analogi (group per dimensi).
   - **"3"** → tampilkan Tier 2.
   - **"4"** → tampilkan Tier 3.

### Bagian 6 - Display findings dengan analogi non-programmer

12. **Group per dimensi** dalam tiap tier (mudah di-skim):

```markdown
## 🟢 TIER 1 - MUDAH (X item, ~Y jam total)

### 🗄️ Database (N item)
[1] Title teknis
- 📖 Analogi: ...
- 🎯 Kenapa penting: ...
- 🛠 Cara perbaiki: edit `path/file.ts` baris N, ...
- ⏱ 5 menit · 🚦 PENTING · ⚠ Risiko bikin rusak: RENDAH

[2] Title teknis
- ...

### 🔒 Keamanan (Security) (N item)
[N] ...

### 🧹 Perapian kode (Refactor) (N item)
...

### ✅ Cek mutu & tes (QA/Test) (N item)
...

[dst. per dimensi]
```

13. Setelah display semua tier, tutup dengan rencana pengerjaan bertahap:

```markdown
## 📋 RENCANA PENGERJAAN

### 🔥 Tahap 0 - MENDESAK (30 menit)
1. Item #<X> - <judul> (5min)
2. ...

### 🟢 Tahap 1 - Perbaikan Cepat (Quick Wins) (1-2 hari)
| Hari | Item | Perkiraan waktu |
|---|---|---|
| Pagi 1 | #<...> | 3 jam |
| ...

[Tahap 2, 3, 4+]
```

### Bagian 7 - Popup #2: Mau lanjut apa?

14. **AI WAJIB tanya user** lagi setelah display findings — dengan `AskUserQuestion` (kotak klik) kalau tersedia, blok di bawah = isi kanonik + fallback teks (per `JALANKAN_KIT.md` > "Cara Tampil Popup"). **(Kalau terdeteksi staff BARU / first-time — lihat bagian "Untuk Staff Baru" di bawah: tetap render [1]–[stop] dengan default/rekomendasi klik [1] yang aman, TAPI sebut di teks pertanyaan: "untuk pemula disarankan [stop] supaya owner review dulu". Menjembatani Phase 3 tanpa melanggar §14.1 — rekomendasi tetap [1].)**

```
Status: Selesai melihat-lihat (mode aman). Tidak ada file yang diubah, tidak ada yang disimpan permanen, tidak ada yang dikirim ke GitHub.

Mau lanjut ke step berikutnya?

Pilihan:
  [1] Tulis laporan lengkap ke docs/decisions/<YYYY-MM-DD>-audit-findings.md (rekomendasi, default) ⭐ DEFAULT — paling aman, tidak mengubah kode; kenali dulu kondisinya sebelum mulai
      → Semua temuan + analogi + rencana pengerjaan jadi 1 file catatan (format Markdown).
      → Owner bisa pantau riwayat perubahannya lewat git, bagikan ke staff, dan jadikan rujukan rencana kerja.
      → Temuan tersimpan rapi sebagai catatan keputusan tim (pola ADR); owner baca santai dulu sebelum mulai Tahap 0.
  [2] Eksekusi Tahap 0 sekarang (item MENDESAK, ~30 menit)
      → AI kerjakan item Tahap 0 langsung, lapor per item.
      → AI tunjukkan dulu apa yang akan dikerjakan, baru mengerjakan setelah kamu setuju.
  [3] Mulai rapikan kode (refactor) sekarang — <N> peluang ditemukan, dari yang paling aman dulu
      → Masuk MODE REFACTOR BERTINGKAT: AI kelompokkan peluang jadi 🟢 Ringan → 🟡 Sedang → 🔴 Berat, lalu tawarkan TINGKAT DEMI TINGKAT (paling aman dulu). Tiap tingkat ada popup-nya sendiri: "kerjakan semua di tingkat ini / pilih satu-satu / lewati ke tingkat berikut / stop".
      → Tiap perubahan: salinan terpisah (branch) + dicatat kecil-kecil (commit) yang bisa dibalik + cek otomatis (lint/build/test) lulus dulu sebelum naik tingkat. AI tunjukkan info tiap tingkat dulu, baru kerja setelah kamu pilih. (Mesin: CLAUDE_universal_v1.md §4.11 + LINTASAI_WORKFLOWS_v1.md §4.2 "Mode Refactor Bertingkat".)
  [4] Pilih 1 temuan spesifik untuk diperbaiki sampai tuntas
      → Kasih nomor (mis. "fix #1 dulu") → AI kerjakan dengan jaring pengaman penuh.
      → Kerja di salinan terpisah (branch — biar versi utama aman) + tiap perubahan dicatat kecil-kecil (commit) + semua cek otomatis (lint/build/test) lulus + rencana balik ke versi sebelumnya siap.
  [stop] Stop, owner review dulu
      → Hasil pratinjau siap. Owner baca-baca dulu, kasih instruksi spesifik nanti di sesi baru.
Default (Enter/kosong) -> [1] Tulis laporan lengkap (rekomendasi — kenali dulu kondisinya, belum ada yang diubah)
```

15. Tunggu jawaban:
   - **"1" / Enter / kosong** ⭐ DEFAULT (DISARANKAN) → tulis file `docs/decisions/<YYYY-MM-DD>-audit-findings.md` lengkap, lapor lokasi file
   - **"2"** → run Tahap 0 dengan branch terpisah + commit per item + smoke test (untuk akses: cek backup workflow, revoke cross-tenant role, dst.)
   - **"3"** → masuk **Mode Refactor Bertingkat** (`CLAUDE_universal_v1.md` §4.11 + `LINTASAI_WORKFLOWS_v1.md` §4.2): kelompokkan temuan dimensi "🧹 Perapian kode" jadi 🟢 Ringan → 🟡 Sedang → 🔴 Berat, tawarkan TINGKAT DEMI TINGKAT (paling aman dulu) — tiap tingkat 1 popup (`[1] kerjakan semua di tingkat ini / [2] pilih satu-satu / [3] lewati ke tingkat berikut / [stop]`) + Safety Net Bagian 8 (branch + commit kecil + lint/build/test lulus sebelum naik tingkat). Naik 1 tingkat per langkah, JANGAN loncat; 🔴 Berat = persetujuan eksplisit + Tahan Penggabungan. Tutup dengan "✅ SELESAI + rekap".
   - **"4"** → tanya nomor finding, lalu execute dengan safety net pattern (lihat Bagian 8)
   - **"stop"** → tutup: *"Pratinjau siap. Sesi berikutnya tinggal bilang 'lanjut Tahap 0' atau 'perbaiki item #X' kapan saja."*

### Bagian 8 - Safety Net Pattern (kalau owner pilih execute)

Untuk SETIAP refactor yang AI eksekusi (Tahap 0 atau pick spesifik):

1. **Branch terpisah**: `git checkout -b fix/audit-<short-slug>`
2. **Read existing test** (kalau ada vitest di area yang akan disentuh) untuk paham contract. **Kalau TIDAK ada tes DAN refactor menyentuh perilaku (🟡 Sedang/🔴 Berat) → tulis characterization test dulu** (kunci perilaku sekarang) atau tahan ke Test Foundation (Tahap 2) — JANGAN lanjut cuma berbekal lint/build/test hijau saat coverage 0 (0 dari 0 selalu "lulus" = rasa aman palsu).
3. **List intended behavior PRESERVED** sebelum touch code (kontrak before/after) - tulis ke commit message body
4. **Per refactor = 1 atomic commit kecil** (reversible via `git revert HEAD`)
5. **Verify**: jalankan cek otomatis pakai package manager yang **TERDETEKSI** (`Get-PackageManager` / baca `package.json`) — mis. `pnpm lint && pnpm build && pnpm test` di project pnpm, `npm run lint && npm run build && npm test` di project npm. **JANGAN hardcode `pnpm`** (bisa rusakkan lockfile project npm/yarn). Pastikan perintahnya benar-benar jalan (exit-code sukses) sebelum percaya hasilnya (§6.3 disiplin #4).
6. **Smoke test alur kritis manual** (untuk fix yang touch auth/DB/payment): list 3 alur untuk owner verify
7. **HIGH RISK (Tier 3)** = Tahan Penggabungan (HOLD MERGE), owner approve dulu
8. **Lapor per item**: "✅ Item #<N> selesai. Perubahan sudah tercatat aman (commit: <sha> — kayak Save di Google Docs). Semua cek otomatis lulus. Tes cepat alur penting (smoke test): <list>. Kalau mau dibatalkan: jalankan `git revert <sha>` (balik ke versi sebelumnya, kayak Ctrl+Z)."

### Bagian 9 - Penutup WAJIB: SELESAI + rekap rinci (anti-buntu, per CLAUDE_universal_v1.md §4.7)

Apa pun jalur yang dipilih user di Popup #2 (tulis laporan / eksekusi Tahap 0 / rapikan kode / pilih 1 temuan / stop), audit **WAJIB ditutup** dengan langkah penutup ini. JANGAN tinggalkan user menatap laporan tanpa tahu "sekarang apa" — itu yang bikin user bingung + harus ngetik prompt lagi.

Format penutup (Bahasa Indonesia awam):

    ✅ SELESAI — Audit <nama project> tuntas.

    📊 Rekap rinci:
    - Diperiksa: <D> dari 11 sudut (keamanan, database, perapian kode, tes, tampilan/frontend, kemudahan-pakai, SEO, ...). <kalau ada sudut yang gagal jalan: "Sudut <nama> belum sempat diperiksa — server sempat membatasi permintaan; bisa dilanjutkan nanti.">
    - Temuan: <berhasil> dari <dicoba> sudah dicek-silang skeptis (biar tidak mengada-ada). <kalau berhasil < dicoba: "⚠️ <belum> temuan BELUM dicek-silang — ditampilkan apa adanya dengan tanda BELUM DICEK-SILANG; audit ini BELUM tuntas. Lanjutkan kapan saja (lebih cepat: lanjut dari hasil yang sudah ada, bukan ulang dari nol).">.
    - Tingkat keseriusan: GENTING <a> · PENTING <b> · RAPIKAN <c>.
    - Yang DIUBAH sesi ini: <daftar item + commit, ATAU "tidak ada — mode aman, semua cuma dibaca">.
    - Yang TIDAK diubah: <sisanya — menunggu keputusanmu>.
    - Tersimpan di: <docs/decisions/<tgl>-audit-findings.md kalau ditulis, ATAU "belum disimpan">.

    Langkah berikutnya yang disarankan: <1 kalimat, mis. "kerjakan 3 item MENDESAK dulu (~30 menit)">.

Lalu **popup penutup** (`AskUserQuestion` kalau tersedia; opsi recommended di [1]):
  [1] Kerjakan item MENDESAK (Tahap 0) sekarang (rekomendasi kalau ada GENTING — hentikan dulu masalah paling mendesak biar tidak makin parah)
  [2] Simpan laporan ke docs/decisions/ (kalau belum disimpan)
  [3] Cukup — audit selesai, berhenti di sini
  (Other = berhenti)

Kalau user pilih "cukup/selesai" → tutup ramah: *"Oke, audit selesai. Kapan saja mau lanjut, tinggal bilang 'lanjut Tahap 0' atau 'perbaiki item #X' — tidak perlu ulang audit dari awal."* Ini SATU-SATUNYA cara audit boleh berakhir — BUKAN berhenti diam di tengah laporan tanpa popup.

### Aturan AI selama workflow ini

- **READ-ONLY default (STATIC)**: Bagian 2-6 = scan + report. Tidak ada `Edit`/`Write`/`Bash destruktif`. **Agen audit/verifikasi DILARANG menyentuh sistem live**: tidak menjalankan SQL yang mengubah data (`INSERT`/`UPDATE`/`DELETE`/`CREATE`/`DROP`/`ALTER`), tidak memakai MCP tool yang mengubah DB/Supabase/server produksi. Verifikasi = baca kode + Grep + nalar. (Pelajaran nyata 2026-06: agen pernah mengubah DB live lalu klaim bersih — JANGAN ulangi.) Pakai Workflow tool untuk parallel scan read-only.
- **Implicit consent dari user paste prompt** = setuju AI lakukan audit read-only sampai Popup #1.
- **Popup #1 + Popup #2 WAJIB** - tunggu user pilih tier + lanjutan.
- **ANALOGI non-programmer WAJIB** di tiap finding (Bagian 3 style guide). Kalau istilah belum ada di `docs/ANALOGI_LIBRARY.md`, AI bikin analogi konsisten + suggest tambah ke library.
- **Cek-silang skeptis WAJIB** (internal: "adversarial verify") - anggap tiap temuan salah dulu sampai terbukti benar, supaya AI tidak mengarang temuan. Saat lapor ke user, JANGAN pakai kata "adversarial/halusinasi/is_real" — bilang "aku cek ulang tiap temuan dengan sikap skeptis biar tidak ada yang mengada-ada".
- **Kejujuran soal cek-silang yang gagal jalan WAJIB (anti-bersih-palsu).** Kalau sebagian pemeriksa-silang balik kosong karena server membatasi sesaat: (a) ulang dulu yang gagal (maks 3 putaran, lihat Bagian 2 step 6); (b) yang TETAP gagal ditandai **BELUM DICEK-SILANG** dan tetap ditampilkan — JANGAN dibuang, JANGAN dianggap aman; (c) DILARANG menyatakan "bersih/aman/tuntas" kalau jumlah yang berhasil dicek-silang < jumlah yang dicoba. Bilang apa adanya: "Audit belum tuntas: <X> dari <Y> temuan belum sempat dicek-silang." Ini penerapan Gerbang Verifikasi Pra-Rilis (CLAUDE_universal_v1.md §4.6) + status jujur soal lingkungan: "kelihatan bersih" != "terbukti bersih".
- **Rencana bertahap = panduan, BUKAN dijalankan otomatis.** Owner pegang kontrol final.
- **Ikuti Alur Berpemandu Bertahap (CLAUDE_universal_v1.md §4.7)**: sajikan BERTAHAP (ringkasan dulu → popup → detail → popup), JANGAN tumpuk seluruh laporan sekaligus lalu diam. DILARANG buntu memaksa user re-prompt. WAJIB tutup dengan langkah penutup "✅ SELESAI + rekap rinci" (Bagian 9).
- **Tinjauan lintasAI Divisi review WAJIB** di akhir (per CLAUDE_universal_v1.md section 4.1).
- **JANGAN narasikan "dapur" internal ke user** (per CLAUDE_universal_v1.md §2.1 poin 6): dilarang sebut jumlah agen, kata "spawn/auditor/verifier/paralel/concurrency". Ke user cukup: "Aku sudah periksa proyek dari 11 sudut (keamanan, database, tampilan, kemudahan-pakai, SEO, dst.) dan saling cek ulang temuannya."
- Semua respons AI dalam **Bahasa Indonesia** ramah, junior-friendly.

---

## Untuk Staff Baru (Day 0 Pertama Kali Audit)

Kalau staff IT non-programmer pertama kali pakai audit ini di proyek (mereka belum tahu codebase), AI WAJIB:

1. **Phase 1** - Foundation reading: pastikan staff sudah baca `docs/GLOSSARY_NON_PROGRAMMER.md` + `docs/SECURITY_INCIDENT_PLAYBOOK.md`
2. **Phase 2** - Project context: brief staff tentang stack + domain + status sebelum audit (auto via Guided Step-by-Step Pattern di `CLAUDE_universal_v1.md` section 4.3)
3. **Phase 3** - Audit dengan extra hand-holding: di Popup #2, arahkan staff baru ke option `[stop]` (Stop, owner review dulu) supaya tidak langsung execute fix tanpa supervisor approval

---

## Konteks tambahan untuk Workflow tool

- Setiap auditor dimensi WAJIB read minimal:
  - `docs/architecture_auto.md` (TOC paham landscape)
  - `prisma/schema.prisma` (kalau ada Prisma)
  - 1-2 file CRITICAL di area yang di-audit (dari dim-specific hint)
- JANGAN baca semua `docs/*.md` di awal (boros token, lawan dari section 7.3 READ-MINIMAL)
- Output schema STRUCTURED supaya synthesize gampang (lihat Bagian 2 step 5)
- **Batas jalan-bersamaan (cap 16) BUKAN jaminan anti-gagal.** Cap 16 cuma membatasi jumlah yang jalan serempak — TIDAK mencegah server sesekali membatasi permintaan ("temporarily limiting requests"). Saat itu terjadi, sebagian pemanggilan **balik kosong (gagal diam-diam)** dan hasilnya bisa kelihatan "bersih" padahal sebagian besar temuan belum sempat dicek-silang. 🏢 Analogi: jalan tol dibatasi 16 mobil sekaligus tetap bisa macet kalau gerbang tol-nya yang sesekali tutup-buka — batas mobil tidak menyelesaikan gerbang yang ngadat.
- **Maka WAJIB: jalankan PER GELOMBANG kecil (auditor maks 4; pemeriksa-silang maks 8 per gelombang) + LOOP ULANG yang gagal (maks 3 putaran) + lapor kekurangan secara JUJUR** (lihat Bagian 2 step 5-7). Kalau setelah diulang masih ada yang gagal, tandai BELUM DICEK-SILANG — jangan dibuang, jangan diaku bersih.
- **Lanjutkan dari hasil yang sudah ada (auto-resume `resumeFromRunId`)** saat mengulang audit yang tadi terpotong — pemeriksaan yang sudah berhasil dipakai ulang, hemat waktu + biaya.

---

Mulai dari langkah 1 sekarang.
