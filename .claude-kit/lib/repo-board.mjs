#!/usr/bin/env node
// lib/repo-board.mjs - "Papan Status Lintas-Repo" (port Node dari repo-board.ps1; cuma-baca, ~0 token).
//
// MIGRASI grup [A] (ADR-003): robot cuma-baca. Fungsi inti getLintasRepoRisk = PURE (skor risiko
// dari fakta git) -> mudah dites tanpa repo nyata. Strangler Fig = BERDAMPINGAN: versi .ps1 hidup.
//
// Skor risiko (TERTINGGI menang): GENTING (.env belum aman) > PENTING (commit belum dikirim /
// perubahan belum disimpan) > RAPIKAN (behind/detached/no-upstream) > OK (bersih+sinkron).
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// PURE: dari fakta git -> { Risk, Label, Notes }. Risk TERTINGGI menang (escalation identik PS).
export function getLintasRepoRisk({ branch = '', ahead = 0, behind = 0, porcelainLines = [], hasUpstream = true } = {}) {
  const notes = []
  let risk = 'OK'

  // Cek berkas rahasia (.env) di antara perubahan -> GENTING.
  let hasEnv = false
  for (const l of porcelainLines) {
    if (!l || l.trim() === '') continue
    const p = l.replace(/^..\s+/, '').trim() // porcelain: 2 char status + spasi + path
    const leaf = path.basename(p)
    if (/^\.env($|\.)/i.test(leaf)) hasEnv = true
  }
  const dirty = porcelainLines.filter((l) => l && l.trim() !== '').length > 0

  if (hasEnv) {
    risk = 'GENTING'
    notes.push('ada perubahan berkas rahasia (.env) yang belum aman - cek jangan sampai ter-commit')
  }
  if (ahead > 0) {
    if (risk === 'OK') risk = 'PENTING'
    notes.push(`${ahead} commit belum dikirim ke server (belum ter-backup)`)
  }
  if (dirty && !hasEnv) {
    if (risk === 'OK') risk = 'PENTING'
    notes.push('ada perubahan belum disimpan (commit)')
  }
  if (!hasUpstream) {
    if (risk === 'OK') risk = 'RAPIKAN'
    notes.push('belum ada remote tracking (kerja belum tentu ter-backup ke server)')
  }
  if (branch === 'HEAD') {
    if (risk === 'OK') risk = 'RAPIKAN'
    notes.push('kepala terlepas (detached HEAD) - tidak di branch mana pun')
  }
  if (behind > 0) {
    if (risk === 'OK') risk = 'RAPIKAN'
    notes.push(`ketinggalan ${behind} dari server (perlu tarik/pull)`)
  }

  const label = risk === 'GENTING' ? '[GENTING]' : risk === 'PENTING' ? '[PENTING]' : risk === 'RAPIKAN' ? '[RAPIKAN]' : '[OK]'
  if (notes.length === 0) notes.push('bersih + sinkron dengan server')
  return { Risk: risk, Label: label, Notes: notes.join('; ') }
}

function git(repoPath, args) {
  const r = spawnSync('git', ['-C', repoPath, ...args], { encoding: 'utf8' })
  return { code: r.status, out: (r.stdout || '').trim() }
}

// Baca git sebuah repo (READ-ONLY) -> objek status + skor.
export function getLintasRepoStatus(repoPath) {
  const name = path.basename(repoPath)
  const inside = git(repoPath, ['rev-parse', '--is-inside-work-tree'])
  if (inside.code !== 0 || inside.out !== 'true') {
    return { Repo: name, Path: repoPath, Branch: '-', Ahead: 0, Behind: 0, Risk: 'RAPIKAN', Label: '[RAPIKAN]', Notes: 'bukan repo git (tak ada .git yang valid)' }
  }
  const b = git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = b.code === 0 ? b.out : 'HEAD'
  const porc = git(repoPath, ['status', '--porcelain'])
  const porcelainLines = porc.out ? porc.out.split(/\r?\n/) : []

  let hasUpstream = true
  let ahead = 0
  let behind = 0
  const counts = git(repoPath, ['rev-list', '--left-right', '--count', '@{u}...HEAD'])
  if (counts.code !== 0 || !counts.out) {
    hasUpstream = false
  } else {
    const parts = counts.out.split(/\s+/)
    if (parts.length >= 2) { behind = parseInt(parts[0], 10) || 0; ahead = parseInt(parts[1], 10) || 0 }
  }

  const r = getLintasRepoRisk({ branch, ahead, behind, porcelainLines, hasUpstream })
  return { Repo: name, Path: repoPath, Branch: branch, Ahead: ahead, Behind: behind, Risk: r.Risk, Label: r.Label, Notes: r.Notes }
}

import fs from 'node:fs'

export function invokeLintasRepoBoard({ path: rootPath = null, repos = null, quiet = false } = {}) {
  const repoPaths = []
  if (repos) {
    for (const r of repos) { if (fs.existsSync(r)) repoPaths.push(path.resolve(r)) }
  } else if (rootPath) {
    if (fs.existsSync(path.join(rootPath, '.git'))) repoPaths.push(path.resolve(rootPath))
    try {
      for (const d of fs.readdirSync(rootPath, { withFileTypes: true })) {
        if (d.isDirectory() && fs.existsSync(path.join(rootPath, d.name, '.git'))) repoPaths.push(path.join(path.resolve(rootPath), d.name))
      }
    } catch { /* abaikan */ }
  }

  const rows = repoPaths.map((rp) => getLintasRepoStatus(rp))
  const genting = rows.filter((x) => x.Risk === 'GENTING').length
  const penting = rows.filter((x) => x.Risk === 'PENTING').length
  const rapikan = rows.filter((x) => x.Risk === 'RAPIKAN').length

  if (!quiet) {
    console.log('Papan Status Lintas-Repo (cuma-baca)')
    console.log('-'.repeat(70))
    if (rows.length === 0) {
      console.log('Tidak ada repo ditemukan. Pakai --path <folder-induk> atau --repos <path1>,<path2>.')
    } else {
      for (const x of rows) {
        console.log(`  ${x.Repo.padEnd(22)} ${x.Branch.padEnd(12)} ${x.Label}`)
        console.log(`       -> ${x.Notes}`)
      }
      console.log('-'.repeat(70))
      console.log(`Ringkasan: GENTING ${genting} - PENTING ${penting} - RAPIKAN ${rapikan} - dari ${rows.length} repo.`)
    }
  }
  return { Rows: rows, Count: rows.length, Genting: genting, Penting: penting, Rapikan: rapikan }
}

function main() {
  const args = process.argv.slice(2)
  const quiet = args.includes('--quiet')
  const pathArg = args.find((a) => !a.startsWith('--')) || process.cwd()
  invokeLintasRepoBoard({ path: pathArg, quiet })
  process.exit(0)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
