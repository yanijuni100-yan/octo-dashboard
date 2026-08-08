# docs/UPDATE_GUIDE.md - Cara Update Kit lintasAI (untuk Staff IT Non-Programmer)

> Versi 4 · 2026-06-20 · auto-deployed oleh setup-pola-b.ps1 (v4: tambah §2.5 Kebijakan Update - kapan PERLU vs TIDAK)

---

## 1. Untuk siapa & kapan baca dokumen ini

Dokumen ini untuk **staff IT non-programmer** yang pakai kit `lintasAI` di proyek harian. Baca kalau:

- Kamu lihat notifikasi/chat "lintasAI versi baru rilis" dan bingung harus apa.
- AI di Claude Code bilang "kit kamu ketinggalan, update dulu".
- Kamu mau tahu apakah update versi baru aman atau bikin file lama berantakan.
- Kamu mau rollback (balik ke versi lama) karena update terasa "aneh".

Kalau kamu programmer senior dan butuh detail teknis sha256/manifest diff, langsung loncat ke `./.claude-kit/CHANGELOG.md` + baca source `update-kit.ps1`.

---

## 2. TL;DR (baca ini dulu kalau buru-buru)

Kit `lintasAI` di-update dengan **1 perintah** - entah lewat chat AI ("lintasAI v1.2.0 rilis, update") atau jalanin `kit.ps1 update` di PowerShell. Sistem otomatis re-clone versi terbaru, backup file kamu yang ter-modifikasi, lalu AI **auto-pakai aturan baru** di sesi berikutnya. Mirip kayak **WhatsApp auto-update di Play Store** - kamu tinggal tap, fitur baru langsung jalan, chat lama tidak hilang.

---

## 2.5 Kebijakan Update: kapan kamu PERLU update, kapan TIDAK (PENTING - baca ini)

**Pertanyaan paling sering:** "Versi lintasAI naik terus tiap ada perubahan. Apakah aku WAJIB update tiap kali?"

**Jawaban tegas: TIDAK.** Ada satu hal yang sering disalahpahami:

> **"Versi naik" (di sisi pembuat) ≠ "kamu WAJIB update" (di sisi pemakai).** Itu DUA hal terpisah.

Pembuat menaikkan nomor versi tiap ada perubahan - itu memang seharusnya (biar tiap perubahan tercatat rapi). Tapi **kamu sebagai pemakai TIDAK harus mengejar tiap nomor.** Kit yang sudah terpasang di proyekmu (`.claude-kit/`) **tetap jalan selamanya walau tak pernah di-update** - tidak ada yang memaksa, tidak rusak kalau dibiarkan.

🏢 **Analogi:** seperti aplikasi di HP (Tokopedia/WhatsApp). Pembuatnya rilis update **terus-menerus**, tapi kamu tidak update tiap kali - HP-mu tetap jalan. Kamu update kalau: (a) ada perbaikan **keamanan penting**, (b) kamu **mau fitur baru**, atau (c) **sekali-sekali** biar tak terlalu ketinggalan.

### Kapan WAJIB vs OPSIONAL vs TIDAK perlu

| Situasi | Perlu update? |
|---|---|
| Update ber-label **`[SECURITY]`** (lihat §3 + §6) | ✅ **WAJIB - segera.** Ini satu-satunya yang "harus sekarang" (mirip surat recall mobil demi keselamatan). |
| Ada **fitur baru** yang kamu **mau pakai** | 💡 **Opsional** - update kalau memang butuh fiturnya. Kalau tidak butuh, lewati. |
| Perbaikan kecil / aturan baru yang **tak kamu butuhkan** | ⏭️ **Tidak mendesak** - boleh ditunda, gabung dengan update terjadwal berikutnya. |
| Versimu sekarang **jalan baik** + tak ada `[SECURITY]` + tak butuh fitur baru | 🟢 **Tidak perlu update** - biarkan, tetap aman. |

### Cara sehat (rekomendasi untuk tim): "owner sebagai gerbang"

