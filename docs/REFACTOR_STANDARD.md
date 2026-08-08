# REFACTOR_STANDARD.md — Standar Merapikan Kode (Refactor) Lintas-Divisi

> Versi 3 · 2026-06-10 · auto-generated (lintasAI) · netral profesional, lintas-stack + lintas-divisi (v3: tambah tingkat USAHA ringan/sedang/berat + tes-asap pasca-refactor + gate refactor BERAT/split)

## Tujuan

Untuk siapa: **AI (Claude Code)** + **staff IT** (termasuk non-programmer yang mengandalkan AI) + reviewer.
Masalah yang diselesaikan: **kapan** kode perlu dirapikan (refactor), **kapan JANGAN**, dan **cara** merapikannya tanpa merusak yang sudah jalan. Standar ini **netral** — berlaku untuk semua bahasa/framework, bukan project tertentu.

> Cara pakai untuk staff non-programmer: kamu **tidak perlu paham kodenya**. Cukup minta AI: *"tolong cek apakah kode di proyek ini perlu dirapikan, pakai REFACTOR_STANDARD.md"*. AI akan baca-saja (tidak mengubah apa pun), lalu kasih daftar berlabel 🔴🟡🟢 + saran. Kamu tinggal putuskan: kerjakan sekarang / nanti / abaikan.

## Apa itu "refactor" (bahasa awam)

**Refactor = merapikan susunan kode supaya lebih bersih, TANPA mengubah apa yang dilihat user.**

- 🏢 **Sehari-hari:** kayak **merapikan gudang** — barang yang sama tetap ada, cuma ditata ulang biar gampang dicari. Pelanggan tidak lihat bedanya, tapi staf gudang kerja lebih cepat + jarang salah ambil.
- 📱 **Tools digital:** kayak **rapi-rapi folder Google Drive** — semua file tetap utuh, cuma dikelompokkan rapi biar gampang nemu.
- 🎯 **Konkret:** halaman login tetap kelihatan + jalan persis sama bagi user; yang berubah cuma cara kode di belakangnya disusun.

## Tingkat keseriusan (label WAJIB — selalu pakai arti jelasnya)

| Label | Arti gampangnya |
|---|---|
| 🔴 **GENTING** | "Harus segera — bahaya kalau dibiarkan" (bisa bikin data bocor / sistem rusak / uang hilang) |
| 🟡 **PENTING** | "Perlu dikerjakan, tapi tidak darurat" (kualitas pelan-pelan turun kalau diabaikan, tapi tidak langsung rusak) |
| 🟢 **RAPIKAN** | "Opsional, biar lebih rapi" (tidak mendesak, sekadar kosmetik) |

> Jangan pakai kode teknis (P0/P1/P2, Critical/High/Low). Staff non-programmer paham GENTING/PENTING/RAPIKAN.

## Tingkat USAHA (ringan / sedang / berat) — beda dari tingkat keseriusan!

**Penting:** "seberapa GENTING" (keseriusan) **berbeda** dari "seberapa BESAR kerjaannya" (usaha) — dua sumbu terpisah. Contoh: password/kunci ketulis di kode itu 🔴 GENTING (bahaya) **tapi** usaha benerinnya 🟩 RINGAN (tinggal pindah ke env, beberapa menit). Sebaliknya, memindah monolith ke 3 repo terpisah itu 🟥 BERAT walau tidak darurat. Selalu lihat **dua-duanya**.

| Tingkat usaha | Arti | Ciri | Contoh |
|---|---|---|---|
| 🟩 **RINGAN** | Kecil, mekanis, aman | Tampilan ke user **tetap sama**; bisa di-undo 1 langkah; tidak mengubah susunan besar | Ganti nama membingungkan; buang kode mati; satukan kode salin-tempel yang **persis sama**; pindah rahasia ke env; kasih pesan error yang jelas; beri nama angka/teks "ajaib" |
| 🟨 **SEDANG** | Lumayan, butuh hati-hati + dicicil | Masih dalam 1 area/modul, tapi menyentuh banyak baris / data; **WAJIB** ada test + langkah kecil | Pecah **file raksasa** (ribuan baris nyampur); satukan komponen dobel yang sudah **beda-beda** (samakan dulu); pindah validasi tersebar ke pintu masuk; benerin query lambat (N+1) + tambah index |
| 🟥 **BERAT** | Besar, mengubah **susunan/sambungan** | Mengubah cara bagian saling nyambung atau cara dikirim ke server; berisiko; butuh rencana + cara-balik matang | Ubah monorepo jadi 1-repo-rapi-modular; **pindah ke 3 repo terpisah (split repo)**; ganti kerangka inti; urai sambungan FE↔BE↔DB yang nyampur dalam |

