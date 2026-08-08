<#
.SYNOPSIS
  install-windows.ps1 - Installer paket Claude config untuk Windows
.DESCRIPTION
  Menyalin file paket ke %USERPROFILE%\.claude\ dengan backup otomatis
  bila file tujuan sudah ada (format .backup-yyyyMMdd-HHmmss).
.PARAMETER DryRun
  Hanya tampilkan rencana aksi tanpa menyalin/menghapus file apapun.
.PARAMETER Force
  Lewati prompt konfirmasi saat ada file existing yang akan ditimpa.
.NOTES
  Versi  : 1.1
  Tanggal: 2026-05-30
  Run    : powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
  Catatan: Kompatibel PowerShell 5.1 (tanpa operator && / ||).
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# ---- Cek versi PowerShell ----
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Host "ERROR: Script ini butuh PowerShell 5.1+. Versi kamu: $($PSVersionTable.PSVersion)" -ForegroundColor Red
    exit 1
}

# ---- Konfigurasi dasar ----
$ClaudeDir = Join-Path $env:USERPROFILE '.claude'
$TemplatesDir = Join-Path $ClaudeDir 'templates'
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

# Tentukan folder script (guard kalau dijalankan via Invoke-Expression / pipe)
$ScriptDir = $null
if ($PSScriptRoot) {
    $ScriptDir = $PSScriptRoot
} elseif ($MyInvocation.MyCommand.Path) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
} else {
    $ScriptDir = (Get-Location).Path
    Write-Host "PERINGATAN: Tidak bisa deteksi folder script otomatis." -ForegroundColor Yellow
    Write-Host "           Pakai folder kerja saat ini: $ScriptDir" -ForegroundColor Yellow
    Write-Host "           Pastikan kamu sudah cd ke folder paket sebelum jalankan." -ForegroundColor Yellow
    Write-Host ""
}

# Counter ringkasan
$okCount = 0
$bakCount = 0
$missCount = 0

Write-Host ""
Write-Host "=== Installer paket Claude (Windows) ===" -ForegroundColor Cyan
Write-Host "Sumber : $ScriptDir"
Write-Host "Target : $ClaudeDir"
if ($DryRun) {
    Write-Host "Mode   : SIMULASI (tidak ada file yang benar-benar disalin)" -ForegroundColor Yellow
}
Write-Host ""

# ---- Step 1 & 2: pastikan folder tujuan ada ----
function Confirm-Directory {
    param([string]$Path)
    if (Test-Path $Path) { return }
    if ($DryRun) {
        Write-Host "[DRY] Akan dibuat folder: $Path" -ForegroundColor Yellow
        return
    }
    try {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
        Write-Host "DIBUAT    $Path" -ForegroundColor Green
    } catch {
        Write-Host "GAGAL bikin folder $Path : $_" -ForegroundColor Red
        Write-Host "       Cek permission write ke $env:USERPROFILE." -ForegroundColor Red
        exit 1
    }
}

Confirm-Directory -Path $ClaudeDir
Confirm-Directory -Path $TemplatesDir

# ---- Mark-of-the-Web unblock (cegah error 'script tidak digital signed' setelah download) ----
if (-not $DryRun) {
    try {
        Get-ChildItem $ScriptDir -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue
        Write-Host "OK    Mark-of-the-Web di-unblock untuk file di folder paket." -ForegroundColor Green
    } catch {
        Write-Host "PERINGATAN: Unblock-File gagal: $_ (script tetap lanjut)" -ForegroundColor Yellow
    }
}