Daripada tiap staff mengejar versi terbaru sendiri-sendiri (capek + berisiko), pakai pola ini:

1. **Owner/lead** yang uji + setujui **satu versi stabil** (mis. tiap awal bulan, atau saat ada `[SECURITY]`).
2. Owner kabari staff: **"pakai versi X"** - staff update ke versi itu, bukan ke "yang paling baru".
3. Staff **tidak perlu** update tiap kali ada rilis - cukup ikut versi yang owner tetapkan + update segera HANYA kalau owner bilang ada `[SECURITY]`.

🏢 **Analogi:** seperti kantor yang menetapkan "semua pakai Windows versi yang sudah dites IT", bukan tiap karyawan pasang update Windows terbaru masing-masing. Lebih tenang, lebih seragam, lebih aman.

> **Intinya:** kamu tidak harus update terus-menerus. **Update terjadwal** (mis. bulanan) + **wajib segera HANYA untuk `[SECURITY]`** + update kapan saja kalau **mau fitur baru**. Selebihnya, versi yang sudah jalan biarkan jalan.

---

## 3. 4-Tier Update Strategy (level keparahan update)

Tidak semua update sama besarnya. Kit `lintasAI` punya **4 level**, dari yang paling ringan sampai yang butuh perhatian khusus:

| Tier | Label CHANGELOG | Contoh isi update | Analogi tools digital | Aksi staff |
|------|-----------------|-------------------|----------------------|------------|
| **1 - Silent** | (tanpa label) | Typo, perbaikan kalimat, fix link rusak | **WhatsApp 2.23.10 → 2.23.11** auto-update di background, kamu bahkan tidak sadar | Cukup 1 perintah `kit.ps1 update`. Selesai. |
| **2 - AI auto-sync** | (tanpa label) | Aturan baru ditambahin, template baru, prompt baru | **iPhone iOS 17.3 → 17.4** minor - ada fitur baru tapi semua app lama tetap jalan normal | 1 perintah update. AI di sesi berikutnya auto-pakai aturan baru. Tidak perlu setup ulang. |
| **3 - [BREAKING]** | `[BREAKING]` | Struktur file/folder berubah, format CLAUDE.md ganti, nama file di-rename | **iPhone iOS 16 → iOS 17** major - sebelum upgrade muncul layar "backup dulu ya", beberapa setting harus dicek ulang | Baca **"Migration Steps"** inline di CHANGELOG.md untuk versi itu. Biasanya 2-5 langkah PowerShell. AI bisa bantu jalanin step-by-step. |
| **4 - [SCAN-REQUIRED]** | `[SCAN-REQUIRED]` | Logic bulk-bootstrap berubah, rule scan dokumen lama ganti | **Tokopedia Seller ganti algoritma kategori** - produk lama harus di-remap ulang biar tetap muncul di pencarian | Paste ulang isi `JALANKAN_KIT.md` ke chat AI baru. AI scan ulang proyek pakai rule baru, lalu apply. |

> 🔒 **Tanda `[SECURITY]` (TERPISAH dari 4 tingkat di atas):** kalau entry CHANGELOG ada `[SECURITY]`, itu perbaikan KEAMANAN — **pasang SEGERA** walau update-nya kecil. Tool update menampilkan peringatan merah. Mirip **"recall mobil"**: komponennya kecil, tapi diganti segera demi keselamatan.

**Cara baca label:** buka `./.claude-kit/CHANGELOG.md`, lihat entry versi terbaru. Kalau ada `[BREAKING]`, `[SCAN-REQUIRED]`, atau `[SECURITY]` di judul, perlu perhatian. Kalau cuma "fix typo di template X", itu Tier 1.

### 3.1 Arti nomor versi (`BESAR.MENENGAH.KECIL`)

Nomor versi sendiri sudah memberi sinyal — kamu bahkan tidak perlu buka CHANGELOG dulu:

| Angka yang naik | Contoh | Artinya |
|---|---|---|
| **KECIL** (paling kanan) | 1.7.5 → 1.7.**6** | Perbaikan kecil — **aman** (Tier 1/2) |
| **MENENGAH** (tengah) | 1.7.x → 1.**8**.0 | Fitur baru — **masih aman** (Tier 2) |
| **BESAR** (paling kiri) | **1**.x → **2**.0 | Ada yang berubah total / breaking (Tier 3) — **ini yang perlu perhatian** |

**Aturan gampang:** kalau angka **paling kiri (BESAR) TIDAK berubah**, update hampir pasti aman. Cuma saat angka paling kiri ikut naik, baca dulu langkah migrasi.

> 💡 Angka BESAR **jarang naik = bagus** — artinya kit jarang merusak yang sudah jalan. Jangan kaget kalau bertahun-tahun masih di `1.x`; itu tanda sehat, bukan ketinggalan.

---

## 4. Dual-Mode Update - pilih yang nyaman

Ada **2 cara** update kit. Sama-sama valid, tapi pas konteks beda:

### Mode 1 - AI Chat (recommended untuk staff non-programmer)

Buka Claude Code, chat:

> "lintasAI v1.2.0 rilis, update dong"

AI akan:
1. Fetch `CHANGELOG.md` versi baru dari GitHub `ojokesusu/lintasAI`.
2. Parse label tier (Tier 1/2/3/4).
3. Compose ringkasan Bahasa Indonesia: "ada 3 perubahan, 1 typo + 1 fitur baru + 1 BREAKING (rename folder X → Y)".
4. Tanya konfirmasi: "lanjut update?" - kamu jawab "ya".
5. Jalanin `./.claude-kit/kit.ps1 update` otomatis.
6. Kalau Tier 3/4, AI bacain "Migration Steps" satu per satu sambil tunggu kamu OK.

**Analogi:** kayak **Tokopedia Seller** yang push notif "ada update aturan baru ongkir, mau lihat?" - kamu tap, dia jelasin pakai bahasa biasa, kamu tinggal setuju.

### Mode 2 - PowerShell Script (untuk power user / CI automation)

Buka PowerShell di folder proyek, jalanin:

```powershell
./.claude-kit/kit.ps1 update
```

Script otomatis classify tier dan kasih output terstruktur di terminal:

```
[OK] Fetched lintasAI v1.2.0 (was: v1.1.3)
[INFO] 3 changes: 1 Tier-1, 1 Tier-2, 1 Tier-3 [BREAKING]
[ACTION REQUIRED] Tier-3 migration needed:
  - Step 1: Rename folder docs/old/ -> docs/legacy/
  - Step 2: Update reference di AGENTS.md line 42
[BACKUP] 2 files user-modified -> .claude-kit/CLAUDE_universal_v1.md.bak-20260604-1530
```

Mode ini dipakai kalau:
- Kamu CI/CD pipeline (no AI in the loop).
- Sambungan internet AI lagi lemot, mau update offline lebih cepat.
- Kamu programmer dan suka lihat output mentah.

**Analogi:** kayak `git pull` manual vs pakai GitHub Desktop GUI - sama hasilnya, beda interface.

---

## 5. Skenario sehari-hari - kapan tiap tier muncul

**Skenario A: Tier 1 - Hari Senin pagi**
> Owner kit fix typo "ANALAGI" → "ANALOGI" di `ANALOGI_LIBRARY.md`. Kamu chat "update", AI bilang "cuma typo, aman 100%, update otomatis". Kamu lanjut kerja. Tidak ada yang berubah di workflow kamu.

**Skenario B: Tier 2 - Hari Rabu sore**
> Owner kit tambah 5 prompt baru di `PROMPT_LIBRARY.md` untuk handle task "code review". Kamu update. Sesi AI besok pagi, kamu tanya "review PR ini", AI auto-pakai prompt baru tanpa kamu sadar. Mirip **Excel kasih function baru `XLOOKUP`** - formula lama (`VLOOKUP`) tetap jalan, function baru tinggal dipakai kalau mau.