> 🏢 Analogi: 🟩 RINGAN = rapikan **1 laci**. 🟨 SEDANG = bongkar-tata-ulang **1 lemari**. 🟥 BERAT = pindahkan **seluruh isi rumah** ke 3 rumah baru.
> ⚠️ **Aturan emas: jangan tumpuk 2 pekerjaan BERAT sekaligus.** Satu perubahan berisiko dalam satu waktu — masing-masing dengan test + cara balik (rollback).

## Manfaat refactor (kenapa repot-repot?)

| Manfaat | Penjelasan awam |
|---|---|
| 🪶 **Lebih ramping** | Kode lebih sedikit + tidak berbelit → lebih cepat dibaca AI maupun manusia |
| 🐞 **Kurangi bug** | Susunan rapi = celah bug lebih sedikit + lebih cepat ketahuan |
| 💰 **Hemat token AI** | Kode bersih = AI baca lebih sedikit = biaya AI lebih murah tiap sesi |
| 📖 **Mudah dipahami staff baru** | Onboarding cepat — tidak perlu nanya 1 orang yang tahu segalanya (bus factor naik) |
| 🔁 **Kurangi duplikasi** | Kode yang disalin-tempel disatukan → kalau ada bug, fix sekali kena semua (bukan 10 tempat) |
| 🧪 **Mudah dites** | Bagian kecil yang rapi gampang dipasangi cek otomatis |
| 🔒 **Lebih aman** | Validasi/pengaman input terpusat di pintu masuk, bukan tersebar (lebih sulit bocor) |
| 🏦 **Kurangi "utang teknis"** | Tagihan tersembunyi yang menumpuk kalau diabaikan — refactor = bayar cicilan biar tidak membengkak |
| 👥 **Gampang dikerjakan tim** | Kode rapi + terbagi jelas = banyak staff bisa kerja paralel tanpa saling tabrakan |
| ✨ **Clean code (standar profesional)** | Ikut standar tim lintas-divisi → kualitas konsisten, tidak bergantung 1 orang |

> **Kenapa ini PENTING khusus tim AI-first (staff non-programmer yang andalkan AI)**: file raksasa + kode dobel = AI harus baca banyak → **lambat + boros token + lebih mudah ngarang (halusinasi)**. Membersihkannya **langsung** menaikkan: AI gampang menganalisa, hemat token, anti-halusinasi, minim bug, clean code, gampang dikerjakan tim. Jadi refactor di sini **bukan kosmetik** — investasi langsung ke kualitas + biaya.

## Refactor lintas-divisi (apa yang dirapikan per peran)

Refactor profesional menyentuh **banyak divisi** sekaligus. AI WAJIB cek tiap sudut ini (baca-saja dulu), lapor temuan berlabel 🔴🟡🟢:

