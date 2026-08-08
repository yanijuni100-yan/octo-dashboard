#!/usr/bin/env node
// lib/install-secret-hook.mjs - Pasang penjaga rahasia pre-commit (.env / kunci API) ke .git/hooks/pre-commit KLIEN.
//
// KENAPA ADA (WHY): template penjaga (templates/hooks/pre-commit-secret-scan.sh) + installer PowerShell
//   (templates/hooks/install-secret-hook.ps1) SUDAH ada + teruji, TAPI pemasang AKTIF kini Node
//   (setup-pola-b.mjs) -> tanpa modul ini, hook TAK PERNAH terpasang otomatis di klien (celah nyata,
//   terverifikasi: PS installer standalone, tak ter-wire). Modul ini memport installer itu ke Node lalu
//   disambung ke setup-pola-b.mjs supaya tiap klien dapat penjaga shift-left otomatis: rahasia ditolak
//   DI LAPTOP sebelum ter-commit (bukan baru ketahuan telat di server).
//
// SIFAT (cermin pola ensureLangHook - lib/lang-hook-wiring.mjs):
//  - IDEMPOTEN: hook kita sudah ada (penanda marker) -> skip (installed:false, reason:'sudah-ada').
//  - FAIL-OPEN: git belum init / .git/hooks tak bisa ditulis / template hilang -> LEWATI (tak crash;
//    pemasangan TETAP berhasil). Hook = jaring TAMBAHAN, bukan syarat install.
//  - AMAN thd hook lain: pre-commit bukan-punya-kita -> DICADANGKAN bertimestamp, JANGAN merge paksa.
//  - LF WAJIB: bash rusak kalau CRLF -> normalize CRLF->LF sebelum tulis.
//  - TULIS ATOMIK: temp + rename (tak ada hook setengah-tertulis kalau proses mati).
//
// KETERBATASAN JUJUR (PENTING, bukan rasa-aman-palsu - dilaporkan apa adanya supaya tak ada rasa-aman-palsu):
//  - Cegah COMMIT BARU, BUKAN riwayat lama. Rahasia yang SUDAH ter-commit tak tertangkap hook ini
//    (butuh audit riwayat terpisah - lihat docs/SECURITY_INCIDENT_PLAYBOOK.md).
//  - Deteksi NAMA berkas (.env*) + pola kunci, BUKAN jaminan menyeluruh.
//  - Lapis pertahanan: hook lokal (lapis-1) + .github/workflows/secret-guard.yml (lapis-2 CI) + risk-gate (lapis-3 opsional).
//  - Bisa dilewati darurat: git commit --no-verify.
//
// Versi: 1 - 2026-06-24
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripBom, backupStamp } from './fs-text.mjs'

// Penanda idempoten: substring yang PASTI ada di template (pre-commit-secret-scan.sh baris 2). BYTE-IDENTIK
// dengan installer PowerShell (install-secret-hook.ps1) supaya hook hasil PS & Node saling dikenali.
export const HOOK_MARKER = 'lintasAI pre-commit secret guard'

// Lokasi template default = saudara modul ini (lib/ -> ../templates/hooks/). Self-locating via import.meta.url
// supaya andal baik saat init (dari kit sumber) maupun update (.claude-kit/lib/ -> .claude-kit/templates/hooks/).
export function defaultTemplatePath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'hooks', 'pre-commit-secret-scan.sh')
}

// backupStamp (cap-waktu cadangan yyyyMMdd-HHmmss) -> sumber bersama lib/fs-text.mjs (impor di atas).

function writeAtomic(filePath, text) {
  const tmp = `${filePath}.tmp-${process.pid}`
  fs.writeFileSync(tmp, text, 'utf8')
  fs.renameSync(tmp, filePath)
}

// Pasang hook penjaga rahasia. Return {installed, reason, hookPath, backupPath}.
//   reason: 'dipasang' | 'dipasang-cadangkan-lama' | 'sudah-ada' | 'tak-ada-git' | 'template-hilang' | 'simulasi'
//   installed=true HANYA saat hook BENAR-BENAR ditulis (atau akan ditulis di dryRun). 'sudah-ada' = installed:false.
// `clock` di-inject di tes supaya nama cadangan deterministik.
export function installSecretHook(projectRoot, { dryRun = false, templatePath = defaultTemplatePath(), clock = () => new Date() } = {}) {
  const gitDir = path.join(projectRoot, '.git')
  const hooksDir = path.join(gitDir, 'hooks')
  // FAIL-OPEN: belum repo git -> lewati (hook menyusul otomatis saat update setelah `git init`).
  if (!fs.existsSync(gitDir)) return { installed: false, reason: 'tak-ada-git', hookPath: null, backupPath: null }
  // Template hilang -> lewati (jangan crash). Seharusnya selalu ada (ikut paket kit).
  if (!fs.existsSync(templatePath)) return { installed: false, reason: 'template-hilang', hookPath: null, backupPath: null }

  const hookText = stripBom(fs.readFileSync(templatePath, 'utf8')).replace(/\r\n/g, '\n') // bash rusak kalau CRLF
  const target = path.join(hooksDir, 'pre-commit')
  let backupPath = null

  if (fs.existsSync(target)) {
    const cur = fs.readFileSync(target, 'utf8')
    if (cur.includes(HOOK_MARKER)) return { installed: false, reason: 'sudah-ada', hookPath: target, backupPath: null }
    // Hook pre-commit lain (bukan punya kita) -> cadangkan bertimestamp, JANGAN merge/timpa diam-diam.
    backupPath = `${target}.backup-${backupStamp(clock())}`
  }

  const reason = backupPath ? 'dipasang-cadangkan-lama' : 'dipasang'
  if (dryRun) return { installed: true, reason: 'simulasi', hookPath: target, backupPath }

  if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true }) // .git/hooks mestinya ada; defensif
  if (backupPath) fs.copyFileSync(target, backupPath)
  writeAtomic(target, hookText)
  // Bit "boleh dijalankan" untuk Linux/Mac. Di Windows, Git untuk Windows menjalankan hook via Git-Bash
  // tanpa butuh bit ini -> dilewati. Gagal chmod tak fatal (hook tetap jalan).
  if (process.platform !== 'win32') {
    try { fs.chmodSync(target, 0o755) } catch { /* abaikan: hook tetap jalan via Git-Bash */ }
  }
  return { installed: true, reason, hookPath: target, backupPath }
}

// CLI manual (opsional): node lib/install-secret-hook.mjs [projectRoot]. Selalu exit 0 (fail-open: "lewati" bukan error).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd()
  console.log(JSON.stringify(installSecretHook(root), null, 2))
}
