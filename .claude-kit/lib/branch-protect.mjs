#!/usr/bin/env node
// lib/branch-protect.mjs - Deteksi apakah branch utama (main) di GitHub ter-protect.
//
// GELOMBANG 4/5 (ADR-004): padanan Node dari Test-MainBranchProtected (inline di setup-pola-b.ps1).
// Dipakai pemasang di RINGKASAN AKHIR untuk memberi panduan commit yang tepat: kalau main
// ter-protect -> arahkan pakai branch + PR; kalau tidak -> commit langsung boleh.
//
// CUMA-BACA + best-effort: hanya memanggil `gh`/`git` (tanpa mengubah apa pun). Kalau gh tak ada
// / tak ada remote / bukan GitHub -> kembalikan Protected=null (tak bisa deteksi, anggap aman:
// pemasang menyarankan cek manual). Mencerminkan Test-MainBranchProtected PS persis (string alasan
// disalin). CATATAN: gh dijalankan dengan cwd=projectRoot (sedikit lebih benar dari PS yang
// mengandalkan CWD proses; git tetap pakai -C seperti PS).
import { spawnSync } from 'node:child_process'

function run(cmd, args, cwd) {
  try {
    const r = spawnSync(cmd, args, { encoding: 'utf8', cwd, timeout: 20000 })
    return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), spawnError: r.error }
  } catch (e) {
    return { code: null, out: '', err: e.message, spawnError: e }
  }
}

// Cermin Get-Command gh: cek gh tersedia (probe --version, exit 0 = ada).
function hasGh() {
  const r = run('gh', ['--version'])
  return !r.spawnError && r.code === 0
}

// Return: { Protected: true|false|null, Reason: string, DefaultBranch: string }
//   Protected=null artinya tak bisa deteksi (gh tak ada / tak login / no remote).
export function testMainBranchProtected(projectRoot) {
  const result = { Protected: null, Reason: 'unknown', DefaultBranch: 'main' }

  if (!hasGh()) {
    result.Reason = 'gh CLI tidak terinstall (skip detect, asumsikan unprotected)'
    return result
  }

  // Repo dengan remote GitHub?
  const remote = run('git', ['-C', projectRoot, 'remote', 'get-url', 'origin'])
  if (remote.code !== 0 || !remote.out) {
    result.Reason = 'no git remote (local-only repo)'
    return result
  }
  if (!/github\.com/.test(remote.out)) {
    result.Reason = 'remote bukan GitHub (skip branch protection check)'
    return result
  }

  // Default branch via gh.
  const repoView = run('gh', ['repo', 'view', '--json', 'defaultBranchRef'], projectRoot)
  if (repoView.code === 0 && repoView.out) {
    try {
      const j = JSON.parse(repoView.out)
      if (j && j.defaultBranchRef && j.defaultBranchRef.name) result.DefaultBranch = j.defaultBranchRef.name
    } catch (e) { /* pakai default 'main' */ }
  }

  // Probe endpoint branch protection.
  const prot = run('gh', ['api', `repos/{owner}/{repo}/branches/${result.DefaultBranch}/protection`], projectRoot)
  if (prot.code === 0) {
    result.Protected = true
    result.Reason = `Branch '${result.DefaultBranch}' is protected (PR required)`
  } else {
    result.Protected = false
    result.Reason = `Branch '${result.DefaultBranch}' unprotected (direct commit allowed)`
  }
  return result
}