# ---- Step 3: mapping file source -> destination ----
# Catatan: CLAUDE_universal_v1.md di-RENAME jadi CLAUDE.md saat di-install.
# Pola A user dapat 4 aturan dokumentasi tim profesional + PROJECT_LIFECYCLE_PROMPT (kickoff/bootstrap/update/migration unified) + 3 file template (_PATTERNS, _EXAMPLE, architecture_auto).
$mapping = @(
    @{ Src = 'CLAUDE_universal_v1.md';              Dst = (Join-Path $ClaudeDir 'CLAUDE.md') },
    @{ Src = 'LINTASAI_WORKFLOWS_v1.md';            Dst = (Join-Path $ClaudeDir 'LINTASAI_WORKFLOWS_v1.md') },
    @{ Src = 'PROJECT_LIFECYCLE_PROMPT_v1.md';      Dst = (Join-Path $ClaudeDir 'PROJECT_LIFECYCLE_PROMPT_v1.md') },
    @{ Src = 'TEAM_ROLLOUT_GUIDE_v1.md';            Dst = (Join-Path $ClaudeDir 'TEAM_ROLLOUT_GUIDE_v1.md') },
    @{ Src = 'templates\architecture.md';           Dst = (Join-Path $TemplatesDir 'architecture.md') },
    @{ Src = 'templates\glossary.md';               Dst = (Join-Path $TemplatesDir 'glossary.md') },
    @{ Src = 'templates\_PATTERNS.md';              Dst = (Join-Path $TemplatesDir '_PATTERNS.md') },
    @{ Src = 'templates\_EXAMPLE.md';               Dst = (Join-Path $TemplatesDir '_EXAMPLE.md') },
    @{ Src = 'templates\architecture_auto.md';      Dst = (Join-Path $TemplatesDir 'architecture_auto.md') }
)

# Konfirmasi sekali di awal kalau ada existing file (kecuali -Force / -DryRun)
if (-not $Force -and -not $DryRun) {
    $existing = @()
    foreach ($item in $mapping) {
        if (Test-Path $item.Dst) { $existing += $item.Dst }
    }
    if ($existing.Count -gt 0) {
        Write-Host "PERHATIAN: $($existing.Count) file tujuan sudah ada dan akan ditimpa." -ForegroundColor Yellow
        Write-Host "          Backup otomatis dibuat dengan akhiran .backup-$Timestamp" -ForegroundColor Yellow
        foreach ($e in $existing) {
            Write-Host "          - $e" -ForegroundColor Yellow
        }
        Write-Host ""
        # Wrap Read-Host di try/catch - gracefully handle NonInteractive shell.
        # RECOMMENDED default = Y (lanjut install). Existing files auto-backup dengan timestamp,
        # jadi Y aman untuk staff non-programmer (intent install sudah dideklarasi via invoke script).
        # NonInteractive shell tetap default 'N' (safe) karena tidak ada user yang bisa konfirmasi.
        $answer = 'N'
        # Deteksi non-interaktif SEBELUM Read-Host. WHY: stdin = pipa terbuka TANPA data
        # (mis. dijalankan AI/CI langsung) bikin Read-Host BLOCK selamanya tanpa pernah throw,
        # jadi try/catch saja TIDAK cukup. Pakai sinyal yang sama dengan lib/popup-helpers.ps1
        # (env + [Console]::IsInputRedirected) supaya gagal-aman ke default 'N'. (audit anti-hang)
        $nonInteractive = [bool]($env:LINTASAI_NONINTERACTIVE -or $env:CLAUDECODE -or $env:CI)
        if (-not $nonInteractive) {
            try { if ([Console]::IsInputRedirected) { $nonInteractive = $true } } catch { $null = $_ }
        }
        if ($env:LINTASAI_INTERACTIVE) { $nonInteractive = $false }  # escape-hatch: human Git Bash paksa prompt
        if ($nonInteractive) {
            Write-Host "INFO: Sesi non-interaktif terdeteksi. Install tidak dilanjutkan (default aman)." -ForegroundColor Yellow
            Write-Host "      Pakai -Force kalau memang mau timpa, atau jalankan di PowerShell window." -ForegroundColor Yellow
            $answer = 'N'
        } else {
            try {
                $answer = Read-Host "Lanjut install? (Y/N) [RECOMMENDED default: Y - lanjut install, existing files auto-backup]"
                if ([string]::IsNullOrWhiteSpace($answer)) { $answer = 'Y' }
            } catch {
                Write-Host "INFO: Shell NonInteractive terdeteksi. Install tidak dilanjutkan (default safe)." -ForegroundColor Yellow
                Write-Host "      Pakai -Force kalau memang mau timpa, atau jalankan di PowerShell window." -ForegroundColor Yellow
                $answer = 'N'
            }
        }
        if ($answer -notmatch '^[Yy]') {
            Write-Host "Dibatalkan oleh user. Tidak ada file yang diubah." -ForegroundColor Yellow
            exit 0
        }
        Write-Host ""
    }
}

