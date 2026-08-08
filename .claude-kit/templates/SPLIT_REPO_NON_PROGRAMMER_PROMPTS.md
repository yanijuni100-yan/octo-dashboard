# Non-Programmer Prompt Cheatsheet - Split Repo Workflow

> Print this. Tempel di monitor kamu. Tools digital populer = referensi cara berkomunikasi dengan AI.

---

## Filosofi: Kamu BUKAN Programmer, Kamu Operator AI

Analogi tools digital:
- **Kamu** = admin Tokopedia Seller, terima pesanan dari customer
- **AI Claude Code** = driver Gojek yang jalanin pesanan
- **Owner** = manajer yang cek hasil sebelum dikirim
- **Staff lain** = rekan kerja di shift sama, koordinasi lewat WhatsApp grup

Kamu gak perlu ngerti bahasa pemrograman. Kamu perlu ngerti:
- **APA**: apa yang harus dikerjain
- **DI MANA**: di bagian mana (Tampilan / Data / paket bersama)
- **SAMA SIAPA**: koordinasi sama tim mana
- **KAPAN**: kapan harus selesai + ada yang harus siap duluan gak

Analogi lebih lanjut:
- Minta ke AI = chat ke driver ojol. Makin jelas alamat + patokan, makin cepet sampai.
- Bagian Tampilan = etalase Tokopedia (yang dilihat customer). Bagian Data = gudang Tokopedia (stok, harga, aturan). Paket bersama = katalog produk (kesepakatan antara etalase & gudang).
- Discord channel = WhatsApp grup kerja. Jangan DM personal buat urusan kerja.
- Owner cek = supervisor Grab approve pesanan besar sebelum dijalankan.

---

## Format Prompt Universal

```
Tugas hari ini: <tulis dalam 1 kalimat apa yang mau dikerjain>

Yang dibutuhin / harus muncul:
- <hal 1>
- <hal 2>
- <hal 3>

Catatan tambahan:
- Sumber permintaan: <dari Discord channel / WA / owner langsung>
- Referensi: <link / screenshot / contoh kalau ada>
- Nunggu apa duluan: <ada tim lain yang harus siapin sesuatu duluan?>
```

Analogi: Mirip kirim order Gojek detail. Bukan cuma "anter ke restoran" tapi "anter ke Tokopedia Tower, lewat tol, jam 12 siang, customer nama Budi nomor +628xxx".

Analogi kedua: Mirip isi form Shopee return. Kalau cuma tulis "barang rusak", CS bingung. Kalau detail "layar pecah di pojok kanan atas, foto terlampir, kode pesanan #12345", CS langsung proses.

---

## CONTEKAN STAFF TAMPILAN (4 Orang) - Contoh Cara Minta ke AI

> Untuk Staff Tampilan: kerja di bagian yang dilihat user (halaman, tombol, tampilan).
> Soal data: cuma boleh ambil/edit data lewat jalur yang udah disiapin tim Data. Gak boleh utak-atik database langsung.


### Pola 1: Bikin Halaman Baru

```
Tugas baru: Bikin halaman buat <kegunaannya>.

Yang ditampilin di halaman:
- <info 1>
- <info 2>
- <info 3>

Yang bisa dilakuin user di halaman ini:
- <kalau user klik X, terjadi Y>

Catatan:
- Datanya kata tim Data udah siap, tinggal panggil aja
- Contoh tampilan / design: <link / screenshot / kalau belum ada bilang aja>
- Halaman ini dibuka pas user dari mana: <dari menu apa>
```

Contoh konkret:
```
Tugas baru: Bikin halaman buat lacak paket.

Yang ditampilin di halaman:
- Status paket sekarang (lagi diproses, sudah dikirim, atau sudah sampai)
- Perkiraan tanggal kapan barang sampai di rumah customer
- Info kurir yang bawa paket

Yang bisa dilakuin user di halaman ini:
- Klik tombol "Lacak Detail" buat lihat info lengkap kurir
- Halaman update sendiri tiap setengah menit, biar info paling baru

Catatan:
- Tim Data bilang info paket udah siap, tinggal dipanggil
- Contoh tampilan: lihat WA grup desain tanggal 5 Juni
- Halaman ini dibuka pas user klik "Lacak Pesanan" di dashboard
```

