#!/usr/bin/env node
// lib/popup-shim.mjs - Penyedia jawaban-aman non-interaktif untuk orkestrator versi Node.
//
// GELOMBANG 5 (ADR-003b/ADR-004) + KEPUTUSAN OWNER 06-22: popup jendela GUI (WinForms) DIBUANG dari
// versi Node. Alasan: dalam alur lintasAI yang sebenarnya, AI menjalankan pemasang tanpa-layar (popup
// tak pernah muncul) lalu memandu staff lewat chat. Jadi window GUI = berat-mubazir di Node + satu-
// satunya hal yang menghambat cutover (perlu uji-lihat manusia). Maka pemasang Node kini SEPENUHNYA
// OTOMATIS: tiap "pertanyaan" langsung dijawab NILAI-AMAN (default), tanpa menampilkan apa pun.
// Pilihan sebenarnya dilakukan lewat AI di chat sesudah pemasangan.
//
// SIFAT NON-PERUSAK: window WinForms TETAP ADA di lib/popup-helpers.ps1 untuk alat PowerShell yang
// masih live (setup/update/uninstall/rollback .ps1). Ia ikut pensiun saat PowerShell-nya pensiun
// (Gelombang 7) - TIDAK dibawa ke Node. Jembatan Node->PS lama (popup-shim.ps1) sudah dihapus.
//
// Yang disisakan modul ini: resolvePowerShellExe (dipakai jalur CADANGAN PowerShell: penjaga junction
// reparse-guard.mjs + fallback pemasang/doctor update-kit.mjs; MOTW git-helpers.mjs sudah Node murni) + deteksi
// mode keyboard manusia (isInteractiveInput, untuk pesan info) + 5 fungsi "tanya" yang selalu balas
// aman. Tanda tangan 5 fungsi DIPERTAHANKAN supaya orkestrator tak perlu diubah; kalau suatu hari
// perlu input konsol, cukup ubah modul INI (orkestrator tetap).
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Pilih PowerShell: pwsh7 dulu (lebih cepat/lintas-OS) lalu powershell.exe. Katup LINTASAI_FORCE_WINPS=1.
// Cermin bin/lintasai.js resolvePowerShellExe (jangan divergensi). Dipakai jalur CADANGAN PowerShell:
// reparse-guard.mjs (penjaga junction) + update-kit.mjs (pemasang/doctor fallback). JANGAN hapus.
export function resolvePowerShellExe() {
  const force = process.env.LINTASAI_FORCE_WINPS
  if (force && force !== '0' && force !== 'false') return 'powershell.exe'
  try {
    const probe = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', 'exit 0'], { stdio: 'ignore', timeout: 5000 })
    if (!probe.error && probe.status === 0) return 'pwsh'
  } catch (e) { /* pwsh tak ada -> fallback */ }
  return 'powershell.exe'
}

let _interactiveCache
// Apakah ada keyboard manusia nyata? Dipakai pemasang HANYA untuk pesan "mode otomatis terdeteksi".
// (Popup TIDAK lagi bergantung ini - semua jawaban kini aman by default.) Cermin Test-LintasInteractiveInput:
//   - LINTASAI_INTERACTIVE=1 -> paksa true (escape hatch Git Bash, menang atas semua).
//   - LINTASAI_NONINTERACTIVE / CLAUDECODE / CI (selain '0'/'false') -> false.
//   - stdin BUKAN TTY (pipe/redirect) -> false.
export function isInteractiveInput() {
  if (_interactiveCache !== undefined) return _interactiveCache
  const force = process.env.LINTASAI_INTERACTIVE
  if (force && force !== '0' && force !== 'false') { _interactiveCache = true; return true }
  for (const name of ['LINTASAI_NONINTERACTIVE', 'CLAUDECODE', 'CI']) {
    const v = process.env[name]
    if (v && v !== '0' && v !== 'false') { _interactiveCache = false; return false }
  }
  if (process.stdin.isTTY !== true) { _interactiveCache = false; return false }
  _interactiveCache = true
  return true
}

// Untuk uji: reset cache deteksi mode (cache di-set sekali per proses; tes butuh ganti env).
export function resetPopupModeCache() {
  _interactiveCache = undefined
}

// ---- API "tanya" (dipanggil orkestrator Node) - SELALU balas NILAI-AMAN, tanpa GUI ----
// Argumen tampilan (kitDir, title, message, options, dst) diterima lalu diabaikan (tanda tangan
// dipertahankan demi kompatibilitas pemanggil).

// Ya/Tidak -> selalu jawaban-aman (defaultYes). Return 'Yes'|'No'.
export function showYesNo({ defaultYes = false } = {}) {
  return defaultYes ? 'Yes' : 'No'
}

// Input teks -> selalu {Cancel,''} (aman: lewati; isian sebenarnya lewat AI/chat atau git config nanti).
export function showInput() {
  return { status: 'Cancel', value: '' }
}

// Pilihan radio (label string) -> selalu defaultIndex (opsi paling aman ada di indeks 0 per konvensi caller).
export function showChoice({ defaultIndex = 0 } = {}) {
  return defaultIndex
}

// Pilihan bernomor -> selalu defaultIndex.
export function showNumberedChoice({ defaultIndex = 0 } = {}) {
  return defaultIndex
}

// Info (tanpa pilihan) -> cetak ke konsol (info tetap sampai ke user, tanpa window).
export function showInfo({ title, message } = {}) {
  console.log(`[${title}] ${message}`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  // CLI diagnostik: cetak mode terdeteksi (berguna saat debug di mesin staff).
  console.log(JSON.stringify({
    interactiveInput: isInteractiveInput(),
    powershell: resolvePowerShellExe(),
    popupGui: 'dibuang dari versi Node (06-22) - selalu jawaban-aman',
  }, null, 2))
}
