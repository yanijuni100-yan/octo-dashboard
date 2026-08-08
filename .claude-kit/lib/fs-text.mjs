#!/usr/bin/env node
// lib/fs-text.mjs - Helper teks + berkas bersama (versi Node). SUMBER TUNGGAL helper baca/tulis kecil.
//
// WHY (RAPIKAN/DRY, BUKAN perbaikan bug): pola helper kecil yang sama dulu disalin di banyak tempat -
// `stripBom` kembar (~3 fungsi + ~10 cek inline) + `readTextSafe`/`isFile`/`isDir`/`pathExists`/
// `writeUtf8NoBom` masing-masing 2-3 salinan byte-identik tersebar di lib/ + alat inti. Disatukan ke
// SATU sumber supaya kalau perilakunya perlu berubah, cukup ubah di sini -> tak ada salinan yang
// ketinggalan (audit konsolidasi A6 2026-06-23 untuk stripBom; diperluas audit fungsi-kembar 2026-06-25).
// Semua pemanggil SUDAH berperilaku sama sebelumnya, jadi perilaku TIDAK berubah - ini murni rapi-rapi.
//
// Penjaga anti-rot: tests/fs-text.test.mjs memindai SEMUA berkas .mjs dan MENOLAK (tes merah) kalau ada
// yang mendefinisikan ulang `function <helper>` di luar berkas ini -> duplikasi tak bisa diam-diam balik
// (penting untuk kerja TIM: anggota baru yang copy-paste helper ini langsung ketahuan sebelum rilis).
import fs from 'node:fs'

// stripBom: buang penanda byte-order (U+FEFF) tak-kasat-mata di AWAL teks. Editor Windows (Notepad /
// VS Code "UTF-8 with BOM") bisa menyisipkannya saat menyimpan ulang; JSON.parse tersedak BOM -> melempar.
// Cermin PowerShell `Get-Content -Encoding UTF8` / `[IO.File]::ReadAllText(...,UTF8)` yang otomatis
// menoleransi BOM. Aman pada null/undefined/'' (tak melempar) -> boleh dipakai langsung pada hasil baca
// yang mungkin kosong. Catatan: 0xfeff ditulis sebagai HEX (bukan karakter mentah) supaya gerbang
// unicode-safety repo tak menolak berkas ini (larangan karakter tak-kasat ter-commit).
export function stripBom(s) {
  return (s && s.charCodeAt(0) === 0xfeff) ? s.slice(1) : s
}

// readTextSafe: baca berkas UTF-8 + buang BOM, return null kalau gagal (berkas tak ada / tak terbaca).
// Cermin PS `Get-Content -Raw` (toleran BOM). Tanpa buang-BOM, JSON.parse Node tersedak BOM (package.json
// tulisan editor Windows sering ber-BOM -> deteksi salah, BEDA dari PS; terbukti uji-banding Gelombang 2).
export function readTextSafe(p) {
  try { return stripBom(fs.readFileSync(p, 'utf8')) } catch { return null }
}

// pathExists: cek ada/tidak (file ATAU folder), senyap (tak melempar). Cermin PS `Test-Path`.
export function pathExists(p) {
  try { fs.accessSync(p); return true } catch { return false }
}

// isDir: cek "ini folder?", senyap. Cermin PS `Test-Path -PathType Container`.
export function isDir(p) {
  try { return fs.statSync(p).isDirectory() } catch { return false }
}

// isFile: cek "ini berkas?", senyap. Cermin PS `Test-Path -PathType Leaf`.
export function isFile(p) {
  try { return fs.statSync(p).isFile() } catch { return false }
}

// writeUtf8NoBom: tulis berkas UTF-8 TANPA BOM (fs default utf8 = tanpa BOM, cermin
// System.Text.UTF8Encoding $false). Pasangan-tulis dari readTextSafe (yang membuang BOM saat baca).
export function writeUtf8NoBom(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8')
}

// readTemplate: baca berkas template UTF-8 + buang BOM. BEDA dari readTextSafe -> MELEMPAR kalau berkas
// hilang (template wajib ada; bukan opsional). Guard `== null` dipertahankan apa adanya (perilaku sama
// dgn 2 salinan lama di agents-md.mjs + template-deploy.mjs sebelum disatukan).
export function readTemplate(sourcePath) {
  let content = fs.readFileSync(sourcePath, 'utf8')
  if (content == null) content = ''
  return stripBom(content)
}

// eqCI: banding 2 string TANPA peka huruf-besar/kecil (cermin PS -eq string yang default tak peka huruf).
// Dipakai untuk path/hash/nama berkas yang boleh beda hanya kapitalnya (mis. 'Foo.md' = 'foo.md').
export function eqCI(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase()
}

// backupStamp: cap-waktu LOKAL 'yyyyMMdd-HHmmss' untuk nama berkas/folder cadangan (cermin Get-Date -Format).
// Pemanggil oper Date sendiri (mis. backupStamp(new Date())) -> bisa dibuat deterministik saat uji.
// Menyatukan 5 salinan lama (formatStamp x3 + timestampSuffix + defaultBackupSuffix) yang formatnya sama.
export function backupStamp(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

// isSymlinkLike: cek apakah path = symbolic-link/junction (lstat, senyap -> false kalau tak ada/error).
// Dipakai sebagai penjaga TOCTOU cepat (cek-sesaat-sebelum-tulis/hapus, menutup vektor swap-ke-junction)
// di uninstall.mjs + rollback.mjs. Catatan KEAMANAN: ini lapis SEMPIT (cuma lstat berkas itu sendiri);
// pelengkap pemeriksa PowerShell yang menelusur induk (lihat testPathsHaveReparsePoint) - bukan pengganti.
export function isSymlinkLike(p) {
  try { return fs.lstatSync(p).isSymbolicLink() } catch { return false }
}