Analogi tools digital: Mirip bikin halaman katalog produk baru di Tokopedia Seller Dashboard. Kamu kasih tau template, info yang harus tampil, dan cara customer interact. AI bikin halamannya.

### Pola 2: Ubah Tampilan yang Sudah Ada

```
Tugas: Ubah tampilan <halaman/bagian> sesuai feedback.

Yang berubah:
- <perubahan 1>
- <perubahan 2>

Bagian mana yang kena: <kalau tahu sebut, kalau gak tau biarin AI cari sendiri>
```

Contoh konkret:
```
Tugas: Ubah tampilan halaman checkout sesuai feedback owner.

Yang berubah:
- Tombol "Bayar" warna diganti dari biru ke hijau (ikuti warna brand baru)
- Tambah gambar gembok di sebelah kotak isian nomor kartu, biar customer ngerasa aman
- Pas loading, tampilannya pakai kotak abu-abu yang berkedip, bukan lingkaran muter

Bagian mana yang kena: bagian halaman checkout (biarin AI cari sendiri file yang relevan)
```

Analogi: Mirip kasih feedback ke desainer Canva. "Logo geser ke kanan, warna ganti ke hijau". Desainer (AI) tahu file mana yang harus diedit.

### Pola 3: Laporin Masalah / Bug

```
Bug: <jelasin masalahnya pakai bahasa user>

Cara nge-cek bahwa bug-nya ada:
1. <langkah 1>
2. <langkah 2>
3. Yang seharusnya terjadi: <kondisi normal>
4. Yang terjadi sekarang: <kondisi salah>

Foto / video: <link kalau ada>
```

Contoh konkret:
```
Bug: Halaman jadi putih kosong pas customer klik "Batalkan Pesanan".

Cara nge-cek bahwa bug-nya ada:
1. Buka halaman pesanan nomor 12345
2. Klik tombol "Batalkan Pesanan"
3. Klik "Ya, batalkan" di kotak konfirmasi
4. Yang seharusnya terjadi: kembali ke daftar pesanan dengan pesan "Pesanan dibatalkan"
5. Yang terjadi sekarang: halaman jadi putih kosong, harus refresh manual

Foto / video: link Discord lampiran abc123.mp4
```

Analogi tools digital: Mirip lapor bug Tokopedia ke CS. Detail langkah per langkah, plus screenshot. AI ngerti masalah persis dan benerin di tempat yang tepat.

Analogi kedua: Mirip kirim laporan ke ojol kalau driver bermasalah. "Driver minta uang tambahan, padahal jarak sesuai aplikasi, ini foto chat-nya." CS langsung tahu konteks dan bisa action.

### Pola 4: Tanya AI Dulu Sebelum Mulai Kerja

```
/tanya <pertanyaan kamu>
```

Contoh:
- "/tanya ada berapa halaman yang pakai menu samping?"
- "/tanya kalau saya ubah info user, kira-kira apa aja yang kena dampaknya?"
- "/tanya daftar pesanan ada fitur lompat halaman gak?"

AI cuma baca + jawab. Gak ngubah apapun.

Analogi: Mirip tanya ke senior di Discord channel sebelum mulai kerja. "Eh, kalau saya ubah X, kira-kira impact ke mana aja ya?" Senior cek dulu, baru kasih saran. Beda dengan langsung ubah lalu rusak.

### Pola 5: Sinkronin Info Bersama dari Tim Data

```
Tugas: Sinkronin ulang info bersama dari paket bersama tim Data.

Catatan:
- Tim Data kabarin di Discord channel ada paket info versi baru
- Yang berubah / baru: <nama info-nya>
```

Analogi: Mirip update aplikasi Tokopedia di HP. Tim Tokopedia push update, kamu (customer) install update biar dapet fitur baru. Sama, tim Data bikin update, tim Tampilan ikut install update info.

---

## CONTEKAN STAFF DATA (2 Orang) - Contoh Cara Minta ke AI

> Untuk Staff Data: kerja di bagian belakang (tempat data disimpan, aturan bisnis, jalur ambil data).
> Soal database: punya akses penuh, boleh nambah/ubah/hapus tempat penyimpanan data.


### Pola 1: Sediakan Jalur Data Baru

