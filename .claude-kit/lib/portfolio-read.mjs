#!/usr/bin/env node
// lib/portfolio-read.mjs - Pembaca READ-ONLY "Buku Induk" portfolio (port Node dari portfolio-read.ps1).
//
// MIGRASI grup [A] (ADR-003 / docs/plans/keputusan-per-elemen-node-vs-ps.md): robot baca-saja,
// parser YAML BARIS-PER-BARIS untuk STRUKTUR DIKENAL (portfolio/access_groups/repos). C4 nol.
// Strangler Fig = BERDAMPINGAN: versi .ps1 TETAP hidup. 100% READ-ONLY (cuma baca + ringkas).
//
// Catatan: bukan parser YAML umum - hanya field tak-ambigu (mirip versi PS). Untuk RINGKASAN.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORTFOLIO_FILE = 'lintasai-portfolio.yml'

export function resolvePortfolioPath(repoRoot, p) {
  if (p) return p
  return path.join(repoRoot, PORTFOLIO_FILE)
}

// Tiruan Read-LintasPortfolio: parse Buku Induk -> { Present, BaseName, GithubOwner, Repos[], Groups[] }.
// Pembaca baris-per-baris, urutan cek elseif IDENTIK versi PS (penting agar hasil sama).
export function readLintasPortfolio(filePath) {
  if (!fs.existsSync(filePath)) {
    return { Present: false, BaseName: null, GithubOwner: null, Repos: [], Groups: [] }
  }
  // split \r?\n: buang \r (CRLF Windows) agar jangkar `^...$` + penghapus-komentar bekerja
  // sama seperti Get-Content PS (yang membuang line-ending). Tanpa ini, `members:\s*$` gagal.
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

  let baseName = null
  let githubOwner = null
  const repos = []
  const groups = []
  let section = null // 'portfolio' | 'access_groups' | 'repos'
  let curRepo = null
  let curGroup = null
  let inMembers = false

  for (const raw of lines) {
    if (/^\s*#/.test(raw)) continue // komentar penuh
    if (/^\s*$/.test(raw)) continue // baris kosong
    const line = raw.replace(/\s+#.*$/, '') // buang komentar tempel akhir baris

    // Baris top-level: flush item yang sedang dirakit DULU sebelum pindah/reset section.
    if (/^\S/.test(line)) {
      if (curGroup) { groups.push(curGroup); curGroup = null }
      if (curRepo) { repos.push(curRepo); curRepo = null }
      inMembers = false
      if (/^portfolio:\s*$/.test(line)) section = 'portfolio'
      else if (/^access_groups:\s*$/.test(line)) section = 'access_groups'
      else if (/^repos:\s*$/.test(line)) section = 'repos'
      else section = null
      continue
    }

    if (section === 'portfolio') {
      let m
      if ((m = line.match(/^\s+base_name:\s*(\S+)/))) baseName = m[1]
      else if ((m = line.match(/^\s+github_owner:\s*(\S+)/))) githubOwner = m[1]
    } else if (section === 'access_groups') {
      let m
      if ((m = line.match(/^\s+-\s+id:\s*(\S+)/))) {
        if (curGroup) groups.push(curGroup)
        curGroup = { id: m[1], member_count: 0 }
        inMembers = false
      } else if (/^\s+members:\s*$/.test(line)) {
        inMembers = true
      } else if (inMembers && /^\s+-\s+\S+/.test(line)) {
        if (curGroup) curGroup.member_count++
      } else if (/^\s+\w+:/.test(line)) {
        inMembers = false
      }
    } else if (section === 'repos') {
      let m
      if ((m = line.match(/^\s+-\s+name:\s*(\S+)/))) {
        if (curRepo) repos.push(curRepo)
        curRepo = { name: m[1], role: null, access_tier: null, allowed_teams: [] }
      } else if (curRepo) {
        if ((m = line.match(/^\s+role:\s*(\S+)/))) curRepo.role = m[1]
        else if ((m = line.match(/^\s+access_tier:\s*(\S+)/))) curRepo.access_tier = m[1]
        else if ((m = line.match(/^\s+allowed_teams:\s*\[([^\]]*)\]/))) {
          curRepo.allowed_teams = m[1].split(',').map((s) => s.trim()).filter((s) => s)
        }
      }
    }
  }
  if (curRepo) repos.push(curRepo)
  if (curGroup) groups.push(curGroup)

  return { Present: true, BaseName: baseName, GithubOwner: githubOwner, Repos: repos, Groups: groups }
}

// Tiruan Show-LintasPortfolioPlan: baca + (opsional) cetak ringkasan READ-ONLY; return ringkasan.
export function showLintasPortfolioPlan(repoRoot, { path: p = null, quiet = false } = {}) {
  const fp = resolvePortfolioPath(repoRoot, p)
  const data = readLintasPortfolio(fp)
  if (!data.Present) {
    if (!quiet) console.log(`[INFO] Tidak ada ${PORTFOLIO_FILE} di ${repoRoot} - Buku Induk portfolio belum dibuat (opsional).`)
    return { Present: false, BaseName: null, GithubOwner: null, RepoCount: 0, GroupCount: 0, Repos: [], Groups: [] }
  }
  if (!quiet) {
    console.log('')
    console.log('Buku Induk portfolio (RINGKASAN - READ-ONLY, tidak mengubah izin apa pun)')
    console.log(`Identitas : base_name='${data.BaseName}'  github_owner='${data.GithubOwner}'`)
    console.log('-'.repeat(70))
    console.log(`Repo (${data.Repos.length}):`)
    for (const r of data.Repos) {
      const teams = r.allowed_teams.length > 0 ? r.allowed_teams.join(', ') : '(tak ada)'
      console.log(`  - ${r.name.padEnd(22)} peran=${(r.role || '').padEnd(10)} tingkat=${(r.access_tier || '').padEnd(10)} boleh-clone: ${teams}`)
    }
    console.log(`Kelompok akses (${data.Groups.length}):`)
    for (const g of data.Groups) console.log(`  - ${g.id.padEnd(18)} ${g.member_count} anggota`)
    console.log('-'.repeat(70))
    console.log("CATATAN: 'boleh-clone' (allowed_teams) = izin clone GitHub = SATU-SATUNYA yang benar-benar memblokir salin kode (READ-ONLY, penegakan MANUAL).")
    console.log('')
  }
  return {
    Present: true,
    BaseName: data.BaseName,
    GithubOwner: data.GithubOwner,
    RepoCount: data.Repos.length,
    GroupCount: data.Groups.length,
    Repos: data.Repos,
    Groups: data.Groups,
  }
}

function main() {
  const repoRoot = process.argv[2] || process.cwd()
  showLintasPortfolioPlan(repoRoot, { quiet: false })
  process.exit(0)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
