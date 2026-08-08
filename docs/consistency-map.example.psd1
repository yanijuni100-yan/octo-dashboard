# consistency-map.example.psd1 - CONTOH peta-konsistensi untuk project kamu
#
# APA INI: daftar "fakta yang sama yang ditulis di banyak berkas" di project-MU, supaya
# robot pemeriksa bisa memastikan semuanya cocok (anti bug "file A lupa diganti, file C sudah").
#
# CARA PAKAI:
#   1. Salin berkas ini jadi: docs/consistency-map.psd1
#   2. Isi sesuai project-mu (lihat contoh di bawah). Minta AI: "isi peta-konsistensi
#      untuk project ini" -> AI akan scan + lengkapi.
#   3. Jalankan robot:
#        pwsh .claude-kit/lib/consistency-check.ps1 -RepoRoot . -ChecksFile docs/consistency-map.psd1
#      -> dia lapor mana yang cocok / basi, dalam hitungan detik.
#
# PENTING: cuma masukkan deklarasi NILAI-SAAT-INI. Penanda SEJARAH (mis. "fitur ini lahir
# di v1.2.0", catatan changelog lama) SENGAJA menyimpan nilai lama -> JANGAN dimasukkan.
#
# Format aman (data-only, tidak menjalankan kode apa pun).

@{
    # ---- Sumber kebenaran: dari mana nilai acuan diambil ----
    # Pilihan A (project punya package.json): baca field JSON.
    Source = @{ File = 'package.json'; JsonField = 'version' }
    # Pilihan B (tanpa package.json): regex 1 capture group dari sebuah berkas.
    #   Source = @{ File = 'VERSION.txt'; Pattern = '(\d+\.\d+\.\d+)' }

    # ---- Berkas yang HARUS cocok dengan Source ----
    # File    : path relatif dari akar project.
    # Label   : nama ramah (muncul di laporan kalau baris versi hilang).
    # Pattern : regex dengan SATU capture group untuk nilai. Match PERTAMA yang dipakai.
    # HeaderLines (opsional): batasi cari ke N baris pertama (hindari salah-tangkap
    #                         penanda sejarah versi di badan berkas).
    Checks = @(
        @{
            File    = 'README.md'
            Label   = 'Badge/baris versi di README'
            Pattern = 'v(\d+\.\d+\.\d+)'
            HeaderLines = 15
        }
        # Contoh lain (hapus/ganti sesuai project-mu):
        # @{ File = 'docs/CHANGELOG.md'; Label = 'Entri changelog teratas'; Pattern = '##\s+\[?v?(\d+\.\d+\.\d+)' }
        # @{ File = 'src/version.ts';    Label = 'Konstanta APP_VERSION';   Pattern = "APP_VERSION\s*=\s*'(\d+\.\d+\.\d+)'" }
    )
}