```
Tugas baru: Sediain info <nama fitur> buat tim Tampilan.

Soal tempat simpan data:
- Tabel <nama>: tambah info <nama info>, isinya bisa kosong: <ya/tidak>

Soal jalur ambilnya:
- Cara ambil: <ambil daftar / kirim isian baru / ubah / hapus>
- Yang harus dikirim user: <apa aja>
- Yang dikasih balik: <apa aja>
- Aturan khusus: <jelasin pakai bahasa biasa>

Soal paket info bersama:
- Tambah info baru di paket bersama
- Naikin nomor versinya, kabarin tim Tampilan
```

Contoh konkret:
```
Tugas baru: Sediain info pelacakan pesanan buat tim Tampilan.

Soal tempat simpan data:
- Tabel Pesanan: tambah info perkiraan tanggal sampai, isinya bisa kosong: ya
  (kalau belum dikirim ya belum ada perkiraannya)

Soal jalur ambilnya:
- Cara ambil: ambil info pelacakan satu pesanan
- Yang harus dikirim user: nomor pesanan-nya
- Yang dikasih balik: nomor pesanan, status (proses/dikirim/sampai),
  tanggal kirim, perkiraan tanggal sampai, tanggal sampai beneran
- Aturan khusus:
  - Perkiraan sampai = tanggal kirim + lama waktu sesuai jenis kurir
  - Kalau status udah "sampai", perkiraannya pakai tanggal sampai beneran

Soal paket info bersama:
- Tambah info pelacakan pesanan di paket bersama
- Naikin versi paketnya (misalnya dari versi 1.1 ke versi 1.2)
- Kabarin tim Tampilan di Discord channel
```

Analogi tools digital: Mirip buka layanan baru di Gojek (misal GoSend Same Day). Database = update daftar jenis layanan. Jalur ambil = saluran yang aplikasi panggil. Paket bersama = kontrak ke tim Tampilan "ini bentuk infonya, tinggal ditampilin".

### Pola 2: Ubah Tempat Simpan Data

```
Tugas: Ubah tempat simpan data.

Yang berubah:
- <tabel>: <nambah/ubah/hapus> info <nama info>
- <tabel>: <nambah/ubah/hapus> info <nama info>

Cek keamanan perubahan:
- Bahaya gak? <bahaya kalau hapus / aman kalau nambah info baru yang kosong>
- Bikin data lama rusak gak? <ya / tidak>
- Perlu isi default buat data lama? <kalau ubah info, kasih nilai default>
```

Contoh konkret:
```
Tugas: Ubah tempat simpan data buat fitur langganan berbayar.

Yang berubah:
- Tabel Pengguna: tambah info paket langganan (pilihan: gratis/pro/perusahaan),
  default-nya "gratis"
- Tabel Pengguna: tambah info tanggal langganan berakhir, isinya bisa kosong
- Tabel Langganan: bikin tabel baru (nomor, pengguna, paket, mulai kapan,
  berakhir kapan, status aktif/nonaktif)

Cek keamanan perubahan:
- Bahaya gak? Tidak (semua cuma nambah, gak ada yang dihapus)
- Bikin data lama rusak gak? Tidak (pengguna lama otomatis dapet paket "gratis")
- Perlu isi default buat data lama? Udah dikasih default "gratis" buat semua
  pengguna lama
```

Analogi: Mirip nambah kolom baru di Google Sheets bersama tim. Kalau nambah kolom kosong = aman. Kalau hapus kolom yang dipakai orang lain = berantakan. Staff Data harus mikirin dampak ke semua "pengguna sheet" (tim Tampilan, aplikasi HP, integrasi lain).

### Pola 3: Tambah Aturan Bisnis

```
Tugas: Tambah aturan <nama aturan>.

Aturan-nya:
- <kalau A maka B>
- <kalau gak, terus C maka D>
- <kondisi cadangan>

Lokasi: di bagian aturan bisnis <area apa>
Tes: bikin pengecekan otomatis buat semua kemungkinan kondisi
```

