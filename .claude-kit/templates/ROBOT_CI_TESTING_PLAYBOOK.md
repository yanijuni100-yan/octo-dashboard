# ROBOT_CI_TESTING_PLAYBOOK.md — Cara Uji + Pulih Robot CI (bahasa non-programmer)

> Versi 1 · 2026-06-10 · untuk staff IT non-programmer · rujukan on-demand (dipakai saat menyalakan robot lintas-repo)

## Untuk siapa & kapan dipakai

Kamu **baru menyalakan robot** lintas-repo lintasAI (untuk tim split-repo 20-30 orang):
- **Robot gabung-otomatis** (`auto-merge-shared.yml`) — gabung update KECIL sendiri, tahan yang BESAR.
- **Kunci pengaman gabung** (`setup-branch-protection.ps1`) — syarat wajib sebelum boleh gabung.
- **Robot terbit + terima paket bersama** (`PUBLISH_SHARED_WORKFLOW.yml` + `RECEIVE_BACKEND_UPDATE.yml`).

Panduan ini = **cara menguji robot dulu sebelum dipercaya** + **cara memulihkan kalau robot salah**. Wajib dibaca penanggung jawab (lead) tiap repo sebelum tim pakai untuk kerja beneran.

> 🏢 **Analogi:** kayak beli mobil baru — sebelum dipakai jalan jauh bawa keluarga, kamu **tes dulu** rem, lampu, klakson di halaman. Robot juga: tes di repo kecil dulu, baru dipercaya untuk tim.

---

## BAGIAN 1 — UJI sebelum dipercaya (5 cek manual, ~20 menit, sekali)

Lakukan di **1 pasang repo uji kecil** (1 backend + 1 frontend kosong), BUKAN langsung di repo tim. Centang tiap cek:

### Cek 1 — Update KECIL digabung otomatis ✅
1. Di repo backend uji, ubah bentuk-data-bersama sedikit (perbaikan kecil), terbitkan.
2. Buka repo frontend uji → tab **"Pull requests"** → tunggu ~3-5 menit → muncul permintaan-gabung otomatis "🔄 Auto-update…".
3. Tunggu cek otomatis hijau → **harusnya tergabung sendiri** tanpa kamu klik.
- ✅ LULUS kalau: tergabung sendiri setelah hijau.
- ❌ GAGAL kalau: tetap menggantung → lihat Bagian 3 (baca tab "Actions").

### Cek 2 — Update BESAR DITAHAN ✅
1. Di backend uji, buat perubahan **besar** (di pesan catatan tulis `BREAKING:` di depan).
2. Buka frontend uji → permintaan-gabung otomatis muncul **dengan label `perlu-ditinjau-manusia`** + komentar "ditahan".
- ✅ LULUS kalau: TIDAK tergabung sendiri, ada label tahan.
- ❌ GAGAL kalau: malah tergabung otomatis → STOP pakai robot, lapor (deteksi versi salah).

### Cek 3 — Kunci pengaman aktif (tak bisa tulis langsung) ✅
1. Coba tulis langsung ke jalur utama (main) repo frontend uji tanpa lewat permintaan-gabung.
- ✅ LULUS kalau: **DITOLAK** GitHub ("protected branch").
- ❌ GAGAL kalau: berhasil tulis langsung → kunci pengaman belum nyala, jalankan `setup-branch-protection.ps1 -Apply`.

### Cek 4 — Persetujuan penanggung jawab diminta ✅
1. Buka permintaan-gabung apa pun → lihat apakah GitHub **otomatis minta review** ke penanggung jawab (sesuai daftar `.github/CODEOWNERS`).
- ✅ LULUS kalau: nama penanggung jawab muncul di kolom "Reviewers".
- ❌ GAGAL kalau: tidak ada → cek `.github/CODEOWNERS` sudah diisi username asli (bukan placeholder `<...>`).

### Cek 5 — Timpa-paksa ditolak ✅
1. Coba timpa-paksa (force-push) ke jalur utama repo uji.
- ✅ LULUS kalau: **DITOLAK**.
- ❌ GAGAL kalau: berhasil → kunci pengaman belum lengkap, ulangi `setup-branch-protection.ps1 -Apply`.

> **Hanya kalau 5 cek LULUS** → robot aman dipakai di repo tim sebenarnya. Kalau ada yang gagal, perbaiki dulu — jangan dipakai untuk tim 30 orang dalam keadaan setengah jalan.

---

## BAGIAN 2 — PULIH kalau robot salah (3 skenario)