**Skenario C: Tier 3 [BREAKING] - Hari Jumat siang**
> Owner kit rename `CLAUDE_universal_v1.md` → `LINTAS_AI_RULES.md`. CHANGELOG kasih Migration Steps:
> 1. Tutup semua sesi Claude Code.
> 2. Jalanin `kit.ps1 update`.
> 3. AI auto-update referensi di `AGENTS.md` kamu.
> 4. Buka sesi baru, verifikasi AI baca file baru.
>
> Analogi: kayak **BCA mobile minta re-login pakai biometric** setelah update major - sedikit ribet, tapi sekali doang.

**Skenario D: Tier 4 [SCAN-REQUIRED] - Hari Senin pagi setelah weekend**
> Owner kit ubah logic scan: dulu cuma baca `docs/`, sekarang juga baca `prisma/schema.prisma`. Kamu paste ulang `JALANKAN_KIT.md` ke chat AI baru. AI bilang "saya scan ulang proyek pakai rule baru ya", lalu propose update di beberapa file lama. Kamu approve. Analogi: **Tokopedia minta seller re-kategorisasi produk** setelah ganti algoritma - sekali kerjaan, manfaat panjang.

---

## 6. Cara execute update - langkah konkret

### Cara 1 (RECOMMENDED): Chat ke AI

1. Buka Claude Code di folder proyek (mis. `D:\projek\nama-proyekmu`).
2. Ketik di chat: `lintasAI v1.2.0 rilis, update`.
   (Ganti `1.2.0` dengan versi yang kamu lihat di chat tim / di GitHub.)
3. Tunggu AI ringkas perubahan dalam Bahasa Indonesia.
4. Jawab `ya` kalau setuju.
5. AI eksekusi + verifikasi + lapor "selesai, versi sekarang v1.2.0".

### Cara 2 (advanced): PowerShell

1. Buka PowerShell.
2. `cd` ke folder proyek.
3. Jalanin:
   ```powershell
   ./.claude-kit/kit.ps1 update
   ```
4. Baca output, ikuti `[ACTION REQUIRED]` kalau ada.
5. Kalau Tier 3/4, buka `./.claude-kit/CHANGELOG.md` baca section "Migration Steps" versi itu.

---

### 6.1 Kalau project sudah dipecah jadi 3 repo (split)

lintasAI **ikut disimpan di tiap repo** (lewat git). Jadi update-nya lewat git, BUKAN satu-satu di komputer tiap staff:

1. **Owner** update kit di **tiap repo**: di folder repo, jalankan `./.claude-kit/kit.ps1 update` → lalu `git commit` → `git push`. (Ulangi untuk backend, frontend, shared — 3x, tapi cuma owner.)
2. **Staff** cukup **`git pull`** di repo masing-masing → otomatis dapat versi kit terbaru yang **SAMA** dengan tim.

> 💡 Jadi staff **TIDAK** update sendiri-sendiri. Owner update + push (1x per repo); staff tinggal **tarik** (`git pull`). Hasilnya: semua orang di satu repo pakai versi kit **sama persis** — tidak ada beda-beda. 🏢 Mirip **Google Drive bersama**: owner perbarui file aturan, semua anggota otomatis lihat versi terbaru yang sama.

---

## 7. Apa yang ter-backup otomatis

Update kit pakai **atomic re-clone** (kit lama dihapus, kit baru di-clone fresh). Tapi file yang **kamu modifikasi sendiri** tidak hilang - dilindungi pakai logic sha256 di `update-kit.ps1`:

- Sebelum re-clone, script hitung sha256 tiap file kit.
- Bandingkan dengan manifest versi awal install.
- File yang sha256-nya **beda** (= kamu pernah edit) → di-backup ke `.bak-YYYYMMDD-HHmm`.
- File yang sha256-nya **sama** (= tidak pernah disentuh) → langsung ditimpa fresh.