Contoh konkret:
```
Tugas: Tambah aturan hitung ongkir.

Aturan-nya:
- Kalau jarak di bawah 5km, ongkir Rp 10.000
- Kalau jarak antara 5-20km, ongkir Rp 10.000 + (jarak dikurangi 5) x Rp 2.000
- Kalau jarak di atas 20km, ongkir Rp 40.000 + (jarak dikurangi 20) x Rp 3.000
- Cadangan: kalau jarak 0 atau kosong, ongkir Rp 0, plus catat peringatan

Lokasi: di bagian aturan bisnis pengiriman
Tes: bikin pengecekan otomatis buat:
  - Jarak 0, 3, 5, 10, 20, 25, 50 km
  - Jarak kosong / tidak diisi
```

Analogi: Mirip nulis SOP di Notion buat admin toko. "Kalau customer komplain, langkah 1 cek riwayat pesanan. Langkah 2 kalau ada bukti rusak, refund. Langkah 3 kalau ragu, eskalasi ke supervisor." Aturan bisnis juga langkah per langkah, harus jelas semua kemungkinan.

### Pola 4: Laporin Bug di Bagian Data

```
Bug: <jelasin masalahnya>

Cara nge-cek bahwa bug-nya ada:
1. <coba ambil info pakai cara apa>
2. Yang seharusnya muncul: <kondisi normal>
3. Yang muncul sekarang: <kondisi salah / pesan error>

Pesan error: <paste pesan error-nya>
```

Contoh konkret:
```
Bug: Pas user buka pesanan yang gak ada, sistem error parah bukannya kasih
pesan sopan.

Cara nge-cek bahwa bug-nya ada:
1. Coba ambil info pesanan dengan nomor 99999 (pesanan yang gak ada)
2. Yang seharusnya muncul: pesan sopan "Pesanan tidak ditemukan"
3. Yang muncul sekarang: pesan error sistem yang panjang dan teknis

Pesan error: "TypeError: Cannot read property 'status' of null"
(intinya: sistem mau baca info status, tapi info pesanannya kosong)
```

Analogi: Mirip lapor ke admin gudang "kalau saya tanya barang yang gak ada di stok, sistem-nya crash, harusnya kasih pesan sopan aja". Admin fix biar gak panik kalau dicari barang kosong.

---

## KOORDINASI ANTAR TIM

### Tim Data Selesai -> Kabarin Tim Tampilan

Staff Data post di Discord channel tugas:
```
[Selesai] Tugas <judul tugas> sudah siap dari sisi Data.
- Info-nya bisa diambil di sistem percobaan (staging)
- Paket info bersama sudah diupdate ke versi baru
- Tim Tampilan silakan lanjut bikin halaman / tampilannya
- Kalau ada pertanyaan, ping aja di Discord channel
```

Analogi: Mirip kurir Gojek update "barang sudah di-pickup, OTW ke alamat". Customer (tim Tampilan) tahu boleh siap-siap terima. Tanpa update ini, customer bingung "udah jalan belum sih?".

### Tim Tampilan Butuh Tim Data -> Minta Tolong

Staff Tampilan post:
```
Halo tim Data, butuh bantuan buat fitur baru:

Apa yang dibutuhin:
- Tim Tampilan mau nampilin <info X> di halaman <Y>
- Datanya seharusnya udah ada di sistem (tinggal disediain jalur ambilnya)

Buat apa: pas user klik <tombol Z>, muncul info <X>-nya

Kalau ada yang kurang jelas, ping aja di Discord channel ya.
```

Tim Data jawab:
```
Oke noted, akan diproses. Perkiraan selesai <hari>.
```

Analogi: Mirip restoran terima pesanan via Tokopedia. Customer (tim Tampilan) order, restoran (tim Data) konfirmasi "diterima, estimasi 30 menit". Bukan diem aja sampai customer bingung.

### Tim Tampilan & Tim Data Beda Pengertian (beda paham instruksi)

Pakai pola ini:
```
[Mau Klarifikasi] Saya nangkep instruksi ini begini: <pengertian A>.
Tim <Tampilan/Data>, kalian nangkep-nya begini juga atau beda?
Tag owner buat keputusan akhir: @owner
```

Analogi: Mirip dua tim marketing & finance debat budget. Yang nentuin akhirnya manager (owner). Jangan main asumsi sendiri lalu kerja duluan.

---

## Cara Staff Liat Halaman Percobaan (Preview)

Setiap kali kamu kirim usulan perubahan (PR), sistem otomatis bikin link preview. Gak perlu setting apapun.

