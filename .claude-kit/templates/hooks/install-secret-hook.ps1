<#
.SYNOPSIS
  Pasang lintasAI pre-commit secret guard ke .git/hooks/pre-commit (opt-in, shift-left).

.DESCRIPTION
  Menyalin pre-commit-secret-scan.sh ke .git/hooks/pre-commit project supaya rahasia
  (file .env asli / kunci API) tertangkap DI LAPTOP sebelum ter-commit + terkirim ke server.

  Aman terhadap hook existing:
    - Sudah hook kita (ada marker)  -> idempotent, tidak diubah (lapor 'current').
    - Hook lain (mis. dipasang tool lain) -> DICADANGKAN ke pre-commit.backup-<timestamp>
      lalu hook kita dipasang. TIDAK digabung otomatis -- gabungkan manual kalau perlu.
  Ditulis dengan akhir-baris LF (bash rusak kalau CRLF).

.PARAMETER ProjectRoot
  Root project (folder yang berisi .git/). Default = folder saat ini.

.NOTES
  Versi: 1 - 2026-06-17 - lintasAI kit. Lewati 1x saat darurat: git commit --no-verify
#>
[CmdletBinding()]
param(
    [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'

$hooksDir = Join-Path $ProjectRoot '.git\hooks'
if (-not (Test-Path -LiteralPath $hooksDir)) {
    Write-Warning "[penjaga-rahasia] .git/hooks/ tidak ditemukan di '$hooksDir'."
    Write-Warning "[penjaga-rahasia] Jalankan dari root project git, atau 'git init' dulu."
    exit 1
}

$src = Join-Path $PSScriptRoot 'pre-commit-secret-scan.sh'
if (-not (Test-Path -LiteralPath $src)) {
    Write-Warning "[penjaga-rahasia] Sumber hook tidak ada: '$src'."
    exit 1
}

$target = Join-Path $hooksDir 'pre-commit'
$marker = 'lintasAI pre-commit secret guard'

# Baca sumber + paksa LF (bash tidak menerima CRLF di shebang).
$hookText = (Get-Content -LiteralPath $src -Raw) -replace "`r`n", "`n"

if (Test-Path -LiteralPath $target) {
    $cur = Get-Content -LiteralPath $target -Raw
    if ($cur -match [regex]::Escape($marker)) {
        Write-Host "[penjaga-rahasia] Sudah terpasang (current) - tidak ada perubahan."
        exit 0
    }
    $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backup = "$target.backup-$ts"
    Copy-Item -LiteralPath $target -Destination $backup -Force
    Write-Warning "[penjaga-rahasia] Sudah ada pre-commit hook lain -> dicadangkan ke '$backup'."
    Write-Warning "[penjaga-rahasia] Hook lama TIDAK digabung otomatis. Gabungkan manual kalau masih perlu."
}

[System.IO.File]::WriteAllText($target, $hookText, (New-Object System.Text.UTF8Encoding $false))

# Beri izin jalan (Linux/Mac). Di Windows, Git untuk Windows menjalankan hook via Git-Bash
# tanpa butuh bit executable filesystem.
try {
    if ($IsLinux -or $IsMacOS) { & chmod +x $target }
} catch {
    Write-Warning "[penjaga-rahasia] Gagal set executable bit: $($_.Exception.Message). Hook tetap jalan via Git-Bash."
}

Write-Host "[penjaga-rahasia] Terpasang: $target"
Write-Host "[penjaga-rahasia] Uji cepat: stage file .env palsu lalu 'git commit' -> harus DITOLAK."
Write-Host "[penjaga-rahasia] Lewati 1x saat darurat/alarm-palsu: git commit --no-verify"