**Contoh:**
```
./.claude-kit/CLAUDE_universal_v1.md          ← tidak pernah kamu edit, di-overwrite
./.claude-kit/CLAUDE_universal_v1.md.bak-20260604-1530  ← (tidak dibuat, file aman)

./.claude-kit/templates/INDEX.md              ← kamu edit kemarin
./.claude-kit/templates/INDEX.md.bak-20260604-1530      ← BACKUP versi kamu disini
./.claude-kit/templates/INDEX.md              ← versi baru kit di-install di sini
```

Setelah update, kamu bisa **diff manual** antara file baru vs `.bak` kamu, lalu merge perubahan yang masih relevan. AI bisa bantu kalau kamu chat "merge backup INDEX.md kemarin ke versi baru".

**Analogi:** mirip **Google Drive kasih versioning otomatis** - file lama tidak hilang, tinggal buka "Version History".

---

## 8. Pembersihan backup (OPT-IN — TIDAK otomatis)

> **Penting:** pembersihan backup **TIDAK berjalan otomatis**. Lewat cara update biasa (`kit.ps1 update` atau minta AI), backup lama **dibiarkan menumpuk** — ini SENGAJA & AMAN: versi lamamu tidak ikut terhapus tanpa kamu minta.

Kalau folder mulai penuh backup, ada **2 cara** membersihkan:

- **Cara A — minta pembersihan (opt-in):** jalankan
  ```powershell
  ./.claude-kit/update-kit.ps1 -CleanupBackups
  ```
  Ini menyimpan **3 versi terbaru** + menghapus backup **lebih tua dari 30 hari**, untuk berkas `*.backup-<tanggal>` dan folder cadangan `.claude-kit.backup-<tanggal>`.
- **Cara B — hapus manual:** hapus sendiri berkas `*.backup-*` / folder `.claude-kit.backup-*` lama saat kamu yakin sudah tidak perlu.

**Contoh** (yang dibersihkan Cara A):
```
AGENTS.md.backup-20260301-120000   ← 95 hari lalu, DIHAPUS
AGENTS.md.backup-20260520-090000   ← keep (3 terbaru)
AGENTS.md.backup-20260601-143000   ← keep
AGENTS.md.backup-20260604-153000   ← keep (paling baru)
```

**Analogi:** kayak **Recycle Bin / Sampah di Windows** — barang lama **tidak hilang sendiri**; kamu yang memutuskan kapan dikosongkan. Aman: tidak ada yang terhapus diam-diam.

> Catatan: TIDAK ada folder `migrations/` per breaking change (over-engineering). Migration instructions ditulis **inline** di CHANGELOG entry per versi, supaya satu tempat aja yang dibaca.

---

## 9. Rollback kalau update bermasalah

Ada **2 jenis "rollback" yang BERBEDA** — kenali gejalamu dulu, baru pilih:

| Gejalamu | Pakai yang mana |
|---|---|
| Berkas project (AGENTS.md, docs) ke-timpa/berubah, mau balikin **isinya** | **Cara 1** (`kit.ps1 rollback`) |
| Kit **baru rusak** / AI jadi bingung / error import setelah update | **Cara 2** (kembalikan SELURUH folder kit) — `kit.ps1 rollback` TIDAK membalikkan folder kit |

### Cara 1: kit.ps1 rollback — balikin BERKAS PROJECT (bukan folder kit)

```powershell
./.claude-kit/kit.ps1 rollback
```

Memulihkan berkas **project** yang ter-track (AGENTS.md, docs, dll) satu per satu dari cadangan terakhir. **Catatan penting:** ini **TIDAK** menyentuh folder `.claude-kit/` itu sendiri — jadi kalau masalahmu "kit-nya yang rusak", Cara 1 **tidak akan** memperbaikinya; pakai Cara 2.

### Cara 2: kembalikan SELURUH folder kit yang rusak

Versi kit lama tersimpan utuh di folder `.claude-kit.backup-<tanggal>` (dibuat tiap update). Kembalikan dengan 2 baris ini (ganti `<tanggal>` sesuai nama folder yang ada):

```powershell
Move-Item .claude-kit .claude-kit.broken
Move-Item .claude-kit.backup-<tanggal> .claude-kit
```