Cara kerjanya:
1. Kamu kirim usulan perubahan ke GitHub
2. Sistem otomatis komentar di usulan kamu, kasih link preview:
   "Preview siap: https://<project>-frontend-git-fitur-abc.vercel.app"
3. Klik link → buka di browser
4. Coba-coba fitur kamu di sini
5. Bagi link ke owner lewat Discord channel review
6. Owner klik link, lihat, kalau oke baru di-approve

PENTING: Link preview itu BISA DILIAT SIAPA AJA yang punya link.
- Buat halaman sensitif (misal halaman admin): kalau mau dikunci pakai password, Vercel ada paket berbayar $20/bulan.
- Atau: undang teman tim ke project Vercel (paket gratis cuma bisa 5 orang).

Analogi: kayak bagi link Google Drive yang setting-nya "siapa pun yang punya link bisa lihat". Cepet tapi gak super privat.

---

## NAIK BANDING ke OWNER (Eskalasi)

Pakai pola ini kalau:
- Tugas butuh keputusan bisnis (bukan teknis)
- Tugas butuh akses ke bagian Data (kamu staff Tampilan)
- Macet lebih dari 1 jam gak ada kemajuan
- AI bilang "saya tidak yakin / butuh penjelasan lebih lanjut"

```
/eskalasi

Cerita lengkapnya:
- Tugas: <judul tugas yang lagi dikerjain>
- Yang udah dicoba: <apa aja yang udah dicoba>
- Macet-nya di mana: <jelasin macet-nya>
- Butuh keputusan apa dari owner: <apa yang butuh diputusin owner>
```

AI bikin ringkasan buat dikirim ke owner lewat Discord DM.

Contoh:
```
/eskalasi

Cerita lengkapnya:
- Tugas: Bikin perhitungan ongkir
- Yang udah dicoba: cek tarif Tokopedia & Shopee buat pembanding
- Macet-nya di mana: instruksi dari owner cuma bilang "ongkir masuk akal",
  belum ada angka pastinya
- Butuh keputusan apa dari owner: angka pasti tarif per jarak, atau ikutin
  hitungan pesaing?
```

Analogi: Mirip staff toko nelpon supervisor pas customer minta diskon besar. "Pak, customer minta diskon 30%, saya gak punya wewenang, mau konfirm dulu." Bukan asal kasih lalu kena teguran.

---

## CARA MINTA YANG BURUK (Hindari)

Buruk: "tolong benerin bug-nya"
Baik: "Bug: pas klik tombol Batalkan di halaman daftar pesanan, halaman jadi putih kosong"

Buruk: "lanjutin yang tadi"
Baik: "Lanjutin revisi sesuai komentar owner di usulan perubahan kemarin [paste komentarnya]"

Buruk: "ya udah lanjut aja"
Baik: "Oke, lanjut. Kalau udah selesai, kirim ke sistem percobaan dan kabarin tim Tampilan."

Buruk: "data-nya gimana?"
Baik: "/tanya info pesanan udah siap di sistem percobaan atau belum? Saya coba ambil tapi gak ada"

Buruk: "bikin halaman yang bagus"
Baik: "Bikin halaman daftar produk. Di komputer tampil 3 produk per baris, di HP 1 produk per baris. Tampilin nama, harga, gambar. Bisa diurutin dari harga termurah."

Buruk: "ada masalah di sistem"
Baik: "PENTING: customer komplain di Discord channel support, halaman pembayaran error sejak jam 2 siang, ini foto pesan errornya"

Analogi: Cara minta yang asal = order ojol dengan alamat "rumah saya". Driver bingung, telpon 5 kali, kamu jengkel. Cara minta yang detail = alamat lengkap + patokan, driver langsung sampai.

---

## CONTEKAN AKHIR (Print, Tempel di Monitor)