| Divisi | Gejala yang dicari | Contoh rapikan (bahasa awam) |
|---|---|---|
| 🔧 **Backend** | Fungsi raksasa, logika berbelit/dobel, error ditelan diam-diam | Pecah fungsi besar jadi kecil; satukan logika yang sama; kasih pesan error yang jelas (apa salah, di mana) |
| 🎨 **Frontend** | Komponen dibuat ulang berkali-kali, tampilan tak punya 4 keadaan (loading/kosong/error/sukses) | Satukan komponen dobel jadi 1 yang dipakai ulang; lengkapi 4 keadaan tampilan |
| 🗄️ **Database** | Query berulang (ambil data satu-satu / "N+1"), tak ada index, query rumit tersebar | Satukan query; tambah index di kolom yang sering dicari (biar cepat); pusatkan query rumit di 1 tempat |
| ☁️ **DevOps** | Pengaturan berserak, rahasia ditulis di kode, langkah kirim-server manual berulang | Pindah rahasia ke tempat aman (env); satukan pengaturan; otomatkan langkah yang berulang |
| 🔒 **Security** | Pengecekan input tersebar, teks user ditampilkan mentah, kunci/password di kode | Pindah pengecekan ke pintu masuk; bersihkan teks sebelum ditampilkan; rahasia ke tempat aman |
| 👥 **UI/UX + a11y** | Alur membingungkan, warna kurang kontras, tak bisa pakai keyboard saja | Sederhanakan alur klik; perbaiki kontras; pastikan bisa dioperasikan keyboard + ramah pembaca-layar |
| 🖌️ **Web Design** | Warna/jarak/font ditulis langsung & berbeda-beda di banyak tempat | Pindah ke "design token" (1 sumber warna/jarak/font) → ganti sekali, kena semua, konsisten |
| ✅ **QA/Test** | Tak ada cek otomatis, bagian terlalu besar untuk dites | Pecah jadi bagian kecil yang gampang dites; tambah cek otomatis jalur utama + kasus pinggir |
| 📈 **SEO/Performa** | Halaman berat, gambar belum dioptimasi, file kode kebesaran | Muat bagian berat hanya saat perlu; kecilkan gambar; pangkas ukuran file |
| 🤖 **ML/AI** | Perintah ke AI panjang & berulang, tak ada batas biaya, data mentah | Satukan template perintah; pasang batas token; bersihkan data sebelum dikirim ke AI |
| 📦 **Arsitektur/Shared** | Tipe data ditebak di banyak tempat, dependency lama, batas antar-modul kabur | Tulis tipe data di 1 sumber; kunci & audit versi dependency; perjelas batas tiap modul |

> Tidak semua divisi relevan tiap project. AI isi yang **terbukti ada gejalanya** (force citation — baca kode dulu), sisanya tulis "—". Jangan paksa isi semua.

## Kapan PERLU refactor (gejala yang dicari)

Refactor itu **bukan asal rapi-rapi** — dilakukan saat ada **gejala** nyata:

1. **Kode salin-tempel** (sama persis di banyak tempat) → satukan jadi 1 fungsi. — 🟩 RINGAN kalau **persis sama**; 🟨 SEDANG kalau salinannya sudah **beda-beda** (harus disamakan dulu).
2. **File gemuk** (>300 baris) atau yang mengurus banyak peran sekaligus → pecah jadi beberapa file kecil. — 🟩 RINGAN kalau ~300 baris rapi; 🟨 SEDANG kalau **ribuan baris nyampur** (state saling kait).
3. **Bug berulang di area yang sama** → tanda susunannya rapuh. — diagnosa 🟩 RINGAN; perbaikan bisa 🟨 SEDANG.
4. **Susah dipahami** (staff baru bingung, AI butuh baca banyak baris buat ngerti) → sederhanakan. — 🟩 RINGAN umumnya (ganti nama / pecah jadi fungsi kecil).
5. **Validasi/pengaman input tersebar** di tengah-tengah kode → pindah ke pintu masuk (boundary). — 🟨 SEDANG (menyentuh banyak titik sekaligus).
6. **Error ditelan diam-diam** (`catch` kosong) → kasih konteks (apa salah, di mana, ID terkait). — 🟩 RINGAN.
7. **Rahasia di-hardcode** (password/kunci API ditulis langsung di kode) → pindah ke env. — 🟩 RINGAN **usahanya**, tapi 🔴 GENTING **keseriusannya** (contoh klasik beda-dua-sumbu).
8. **Kode mati** (tidak pernah dipakai) → buang. — 🟩 RINGAN.
9. **Nama membingungkan** (variabel `x`, `data2`, `tmp`) → ganti nama yang jelas. — 🟩 RINGAN.
10. **Database lambat** karena query berulang (N+1) → satukan / kasih index. — 🟨 SEDANG (menyentuh database, perlu diukur dulu pakai `EXPLAIN`).

## Kapan JANGAN refactor (sama pentingnya)

