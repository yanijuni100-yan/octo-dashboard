<#
.SYNOPSIS
    Install lintasAI pre-commit hook ke .git/hooks/pre-commit.

.DESCRIPTION
    Script utility owner-level untuk men-install git pre-commit hook
    yang menjalankan fast smoke test + scan smart-char di staged PS1 files.

    Pre-commit hook akan menolak commit kalau:
      1. tests/smoke-fast.ps1 gagal (exit != 0)
      2. Ada smart chars (em-dash, smart quotes) di staged .ps1 files

.USAGE
    # Dari root repo lintasAI:
    pwsh -File tests/install-pre-commit.ps1

    # Kalau .git/hooks/ tidak ditemukan, script lapor warning + exit 1.

.WHAT-IT-CHECKS
    - tests/smoke-fast.ps1 (fast smoke harness - wajib lulus)
    - Smart characters di staged .ps1:
        U+2014 (em-dash), U+2013 (en-dash)
        U+201C/U+201D (curly double-quotes)
        U+2018/U+2019 (curly single-quotes)

.BYPASS
    Untuk emergency commit (mis. hotfix prod), gunakan:

        git commit --no-verify -m "emergency: ..."

    PERINGATAN: --no-verify skip semua hook. Pakai HANYA saat darurat,
    dan segera follow-up dengan commit normal yang lulus hook.

.NOTES
    Versi: 1
    Tanggal: 2026-06-07
    Author: lintasAI kit
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

# Resolve repo root (script ada di tests/, root = ../)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$hooksDir = Join-Path $repoRoot '.git\hooks'
$hookFile = Join-Path $hooksDir 'pre-commit'

Write-Host "[install-pre-commit] Repo root : $repoRoot"
Write-Host "[install-pre-commit] Hooks dir : $hooksDir"

# Verify .git/hooks/ exists
if (-not (Test-Path $hooksDir)) {
    Write-Warning "[install-pre-commit] .git/hooks/ tidak ditemukan di $hooksDir."
    Write-Warning "[install-pre-commit] Pastikan kamu run dari root repo git, atau jalankan 'git init' dulu."
    exit 1
}

# Pre-commit hook content (bash - works on Linux/Mac/Git-Bash di Windows)
$hookContent = @'
#!/bin/bash
# Pre-commit hook: lintasAI fast smoke
set -e
echo "[pre-commit] Running fast smoke..."
pwsh -File tests/smoke-fast.ps1 || { echo "[pre-commit] Fast smoke FAILED. Fix errors before commit."; exit 1; }

# Check smart chars in staged PS1
staged=$(git diff --cached --name-only --diff-filter=ACM | grep -E "\.ps1$" || true)
if [ -n "$staged" ]; then
    for f in $staged; do
        if grep -P "[\x{2014}\x{2013}\x{201C}\x{201D}\x{2018}\x{2019}]" "$f" >/dev/null 2>&1; then
            echo "[pre-commit] ERROR: smart chars in $f. Replace with ASCII before commit."
            exit 1
        fi
    done
fi

echo "[pre-commit] All checks PASSED"
'@

# Write hook with LF line-endings (bash requires LF, bukan CRLF)
$hookContentLf = $hookContent -replace "`r`n", "`n"
[System.IO.File]::WriteAllText($hookFile, $hookContentLf, [System.Text.UTF8Encoding]::new($false))

Write-Host "[install-pre-commit] Hook written : $hookFile"

# Make executable (chmod +x equivalent - git-for-windows respects this)
# Pada Windows native, executable bit di-track via git index, bukan filesystem.
# Tetap try-set, ignore kalau gagal (Windows tanpa WSL/MSYS).
try {
    if ($IsLinux -or $IsMacOS) {
        & chmod +x $hookFile
        Write-Host "[install-pre-commit] chmod +x applied"
    } else {
        # Windows: executable bit handled by Git-for-Windows defaults; no chmod needed.
        Write-Host "[install-pre-commit] Windows detected - executable bit di-handle Git untuk Windows secara default."
    }
} catch {
    Write-Warning "[install-pre-commit] Gagal set executable bit: $($_.Exception.Message). Hook tetap akan jalan via Git-Bash."
}

Write-Host ""
Write-Host "[install-pre-commit] DONE. Pre-commit hook aktif."
Write-Host "[install-pre-commit] Test cepat: git commit --allow-empty -m 'test pre-commit hook'"
Write-Host "[install-pre-commit] Bypass darurat: git commit --no-verify -m '...'"