```
===========================================
CONTEKAN BUAT STAFF TAMPILAN (4 orang)
Kerja di: bagian yang dilihat user
Soal data: cuma boleh ambil/edit lewat jalur tim Data
===========================================

1. Tugas: <apa>
   Yang ditampilin / yang berubah: <daftar singkat>
   Catatan:
   - Data dari mana: <kata tim Data udah siap di mana>
   - Pakai info bersama versi berapa

2. Kalau bingung: /tanya <pertanyaan>

3. Naik banding ke owner: /eskalasi <cerita>

4. Koordinasi sama tim Data lewat Discord channel tugas

5. JANGAN: minta yang asal ("benerin bug", "lanjut aja")
   SELALU: kasih judul tugas + cerita lengkap
===========================================

===========================================
CONTEKAN BUAT STAFF DATA (2 orang)
Kerja di: tempat simpan data + aturan bisnis + jalur ambil data
Database: punya akses penuh, boleh nambah/ubah/hapus
===========================================

1. Tugas: <apa>
   Soal tempat simpan data: <yang berubah>
   Soal jalur ambilnya: <cara ambil + yang dikirim + yang dikasih balik>
   Soal aturan: <aturan bisnisnya>
   Soal paket info bersama: <info baru yang ditambah>

2. Kalau udah siap: kabarin tim Tampilan di Discord channel

3. Naikin versi paket info bersama, kabarin tim Tampilan

4. JANGAN: lupa catat perubahan database
   SELALU: kasih nama yang jelas pas nyimpen perubahannya
===========================================
```

---

## TANYA JAWAB Buat Staff Awam

**Q: Kalau saya bingung sama istilah teknis pas baca instruksi, gimana?**
A: Bilang aja AI: "tolong jelasin <istilahnya> pakai bahasa biasa". AI akan jelasin ulang. Analogi: mirip nanya ke customer service Tokopedia "bang, 'cashback' itu apa sih?". CS jawab pakai bahasa simpel.

**Q: Saya gak yakin tugas ini buat tim Tampilan atau tim Data, gimana?**
A: Pakai /cek-bagian <ceritain tugasnya>. AI bakal kasih tau (Tampilan = halaman yang dilihat user; Data = tempat simpan info + aturan bisnis). Analogi: mirip cek saldo ShopeePay sebelum transaksi besar. Cek dulu apakah bisa, baru jalan.

**Q: AI bikin sesuatu yang aneh, saya gak ngerti, harus terima?**
A: Bilang AI: "kasih ringkasan apa aja yang kamu ubah, di bagian mana, dan kenapa". Kalau penjelasannya masih gak ngerti juga, naik banding ke owner. Analogi: mirip terima tagihan dari vendor yang angkanya aneh. Minta rincian dulu, jangan asal setuju.

**Q: Saya share layar ke owner, takut info rahasia keliatan, gimana?**
A: Sebelum share, tutup file rahasia (file .env.local sama file profil staff). Share halaman aplikasi aja. Analogi: mirip screenshot saldo bank buat bukti transfer. Tutup dulu nomor rekening + total saldo, cuma tunjukin nominal yang ditransfer.

**Q: Saya kirim perubahan ternyata salah, gimana batalin?**
A: Bilang AI: "/batalin perubahan terakhir, jangan dikirim". AI batalin di komputer lokal. Kalau udah terkirim, bilang owner sebelum panik. Analogi: mirip transfer GoPay ke nomor salah. Kalau belum diterima, masih bisa cancel. Kalau udah masuk, harus minta tolong CS.

**Q: AI minta saya jalanin perintah yang gak saya ngerti (misal "hapus semua folder X"), aman?**
A: TANYA dulu sebelum dijalanin: "/tanya perintah <X> ini buat apa, ada resikonya gak?". AI bakal jelasin. Kalau masih ragu, naik banding ke owner. Analogi: mirip dapet pesan WA "klik link ini buat klaim hadiah". Jangan asal klik, verifikasi dulu.

**Q: Saya staff Tampilan tapi butuh ubah info di paket bersama, boleh?**
A: Gak boleh langsung. Cara-nya: minta ke tim Data lewat Discord channel, mereka yang update + naikin versi paketnya, kamu tinggal sinkronin. Analogi: mirip stok barang di Tokopedia. Tim Tampilan (etalase) gak boleh ubah harga langsung, harus minta tim Data (admin produk) ubah dulu, baru sinkron ke etalase.

**Q: Owner kasih tugas lewat WA personal, padahal aturannya lewat Discord channel, gimana?**
A: Sopan minta dipindah: "Pak owner, boleh tugas ini ditaroh di channel tugas biar tim lain juga tau? Khawatir double kerja kalau ada yang ambil juga." Analogi: mirip arisan harus di grup, jangan personal. Biar semua transparan.

