# docs/architecture_auto.md - Registry semua file .md pendamping (TOC)

> Versi 2 · 2026-06-24 · Diisi AI **manual**, lalu **dicek robot registry** (bukan diisi otomatis)
> Aturan: `CLAUDE_universal_v1.md` seksi 7.4 ARCHITECTURE REGISTRY

## Pengantar

File ini adalah **registry/TOC semua file `.md` pendamping** di folder `docs/`. Tujuannya: AI baca file ini DULU di awal sesi untuk tahu apa yang available, lalu cherry-pick `.md` spesifik sesuai task - **bukan baca semua `docs/*.md`** (cegah boros token saat docs membesar).

**Cara kerja sebenarnya (jangan tertipu kata "auto")**: file ini **diisi AI dengan tangan** tiap kali ada `.md` pendamping baru / di-rename / dihapus (lewat AUTO-SYNC atau LAZY-GENERATE) — **bukan** di-generate otomatis dari isi folder `docs/`. Yang "otomatis" hanya **pengecekannya**: ada robot registry (`lib/project-manifest.ps1` di kit — saat ini versi **PowerShell**, butuh `pwsh`; versi Node masih dalam antrean port) yang menandai kalau ada `.md` lupa didaftarkan (MISSING) atau entri yang filenya sudah hilang (ORPHAN). **Catatan untuk project jalur Node-only (tanpa `pwsh`):** robot ini belum jalan di jalurmu, jadi jaga registry ini **lebih disiplin secara manual** sampai versi Node tersedia. Apa pun jalurnya, file ini tetap WAJIB AI update di sesi yang sama saat menyentuh `.md` — robot cuma **jaring pengaman**, bukan pengganti disiplin. 🏢 Analogi: kayak satpam yang **menegur** kalau ada nama tamu kelupaan dicatat — resepsionis tetap yang **menulis** daftarnya.

**Pisah dari `architecture.md`** (yang user-edited): supaya user-edit peta makro tidak konflik dengan AI auto-maintain registry.

---

## Format entri

`- [<filename>.md](<path>) - <summary singkat 1 baris, max 80 karakter>`

Contoh:
```
- [auth.md](auth.md) - Modul autentikasi (login + session + RBAC)
- [security/encryption.md](security/encryption.md) - AES-GCM credential vault
```

---

## Top-level (`docs/*.md`)

<!-- AI tambah baris baru di sini tiap LAZY-GENERATE / BOOTSTRAP -->
<!-- Format: - [<filename>](<path>) - <summary> -->

*(Belum ada `.md` pendamping. Kalau buat file kode CRITICAL, AI akan tawarkan LAZY-GENERATE - terima dengan "y" → entri muncul di sini otomatis.)*

---

## Subfolder (kalau scale > 30 file)

<!-- Hanya muncul kalau docs/ sudah pakai subfolder grouping (security/, api/, features/). -->
<!-- AI auto-add section per subfolder + list file di dalamnya. -->

*(Tidak ada subfolder. Default flat di `docs/` sampai docs > 30 file - baru pakai grouping.)*

---

## Pending docs (LAZY-GENERATE skipped)

<!-- File kode CRITICAL yang user skip generate. AI tawarin lagi saat sentuh file di sesi berikutnya. -->
<!-- Format: - <source-path> - kena pattern <kategori>, user skip pada <tanggal> -->

*(Belum ada - bagian ini terisi otomatis kalau user pilih "n" saat AI sugest LAZY-GENERATE.)*

---

## Riwayat update registry

| Tanggal | Aksi | Catatan |
|---|---|---|
| 2026-05-31 | Inisialisasi | Skeleton (registry TOC kosong, AI auto-update saat ada `.md` baru). |

<!-- AI tambah baris baru tiap update registry (file baru / rename / hapus). -->
