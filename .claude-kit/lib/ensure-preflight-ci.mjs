#!/usr/bin/env node
// lib/ensure-preflight-ci.mjs - Pasang workflow CI "Gerbang mutu otomatis" ke project klien (OPT-IN).
//
// KENAPA ADA: robot mutu lintasAI (kecocokan versi, Unicode, tes, registry, perf) di project klien
// HANYA jalan kalau AI/klien memanggil `npx lintasai preflight` (= dipicu AI saat Gerbang sec.4.6).
// Tak ada pemicu MESIN di sisi klien -> kalau AI lupa menjalankan gerbang, cek mutu terlewat (audit
// 2026-06-28, temuan PENTING #2). Modul ini menyalin templates/github/workflows/preflight.yml ke
// .github/workflows/ klien DALAM 1 PERINTAH -> tiap push/PR ke GitHub menjalankan robot mutu otomatis.
//
// OPT-IN (cermin enable-risk-gate, BUKAN dipasang otomatis di setup): hanya jalan saat user/AI minta
// `npx lintasai enable-preflight-ci`. Alasan opt-in: butuh GitHub Actions + alur PR; memaksanya ke
// klien yang belum pakai GitHub = CI merah membingungkan. Owner yang putuskan (sec.1.1).
//
// SIFAT (cermin lib/ensure-risk-gate-hook.mjs - pola pemasang yang sudah teruji):
//  - IDEMPOTEN: berkas sudah ADA + isi SAMA -> tak menulis lagi (changed:false, reason 'sudah-ada').
//  - DEFENSIF: berkas sudah ADA + isi BEDA -> JANGAN timpa tanpa --force (jaga editan kustom klien);
//    lapor 'sudah-ada-beda' + sarankan --force.
//  - FAIL-NYARING: template sumber hilang -> error jelas (bukan diam-diam bikin berkas kosong).
//  - TULIS ATOMIK: temp + rename (tak ada berkas setengah-tertulis kalau proses mati).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripBom } from './fs-text.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// SSOT isi workflow = templates/github/workflows/preflight.yml (relatif ke akar kit, satu tingkat di
// atas lib/). Dikunci tes paritas supaya kalau template berubah, pemasang tetap menyalin yang terbaru.
export const PREFLIGHT_CI_TEMPLATE = path.join(__dirname, '..', 'templates', 'github', 'workflows', 'preflight.yml')
export const PREFLIGHT_CI_DEST_REL = ['.github', 'workflows', 'preflight.yml']

function readTextOrNull(p) {
  try { return stripBom(fs.readFileSync(p, 'utf8')) } catch { return null }
}

function writeFileAtomic(filePath, text) {
  const tmp = `${filePath}.tmp-${process.pid}`
  fs.writeFileSync(tmp, text, 'utf8')
  fs.renameSync(tmp, filePath)
}

// Pasang workflow preflight.yml ke project klien. Return { changed, reason }. FAIL-SAFE.
// reason: 'dibuat' | 'sudah-ada' | 'sudah-ada-beda' | 'diperbarui' (force) | 'simulasi' | 'template-hilang'.
export function ensurePreflightCi(projectRoot, { dryRun = false, force = false, templatePath = PREFLIGHT_CI_TEMPLATE } = {}) {
  const tpl = readTextOrNull(templatePath)
  if (tpl === null) return { changed: false, reason: 'template-hilang' }

  const destPath = path.join(projectRoot, ...PREFLIGHT_CI_DEST_REL)
  const existing = readTextOrNull(destPath)

  if (existing !== null) {
    if (existing === tpl) return { changed: false, reason: 'sudah-ada' }
    // Isi beda = mungkin klien sengaja menyunting -> jangan timpa diam-diam kecuali --force.
    if (!force) return { changed: false, reason: 'sudah-ada-beda' }
    if (dryRun) return { changed: true, reason: 'simulasi' }
    writeFileAtomic(destPath, tpl)
    return { changed: true, reason: 'diperbarui' }
  }

  if (dryRun) return { changed: true, reason: 'simulasi' }
  const destDir = path.dirname(destPath)
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
  writeFileAtomic(destPath, tpl)
  return { changed: true, reason: 'dibuat' }
}

// --- CLI: `node lib/ensure-preflight-ci.mjs [--project-root <dir>] [--dry-run] [--force]` ---
function main() {
  let projectRoot = process.cwd()
  let dryRun = false
  let force = false
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project-root') projectRoot = argv[++i] || projectRoot
    else if (argv[i] === '--dry-run' || argv[i] === '--simulasi') dryRun = true
    else if (argv[i] === '--force' || argv[i] === '--paksa') force = true
  }

  const res = ensurePreflightCi(projectRoot, { dryRun, force })
  const destRel = PREFLIGHT_CI_DEST_REL.join('/')
  switch (res.reason) {
    case 'sudah-ada':
      console.log(`OK - Gerbang mutu CI SUDAH terpasang di ${destRel} (isi sama, tak ada perubahan).`)
      break
    case 'sudah-ada-beda':
      console.error(`[LEWATI] ${destRel} SUDAH ada tapi isinya BEDA (mungkin kamu sunting sendiri) - TIDAK ditimpa.`)
      console.error('  Mau pakai versi terbaru dari kit? Jalankan ulang dengan --force (editanmu akan tertimpa).')
      process.exit(1)
      break
    case 'simulasi':
      console.log(`SIMULASI - Gerbang mutu CI AKAN dipasang ke ${destRel} (belum menulis apa pun).`)
      break
    case 'dibuat':
    case 'diperbarui':
      console.log(`OK - Gerbang mutu CI ${res.reason === 'dibuat' ? 'DIPASANG' : 'DIPERBARUI'} di ${destRel}.`)
      console.log('LANGKAH BERIKUT: commit + push berkas ini ke GitHub. Tiap push/PR ke main -> robot mutu jalan otomatis.')
      console.log('Catatan: butuh GitHub Actions aktif. Matikan kapan saja: hapus berkas itu. Detail: docs/preflight.md.')
      break
    case 'template-hilang':
      console.error('[GAGAL] Template workflow tak ditemukan (templates/github/workflows/preflight.yml). Kit mungkin tak lengkap - jalankan "npx lintasai update".')
      process.exit(1)
      break
    default:
      console.error(`[GAGAL] Tidak bisa memasang Gerbang mutu CI (alasan: ${res.reason}).`)
      process.exit(1)
  }
  process.exit(0)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