**Q: Saya butuh akses ke database asli buat ngecek masalah, boleh minta?**
A: Gak boleh. Akses database asli cuma buat tim Data + owner (staff Tampilan gak punya akses ke bagian Data maupun kunci database-nya). Cara-nya: ceritain masalahnya, AI siapin perintah buat ngecek, owner / staff Data yang jalanin lalu kirim hasilnya. Analogi: mirip ATM bank. Customer (kamu) gak bisa buka brankas, harus minta teller (owner) yang verifikasi dulu.

**Q: AI bilang "saya gak punya info soal X", gimana?**
A: Kasih info yang dia minta. Tempel link, tempel pesan error, tempel screenshot dengan keterangan. Jangan harap AI nebak-nebak. Analogi: mirip nanya ke teman lewat chat "eh tolongin ini dong". Teman pasti nanya balik "tolongin apa, screenshot dong". Sama lah AI.

---

## Tips Tambahan Buat Staff Awam

### Tip 1: Selalu Mulai dari Cerita Latar Belakang
Sebelum minta ke AI, tanya diri sendiri:
- Bagian mana yang kena? (Tampilan / Data / paket bersama)
- Ada yang harus siap duluan? (perlu nunggu tim lain selesai dulu?)
- Siapa yang harus tau? (cuma saya, tim, atau owner)

Analogi: mirip nulis email kerja. Judul jelas, penerima tepat, CC yang relevan. Bukan asal kirim ke semua orang.

### Tip 2: Jangan Takut Nanya Ulang
AI gak bakal judge kalau kamu nanya 5x buat memperjelas instruksi. Lebih baik nanya banyak di awal daripada kerja salah dan ngulang.

Analogi: mirip nanya alamat ke ojol "Pak, di gang setelah Indomaret atau sebelum?". Driver lebih seneng ditanya daripada nyasar.

### Tip 3: Cek Dulu Sebelum Kirim
Pola aman sebelum kirim hasil kerja:
```
/cek hasil tugas <judul tugas>
```
AI bakal jalanin pengecekan otomatis. Kalau semua hijau, baru dikirim.

Analogi: mirip cek isi tas sebelum keluar rumah. Dompet, HP, kunci - aman? Baru cabut.

### Tip 4: Catat Pas Selesai
Setelah selesai tugas besar, post di Discord channel:
```
[Selesai] Tugas <judul tugas>
- Apa yang dikerjain: <ringkas>
- Bagian yang berubah: <daftar singkat>
- Udah dicoba di sistem percobaan: <link>
- Perlu owner cek dulu sebelum dipakai: <ya/tidak>
```

Analogi: mirip update status pesanan Shopee "barang sudah dikirim, nomor resi JNE 1234". Customer aware, kamu juga punya catatan.

### Tip 5: Hormati Jam Kerja
Tim Data mungkin beda jam kerjanya. Jangan harap dibales cepet di luar jam kerja. Kalau urgent, langsung naik banding ke owner.

Analogi: mirip seller Tokopedia. Customer chat jam 2 pagi, jangan harap dibales langsung. Tapi kalau urgent (refund besar), bisa hubungi nomor darurat.

---

## Penutup

Kamu adalah operator AI, bukan programmer. Tugasmu:
1. Terjemahin kebutuhan bisnis jadi instruksi yang detail buat AI
2. Koordinasi sama tim lain lewat Discord channel
3. Naik banding ke owner kalau macet atau butuh keputusan
4. Cek hasil AI sebelum bilang "selesai"

Kalau ragu, prinsipnya:
- **Jelas > Singkat**: lebih baik instruksi panjang detail daripada singkat tapi ambigu
- **Nanya > Nebak**: lebih baik nanya 5x daripada ngulang kerjaan 1x
- **Terbuka > Diem**: post update di Discord channel, jangan kerja diem-diem

Analogi terakhir: bayangin kamu sopir Gojek pakai Google Maps. Maps (AI) bantu navigasi, tapi kamu yang nentuin tujuan, kapan jalan, kapan istirahat. Kalau Maps suruh lewat jalan rusak, kamu boleh tolak. Tapi kamu juga harus tau cara baca Maps biar gak nyasar.

Selamat bekerja. Tempel contekan ini di monitor.