Atau, kalau kit kamu di-track git: `git restore --source=HEAD~1 -- .claude-kit/` (balik ke versi commit sebelumnya).

### Cara 3: chat AI (paling gampang)

> "rollback update lintasAI tadi, kayanya bermasalah"

AI akan **tanya gejalamu dulu**, lalu jalankan Cara 1 atau Cara 2 yang tepat + verifikasi.

**Analogi:** kayak **2 tombol berbeda** — Cara 1 = "**Undo** perubahan dokumen" (Ctrl+Z di Google Docs: balikin isi berkas); Cara 2 = "**install ulang aplikasi** versi lama" (kalau aplikasinya sendiri yang rusak). Jangan tertukar: meng-undo dokumen tidak memperbaiki aplikasi yang rusak.

---

## 10. FAQ untuk staff non-programmer

**Q1: Saya tidak update selama 2 bulan, aman?**
Aman, kit lama tetap jalan. Tapi AI mungkin tidak tahu fitur/aturan baru. Best practice: update minimal 1× per 2 minggu, atau tiap kali owner kit announce versi baru di chat tim.

**Q2: Update bisa bikin file `docs/` proyek saya hilang?**
**TIDAK.** Update cuma sentuh folder `./.claude-kit/`. File proyek (mis. `docs/`, `prisma/`, `app/`) tidak ke-touch sama sekali. Kit dan proyek terpisah, kayak **app WhatsApp vs chat history kamu** - update app tidak hapus chat.

**Q3: Saya pernah edit `CLAUDE_universal_v1.md`, edit-an saya hilang setelah update?**
Tidak. File user-modified auto-backup ke `.bak-YYYYMMDD-HHmm`. Bisa kamu cek + merge manual. AI bisa bantu.

**Q4: Versi kit terbaru di mana saya lihat?**
Buka `github.com/ojokesusu/lintasAI` → file `CHANGELOG.md`. Atau chat AI: "versi terbaru lintasAI berapa?".

**Q5: Sesi AI besok pagi otomatis tahu aturan baru, atau saya perlu setting ulang?**
Auto. Tiap kali AI start sesi, dia baca `./.claude-kit/CLAUDE_universal_v1.md` fresh. Jadi setelah update, sesi berikutnya = pakai aturan baru tanpa setting ulang. Analogi: **Notion update template** → besok kamu buka Notion, template baru langsung ada.

**Q6: Saya CI/CD, update di pipeline gimana?**
Pakai Mode 2 (PowerShell). Tambahin step `./.claude-kit/kit.ps1 update --non-interactive` di pipeline. Exit code non-zero kalau ada Tier 3/4 yang butuh manual review.

**Q7: Kalau saya cuma 1 orang (solo project), perlu update juga?**
Perlu. Owner kit terus improve aturan, prompt, dan analogi. Update = AI kamu makin pintar. Solo project lebih gampang lagi karena tidak perlu koordinasi tim.

---

## 11. Cross-reference

- **Istilah teknis** (mis. "sha256", "manifest", "atomic re-clone") → buka `./.claude-kit/templates/ANALOGI_LIBRARY.md` untuk analogi sehari-hari.
- **Detail per versi** (apa berubah di v1.2.0 vs v1.3.0) → buka `./.claude-kit/CHANGELOG.md`.
- **Audit setelah update besar** → ikuti pattern di `./.claude-kit/CLAUDE_universal_v1.md` section 4.4 "Audit Post-Setup".
- **Aturan umum kerja AI-first** → `./.claude-kit/CLAUDE_universal_v1.md` (wajib baca tiap sesi).
- **Kalau bingung, chat AI**: "saya mau update lintasAI tapi tidak paham langkahnya" - AI guide step-by-step.

---

> Dokumen ini bagian dari kit `lintasAI` v1.0.0 (commit d7284b1). Update guide ini sendiri ikut tier classification - kalau owner kit ubah strategy update, versi guide ini naik ke v2 dengan `[BREAKING]` label.