- ❌ **Kode yang jalan + jarang disentuh** → "kalau tidak rusak, jangan diutak-atik".
- ❌ **Demi estetika saja** tanpa manfaat nyata → buang-buang waktu + risiko bug baru.
- ❌ **Mepet deadline** → refactor besar di waktu genting = main api.
- ❌ **Tanpa cek otomatis (test)** → refactor tanpa test = judi; tidak ada jaring kalau ada yang rusak.
- ❌ **Mencampur refactor besar dengan fitur/fix** dalam 1 commit → pisahkan (1 commit = 1 tujuan).

## Cara AMAN refactor (5 langkah — AI WAJIB ikuti)

1. **Baca dulu** — pahami kode + catatan `docs/` terkait. Jangan kerja buta.
2. **Rencana + label** — tulis apa yang dirapikan, kasih label 🔴🟡🟢, perkiraan dampak, cara balik (rollback).
3. **Konfirmasi owner** — tampilkan ringkasan + **tunggu izin**. JANGAN auto-refactor.
4. **Langkah kecil** — kerjakan **1 item**, tampilkan bedanya (diff), jalankan cek otomatis, **baru lanjut** item berikutnya. Bukan rombak semua sekaligus.
5. **Verify** — cek otomatis (test) + tes asap alur utama lulus sebelum bilang "selesai".

> 🏢 Analogi langkah kecil: kayak **renovasi rumah sambil ditinggali** — perbaiki 1 kamar dulu, pastikan masih bisa ditinggali, baru lanjut kamar berikutnya. Bukan bongkar semua dinding sekaligus lalu kehujanan.

## Setelah refactor — WAJIB cek ulang fitur masih jalan (tes-asap manual)

Refactor yang benar = **tampilan + cara kerja ke user TETAP sama**. Cara membuktikannya, terutama kalau **belum ada cek otomatis (test)**: **buka & klik sendiri alur-alur utama**, pastikan masih jalan persis seperti sebelum dirapikan.

> Ide "buka menu A/B/C/D/E satu-satu untuk pastikan masih bekerja" itu **bagus & memang wajib** — di dunia profesional namanya **tes-asap** (*smoke test*). **Bukan berlebihan** walau refactor-nya RINGAN: perubahan sekecil apa pun bisa diam-diam merusak sesuatu. Untuk tim **tanpa test otomatis**, tes-asap manual = jaring pengaman **termurah**.

**Cara (untuk staff non-programmer):**
1. **Sebelum** refactor, catat **5-10 alur penting** (mis. menu A = login, B = buat data, C = cetak laporan, D = hapus, E = cari).
2. **Sesudah tiap langkah** refactor, buka tiap menu itu + lakukan 1x → masih jalan? tampilan sama? tidak ada error?
3. Ada yang beda/rusak → **langsung balik (git revert)** item itu, jangan lanjut.
4. Semua lulus → baru lanjut item berikutnya.

> 🏢 Analogi: kayak **tukang yang habis benerin keran** — sebelum pamit dia **nyalakan SEMUA keran** sebentar buat pastikan tidak ada yang bocor, bukan cuma keran yang dia sentuh. 📱 Mirip kamu habis update aplikasi BCA mobile lalu **cek dulu**: cek saldo, transfer kecil, bayar — pastikan semua menu masih normal sebelum dipakai serius.

## Kapan boleh mulai refactor BERAT (mis. pindah ke 3 repo terpisah / split repo)

**Ya — memindahkan monorepo ke 3 repo terpisah (split repo) = refactor 🟥 BERAT** (mengubah susunan + cara kirim-server). Boleh dimulai **hanya setelah** semua syarat ini terpenuhi:

- [ ] Refactor 🟩 RINGAN terparah **sudah selesai + lulus tes-asap** (tidak ada error/bug/crash).
- [ ] **Sambungan FE↔BE↔DB sudah diperjelas** (frontend bicara ke backend lewat "loket"/API; database **cuma** disentuh backend). Kalau masih nyampur dalam, **ini sendiri** pekerjaan 🟨 SEDANG–🟥 BERAT → kerjakan dulu, terpisah.
- [ ] **Cek-ulang ringan (scan ulang) lulus**: setelah dirapikan, **gambar ULANG peta batas modul** (file pindah-pindah saat dirapikan → peta lama basi) + tes-asap semua menu hijau. Standar profesional: perubahan berat selalu mulai dari kondisi sehat-terverifikasi + peta akurat. Baru pecah.
- [ ] Ada **cara balik**: monolith lama disimpan sebagai cadangan (split = **SALIN**, bukan PINDAH).
- [ ] **Satu perubahan berisiko dalam satu waktu** — jangan barengkan split dengan rombakan lain.

