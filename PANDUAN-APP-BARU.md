# Octo Dashboard v2 — Electron + React + TypeScript + Vite

Versi baru dengan kode yang lebih profesional & mudah dikembangkan. Semua fitur
lama tetap ada (profil, bulk Gmail, webview per-akun, proxy, otomatisasi, tema,
ekspor/impor) **plus** sinkron cloud Supabase.

## Menjalankan

```bash
npm install        # sekali saja (sudah terpasang)
npm run dev        # mode pengembangan (hot reload) — untuk dipakai sehari-hari
```

Perintah lain:

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan app + hot reload (otomatis refresh saat kode diubah) |
| `npm run build` | Compile ke folder `out/` (main + preload + renderer) |
| `npm start` | Pratinjau hasil build (`out/`) |
| `npm run typecheck` | Cek tipe TypeScript tanpa menjalankan |
| `npm run dist` | Build + buat installer `.exe` (electron-builder → folder `dist/`) |

## Struktur folder

```
src/
  main/index.ts          Proses utama Electron: window + penyimpanan file (IPC)
  preload/index.ts       Jembatan aman renderer↔main (electronAPI)
  preload/index.d.ts     Tipe electronAPI
  renderer/
    index.html           Halaman root
    src/
      main.tsx           Titik masuk React
      App.tsx            Kerangka: sidebar + topbar + view aktif
      env.d.ts           Tipe <webview>
      styles.css         Tampilan (dipakai ulang dari v1)
      lib/
        types.ts         Tipe data (Profile, Store, Cfg)
        store.ts         State global (Zustand) + semua aksi + sinkron cloud
        ui.ts            State UI ringan (akun aktif, perintah buka)
        storage.ts       Penyimpanan lokal (file Electron / localStorage)
        supabase.ts      Client Supabase
        api.ts           API Live (Octo/AdsPower)
        util.ts          Fungsi bantu (warna, parse, ekspor, dll)
        theme.ts         Pengaturan tema
      components/        Sidebar, Topbar, Toast, BgOrbs, modal, WebviewPane,
                         FrameView (single), GridView (banyak akun)
      views/             Overview, Profiles, Proxies, Automation, Settings
```

## Penyimpanan data

- **Dev**: `data/octo-data.json` di folder proyek (memakai data lama yang sudah ada).
- **Terpasang (.exe)**: `<userData>/data/octo-data.json` (lokasi aman, tahan reinstall).
- **Cloud**: tabel `dashboards` di Supabase (lihat [PANDUAN-SUPABASE.md](PANDUAN-SUPABASE.md)).

Sinkron cloud diatur di tab **Pengaturan → ☁️ Sinkron Cloud (Supabase)**. Login sekali,
lalu data tersinkron otomatis antar komputer.

## Versi lama (v1)

File lama (`app.js`, `index.html`, `electron-main.js`, `electron-preload.js`,
`styles.css` di root) **masih disimpan** sebagai cadangan. Versi v1 yang utuh juga
ada di branch `main` (versi React ini di branch `feat/react-migration`).