> 🏢 **Prinsip:** hampir semua "salah" robot bisa dibalik (kayak Ctrl+Z di Google Docs). Jangan panik, jangan balikin semuanya membabi-buta. Ikuti skenario.

### Skenario A — Robot salah-gabung sesuatu yang rusak
**Tanda:** setelah gabung otomatis, halaman frontend error.
1. **Deteksi (30 detik):** lead lihat tab "Actions" merah / ada laporan error.
2. **Balik (≈5 menit):** buka permintaan-gabung yang barusan tergabung → klik **"Revert"** (GitHub bikin permintaan-gabung kebalikan) → gabung yang Revert itu. Versi balik seperti semula.
3. **Verifikasi (10 menit):** buka halaman yang tadi error → pastikan normal lagi.
> 📱 Kayak **Tokopedia batalkan pesanan** sebelum dikirim — 1 tombol, balik seperti belum pesan.

### Skenario B — Paket bersama terbit dengan isi rusak
**Tanda:** beberapa repo frontend sekaligus mulai error setelah backend terbit.
1. **Balik di sumber:** di repo backend, **balik (revert)** perubahan yang rusak → terbitkan ulang versi yang benar.
2. **Robot terima-update** akan otomatis bikin permintaan-gabung versi-benar ke tiap frontend.
3. **Kabari tim** (Discord) supaya tahu sedang dibalik.
> ⚠️ Siapa yang boleh: **owner / lead backend saja** (bukan staff frontend).

### Skenario C — Robot mogok / gagal (tidak jalan)
**Tanda:** permintaan-gabung otomatis tidak muncul, atau tab "Actions" merah.
1. Buka tab **"Actions"** → klik baris merah → baca langkah yang gagal. 3 penyebab tersering:
   - **"Guard tipe rahasia" gagal** → ini BAGUS, robot mencegah data rahasia bocor. Perbaiki: keluarkan tipe rahasia dari paket bersama.
   - **"Publish gagal"** → kunci-akses paket (token) belum dipasang / kedaluwarsa. Perbaiki setelan.
   - **"Gabung-otomatis gagal (merah)"** → kunci pengaman gabung belum nyala. Jalankan `setup-branch-protection.ps1 -Apply`.
2. **Selama robot mogok:** kerja tidak berhenti — **gabung manual** seperti biasa (klik "Merge" sendiri setelah cek hijau). Robot mogok ≠ tim berhenti.

---

## BAGIAN 3 — Pantau harian (cara baca tab "Actions" untuk non-programmer)

Tiap repo punya tab **"Actions"** (di bar atas, sebelah "Pull requests") = papan lampu status robot:
- **Centang hijau ✓** = robot jalan sukses. Tidak perlu apa-apa.
- **Silang merah ✗** = ada yang gagal. Klik → baca langkah merah → cocokkan ke Skenario C di atas.
- **Lingkaran kuning ●** = sedang jalan. Tunggu sebentar.

> 🏢 **Analogi:** kayak lampu indikator di dashboard mobil. Hijau = aman jalan. Merah = berhenti, cek dulu. Kuning = sabar, sedang proses.

**Rutinitas lead (1 menit/hari):** buka tab "Actions" tiap repo → kalau semua hijau, selesai. Kalau ada merah, tangani sesuai Skenario C.

---

## Siapa boleh apa (peran)

| Tindakan | Siapa |
|---|---|
| Gabung update KECIL | Robot (otomatis) |
| Gabung update BESAR (yang ditahan) | Lead frontend (manual, setelah cek) |
| Balik (revert) permintaan-gabung salah | Lead / owner |
| Balik (revert) paket bersama rusak | Owner / lead backend saja |
| Nyalakan kunci pengaman gabung | Owner (butuh hak admin repo) |

---

## Catatan

- Robot CI = **lapisan terpisah di atas project**. Kalau robot error, **aplikasi tim TETAP jalan** — paling buruk gabung manual seperti dulu. Tidak ada user kena.
- Uji di repo kecil dulu (Bagian 1) = **wajib** sebelum gelar ke tim 20-30 orang.
- File terkait: `templates/github/AUTO_MERGE_SHARED_WORKFLOW.yml`, `templates/github/scripts/setup-branch-protection.ps1`, `templates/CROSS_REPO_TYPES_PIPELINE.md`, `SECURITY_INCIDENT_PLAYBOOK.md` (kalau yang bocor = rahasia/token, bukan sekadar robot error).