> ⚠️ **Jangan tumpuk 2 BERAT sekaligus.** "Urai sambungan" dan "pindah 3 repo" dua-duanya berat → kerjakan **bertahap satu per satu**, masing-masing dengan tes-asap + cara balik.
> 💡 **Tawarkan opsi dulu (lintas-divisi), jangan langsung split:** belum tentu harus 3 repo. **1 repo yang rapi-modular** (dibagi jelas di dalam) sering **sudah cukup** sampai tim benar-benar terasa sesak. 3 repo = isolasi keras tapi ada ongkos (terbit paket + sinkron versi). Owner putuskan **sadar**, AI sajikan pilihan + trade-off.

## Aturan keras (tidak bisa ditawar)

- **Saat AUDIT = baca-saja** (read-only). Tidak mengubah file. Audit dulu, baru (dengan izin) rapikan.
- **JANGAN refactor kode di luar tema task.** Boy scout rule: maksimal 5-10 baris pembersihan kalau kebetulan menyentuh file, dan **laporkan jelas**.
- **JANGAN rename/hapus langsung** — pakai pola tambah-baru → pindah → hapus-lama (expand-then-contract), supaya tidak memutus yang sedang jalan.
- **Selalu ada cara balik** — `git revert` sebagai jaring pengaman. Aksi yang tidak bisa di-undo = konfirmasi keras dulu.
- **Test dulu sebelum refactor besar** — tanpa test, jangan rombak.

## Checklist cepat "perlu refactor atau tidak?" (12 cek saat baca struktur)

- [ ] Ada kode salin-tempel di >2 tempat?
- [ ] Ada file >300 baris / mengurus >1 peran?
- [ ] Ada bug yang berulang di area yang sama?
- [ ] Ada `catch` kosong / error ditelan?
- [ ] Ada rahasia (password/kunci) ditulis langsung di kode?
- [ ] Ada validasi input yang tersebar (bukan di pintu masuk)?
- [ ] Ada kode mati / tidak terpakai?
- [ ] Ada nama variabel/fungsi yang membingungkan?
- [ ] Ada query database berulang (N+1) tanpa index?
- [ ] Ada `innerHTML`/render mentah tanpa sanitasi (celah XSS)?
- [ ] Ada nilai hardcode (warna/spacing/URL) yang harusnya jadi token/env?
- [ ] Apakah ada cek otomatis (test) yang melindungi area ini sebelum dirapikan?

## Input / Output

- **Input:** struktur + isi kode proyek (dibaca AI, read-only).
- **Output:** daftar temuan berlabel 🔴🟡🟢 + saran konkret + rencana bertahap (Quick Wins / Bertahap / Strategi Besar). BUKAN perubahan kode otomatis.

## Dependensi

- `AUDIT_POST_SETUP_PROMPT_v1.md` — audit menyeluruh multi-dimensi (refactor = 1 dimensinya).
- `PROJECT_LIFECYCLE_PROMPT_v1.md` Stage 4 (Rapikan ke Standar Tim) — eksekusi perbaikan bertahap dengan konfirmasi per langkah.
- `CLAUDE_universal_v1.md` §5 (Standar kode) + §8.2 (anti-halusinasi: vonis cuma setelah baca kode nyata).

## Catatan

- Standar ini **netral** — tidak menvonis project tertentu. Vonis "fungsi X perlu dirapikan" hanya valid **setelah AI membaca kode nyata** (force citation rule — tidak menebak).
- Refactor = **future-proofing**: bukan cuma rapi sekarang, tapi bikin staff bulan depan + AI sesi depan gampang lanjut.
- Gampang salah: menganggap "refactor = rewrite besar". BUKAN. Refactor yang benar = **langkah kecil aman**, bukan bongkar total.