foreach ($item in $mapping) {
    $srcPath = Join-Path $ScriptDir $item.Src
    $dstPath = $item.Dst
    $label   = $item.Src

    # Source hilang -> tandai MISSING
    if (-not (Test-Path $srcPath)) {
        Write-Host "MISSING   $label  (tidak ditemukan di folder paket)" -ForegroundColor Red
        $missCount++
        continue
    }

    # Dry-run: cuma log rencana
    if ($DryRun) {
        if (Test-Path $dstPath) {
            Write-Host "[DRY] BACKUP  $dstPath  ->  $dstPath.backup-$Timestamp" -ForegroundColor Yellow
            Write-Host "[DRY] INSTALL $label  ->  $dstPath" -ForegroundColor Yellow
        } else {
            Write-Host "[DRY] INSTALL $label  ->  $dstPath" -ForegroundColor Yellow
        }
        continue
    }

    # Destination sudah ada -> backup dulu (pakai .backup-<ts>, bukan .bak)
    if (Test-Path $dstPath) {
        $bakPath = "$dstPath.backup-$Timestamp"
        try {
            Copy-Item -Path $dstPath -Destination $bakPath -Force
            Write-Host "BACKUP    $dstPath  ->  $bakPath" -ForegroundColor Yellow
            $bakCount++
        } catch {
            Write-Host "GAGAL backup $dstPath -> $bakPath : $_" -ForegroundColor Red
            $missCount++
            continue
        }
    }

    # Copy source ke destination (overwrite kalau perlu)
    try {
        Copy-Item -Path $srcPath -Destination $dstPath -Force
        Write-Host "OK        $label  ->  $dstPath" -ForegroundColor Green
        $okCount++
    } catch {
        Write-Host "GAGAL copy $label : $_" -ForegroundColor Red
        $missCount++
    }
}

# ---- Step 4: ringkasan & panduan ----
Write-Host ""
Write-Host "=== Ringkasan ===" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "Mode SIMULASI: tidak ada file yang benar-benar disalin." -ForegroundColor Yellow
    Write-Host "Jalankan ulang tanpa -DryRun untuk eksekusi sungguhan." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

$totalSrc = $mapping.Count
Write-Host ("Total file di paket : {0}" -f $totalSrc)            -ForegroundColor Cyan
Write-Host ("Ter-install         : {0}" -f $okCount)             -ForegroundColor Green
Write-Host ("Di-backup (timpa)   : {0}" -f $bakCount)            -ForegroundColor Yellow
Write-Host ("Missing/error       : {0}" -f $missCount)           -ForegroundColor Red
Write-Host ""

Write-Host "Langkah berikutnya:" -ForegroundColor Cyan
Write-Host "  1. Buka folder $ClaudeDir untuk memastikan file ter-install."
Write-Host "  2. File backup berakhiran .backup-$Timestamp adalah salinan file lama;"
Write-Host "     hapus kalau sudah yakin install ini OK."
Write-Host "  3. Buka project pakai Claude Code -> CLAUDE.md akan otomatis ter-load."
Write-Host "     Verifikasi dengan buka langsung file $ClaudeDir\CLAUDE.md,"
Write-Host "     atau tanya AI: 'Kamu baca aturan global dari file apa?'"
Write-Host "  4. Baca README untuk cara pakai PROJECT_LIFECYCLE_PROMPT_v1.md"
Write-Host "     (Stage 1 (Proyek Baru): Kickoff / Stage 2 (Bikin Catatan Proyek): Bootstrap Docs / Stage 3 (Perbarui Catatan): Update Docs / Stage 4 (Rapikan ke Standar Tim): Migration)."
Write-Host ""

if ($missCount -gt 0) {
    Write-Host ("PERINGATAN: {0} file ter-install, {1} file gagal/missing." -f $okCount, $missCount) -ForegroundColor Red
    Write-Host "           Install partial -- cek pesan MISSING/GAGAL di atas," -ForegroundColor Red
    Write-Host "           lalu jalankan ulang setelah file lengkap." -ForegroundColor Red
    exit 1
}

Write-Host "Selesai. Selamat ngoding!" -ForegroundColor Green
exit 0
