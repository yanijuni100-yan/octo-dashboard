<#
.SYNOPSIS
  setup-pola-b.ps1 - Setup Pola B di root proyek (kit embed sebagai subfolder)
.DESCRIPTION
  Asumsi: kamu sudah extract zip kit ini jadi <proyek>\.claude-kit\, lalu jalanin
  script ini dari folder <proyek>\.claude-kit\.

  Script ini ORCHESTRATOR - heavy-lifting di delegate ke lib/*.ps1:
    - lib\manifest.ps1          : Initialize/Add/Save manifest (.install-manifest.json)
    - lib\template-deploy.ps1   : Copy template + placeholder substitution
    - lib\git-helpers.ps1       : Strip .git + Unblock MOTW
    - lib\agents-md.ps1         : Deploy AGENTS.md (template fill + backup)
    - lib\version-detect.ps1    : Parse versi kit dari CHANGELOG.md
    - lib\manifest-signing.ps1  : HMAC sign manifest (loaded via Save-Manifest)
    - lib\safety.ps1            : Path safety helpers

  Tugas orchestrator:
    1. Project root validation + nested-extract detection
    2. Interactive prompts (popup CLAUDE.md, nama, repo, AGENTS.md overwrite)
    3. Verifikasi file inti kit ada (via lib\kit-files.psd1)
    4. Call lib functions untuk actual deploy
    5. Final summary report

  TIDAK install ke ~/.claude/ (itu Pola Global, pakai install-windows.ps1).
.PARAMETER Force
  Timpa AGENTS.md yang sudah ada (backup otomatis ke .backup-<timestamp>).
  Saat -Force aktif, prompt opsional Nama/URL repo di-skip (placeholder default dipakai).
.PARAMETER DryRun
  Tampilkan rencana aksi tanpa nulis/copy file apapun.
.NOTES
  Versi  : 2.0 (orchestrator refactor, 2026-06-06)
  Run    : powershell -ExecutionPolicy Bypass -File .\setup-pola-b.ps1
  Atau   : cd <proyek>\.claude-kit; .\setup-pola-b.ps1
  Lebih ringkas: .\.claude-kit\kit.ps1 setup
#>

[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$DryRun,
    [switch]$SkipTeamFiles,
    [switch]$NoGui,
    [string]$ProjectRoot = $null
)

$ErrorActionPreference = 'Stop'

# Aktifkan StrictMode EKSPLISIT dari awal (bukan numpang "bocoran" dari lib\manifest.ps1
# yang di-dot-source belakangan). Bikin perilaku deterministik & tidak bergantung urutan
# muat file: akses variable yang belum di-set langsung ketahuan, bukan diam-diam jadi $null.
Set-StrictMode -Version Latest

# ---- Track user-skipped steps (Trace #1 graceful-cancel summary) ----
# Populated saat user cancel popup / Read-Host (CLAUDE.md choice, AGENTS.md choice,
# git identity input, VS Code launch). Dipakai di final summary supaya user tahu
# step mana yang di-skip vs di-execute. List kosong = full setup tanpa skip.
$script:__lintasAI_SkippedSteps = @()

# ---- In-session idempotency flag for git identity block (BUG 1 defense in depth) ----
# Mencegah popup git identity muncul lebih dari 1x per proses PowerShell, terutama
# saat setup di-dot-source / re-import library / re-run via update-kit.ps1.
# Primary fix tetap: read scope harus sama dengan write scope (lihat block (a) di bawah).
if (-not (Get-Variable -Name '__lintasAI_GitIdentityHandled' -Scope Script -ErrorAction SilentlyContinue)) {
    $script:__lintasAI_GitIdentityHandled = $false
}

# ---- v1.5.6 Fix #3: Test-MainBranchProtected helper ----
# Detect kalau branch `main` (atau default branch) di GitHub di-protect.
# Returns: PSCustomObject @{ Protected=$true|$false|$null; Reason='...'; DefaultBranch='main' }
# Protected = $null artinya tidak bisa detect (gh missing / tidak login / no remote).
function Test-MainBranchProtected {
    param([string]$ProjectRoot)

    $result = [PSCustomObject]@{
        Protected     = $null
        Reason        = 'unknown'
        DefaultBranch = 'main'
    }

    # Cek gh CLI tersedia.
    $ghCmd = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $ghCmd) {
        $result.Reason = 'gh CLI tidak terinstall (skip detect, asumsikan unprotected)'
        return $result
    }

    # Cek apakah ini repo dengan remote GitHub.
    try {
        $remoteUrl = & git -C $ProjectRoot remote get-url origin 2>$null
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($remoteUrl)) {
            $result.Reason = 'no git remote (local-only repo)'
            return $result
        }
        if ($remoteUrl -notmatch 'github\.com') {
            $result.Reason = 'remote bukan GitHub (skip branch protection check)'
            return $result
        }
    } catch {
        $result.Reason = "git remote check failed: $($_.Exception.Message)"
        return $result
    }

    # Detect default branch via gh.
    try {
        $repoInfo = & gh repo view --json defaultBranchRef 2>$null | ConvertFrom-Json
        if ($repoInfo.defaultBranchRef.name) {
            $result.DefaultBranch = $repoInfo.defaultBranchRef.name
        }
    } catch {
        # Pakai default 'main' kalau gh repo view gagal (gh not installed / not authenticated / remote not GitHub).
        $null = $_
    }

    # Probe branch protection endpoint.
    try {
        $null = & gh api "repos/{owner}/{repo}/branches/$($result.DefaultBranch)/protection" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $result.Protected = $true
            $result.Reason    = "Branch '$($result.DefaultBranch)' is protected (PR required)"
        } else {
            $result.Protected = $false
            $result.Reason    = "Branch '$($result.DefaultBranch)' unprotected (direct commit allowed)"
        }
    } catch {
        $result.Protected = $false
        $result.Reason    = "Protection probe failed (assume unprotected): $($_.Exception.Message)"
    }

    return $result
}

# ---- Resolve folder kit (tempat script ini berada) ----
$KitDir = if ($PSScriptRoot) { $PSScriptRoot } elseif ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { (Get-Location).Path }

# ---- Dot-source popup-helpers (Pass 2: GUI popup helpers for interactive prompts) ----
# Loaded EARLY (before main lib block) so Test-LintasGuiAvailable / Show-Lintas* available
# throughout setup flow. Fail-fast: missing file = critical (popup-helpers gates AGENTS.md
# choice prompt + VS Code launch UX in headed mode).
$popupHelpersPath = Join-Path $KitDir 'lib/popup-helpers.ps1'
try {
    if (-not (Test-Path $popupHelpersPath)) {
        throw "lib/popup-helpers.ps1 tidak ditemukan di $popupHelpersPath. Extract ulang zip kit."
    }
    . $popupHelpersPath
} catch {
    Write-Host "ERROR: Gagal load lib/popup-helpers.ps1: $_" -ForegroundColor Red
    Write-Host "       Setup butuh helper popup untuk interactive prompts. Extract ulang kit." -ForegroundColor Red
    exit 1
}

# ---- Detect headless mode (no GUI) ----
# $NoGui param force console mode. Auto-detect headless via Test-LintasGuiAvailable
# (assemblies load + UserInteractive true = GUI; else = headless / Server Core / SSH).
$useConsoleMode = $false
$isHeadless = -not (Test-LintasGuiAvailable)
# BUG FIX (v1.26.1): when launched by an AI tool / CI runner, stdin is an OPEN PIPE
# with no data (not EOF, not -NonInteractive). In that state Read-Host BLOCKS forever
# (it never throws, so the try/catch fallbacks below never fire) AND the GUI popup
# path (ShowDialog) would also block with no human to click. Test-LintasInteractiveInput
# returns $false in that case (via [Console]::IsInputRedirected + env signals). We FORCE
# console mode so we never enter the blocking GUI path, and EACH Read-Host below is gated
# by $script:__lintasAI_NonInteractive to skip the prompt and use a safe default.
$script:__lintasAI_NonInteractive = -not (Test-LintasInteractiveInput)
if ($NoGui -or $isHeadless -or $script:__lintasAI_NonInteractive) {
    $useConsoleMode = $true
}
if ($script:__lintasAI_NonInteractive) {
    Write-Host "INFO: Mode non-interaktif terdeteksi (tidak ada keyboard manusia / dijalankan otomatis oleh AI/CI)." -ForegroundColor Yellow
    Write-Host "      Semua pertanyaan akan dilewati pakai nilai default yang aman." -ForegroundColor Yellow
}

# ---- Resolve ProjectRoot (npm wrapper vs traditional invocation) ----
# Traditional: kit lives at <project>/.claude-kit/, $ProjectRoot = parent of $KitDir.
# NPX wrapper: $ProjectRoot passed explicitly; kit source at $KitDir (npm cache) must
#              be COPIED to $ProjectRoot/.claude-kit/ before setup continues.
$script:__lintasAI_NpxMode = $false
if (-not $ProjectRoot) {
    # Traditional invocation - kit lives at <project>/.claude-kit/, parent is project
    $ProjectRoot = Split-Path -Parent $KitDir
} else {
    # NPX wrapper invocation - $ProjectRoot passed explicitly
    Write-Host "[npx] Mode: explicit ProjectRoot = $ProjectRoot" -ForegroundColor Cyan
    $script:__lintasAI_NpxMode = $true
}
$ProjectRoot = (Resolve-Path $ProjectRoot -ErrorAction Stop).Path

# ---- NPX mode: copy kit from $KitDir (npm cache) to $ProjectRoot/.claude-kit/ ----
# Detection: if $KitDir is NOT already inside $ProjectRoot/.claude-kit/, we need to copy.
$expectedKitDir = Join-Path $ProjectRoot '.claude-kit'
$kitDirResolved = (Resolve-Path $KitDir -ErrorAction Stop).Path
# Path normalization: use [System.IO.Path]::GetFullPath to handle short-name (ADMINI~1)
# vs long-name (Administrator) edge case. TrimEnd backslash + lowercase for case-insensitive compare.
$kitDirNormalized = [System.IO.Path]::GetFullPath($kitDirResolved).TrimEnd('\').ToLowerInvariant()
$expectedKitDirNormalized = [System.IO.Path]::GetFullPath($expectedKitDir).TrimEnd('\').ToLowerInvariant()
if ($script:__lintasAI_NpxMode -and ($kitDirNormalized -eq $expectedKitDirNormalized)) {
    Write-Host "[npx-mode] Kit source sudah di expected location, skip copy." -ForegroundColor Cyan
} elseif ($script:__lintasAI_NpxMode) {
    Write-Host "[npx] Copy kit: $KitDir -> $expectedKitDir" -ForegroundColor Cyan
    if (-not $DryRun) {
        try {
            if (-not (Test-Path $expectedKitDir)) {
                New-Item -ItemType Directory -Path $expectedKitDir -Force | Out-Null
            }
            # Robocopy or Copy-Item: use Copy-Item for cross-platform-ish behavior
            Get-ChildItem -Path $KitDir -Force | ForEach-Object {
                $destPath = Join-Path $expectedKitDir $_.Name
                if ($_.PSIsContainer) {
                    Copy-Item -Path $_.FullName -Destination $destPath -Recurse -Force
                } else {
                    Copy-Item -Path $_.FullName -Destination $destPath -Force
                }
            }
            Write-Host "[npx] Kit copied successfully." -ForegroundColor Green
        } catch {
            # Copy gagal (AV mengunci file, path kepanjangan >260 char, folder read-only, disk penuh).
            # Tanpa pagar ini: $ErrorActionPreference='Stop' lempar stack .NET mentah ke staff non-programmer.
            Write-Host "ERROR: Gagal menyalin file kit ke $expectedKitDir" -ForegroundColor Red
            Write-Host "       Detail: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
            Write-Host "       Kemungkinan penyebab:" -ForegroundColor Yellow
            Write-Host "        - Antivirus mengunci file saat menyalin (cek log AV, lalu coba lagi)" -ForegroundColor Yellow
            Write-Host "        - Path folder kepanjangan (>260 karakter) - pindahkan proyek lebih dekat ke root drive" -ForegroundColor Yellow
            Write-Host "        - Folder/disk target read-only atau penuh" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "       Perbaiki penyebab di atas, lalu jalankan ulang: npx lintasai init" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "[SIMULASI] [npx] Akan copy kit contents dari $KitDir ke $expectedKitDir" -ForegroundColor Yellow
    }
    # Pivot $KitDir to the deployed location ONLY when copy actually happened.
    # In DryRun mode, $expectedKitDir is empty (copy skipped) - pivoting would cause
    # downstream dot-source (lib\safety.ps1) to fail with CommandNotFoundException.
    if (-not $DryRun) {
        $KitDir = $expectedKitDir
    } else {
        Write-Host "[SIMULASI] `$KitDir tetap di source location (skip pivot karena copy di-skip)" -ForegroundColor Yellow
    }
}

# ---- Dot-source library helpers (heavy-lifting) ----
# Order penting: agents-md.ps1 dot-source SEBELUM manifest.ps1.
# agents-md.ps1 punya guard `if ($script:__lintasAI_AgentsMdLoaded)` (anti-redefine).
# manifest.ps1 set `Set-StrictMode -Version Latest` yang kebawa ke caller scope -
# strict mode reject access ke variable yang belum di-set. Kalau order kebalik,
# guard agents-md crash karena `$script:__lintasAI_AgentsMdLoaded` belum ada.
$script:__lintasAI_AgentsMdLoaded = $null
# Load tiap lib file dengan existence-check + dot-source ATOMIK per file.
# TOCTOU fix: pre-check terpisah (Test-Path semua dulu, baru dot-source semua) rentan
# race condition - AV bisa quarantine file di antara scan dan load, error muncul jadi
# cryptic "The term '<path>' is not recognized" karena $ErrorActionPreference='Stop'.
# Pattern di bawah cek + load per-file dalam try/catch, jadi gap antara verifikasi dan
# eksekusi minimal (hanya 1 file scope). Catatan: popup-helpers.ps1 sengaja di-load
# on-demand di tempat lain (bukan di sini).
$libsToLoad = @(
    'lib\safety.ps1',
    'lib\agents-md.ps1',
    'lib\template-deploy.ps1',
    'lib\git-helpers.ps1',
    'lib\version-detect.ps1',
    'lib\manifest.ps1',
    'lib\json-merge-helpers.ps1',
    'lib\project-detect.ps1',
    'lib\project-manifest.ps1'
)
foreach ($lib in $libsToLoad) {
    $libPath = Join-Path $KitDir $lib
    try {
        if (-not (Test-Path -LiteralPath $libPath)) {
            throw "File tidak ditemukan: $libPath"
        }
        . $libPath
    } catch {
        Write-Host "ERROR: Gagal load file lib kit: $lib" -ForegroundColor Red
        Write-Host "       Detail: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "       Kemungkinan penyebab:" -ForegroundColor Yellow
        Write-Host "        - File hilang (extract zip tidak lengkap)" -ForegroundColor Yellow
        Write-Host "        - File di-quarantine antivirus (cek log AV)" -ForegroundColor Yellow
        Write-Host "        - File ter-hapus/ter-rename proses lain (race)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "       Extract ulang zip kit ke folder ini, lalu jalankan script lagi." -ForegroundColor Red
        exit 1
    }
}
# manifest-signing.ps1 di-load on-demand oleh Save-Manifest (lib\manifest.ps1)

# ---- Deteksi NESTED extract (zip extract jadi folder dalam folder) ----
# Skenario: Windows Explorer "Extract All" sering bikin .claude-kit\<kit-folder>\...
$kitFolderName = Split-Path -Leaf $KitDir
$parentDir = Split-Path -Parent $KitDir
$parentFolderName = Split-Path -Leaf $parentDir

# Nested kalau PARENT folder bernama '.claude-kit' (apapun nama folder-dalam) - INCLUDING
# kasus folder-dalam JUGA bernama '.claude-kit' (.claude-kit/.claude-kit). Klausa lama
# "$kitFolderName -ne '.claude-kit'" bikin kasus double-.claude-kit lolos = blind spot
# (aturan ter-tulis di tempat salah, gagal diam-diam).
if ($parentFolderName -eq '.claude-kit') {
    Write-Host "DETEKSI: Kit ter-ekstrak BERSARANG (folder di dalam folder) - script ada di '$kitFolderName' di dalam '.claude-kit'." -ForegroundColor Yellow
    Write-Host "        Ini biasa terjadi kalau membuka zip pakai Windows Explorer (tombol Extract All)." -ForegroundColor Yellow
    Write-Host ""

    if (-not $Force -and -not $DryRun) {
        # Wrap Read-Host di try/catch - gracefully handle NonInteractive shell.
        # Default ke 'N' (abort, jangan auto-flatten destruktif tanpa user consent).
        $autoFix = 'N'
        if ($script:__lintasAI_NonInteractive) {
            # Tanpa keyboard manusia: JANGAN tanya, JANGAN auto-flatten (operasi ini
            # menghapus folder). Pertahankan struktur lama = pilihan paling aman.
            Write-Host "INFO: Mode non-interaktif - auto-flatten butuh konfirmasi user, dilewati (struktur lama dipertahankan, aman)." -ForegroundColor Yellow
            Write-Host "      Jalankan di PowerShell window untuk pilih Y/N, atau pakai -Force untuk auto-yes." -ForegroundColor Yellow
        } else {
            try {
                Write-Host ""
                Write-Host "Mau aku rapikan otomatis? (pindahkan isi '$kitFolderName' ke '.claude-kit', hapus folder kosong)" -ForegroundColor Cyan
                Write-Host "Pilihan: [1] Ya, rapikan sekarang (pindahkan isi ke folder yang benar) / [2] Tidak, biarkan apa adanya (default, paling aman)"
                Write-Host "Default (Enter/kosong) -> [2] Tidak"
                $flattenChoice = Read-Host "Pilih [1] / [2]"
                if ([string]::IsNullOrWhiteSpace($flattenChoice) -or $flattenChoice -eq '2') {
                    $autoFix = 'N'
                } elseif ($flattenChoice -eq '1') {
                    $autoFix = 'Y'
                } else {
                    $autoFix = 'N'
                }
            } catch {
                Write-Host "INFO: Shell NonInteractive terdeteksi. Auto-flatten butuh konfirmasi user - abort." -ForegroundColor Yellow
                Write-Host "      Jalankan di PowerShell window untuk pilih Y/N, atau pakai -Force untuk auto-yes." -ForegroundColor Yellow
                $autoFix = 'N'
            }
        }
        if ($autoFix -notmatch '^[Yy]') {
            Write-Host "Dibatalkan. Untuk fix manual:" -ForegroundColor Yellow
            Write-Host "  1. Pindahkan SEMUA isi '$KitDir' ke parent '$parentDir'." -ForegroundColor Yellow
            Write-Host "  2. Hapus folder kosong '$KitDir'." -ForegroundColor Yellow
            Write-Host "  3. Jalankan ulang setup-pola-b.ps1 dari '$parentDir\setup-pola-b.ps1'." -ForegroundColor Yellow
            exit 1
        }
    }

    if ($DryRun) {
        Write-Host "[SIMULASI] Akan flatten: pindahkan '$KitDir\*' ke '$parentDir\', hapus '$KitDir'." -ForegroundColor Yellow
        Write-Host "[SIMULASI] Setelah flatten, validasi file inti kit + setup AGENTS.md akan jalan dari '$parentDir'." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Mode SIMULASI: berhenti setelah preview nested. Jalankan ulang tanpa -DryRun untuk eksekusi sungguhan." -ForegroundColor Cyan
        exit 0
    } else {
        try {
            Write-Host "FLATTEN: $KitDir\* -> $parentDir\" -ForegroundColor Cyan
            Get-ChildItem -Path $KitDir -Force | Move-Item -Destination $parentDir -Force
            Remove-Item -Path $KitDir -Recurse -Force
            Write-Host "OK    Flatten selesai." -ForegroundColor Green
            $KitDir = $parentDir
            $kitFolderName = Split-Path -Leaf $KitDir
            Write-Host ""
        } catch {
            Write-Host "GAGAL flatten: $_" -ForegroundColor Red
            Write-Host "       Fix manual: pindahkan isi $KitDir ke parent, hapus folder kosong." -ForegroundColor Red
            $sisaFiles = Get-ChildItem -Path $KitDir -Force -ErrorAction SilentlyContinue
            if ($sisaFiles) {
                Write-Host "       File yang masih di ${KitDir}:" -ForegroundColor Yellow
                $sisaFiles | ForEach-Object { Write-Host "         $($_.Name)" -ForegroundColor Yellow }
            }
            exit 1
        }
    }
}

# ---- Validasi: kit harus berada di subfolder bernama .claude-kit ----
if ($kitFolderName -ne '.claude-kit') {
    Write-Host "PERINGATAN: Folder kit ini bernama '$kitFolderName', bukan '.claude-kit'." -ForegroundColor Yellow
    Write-Host "          Pola B mengasumsikan kit ada di '<proyek>\.claude-kit\'." -ForegroundColor Yellow
    Write-Host "          Aku tetap lanjut, tapi AGENTS.md akan rujuk path '.\$kitFolderName\'" -ForegroundColor Yellow
    Write-Host "          - kalau mau path standar, rename folder ini jadi '.claude-kit' dulu." -ForegroundColor Yellow
    Write-Host ""
}

# ---- Resolve root proyek (parent dari folder kit) ----
# NOTE: $ProjectRoot sudah di-resolve di atas (param eksplisit atau Split-Path -Parent $KitDir).
# Re-derive di sini HANYA kalau belum di-set (defensif). Skip kalau npx mode (sudah eksplisit).
if (-not $ProjectRoot) {
    $ProjectRoot = Split-Path -Parent $KitDir
}
$ProjectName = Split-Path -Leaf $ProjectRoot
$Today = Get-Date -Format 'yyyy-MM-dd'

# ---- Init manifest state (lib\manifest.ps1) ----
$manifestState = Initialize-Manifest -ProjectRoot $ProjectRoot

# ---- Resolve label versi kit dari CHANGELOG.md (lib\version-detect.ps1) ----
$kitChangelog = Join-Path $KitDir 'CHANGELOG.md'
$detectedVersion = Get-KitVersionFromChangelog -ChangelogPath $kitChangelog
$KitVersion = if ($detectedVersion) { $detectedVersion } else { 'pre-launch (testing)' }

# ---- Validasi: root proyek terlihat valid ----
if (-not (Test-Path $ProjectRoot)) {
    Write-Host "ERROR: Root proyek tidak ditemukan: $ProjectRoot" -ForegroundColor Red
    Write-Host "       Pastikan folder kit ini ada di dalam folder proyek." -ForegroundColor Red
    exit 1
}

# ---- v1.5.6 Fix #5: Early stack detection (HARD STOP untuk non-Node) ----
# Stop BEFORE any destructive write kalau project bukan Node.js (kit v1.x Node-only).
# Soft warn kalau stack unknown (tidak ada marker), lanjut dengan assumption Node.
if (Get-Command Get-StackType -ErrorAction SilentlyContinue) {
    $stack = Get-StackType -ProjectRoot $ProjectRoot
    Write-Host ""
    Write-Host "=== Pre-flight: Stack detection ===" -ForegroundColor Cyan
    if ($stack.StackType -eq 'unknown') {
        Write-Host "[!] Stack tidak dikenali. lintasAI v1.x optimized untuk Node.js (Next.js)." -ForegroundColor Yellow
        Write-Host "    Tidak ada marker file (package.json, pyproject.toml, go.mod, dll) terdeteksi." -ForegroundColor DarkGray
        Write-Host "    Lanjut anyway? (default kit assumption: Node.js + Next.js)" -ForegroundColor DarkGray
        # Soft warn - lanjut, tapi catat di log.
        $script:__lintasAI_SkippedSteps += 'Stack detection: unknown (assumed Node.js)'
    } elseif ($stack.IsSupported) {
        Write-Host (("OK: stack terdeteksi = {0} (dari {1})." -f $stack.StackType, ($stack.DetectedFiles -join ', '))) -ForegroundColor Green
    } else {
        # Non-Node stack detected -> HARD STOP.
        Write-Host ""
        Write-Host "[STOP] lintasAI v1.x saat ini Node.js-only." -ForegroundColor Red
        Write-Host (("       Stack terdeteksi: {0} (dari {1})" -f $stack.StackType, ($stack.DetectedFiles -join ', '))) -ForegroundColor Red
        Write-Host ""
        Write-Host "       Kit bergantung ke konvensi: package.json, lockfile npm/pnpm/yarn/bun," -ForegroundColor DarkGray
        Write-Host "       Prisma (DB), Next.js (struktur folder src/app/, src/lib/, src/components/)." -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "       Dukungan lintas-stack menyusul di v2.0+ (pantau:" -ForegroundColor DarkGray
        Write-Host "       https://github.com/ojokesusu/lintasAI/issues?q=label%3Across-stack)." -ForegroundColor DarkGray
        Write-Host ""
        Write-Host (("       Cara sementara: pasang kit di project Node lain (mis. Next.js), atau" )) -ForegroundColor DarkGray
        Write-Host (("       tunggu v2.0+ untuk stack {0}." -f $stack.StackType)) -ForegroundColor DarkGray
        exit 1
    }
}

# ---- Strip .claude-kit/.git/ (lib\git-helpers.ps1) ----
# Saat kit di-clone (bukan zip-extract), folder .git/ ikut ke project. Bersihkan
# SEKALI di awal setup. Idempotent: skip kalau folder tidak ada.
if (-not $DryRun) {
    if (-not (Remove-GitMetadata -Path $KitDir)) {
        Write-Host "WARN  Gagal hapus .claude-kit/.git/ (lihat Write-Warning di atas)" -ForegroundColor Yellow
    }
}

# ---- Mark-of-the-Web unblock (lib\git-helpers.ps1) ----
if (-not $DryRun) {
    $motwOk = Remove-MotwBlock -Path $KitDir
    if ($motwOk) {
        Write-Host "OK    Mark-of-the-Web di-unblock untuk semua file kit." -ForegroundColor Green
    } else {
        Write-Host "PERINGATAN: Unblock-File gagal (script tetap lanjut, mungkin perlu Unblock-File manual)" -ForegroundColor Yellow
    }
}

# ---- CLAUDE.md "loader" di-deploy SETELAH AGENTS.md (lihat blok "Setup CLAUDE.md loader" di bawah) ----
# Model loading (v1.5.26): Claude Code OTOMATIS membaca CLAUDE.md, BUKAN AGENTS.md. Maka aturan tim
# + override proyek dimuat lewat CLAUDE.md yang @import .claude-kit/CLAUDE_universal_v1.md + AGENTS.md.
# CLAUDE.md custom existing di-backup otomatis oleh Publish-ClaudeMd (idempotent kalau sudah loader),
# jadi tidak ada lagi prompt "biarkan/rename/batal" yang dulu keliru mengasumsikan "AGENTS.md menang".

Write-Host ""
Write-Host "=== Setup Pola B (kit embed di proyek) ===" -ForegroundColor Cyan
Write-Host "Folder kit    : $KitDir"
Write-Host "Root proyek   : $ProjectRoot"
Write-Host "Nama proyek   : $ProjectName"
Write-Host "Tanggal       : $Today"
if ($DryRun) {
    Write-Host "Mode          : SIMULASI (tidak ada file yang ditulis)" -ForegroundColor Yellow
}
Write-Host ""

# ---- Verifikasi file inti kit ada ----
# Source of truth: lib\kit-files.psd1 (single manifest, di-load semua konsumen)
$kitFilesPsd1 = Join-Path $KitDir 'lib\kit-files.psd1'
if (-not (Test-Path $kitFilesPsd1)) {
    Write-Host "ERROR: lib\kit-files.psd1 hilang. Extract ulang zip kit." -ForegroundColor Red
    exit 1
}
$kitFiles = Import-PowerShellDataFile -Path $kitFilesPsd1
# Grup 'tests' SENGAJA TIDAK diverifikasi sebagai "wajib ada": berkas tes Pester (*.Tests.ps1) = internal
# dev, dikecualikan dari paket npm (files[] !tests/*.Tests.ps1). Mewajibkannya -> "Kit tidak lengkap"
# di TIAP install/re-install npm (bug terdeteksi uji-tarball 2026-06-25). kit-files.psd1 tetap mendaftar
# semua tes (integritas DEV, dijaga install-mapping-sync.Tests.ps1). Cermin setup-pola-b.mjs.
$wajibAda = @(
    $kitFiles.core_prompts +
    $kitFiles.universal_rules +
    $kitFiles.scripts +
    $kitFiles.lib_files +
    $kitFiles.templates +
    $kitFiles.docs +
    $kitFiles.ci +
    $kitFiles.meta
) | ForEach-Object { $_ -replace '/', '\' }

$missing = @()
foreach ($f in $wajibAda) {
    $p = Join-Path $KitDir $f
    if (-not (Test-Path $p)) { $missing += $f }
}

if ($missing.Count -gt 0) {
    Write-Host "ERROR: Kit tidak lengkap. File hilang:" -ForegroundColor Red
    foreach ($f in $missing) { Write-Host "        - $f" -ForegroundColor Red }
    Write-Host ""
    Write-Host "       Extract ulang zip kit ke folder ini, lalu jalankan script lagi." -ForegroundColor Red
    exit 1
}
Write-Host ("OK    {0} file inti kit terverifikasi" -f $wajibAda.Count) -ForegroundColor Green

# ---- Deploy lib/ helper scripts (track ke manifest) ----
$libDir = Join-Path $KitDir 'lib'
if (-not (Test-Path $libDir)) {
    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $libDir -Force | Out-Null
        Add-DirToManifest -State $manifestState -DirPath $libDir
        Write-Host "CREATED $libDir\" -ForegroundColor Green
    } else {
        Write-Host "[SIMULASI] CREATE $libDir\" -ForegroundColor Yellow
    }
}
# Source of truth: lib_files dari kit-files.psd1 (sinkron dengan verifikasi di atas)
$libFiles = $kitFiles.lib_files | ForEach-Object { ($_ -replace '/', '\') -replace '^lib\\','' }
foreach ($lf in $libFiles) {
    $lfPath = Join-Path $libDir $lf
    if (Test-Path $lfPath) {
        if (-not $DryRun) {
            Add-ToManifest -State $manifestState -FilePath $lfPath -Kind 'lib' -From ('.claude-kit/lib/' + ($lf -replace '\\','/'))
            Write-Host ("OK    {0} (tracked)" -f $lfPath) -ForegroundColor Green
        } else {
            Write-Host ("[SIMULASI] TRACK {0}" -f $lfPath) -ForegroundColor Yellow
        }
    } else {
        Write-Host ("WARN  lib file tidak ditemukan: {0} (skip track)" -f $lfPath) -ForegroundColor Yellow
    }
}

# ---- Tanya optional info untuk fill placeholder ----
$ownerName = ''
$repoUrl = ''
if (-not $Force -and -not $DryRun) {
    if ($script:__lintasAI_NonInteractive) {
        Write-Host "INFO: Mode non-interaktif - prompt Nama/URL repo dilewati, pakai nilai default." -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "Optional: isi info berikut untuk pre-fill AGENTS.md (Enter = pakai default):" -ForegroundColor Cyan
        try {
            $ownerName = Read-Host ("Nama kamu (default: {0})" -f $env:USERNAME)
            $repoUrl = Read-Host "URL repo standar tim (default: 'belum-ada')"
        } catch {
            Write-Host "INFO: Shell NonInteractive terdeteksi, pakai default value." -ForegroundColor Yellow
            Write-Host "      (Jalankan setup langsung di PowerShell window kalau mau isi prompt.)" -ForegroundColor Yellow
        }
    }
}
# Default cadangan kalau kosong (skip prompt karena -Force/-DryRun, atau user tekan Enter)
if (-not $ownerName) { $ownerName = $env:USERNAME }
if (-not $repoUrl) { $repoUrl = 'belum-ada (solo project)' }

# ---- Setup AGENTS.md di root proyek (lib\agents-md.ps1) ----
$agentsTemplate = Join-Path $KitDir 'AGENTS.md.template'
$agentsTarget = Join-Path $ProjectRoot 'AGENTS.md'

# Decide preserve vs overwrite + handle interactive prompt
# Pass 2: 3-option popup (Skip / Backup+Replace / Diff) with safe default = Skip (idx 0).
# Default: 'create' kalau target belum ada (fresh install), prompt 'skip' kalau existing.
# Bug v1.4.x: default unconditional 'skip' bikin fresh install TIDAK deploy AGENTS.md.
# -Force pada AGENTS.md existing = backup-replace (sesuai .PARAMETER Force: "Timpa AGENTS.md").
# Tanpa cabang -Force ini, $agentsAction tetap 'skip' walau -Force -> dokumentasi menyesatkan
# (staff re-run dengan -Force berharap refresh, tapi diam-diam tidak terjadi).
$agentsAction = if (Test-Path $agentsTarget) {
    if ($Force) { 'backup-replace' } else { 'skip' }
} else { 'create' }
if (Test-Path $agentsTarget) {
    if (-not $Force -and -not $DryRun) {
        Write-Host ""
        Write-Host "PERHATIAN: $agentsTarget sudah ada." -ForegroundColor Yellow
        # v1.7.4: deteksi format AGENTS.md existing - lintasAI (punya marker) vs ASING (tool lain).
        # File ASING kalau di-Skip tetap ke-@import CLAUDE.md -> ikut nyetir AI + bisa bentrok aturan tim.
        # Maka: file lintasAI -> default Skip (aman); file asing -> default Backup+replace (file lama dicadangkan).
        # Pola sama dengan deteksi marker di Publish-ClaudeMd (lib/agents-md.ps1).
        $agentsIsLintasai = $false
        try {
            $existingAgents = Get-Content -LiteralPath $agentsTarget -Raw -Encoding UTF8
            if ($existingAgents -and (
                    $existingAgents.Contains('standar tim IT (Pola B)') -or
                    $existingAgents.Contains('.claude-kit/CLAUDE_universal_v1.md'))) {
                $agentsIsLintasai = $true
            }
        } catch { $agentsIsLintasai = $false }
        # Single source of truth: label + action paired per option (cegah drift antara popup & console).
        if ($agentsIsLintasai) {
            Write-Host "INFO: Terdeteksi format lintasAI - aman di-Skip." -ForegroundColor Green
            $agentsPopupMsg = "AGENTS.md ini sudah format lintasAI - Skip aman. Pilih:"
            $agentsMdOptions = @(
                @{ Index = 1; Label = "Lewati - jangan sentuh (rekomendasi, paling aman: file lama tidak diubah)"; Action = "skip" },
                @{ Index = 2; Label = "Cadangkan lalu ganti (file lama disimpan dulu)"; Action = "backup-replace" },
                @{ Index = 3; Label = "Lihat beda dulu (bandingkan isi file)"; Action = "diff" }
            )
        } else {
            Write-Host "WARN  BUKAN format lintasAI (kemungkinan file dari tool lain)." -ForegroundColor Yellow
            Write-Host "      Kalau di-Skip, aturannya ikut nyetir AI + bisa bentrok aturan tim." -ForegroundColor Yellow
            Write-Host "      Backup+replace = file lama DICADANGKAN (tidak hilang), lintasAI pasang yang benar." -ForegroundColor Yellow
            $agentsPopupMsg = "AGENTS.md ini BUKAN format lintasAI (file asing). Skip = aturan asing ikut aktif + bisa bentrok. File lama dicadangkan kalau Backup+replace. Pilih:"
            $agentsMdOptions = @(
                @{ Index = 1; Label = "Cadangkan lalu ganti - file lama dicadangkan (rekomendasi: aman, file lama disimpan + bisa dibalik)"; Action = "backup-replace" },
                @{ Index = 2; Label = "Lihat beda dulu (lihat isi file lama)"; Action = "diff" },
                @{ Index = 3; Label = "Lewati - pertahankan file asing (HATI-HATI, bisa bentrok)"; Action = "skip" }
            )
        }
        $choiceIdx = 0
        if ($useConsoleMode) {
            Write-Host "Pilih aksi:" -ForegroundColor Cyan
            foreach ($opt in $agentsMdOptions) {
                Write-Host "  [$($opt.Index)] $($opt.Label)"
            }
            $validKeys = ($agentsMdOptions | ForEach-Object { $_.Index }) -join '/'
            $rawChoice = '1'
            if ($script:__lintasAI_NonInteractive) {
                Write-Host "INFO: Mode non-interaktif. Default = 1 (pilihan paling aman / tidak mengubah)." -ForegroundColor Yellow
            } else {
                try {
                    $rawChoice = Read-Host "Pilih [$validKeys] (default: 1)"
                    if ([string]::IsNullOrWhiteSpace($rawChoice)) { $rawChoice = '1' }
                } catch {
                    Write-Host "INFO: Shell NonInteractive terdeteksi. Default = 1 (Skip)." -ForegroundColor Yellow
                    $rawChoice = '1'
                }
            }
            $matched = $agentsMdOptions | Where-Object { "$($_.Index)" -eq "$rawChoice" } | Select-Object -First 1
            if ($matched) {
                $choiceIdx = $agentsMdOptions.IndexOf($matched)
            } else {
                $choiceIdx = 0
            }
        } else {
            try {
                $popupArgs = @{
                    Title        = "AGENTS.md sudah ada"
                    Message      = $agentsPopupMsg
                    Options      = ($agentsMdOptions | ForEach-Object { $_.Label })
                    DefaultIndex = 0
                }
                $choiceIdx = Show-LintasChoicePopup @popupArgs
            } catch {
                Write-Host "WARN  Popup gagal tampil ($_). Fallback ke default Skip." -ForegroundColor Yellow
                Write-Host "INFO: GUI degraded - sisa prompt akan pakai console mode." -ForegroundColor Yellow
                $script:useConsoleMode = $true
                $useConsoleMode = $true
                $choiceIdx = 0
            }
            if ($choiceIdx -lt 0) {
                Write-Host "INFO: User cancel popup. Default = Skip (safe)." -ForegroundColor Yellow
                $choiceIdx = 0
                $script:__lintasAI_SkippedSteps += 'AGENTS.md choice (cancel popup -> Skip default)'
            }
        }
        # Map choice index -> action via struct (no separate switch needed)
        if ($choiceIdx -ge 0 -and $choiceIdx -lt $agentsMdOptions.Count) {
            $agentsAction = $agentsMdOptions[$choiceIdx].Action
        } else {
            $agentsAction = 'skip'
        }
        if ($agentsAction -eq 'skip') {
            Write-Host "INFO: AGENTS.md di-skip - lanjut setup git identity + settings.local.json + VS Code launch." -ForegroundColor Cyan
            $script:__lintasAI_SkippedSteps += 'AGENTS.md (user pilih Skip, existing file preserved)'
        } elseif ($agentsAction -eq 'diff') {
            Write-Host ""
            Write-Host "DIFF: AGENTS.md existing vs template baru" -ForegroundColor Cyan
            try {
                $existingContent = Get-Content -LiteralPath $agentsTarget -Raw
                $templateContent = Get-Content -LiteralPath $agentsTemplate -Raw
                Compare-Object -ReferenceObject ($existingContent -split "\r?\n") -DifferenceObject ($templateContent -split "\r?\n") |
                    Format-Table -AutoSize | Out-Host
            } catch {
                Write-Host "WARN  Gagal diff: $_" -ForegroundColor Yellow
            }
            Write-Host "Setup berhenti - merge manual dulu, lalu jalankan ulang dengan -Force kalau mau timpa." -ForegroundColor Yellow
            exit 0
        }
        # else: backup-replace -> fall through to Publish-AgentsMd (auto-backup built-in)
    }
}

# Build placeholder set (shared dengan docs/ templates di bawah)
$agentsPlaceholders = @{
    '<NAMA_PROYEK>'      = $ProjectName
    '<TANGGAL_HARI_INI>' = $Today
    '<NAMA_KAMU>'        = $ownerName
    '<URL_REPO_STANDAR>' = $repoUrl
    '<VERSI_KIT>'        = $KitVersion
}

if ($DryRun) {
    Write-Host "[SIMULASI] DEPLOY AGENTS.md (template fill + backup kalau existing)" -ForegroundColor Yellow
    Write-Host "[SIMULASI] Placeholders: NAMA_PROYEK='$ProjectName', TANGGAL_HARI_INI='$Today', VERSI_KIT='$KitVersion'" -ForegroundColor Yellow
} elseif ($agentsAction -eq 'skip') {
    # User pilih Skip (RECOMMENDED) - AGENTS.md existing tidak di-deploy template baru.
    Write-Host "SKIP  Publish-AgentsMd (user pilih Skip - existing AGENTS.md preserved)" -ForegroundColor Yellow
} else {
    try {
        $deployResult = Publish-AgentsMd `
            -ProjectRoot $ProjectRoot `
            -TemplatePath $agentsTemplate `
            -Placeholders $agentsPlaceholders
        # Track backup ke manifest kalau ada
        if ($deployResult.backup_path) {
            Add-ToManifest -State $manifestState -FilePath $deployResult.backup_path -Kind 'backup' -From 'AGENTS.md (pre-Force backup)'
            Write-Host "BACKUP $agentsTarget -> $($deployResult.backup_path)" -ForegroundColor Yellow
        }
        Add-ToManifest -State $manifestState -FilePath $deployResult.target_path -Kind 'filled_template' -From 'AGENTS.md.template'
        Write-Host "OK    $($deployResult.target_path)" -ForegroundColor Green
        $filled = "NAMA_PROYEK='$ProjectName', TANGGAL_HARI_INI='$Today', NAMA_KAMU='$ownerName', URL_REPO_STANDAR='$repoUrl', VERSI_KIT='$KitVersion'"
        Write-Host "      Pre-filled: $filled" -ForegroundColor Green
    } catch {
        Write-Host "GAGAL deploy AGENTS.md: $_" -ForegroundColor Red
        exit 1
    }
}

# ---- Setup CLAUDE.md loader di root proyek (auto-loaded Claude Code) ----
# CLAUDE.md ini @import .claude-kit/CLAUDE_universal_v1.md (aturan tim) + AGENTS.md (override proyek).
# Bikin aturan ter-load MEKANIS tiap sesi (Claude Code auto-load CLAUDE.md, BUKAN AGENTS.md).
$claudeTemplate = Join-Path $KitDir 'CLAUDE.md.template'
if ($DryRun) {
    Write-Host "[SIMULASI] DEPLOY CLAUDE.md loader (@import .claude-kit/CLAUDE_universal_v1.md + AGENTS.md)" -ForegroundColor Yellow
} elseif (-not (Test-Path $claudeTemplate)) {
    Write-Host "WARN  CLAUDE.md.template tidak ada di kit - skip deploy loader (aturan mungkin tidak auto-load)." -ForegroundColor Yellow
} else {
    try {
        $claudeResult = Publish-ClaudeMd `
            -ProjectRoot $ProjectRoot `
            -TemplatePath $claudeTemplate `
            -Placeholders @{ '<NAMA_PROYEK>' = $ProjectName }
        if ($claudeResult.action -eq 'current') {
            Write-Host "OK    CLAUDE.md loader sudah terpasang (idempotent, tidak diubah)." -ForegroundColor Green
        } else {
            if ($claudeResult.backup_path) {
                Add-ToManifest -State $manifestState -FilePath $claudeResult.backup_path -Kind 'backup' -From 'CLAUDE.md (custom, pre-loader backup)'
                Write-Host "BACKUP CLAUDE.md custom -> $($claudeResult.backup_path)" -ForegroundColor Yellow
            }
            Add-ToManifest -State $manifestState -FilePath $claudeResult.target_path -Kind 'filled_template' -From 'CLAUDE.md.template'
            Write-Host "OK    $($claudeResult.target_path) (pemuat aturan tim - otomatis dibaca Claude Code)" -ForegroundColor Green
        }
    } catch {
        Write-Host "WARN  Gagal deploy CLAUDE.md loader: $_" -ForegroundColor Yellow
        Write-Host "      AGENTS.md tetap ada; loader bisa dibuat manual (CLAUDE.md berisi 2 baris @import)." -ForegroundColor Yellow
    }
}

# ---- Bootstrap docs/ skeleton ----
$docsDir = Join-Path $ProjectRoot 'docs'

# Sanity check: proyek hampir kosong? Skip docs/ skeleton supaya tidak prematur.
$excludeNames = @(
    '.git', '.claude-kit', 'AGENTS.md', 'CLAUDE.md', 'docs',
    'node_modules', 'vendor', 'dist', 'build', 'out', 'target',
    '__pycache__', '.venv', 'venv', '.next', '.nuxt', '.turbo', '.cache'
)
$nonHiddenFiles = @(Get-ChildItem -Path $ProjectRoot -Force -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -notin $excludeNames -and -not $_.Name.StartsWith('.')
})
$proyekHampirKosong = ($nonHiddenFiles.Count -le 1)

if ($proyekHampirKosong) {
    Write-Host ""
    Write-Host "INFO: Proyek terlihat hampir kosong - skip docs/ skeleton (terlalu prematur)." -ForegroundColor Cyan
    Write-Host "      Setelah ada code, jalankan ulang AI dengan prompt PROJECT_LIFECYCLE_PROMPT_v1.md (Stage 2: Bikin Catatan Proyek)" -ForegroundColor Cyan
} else {
    if (-not (Test-Path $docsDir)) {
        if (-not $DryRun) {
            New-Item -ItemType Directory -Path $docsDir -Force | Out-Null
            Add-DirToManifest -State $manifestState -DirPath $docsDir
            Write-Host ""
            Write-Host "CREATED $docsDir\" -ForegroundColor Green
        } else {
            Write-Host "[SIMULASI] CREATE $docsDir\" -ForegroundColor Yellow
        }
    }

    # Templates dengan placeholder substitution
    $docsTemplatesWithPlaceholder = @(
        @{ Src = 'templates\architecture.md'; Dst = (Join-Path $docsDir 'architecture.md'); From = 'templates/architecture.md'; Placeholders = @{
            '<NAMA_PROYEK>' = $ProjectName
            '[TBD: tanggal hari ini, format YYYY-MM-DD]' = $Today
            '[TBD: YYYY-MM-DD]' = $Today
        }},
        @{ Src = 'templates\glossary.md'; Dst = (Join-Path $docsDir 'glossary.md'); From = 'templates/glossary.md'; Placeholders = @{
            '<NAMA_PROYEK>' = $ProjectName
            '<YYYY-MM-DD>' = $Today
        }}
    )
    foreach ($t in $docsTemplatesWithPlaceholder) {
        $tSrc = Join-Path $KitDir $t.Src
        $tDst = $t.Dst
        if (Test-Path $tDst) {
            Write-Host "SKIP    $tDst (sudah ada, tidak di-overwrite)" -ForegroundColor Yellow
        } elseif (-not (Test-Path $tSrc)) {
            Write-Host ("WARN  Template tidak ditemukan: {0} (skip)" -f $tSrc) -ForegroundColor Yellow
        } elseif (-not $DryRun) {
            $r = Copy-TemplateWithPlaceholder -SourcePath $tSrc -TargetPath $tDst -Placeholders $t.Placeholders -IfExists 'Skip'
            if ($r.copied) {
                Add-ToManifest -State $manifestState -FilePath $tDst -Kind 'skeleton' -From $t.From
                Write-Host ("OK    {0} (skeleton, pre-filled NAMA_PROYEK='{1}')" -f $tDst, $ProjectName) -ForegroundColor Green
            } elseif ($r.action -eq 'missing') {
                Write-Host ("GAGAL copy {0}: source missing" -f $t.Dst) -ForegroundColor Red
            }
        } else {
            Write-Host "[SIMULASI] COPY  $tSrc -> $tDst" -ForegroundColor Yellow
        }
    }

    # 3 file template tambahan (tanpa placeholder substitution, plain copy)
    $extraTemplates = @(
        @{ TemplateName = '_PATTERNS.md';          TargetName = '_PATTERNS.md';          Desc = 'aturan dokumentasi tim profesional generic' },
        @{ TemplateName = '_EXAMPLE.md';           TargetName = '_EXAMPLE.md';           Desc = 'contoh format .md pendamping siap-copy' },
        @{ TemplateName = 'architecture_auto.md';  TargetName = 'architecture_auto.md';  Desc = 'registry TOC AI-maintained skeleton' }
    )
    foreach ($t in $extraTemplates) {
        $tSrc = Join-Path $KitDir ('templates\' + $t.TemplateName)
        $tDst = Join-Path $docsDir $t.TargetName
        if (Test-Path $tDst) {
            Write-Host "SKIP    $tDst (sudah ada, tidak di-overwrite)" -ForegroundColor Yellow
        } elseif (-not (Test-Path $tSrc)) {
            Write-Host ("WARN  Template tidak ditemukan: {0} (skip)" -f $tSrc) -ForegroundColor Yellow
        } elseif (-not $DryRun) {
            $r = Copy-StaticTemplate -SourcePath $tSrc -TargetPath $tDst -IfExists 'Skip'
            if ($r.copied) {
                Add-ToManifest -State $manifestState -FilePath $tDst -Kind 'skeleton' -From ('templates/' + $t.TemplateName)
                Write-Host ("OK    {0} ({1})" -f $tDst, $t.Desc) -ForegroundColor Green
            } elseif ($r.action -eq 'missing') {
                Write-Host ("GAGAL copy {0}: source missing" -f $t.TargetName) -ForegroundColor Red
            }
        } else {
            Write-Host "[SIMULASI] COPY  $tSrc -> $tDst" -ForegroundColor Yellow
        }
    }
}

# ---- Bootstrap TIM files (Team Mode T = default) ----
if (-not $SkipTeamFiles -and -not $proyekHampirKosong) {
    Write-Host ""
    Write-Host "=== Copy file tim (Team Mode) ===" -ForegroundColor Cyan

    # Buat folder .github/ + workflows + scripts kalau belum ada
    $githubDir = Join-Path $ProjectRoot '.github'
    $workflowsDir = Join-Path $githubDir 'workflows'
    $scriptsDir = Join-Path $githubDir 'scripts'
    foreach ($d in @($githubDir, $workflowsDir, $scriptsDir)) {
        if (-not (Test-Path $d) -and -not $DryRun) {
            New-Item -ItemType Directory -Path $d -Force | Out-Null
            Add-DirToManifest -State $manifestState -DirPath $d
            Write-Host ("CREATED {0}\" -f $d) -ForegroundColor Green
        }
    }

    # Buat folder docs/decisions/ kalau belum ada
    $decisionsDir = Join-Path $docsDir 'decisions'
    if (-not (Test-Path $decisionsDir) -and -not $DryRun) {
        New-Item -ItemType Directory -Path $decisionsDir -Force | Out-Null
        Add-DirToManifest -State $manifestState -DirPath $decisionsDir
        Write-Host ("CREATED {0}\" -f $decisionsDir) -ForegroundColor Green
    }

    # Mapping file tim: src (di .claude-kit) -> dst (di project root)
    $teamFiles = @(
        @{ Src = 'templates\github\workflows\ai-review.yml';    Dst = (Join-Path $workflowsDir 'ai-review.yml');     Desc = 'GitHub Action Senior AI Reviewer' },
        @{ Src = 'templates\github\workflows\backup-schemas.yml'; Dst = (Join-Path $workflowsDir 'backup-schemas.yml'); Desc = 'GitHub Action daily backup pg_dump per-schema (L3 backup)' },
        @{ Src = 'templates\github\workflows\secret-guard.yml';   Dst = (Join-Path $workflowsDir 'secret-guard.yml');   Desc = 'GitHub Action penjaga kebocoran rahasia (tolak .env asli ter-commit)' },
        @{ Src = 'templates\github\workflows\audit-access.yml';   Dst = (Join-Path $workflowsDir 'audit-access.yml');   Desc = 'GitHub Action pengingat cek-akses bulanan (buka Issue, tidak mencabut akses)' },
        @{ Src = 'templates\github\scripts\ai-review.cjs';       Dst = (Join-Path $scriptsDir 'ai-review.cjs');        Desc = 'Script Senior AI Reviewer' },
        @{ Src = 'templates\github\scripts\setup-branch-protection.ps1'; Dst = (Join-Path $scriptsDir 'setup-branch-protection.ps1'); Desc = 'Skrip sekali-jalan nyalakan kunci pengaman gabung (branch protection) - default SIMULASI, butuh -Apply' },
        @{ Src = 'templates\github\CODEOWNERS.template';        Dst = (Join-Path $githubDir 'CODEOWNERS');           Desc = 'CODEOWNERS template (WAJIB edit dengan username actual)' },
        @{ Src = 'templates\github\pull_request_template.md';   Dst = (Join-Path $githubDir 'pull_request_template.md'); Desc = 'PR template tim' },
        @{ Src = 'templates\KERJA_KELOMPOK.md';        Dst = (Join-Path $docsDir 'KERJA_KELOMPOK.md');      Desc = 'Pintu masuk kerja kelompok (langkah klik kunci main + penghubung ke panduan tim)' },
        @{ Src = 'templates\CLAUDE_TEAM_GUIDE.md';     Dst = (Join-Path $docsDir 'CLAUDE_TEAM_GUIDE.md');   Desc = 'Panduan tim AI-first' },
        @{ Src = 'templates\PROMPT_LIBRARY.md';        Dst = (Join-Path $docsDir 'PROMPT_LIBRARY.md');      Desc = '22 prompt pattern siap-pakai (1-10 generic + 11-15 chat-driven + 16-22 audit/update/split/onboarding/anti-halusinasi)' },
        @{ Src = 'templates\ONBOARDING.md';            Dst = (Join-Path $docsDir 'ONBOARDING.md');          Desc = 'Playbook dev baru' },
        @{ Src = 'templates\TEAM_FLOW_SKETCH_v1.md';   Dst = (Join-Path $docsDir 'TEAM_FLOW_SKETCH_v1.md'); Desc = 'Flow kerja tim end-to-end (5 peran + staging->prod + serah-terima + cek bug)' },
        @{ Src = 'templates\OWNER_SETUP_CHECKLIST_v1.md'; Dst = (Join-Path $docsDir 'OWNER_SETUP_CHECKLIST.md'); Desc = 'Checklist tugas teknis sekali-pasang owner/lead (bahasa non-programmer)' },
        @{ Src = 'templates\STACK_GUIDE.md';           Dst = (Join-Path $docsDir 'STACK_GUIDE.md');         Desc = 'Next.js + Vercel + SEO + security' },
        @{ Src = 'templates\STACK_MIGRATION_GUIDE.md'; Dst = (Join-Path $docsDir 'STACK_MIGRATION_GUIDE.md'); Desc = 'Migrasi Vercel -> Railway/Render (ADVANCED post-launch)' },
        @{ Src = 'templates\REFACTOR_STANDARD.md';     Dst = (Join-Path $docsDir 'REFACTOR_STANDARD.md');   Desc = 'Standar merapikan kode (refactor) lintas-divisi, bahasa non-programmer' },
        @{ Src = 'templates\RESEP_PERUBAHAN.md';       Dst = (Join-Path $docsDir 'RESEP_PERUBAHAN.md');     Desc = 'Resep perubahan: berkas mana ikut bergerak per jenis perubahan + cara jalankan robot pemeriksa kecocokan (anti bug file-lupa-diganti)' },
        @{ Src = 'templates\consistency-map.example.jsonc'; Dst = (Join-Path $docsDir 'consistency-map.example.jsonc'); Desc = 'Contoh peta-konsistensi (format Node, dibaca gerbang npx lintasai preflight): daftarkan fakta-berulang project supaya robot menjaganya' },
        @{ Src = 'templates\consistency-map.example.psd1'; Dst = (Join-Path $docsDir 'consistency-map.example.psd1'); Desc = 'Contoh peta-konsistensi (format PowerShell cadangan): daftarkan fakta-berulang project (versi/config) supaya robot menjaganya' },
        @{ Src = 'templates\BUKU_PELAJARAN.example.md'; Dst = (Join-Path $docsDir 'BUKU_PELAJARAN.example.md'); Desc = 'Contoh Buku Pelajaran (LAPIS 3): tiap bug yang lolos -> jadi pengaman tetap (salin jadi docs/BUKU_PELAJARAN.md saat bug pertama)' },
        @{ Src = 'templates\MCP_SETUP.md';             Dst = (Join-Path $docsDir 'MCP_SETUP.md');           Desc = 'MCP setup + Decision Tree Postgres/Supabase' },
        @{ Src = 'templates\RLS_SETUP_PROMPT.md';      Dst = (Join-Path $docsDir 'RLS_SETUP_PROMPT.md');    Desc = 'RLS setup prompt untuk staff IT schema-scoped' },
        @{ Src = 'templates\DB_SCHEMA_SCAN_PROMPT.md'; Dst = (Join-Path $docsDir 'DB_SCHEMA_SCAN_PROMPT.md'); Desc = 'Scan DB schema -> docs/db-schema.md' },
        @{ Src = 'templates\OPERASI_DATABASE_AMAN.md'; Dst = (Join-Path $docsDir 'OPERASI_DATABASE_AMAN.md'); Desc = 'Ubah struktur DB tanpa downtime (expand-then-contract) + rollback runbook' },
        @{ Src = 'templates\OBSERVABILITY_PRODUKSI.md'; Dst = (Join-Path $docsDir 'OBSERVABILITY_PRODUKSI.md'); Desc = 'Alarm error produksi (Sentry) + log terstruktur + healthcheck (wajib sebelum online)' },
        @{ Src = 'templates\GLOSSARY_NON_PROGRAMMER.md'; Dst = (Join-Path $docsDir 'GLOSSARY_NON_PROGRAMMER.md'); Desc = 'Glossary istilah teknis untuk non-programmer (WAJIB baca dulu)' },
        @{ Src = 'templates\ANALOGI_LIBRARY.md';        Dst = (Join-Path $docsDir 'ANALOGI_LIBRARY.md');     Desc = '32 jargon teknis + bahan analogi tools digital populer Indonesia (cadangan rujukan AI, opsional)' },
        @{ Src = 'templates\UPDATE_GUIDE.md';           Dst = (Join-Path $docsDir 'UPDATE_GUIDE.md');        Desc = 'Panduan staff IT non-programmer cara update kit (4-tier strategy + analogi tools digital)' },
        @{ Src = 'templates\SECURITY_INCIDENT_PLAYBOOK.md'; Dst = (Join-Path $docsDir 'SECURITY_INCIDENT_PLAYBOOK.md'); Desc = 'Security incident playbook (kalau token bocor / data leak)' },
        @{ Src = 'templates\THREAT_MODEL_NON_LEGAL.md'; Dst = (Join-Path $docsDir 'THREAT_MODEL_NON_LEGAL.md'); Desc = 'Peta ancaman tim tanpa jalur hukum (apa dijaga / dari siapa / dengan apa)' },
        @{ Src = 'templates\ACCESS_CONTROL_NREPO_v1.md'; Dst = (Join-Path $docsDir 'ACCESS_CONTROL_NREPO_v1.md'); Desc = 'Kontrol-akses N-repo: least-privilege + checklist staf keluar + cek-akses bulanan' },
        @{ Src = 'templates\feature-flags-advanced.md'; Dst = (Join-Path $docsDir 'feature-flags-advanced.md'); Desc = 'Feature flag pattern (ADVANCED, post-launch only)' },
        @{ Src = 'templates\decisions\_TEMPLATE.md';   Dst = (Join-Path $decisionsDir '_TEMPLATE.md');      Desc = 'ADR template' },
        @{ Src = 'templates\decisions\README.md';      Dst = (Join-Path $decisionsDir 'README.md');         Desc = 'ADR folder README' }
    )

    foreach ($t in $teamFiles) {
        $tSrc = Join-Path $KitDir $t.Src
        $tDst = $t.Dst
        if (Test-Path $tDst) {
            Write-Host ("SKIP    {0} (sudah ada, tidak di-overwrite)" -f $tDst) -ForegroundColor Yellow
        } elseif (-not (Test-Path $tSrc)) {
            Write-Host ("WARN  File tim tidak ditemukan di kit: {0} (skip)" -f $tSrc) -ForegroundColor Yellow
        } elseif (-not $DryRun) {
            $r = Copy-StaticTemplate -SourcePath $tSrc -TargetPath $tDst -IfExists 'Skip'
            if ($r.copied) {
                # Pakai forward slash di field 'from' supaya konsisten cross-platform di JSON
                $fromRel = $t.Src.Replace('\','/')
                Add-ToManifest -State $manifestState -FilePath $tDst -Kind 'team_file' -From $fromRel
                Write-Host ("OK    {0} ({1})" -f $tDst, $t.Desc) -ForegroundColor Green
            } elseif ($r.action -eq 'missing') {
                Write-Host ("GAGAL copy {0}: source missing" -f $t.Src) -ForegroundColor Red
            }
        } else {
            Write-Host "[SIMULASI] COPY  $tSrc -> $tDst" -ForegroundColor Yellow
        }
    }

    # Copy docs/SIGNED_RELEASE.md (sourced dari kit's docs/ folder, bukan templates/)
    $signedReleaseSrc = Join-Path $KitDir 'docs\SIGNED_RELEASE.md'
    $signedReleaseDst = Join-Path $docsDir 'SIGNED_RELEASE.md'
    if (Test-Path $signedReleaseDst) {
        Write-Host ("SKIP    {0} (sudah ada, tidak di-overwrite)" -f $signedReleaseDst) -ForegroundColor Yellow
    } elseif (-not (Test-Path $signedReleaseSrc)) {
        Write-Host ("WARN  docs/SIGNED_RELEASE.md tidak ditemukan di kit: {0} (skip)" -f $signedReleaseSrc) -ForegroundColor Yellow
    } elseif (-not $DryRun) {
        # Pastikan docs/ ada (edge case kalau heuristic skip creation tapi user disable -SkipTeamFiles)
        if (-not (Test-Path $docsDir)) {
            New-Item -ItemType Directory -Path $docsDir -Force | Out-Null
            Add-DirToManifest -State $manifestState -DirPath $docsDir
        }
        $r = Copy-StaticTemplate -SourcePath $signedReleaseSrc -TargetPath $signedReleaseDst -IfExists 'Skip'
        if ($r.copied) {
            Add-ToManifest -State $manifestState -FilePath $signedReleaseDst -Kind 'team_file' -From 'docs/SIGNED_RELEASE.md'
            Write-Host ("OK    {0} (panduan verifikasi signed release)" -f $signedReleaseDst) -ForegroundColor Green
        }
    } else {
        Write-Host "[SIMULASI] COPY  $signedReleaseSrc -> $signedReleaseDst" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "REMINDER untuk Team Mode:" -ForegroundColor Cyan
    Write-Host "  0. KERJA KELOMPOK: buka docs\KERJA_KELOMPOK.md - langkah klik MENGUNCI main di GitHub"
    Write-Host "       (hanya owner yang bisa) + alur branch -> PR -> review. Atau: npx lintasai team-setup."
    Write-Host "  1. Edit .github\CODEOWNERS - ganti placeholder dengan GitHub username actual."
    Write-Host "  2. Setup ANTHROPIC_API_KEY di GitHub repo Settings -> Secrets -> Actions."
    Write-Host "  3. Baca docs\CLAUDE_TEAM_GUIDE.md (panduan tim) + docs\PROMPT_LIBRARY.md."
    Write-Host "  4. Kalau pakai DB: setup schema isolation + RLS:"
    Write-Host "       - docs\MCP_SETUP.md (PostgreSQL MCP default, Supabase MCP owner-only)"
    Write-Host "       - docs\RLS_SETUP_PROMPT.md (paste prompt RLS untuk staff IT)"
    Write-Host "       - docs\DB_SCHEMA_SCAN_PROMPT.md (paste prompt scan schema -> docs\db-schema.md)"
} elseif ($SkipTeamFiles) {
    Write-Host ""
    Write-Host "INFO: -SkipTeamFiles aktif (advanced escape hatch) - skip copy .github/ + docs tim." -ForegroundColor Cyan
}

# ---- Tulis kartu identitas project (project.lintas.psd1) - sumber-tunggal mesin-baca ----
# Lahir terisi: kolom stack di-derive dari package.json; intent ditandai 'pending' (AI isi sesi
# pertama). Idempoten: kalau sudah ada, TIDAK ditimpa. Dijaga robot anti-basi (lib\project-manifest.ps1).
if (Get-Command Write-LintasProjectManifestIfMissing -ErrorAction SilentlyContinue) {
    try {
        if (-not $DryRun) {
            $pmWrite = Write-LintasProjectManifestIfMissing -RepoRoot $ProjectRoot
            if ($pmWrite.Written) {
                Add-ToManifest -State $manifestState -FilePath $pmWrite.Path -Kind 'project_manifest' -From 'generated: project.lintas.psd1'
                Write-Host ("OK    {0} (kartu identitas project - stack otomatis, intent menunggu AI)" -f $pmWrite.Path) -ForegroundColor Green
            } elseif ($pmWrite.Reason -eq 'exists') {
                Write-Host "SKIP    project.lintas.psd1 (sudah ada, tidak ditimpa)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[SIMULASI] WRITE project.lintas.psd1 di akar project" -ForegroundColor Yellow
        }
    } catch {
        Write-Host ("WARN  Gagal tulis project.lintas.psd1 (non-fatal): {0}" -f $_.Exception.Message) -ForegroundColor Yellow
    }
}

# ---- Save install manifest (lib\manifest.ps1 - merge + HMAC sign + write JSON) ----
if (-not $DryRun) {
    try {
        $saveResult = Save-Manifest `
            -State $manifestState `
            -KitDir $KitDir `
            -KitVersion $KitVersion `
            -ProjectName $ProjectName

        # ---- Ensure .claude-kit/.gitignore ignore manifest + backup files ----
        # APPEND-if-missing pattern: preserve existing .gitignore, tambah entries yang belum ada.
        $gitignorePath = Join-Path $KitDir '.gitignore'
        $requiredEntries = @(
            '.install-manifest.json',
            '*.bak',
            '*.backup-*',
            '*.env',
            '*.env.local',
            '*.pem',
            '*.key'
        )
        $existingLines = @()
        if (Test-Path -LiteralPath $gitignorePath) {
            $existingLines = @(Get-Content -LiteralPath $gitignorePath -Encoding UTF8 -ErrorAction SilentlyContinue)
            # Defensive BOM strip: PS 7+ -Encoding UTF8 (alias utf8NoBOM) does NOT strip BOM on read,
            # causing the first line to be prefixed with U+FEFF and breaking -notcontains comparison.
            if ($existingLines.Count -gt 0 -and $existingLines[0].Length -gt 0 -and [int][char]$existingLines[0][0] -eq 0xFEFF) {
                $existingLines[0] = $existingLines[0].Substring(1)
            }
        }
        $missingEntries = @($requiredEntries | Where-Object { $existingLines -notcontains $_ })
        if ($missingEntries.Count -gt 0) {
            $appendBlock = "`n# Auto-appended oleh setup-pola-b.ps1 (lintasAI safe-uninstall hardening):`n# Cegah leak environment metadata + secret kalau user run ``git add .claude-kit/``.`n"
            $appendBlock += ($missingEntries -join "`n") + "`n"
            if ($existingLines.Count -gt 0) {
                [System.IO.File]::AppendAllText($gitignorePath, $appendBlock, (New-Object System.Text.UTF8Encoding $false))
            } else {
                [System.IO.File]::WriteAllText($gitignorePath, $appendBlock.TrimStart("`n"), (New-Object System.Text.UTF8Encoding $false))
            }
        }

        Write-Host ""
        Write-Host ("OK    .install-manifest.json written ({0} file + {1} dir tracked)" -f $saveResult.FilesCount, $saveResult.DirsCount) -ForegroundColor Green
        if ($saveResult.Merged) {
            Write-Host "      Merged dengan manifest sebelumnya (re-run setup detected)." -ForegroundColor DarkGray
        }
        if ($saveResult.Signed) {
            Write-Host "      HMAC-signed (tamper-detection aktif)." -ForegroundColor DarkGray
        }
        Write-Host "      Dipakai uninstall.ps1 untuk safe delete (hash-based pristine detection)." -ForegroundColor DarkGray
        Write-Host "      Anonymized: project_root='<PROJECT_ROOT>', installed_by='<USER>' (tidak leak env)." -ForegroundColor DarkGray
    } catch {
        Write-Host "WARN  Gagal tulis .install-manifest.json: $_" -ForegroundColor Yellow
        Write-Host "      Setup TETAP berhasil, tapi uninstall.ps1 nanti minta fallback manual." -ForegroundColor Yellow
    }
}

# ---- v1.5.8: Project-root .gitignore auto-append (Gap 1 fix dari dogfood v2 akses) ----
# Cegah accidental commit kit secrets + per-staff identity + backup folders.
# Idempotent: skip pattern yang sudah ada.
if (-not $DryRun) {
    try {
        $projectGitignorePath = Join-Path $ProjectRoot '.gitignore'
        $lintasaiPatterns = @(
            '.claude-kit/.audit-log',
            '.claude-kit/.manifest-secret',
            '.claude-kit/.install-manifest.json',
            '.git-identity-*',
            '.staff-profile.md',
            '.claude-kit.backup-*/',
            # v1.13.2 FIX kebocoran-backup: pola FOLDER di atas ('.claude-kit.backup-*/') HANYA
            # menutup folder backup kit. File backup TINGKAT-AKAR yang dibuat saat -Force
            # (AGENTS.md.backup-<ts>, CLAUDE.md.backup-<ts> dari lib/agents-md.ps1; *.bak.<ts>
            # dari lib/json-merge-helpers.ps1) SEBELUMNYA tidak ter-ignore -> bocor ke repo tim
            # saat staff `git add .`. Pola file di .claude-kit/.gitignore (baris ~932) salah scope
            # (cuma berlaku di dalam .claude-kit/). 3 pola berikut menutup file backup di AKAR proyek.
            '*.backup-*',
            '*.bak',
            '*.bak.*'
        )
        $existingProjectLines = @()
        if (Test-Path -LiteralPath $projectGitignorePath) {
            $existingProjectLines = @(Get-Content -LiteralPath $projectGitignorePath -Encoding UTF8 -ErrorAction SilentlyContinue)
            # Defensive BOM strip (sama pattern dengan .claude-kit/.gitignore handler di atas).
            if ($existingProjectLines.Count -gt 0 -and $existingProjectLines[0].Length -gt 0 -and [int][char]$existingProjectLines[0][0] -eq 0xFEFF) {
                $existingProjectLines[0] = $existingProjectLines[0].Substring(1)
            }
        }
        $missingProjectPatterns = @($lintasaiPatterns | Where-Object { $existingProjectLines -notcontains $_ })
        if ($missingProjectPatterns.Count -gt 0) {
            $header = "`n`n# === lintasAI patterns (v1.5.8+ auto-appended by setup-pola-b.ps1) ===`n# Cegah leak: kit secrets, per-staff identity, backup folders.`n"
            $appendProjectBlock = $header + ($missingProjectPatterns -join "`n") + "`n"
            if ($existingProjectLines.Count -gt 0) {
                [System.IO.File]::AppendAllText($projectGitignorePath, $appendProjectBlock, (New-Object System.Text.UTF8Encoding $false))
            } else {
                [System.IO.File]::WriteAllText($projectGitignorePath, $appendProjectBlock.TrimStart("`n"), (New-Object System.Text.UTF8Encoding $false))
            }
            Write-Host ("OK    .gitignore project root: {0} lintasAI patterns ditambah (cegah leak secrets)" -f $missingProjectPatterns.Count) -ForegroundColor Green
        } else {
            Write-Host "OK    .gitignore project root: lintasAI patterns sudah ada (idempotent skip)" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host ("WARN  Gagal update .gitignore project root: {0}" -f $_) -ForegroundColor Yellow
        Write-Host "      Setup TETAP berhasil. Manual: cek .gitignore + add lintasAI patterns." -ForegroundColor Yellow
    }
}

# ---- .github/staff-roster.yml skeleton (direktori tim) ----
# Direktori tim sederhana (siapa + peran). Dipakai AI/owner sebagai RUJUKAN "siapa boleh
# apa" saat menetapkan scope kerja - bukan pagar keras (penegakan otomatis per-role belum
# aktif). v1.13.3: isi email owner dari `git config user.email` ASLI (kalau sudah di-set)
# supaya health-check seksi 7.6 tidak salah-alarm "email belum terdaftar" di sesi pertama.
# Skip kalau sudah ada (preserve user data).
if (-not $DryRun) {
    try {
        $rosterPath = Join-Path $ProjectRoot '.github\staff-roster.yml'
        if (-not (Test-Path -LiteralPath $rosterPath)) {
            $githubDir = Join-Path $ProjectRoot '.github'
            if (-not (Test-Path -LiteralPath $githubDir)) {
                $null = New-Item -ItemType Directory -Path $githubDir -Force
            }
            # Ambil email git asli (local dulu, lalu global). Kalau belum di-set -> placeholder.
            $ownerEmail = $null
            try {
                $ownerEmail = (& git -C $ProjectRoot config user.email 2>$null)
                if ([string]::IsNullOrWhiteSpace($ownerEmail)) { $ownerEmail = (& git config --global user.email 2>$null) }
                if ($ownerEmail) { $ownerEmail = ([string]$ownerEmail).Trim() }
            } catch { $ownerEmail = $null }
            $rosterEmail = if (-not [string]::IsNullOrWhiteSpace($ownerEmail)) { $ownerEmail } else { 'replace-with-owner-email@example.com' }

            $rosterContent = @'
# Staff roster - direktori tim lintasAI (siapa + peran/role).
# Dipakai AI/owner sebagai RUJUKAN "siapa boleh apa" saat menetapkan scope kerja.
# Catatan: penegakan otomatis per-role belum aktif - ini RUJUKAN, bukan pagar keras.
#
# Schema per entry:
#   - email: <git config user.email>
#     name: <display name>
#     github: <github handle>
#     role: <owner | backend-architect | frontend-architect | backend-developer | frontend-developer | ui-developer>
#     added_at: <YYYY-MM-DD>
#     notes: <opsional>
#
# Auto-generated skeleton oleh setup-pola-b.ps1. LENGKAPI nama/github entry "owner"
# + tambah staff sebelum onboard.

staff:
  - email: __OWNER_EMAIL__
    name: <Owner Name>
    github: <owner-github-handle>
    role: owner
    added_at: <YYYY-MM-DD>
    notes: Project owner. Real contact via Signal/Telegram untuk hal sensitif.
'@
            $rosterContent = $rosterContent.Replace('__OWNER_EMAIL__', $rosterEmail)
            [System.IO.File]::WriteAllText($rosterPath, $rosterContent, (New-Object System.Text.UTF8Encoding $false))
            $emailNote = if (-not [string]::IsNullOrWhiteSpace($ownerEmail)) { "email owner terisi dari git config" } else { "isi email owner (placeholder)" }
            Write-Host ("OK    .github\staff-roster.yml created ($emailNote; lengkapi nama/github sebelum staff onboard)" ) -ForegroundColor Green
        } else {
            Write-Host "SKIP  .github\staff-roster.yml (sudah ada, user data tidak di-overwrite)" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host ("WARN  Gagal create staff-roster.yml: {0}" -f $_) -ForegroundColor Yellow
    }
}

# ---- Post-install setup (Pass 2): Git identity check + VS Code launch ----
# Skip semua dalam DryRun mode (no side effects).
if (-not $DryRun) {
    # ---- (a) Git identity check ----
    # Cek apakah user.email sudah di-set. Kalau belum, prompt + auto-set name=email-prefix.
    # Wrapped in try/catch: git missing OR git config failure tidak boleh crash setup.
    try {
        # BUG 1 defense in depth: in-session idempotency. Setelah block ini selesai
        # 1x (apapun outcome: handled / cancelled / no-repo), JANGAN re-run di proses
        # PowerShell yang sama. Penting saat setup di-dot-source ulang oleh
        # update-kit.ps1 atau library re-import.
        if ($script:__lintasAI_GitIdentityHandled) {
            # silent short-circuit; tidak perlu noise output
        } else {
            # BUG 1 ULTIMATE FIX v1.4.3: cross-process persistence via SUCCESS marker.
            # $script: scope hanya hidup dalam 1 PS process. Tiap npx init spawn process baru
            # = guard reset. Marker file = persistent across processes/sessions.
            # 2 markers:
            #   .git-identity-set    = user pernah set email successfully (skip prompt forever)
            #   .git-identity-skipped = user pernah cancel (skip until manual delete)
            $gitIdentitySetMarker = Join-Path $ProjectRoot '.claude-kit/.git-identity-set'
            $gitIdentitySkipMarker = Join-Path $ProjectRoot '.claude-kit/.git-identity-skipped'
            if (Test-Path -LiteralPath $gitIdentitySetMarker) {
                Write-Host "INFO: Identitas Git sudah diatur sebelumnya (tidak ditanya lagi). Hapus .claude-kit/.git-identity-set kalau mau diatur ulang." -ForegroundColor DarkGray
                $script:__lintasAI_GitIdentityHandled = $true
            } elseif (Test-Path -LiteralPath $gitIdentitySkipMarker) {
                Write-Host "INFO: Pengaturan identitas Git sebelumnya dilewati (hapus .claude-kit/.git-identity-skipped kalau mau coba lagi)." -ForegroundColor DarkGray
                $script:__lintasAI_GitIdentityHandled = $true
                $script:__lintasAI_SkippedSteps += 'Git identity setup (skipped via marker file)'
            } else {

        # ---- v1.5.6 Fix #1: Pre-flight `.git` folder check ----
        # Cek apakah project sudah `git init`. Kalau belum, tawarkan opsi
        # SEBELUM minta email (hemat waktu user + transparansi pilihan).
        $gitFolder = Join-Path $ProjectRoot '.git'
        if (-not (Test-Path -LiteralPath $gitFolder -PathType Container)) {
            Write-Host ""
            Write-Host "=== Pre-flight: Git repository check ===" -ForegroundColor Cyan
            Write-Host ("Project '{0}' belum di-git init." -f $ProjectRoot) -ForegroundColor Yellow
            Write-Host "Tanpa git repo lokal, role-lookup via git config user.email tidak bisa per-project." -ForegroundColor DarkGray
            Write-Host ""

            $preflightChoice = $null
            if ($useConsoleMode) {
                # Headless / no-GUI mode -> default ke [1] lewati git (paling aman, tidak mengubah file).
                Write-Host "Mode console terdeteksi (headless). Default: [1] lewati git ops." -ForegroundColor DarkGray
                $preflightChoice = 1
            } else {
                try {
                    if (Get-Command Show-LintasNumberedChoicePopup -ErrorAction SilentlyContinue) {
                        # Opsi [1] = lewati git (paling aman) = rekomendasi + default. Helper balik indeks 0-based.
                        $rawPreflightIdx = Show-LintasNumberedChoicePopup `
                            -Title 'Git repo belum ada' `
                            -Message ("Project '{0}' belum di-git init. Pilih:" -f (Split-Path -Leaf $ProjectRoot)) `
                            -Options @(
                                @{ Label = 'Lewati langkah git, pakai identitas global'; Recommended = $true },
                                @{ Label = 'Buat git init otomatis di folder project (kalau mau commit setup di sini)' },
                                @{ Label = 'Batalkan setup (mau init git manual dulu)'; SpecialKey = 'cancel' }
                            ) `
                            -DefaultIndex 0
                        # Normalisasi 0-based -> 1-based supaya cocok switch di bawah; -1 (batal/X) -> 0 -> default = lewati (aman).
                        $preflightChoice = [int]$rawPreflightIdx + 1
                    } else {
                        $preflightChoice = 1
                    }
                } catch {
                    # Headless / popup error - default ke lewati git ops (aman)
                    $preflightChoice = 1
                }
            }

            switch ($preflightChoice) {
                1 {
                    Write-Host "Skip git init. Identity akan di-set di --global scope." -ForegroundColor Yellow
                }
                2 {
                    Write-Host "Menjalankan git init di $ProjectRoot ..." -ForegroundColor Cyan
                    try {
                        & git -C $ProjectRoot init 2>&1 | Out-Null
                        if ($LASTEXITCODE -eq 0) {
                            Write-Host "OK: git repo initialized." -ForegroundColor Green
                        } else {
                            Write-Host "WARN: git init exit code $LASTEXITCODE. Fallback ke --global identity." -ForegroundColor Yellow
                        }
                    } catch {
                        Write-Host ("WARN: git init gagal ({0}). Fallback ke --global identity." -f $_.Exception.Message) -ForegroundColor Yellow
                    }
                }
                3 {
                    Write-Host "Git identity di-skip (kamu pilih batal di langkah git)." -ForegroundColor Yellow
                    Write-Host "CATATAN: file kit SUDAH ter-deploy. Yang dilewati cuma setup git identity + merge izin VS Code." -ForegroundColor Yellow
                    Write-Host "Jalankan ulang setup kapan saja untuk menyelesaikan langkah ini." -ForegroundColor Yellow
                    $script:__lintasAI_GitIdentityHandled = $true
                    $script:__lintasAI_SkippedSteps += 'Git identity setup (user cancelled at pre-flight)'
                    # Tulis marker supaya re-run tidak nanya lagi sampai marker dihapus.
                    try {
                        $cancelMarkerDir = Split-Path -Parent $gitIdentitySkipMarker
                        if (-not (Test-Path -LiteralPath $cancelMarkerDir)) {
                            New-Item -ItemType Directory -Path $cancelMarkerDir -Force | Out-Null
                        }
                        New-Item -ItemType File -Path $gitIdentitySkipMarker -Force | Out-Null
                    } catch {
                        Write-Host "WARN  Gagal tulis cancel marker: $_" -ForegroundColor Yellow
                    }
                    return
                }
                default {
                    Write-Host "Pilihan tidak dikenali. Default ke [1] lewati git ops." -ForegroundColor Yellow
                }
            }
        }
        # End pre-flight check. Lanjut ke email prompt seperti biasa.

        $currentEmail = $null
        # BUG 1 PRIMARY FIX: read scope harus sama dengan write scope (--local di
        # block (a) selanjutnya pakai `git -C $ProjectRoot config --local`).
        # Sebelumnya cuma baca --global -> setelah user isi email, value disimpan
        # ke .git/config lokal repo, tapi loop check berikutnya tetap baca GLOBAL
        # (yang masih kosong) -> popup muncul lagi tiap re-run.
        # Sekarang: cek LOCAL dulu (preferred), fallback GLOBAL untuk user yang
        # sudah set identity global sebelumnya.
        try {
            $localEmail = & git -C $ProjectRoot config --local --get user.email 2>$null
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($localEmail)) {
                $currentEmail = $localEmail
            }
        } catch {
            $currentEmail = $null
        }
        if ([string]::IsNullOrWhiteSpace($currentEmail)) {
            try {
                $globalEmail = git config --global --get user.email 2>$null
                if ($LASTEXITCODE -eq 0) { $currentEmail = $globalEmail }
            } catch {
                $currentEmail = $null
            }
        }
        if ([string]::IsNullOrWhiteSpace($currentEmail)) {
            Write-Host ""
            Write-Host "=== Git identity setup ===" -ForegroundColor Cyan
            Write-Host "Git user.email belum di-set. Diperlukan untuk role lookup (staff-roster.yml)." -ForegroundColor Yellow
            $emailInput = $null
            if ($useConsoleMode) {
                if ($script:__lintasAI_NonInteractive) {
                    Write-Host "INFO: Mode non-interaktif - setup git identity dilewati (bisa diatur nanti)." -ForegroundColor Yellow
                    $emailInput = $null
                } else {
                    try {
                        $emailInput = Read-Host "Email kamu (untuk role lookup) [format: name@example.com, kosongkan + Enter = skip, ketik [cancel] untuk batal]"
                    } catch {
                        Write-Host "INFO: Shell NonInteractive - skip git identity setup." -ForegroundColor Yellow
                        $emailInput = $null
                    }
                }
            } else {
                $script:__lintasAI_CancelledGitIdentity = $false
                try {
                    $popupResult = Show-LintasInputPopup `
                        -Title "Setup Git Identity" `
                        -Message "Email kamu (untuk role lookup):" `
                        -DefaultValue ""
                    # Round 2 fix: Show-LintasInputPopup now returns @{Status;Value}
                    # to distinguish Cancel from empty-OK. Surface explicit cancel
                    # (security-relevant: git identity drives role lookup in
                    # staff-roster.yml) instead of silently skipping.
                    if ($popupResult -is [hashtable] -and $popupResult.Status -eq 'Cancel') {
                        Write-Host "INFO: User cancelled git identity setup. Skip (you can re-run setup later)." -ForegroundColor Yellow
                        $script:__lintasAI_CancelledGitIdentity = $true
                        # BUG 1 UX fix: persist cancel decision across runs so update-kit.ps1
                        # -> setup-pola-b.ps1 re-run TIDAK re-prompt. Marker hidup sampai
                        # user hapus manual (.claude-kit/.git-identity-skipped).
                        try {
                            $cancelMarker = Join-Path $ProjectRoot '.claude-kit/.git-identity-skipped'
                            $cancelMarkerDir = Split-Path -Parent $cancelMarker
                            if (-not (Test-Path -LiteralPath $cancelMarkerDir)) {
                                New-Item -ItemType Directory -Path $cancelMarkerDir -Force | Out-Null
                            }
                            New-Item -ItemType File -Path $cancelMarker -Force | Out-Null
                            Write-Host ("      Marker dibuat: {0} (hapus untuk retry nanti)." -f $cancelMarker) -ForegroundColor DarkGray
                        } catch {
                            Write-Host "WARN  Gagal tulis cancel marker: $_" -ForegroundColor Yellow
                        }
                        # In-session idempotency: cancel = handled (block re-prompt di
                        # proses yang sama walau marker write fail).
                        $script:__lintasAI_GitIdentityHandled = $true
                        $emailInput = $null
                    } elseif ($popupResult -is [hashtable]) {
                        $emailInput = [string]$popupResult.Value
                    } else {
                        $emailInput = $null
                    }
                } catch {
                    Write-Host "WARN  Popup input gagal: $_" -ForegroundColor Yellow
                    Write-Host "INFO: GUI degraded - sisa prompt akan pakai console mode." -ForegroundColor Yellow
                    $script:useConsoleMode = $true
                    $useConsoleMode = $true
                    $emailInput = $null
                }
            }
            if (-not $emailInput -or -not $emailInput.Trim()) {
                if ($script:__lintasAI_CancelledGitIdentity) {
                    $script:__lintasAI_SkippedSteps += 'Git identity setup (user cancelled)'
                } else {
                    $script:__lintasAI_SkippedSteps += 'Git identity setup (no email provided)'
                }
            }
            if ($emailInput -and $emailInput.Trim()) {
                $email = $emailInput.Trim()
                # Tighten regex per Pass 1 finding: length cap 254 (RFC 5321) + basic shape check.
                # Round 2: reject control characters (NUL etc.) - \s only matches [ \t\n\r\f\v],
                # so NUL bytes were slipping through and could truncate downstream string handlers,
                # silently mismatching staff-roster.yml lookup and defeating role-aware gate.
                if ($email.Length -le 254 -and $email -match "^[^\s@\x00-\x1F\x7F]+@[^\s@\x00-\x1F\x7F]+\.[^\s@\x00-\x1F\x7F]+$") {
                    $derivedName = $email.Split("@")[0]
                    try {
                        # Round 2 fix: verify $ProjectRoot is inside a git work tree, then write
                        # with explicit --local scope + -C $ProjectRoot. Without these:
                        #   - bare `git config user.email` walks up from CWD and may pollute a
                        #     PARENT repo's config (e.g. enclosing projects/.git).
                        #   - `git config --global` overrides user's identity for ALL their repos,
                        #     too heavy-handed for a per-project setup.
                        # Local scope keeps the change isolated to this project's .git/config.
                        $isRepo = $false
                        try {
                            $insideTree = (& git -C $ProjectRoot rev-parse --is-inside-work-tree 2>$null)
                            if ($LASTEXITCODE -eq 0 -and "$insideTree".Trim() -eq 'true') { $isRepo = $true }
                        } catch {
                            $isRepo = $false
                        }
                        if (-not $isRepo) {
                            # v1.4.3 fix: bukan git repo - tetap set global config + write success marker
                            # supaya cross-process tidak re-prompt. Email tetap valid untuk role lookup
                            # via staff-roster.yml (yang baca git config global).
                            Write-Host ("INFO: {0} bukan git repo. Set git --global identity sebagai fallback." -f $ProjectRoot) -ForegroundColor Yellow
                            try {
                                git config --global user.email $email
                                git config --global user.name $derivedName
                                Write-Host ("Git identity set (global scope, no local repo): {0} (name={1})" -f $email, $derivedName) -ForegroundColor Green
                            } catch {
                                Write-Warning "Gagal set git config global: $_"
                            }
                            $script:__lintasAI_GitIdentityHandled = $true
                        } else {
                            git -C $ProjectRoot config --local user.email $email
                            git -C $ProjectRoot config --local user.name $derivedName
                            Write-Host ("Git identity set (local scope): {0} (name={1})" -f $email, $derivedName) -ForegroundColor Green
                            $script:__lintasAI_GitIdentityHandled = $true
                        }
                        # v1.4.3 ULTIMATE FIX: write SUCCESS marker untuk cross-process idempotency.
                        # Tanpa marker ini, npx init spawn new PS process = $script: scope reset
                        # = re-prompt walaupun email sudah valid set sebelumnya.
                        try {
                            $setMarker = Join-Path $ProjectRoot '.claude-kit/.git-identity-set'
                            $setMarkerDir = Split-Path -Parent $setMarker
                            if (-not (Test-Path -LiteralPath $setMarkerDir)) {
                                New-Item -ItemType Directory -Path $setMarkerDir -Force | Out-Null
                            }
                            "$email|$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $setMarker -Encoding utf8 -Force
                            Write-Host ("      Marker dibuat: {0} (cross-process idempotency)." -f $setMarker) -ForegroundColor DarkGray
                        } catch {
                            Write-Host "WARN  Gagal tulis success marker: $_" -ForegroundColor Yellow
                        }
                    } catch {
                        Write-Warning "Gagal set git config: $_"
                    }
                } else {
                    Write-Warning "Email invalid format, git config not set"
                }
            }
        } else {
            # currentEmail SUDAH ter-set (local atau global) — skip prompt + mark handled
            # supaya re-run di proses ini langsung short-circuit di guard atas.
            $script:__lintasAI_GitIdentityHandled = $true
        }
            } # close: marker-test else (block prompt + handle)
        } # close: in-session idempotency else
    } catch {
        Write-Host "WARN  Git identity setup di-skip: $_" -ForegroundColor Yellow
        # Mark handled even on error — kalau git missing / config crash, JANGAN
        # re-attempt di re-run yang sama (user butuh fix env dulu).
        $script:__lintasAI_GitIdentityHandled = $true
    }

    # ---- (a2) Merge .claude/settings.local.json allow-list ----
    # Auto-merge lintasAI allow-list rules into project's Claude Code permissions file.
    # Lives outside .claude-kit/ so VS Code Claude Code extension picks it up natively.
    # Idempotent: Merge-LintasAllowList preserves user-defined entries + dedupes.
    try {
        $settingsTargetDir = Join-Path $ProjectRoot '.claude'
        $settingsTarget = Join-Path $settingsTargetDir 'settings.local.json'
        $settingsTemplate = Join-Path $KitDir 'templates\settings.local.json.template'

        if (-not (Test-Path -LiteralPath $settingsTemplate)) {
            Write-Host "WARN  templates/settings.local.json.template tidak ditemukan - skip merge allow-list." -ForegroundColor Yellow
        } else {
            if (-not (Test-Path -LiteralPath $settingsTargetDir)) {
                New-Item -ItemType Directory -Path $settingsTargetDir -Force | Out-Null
                Write-Host ("CREATED {0}\" -f $settingsTargetDir) -ForegroundColor Green
            }

            # Capture pre-merge entry count for delta reporting.
            $beforeCount = 0
            if (Test-Path -LiteralPath $settingsTarget) {
                try {
                    $existingJson = Get-Content -LiteralPath $settingsTarget -Raw -Encoding UTF8 | ConvertFrom-Json
                    if ($existingJson.permissions -and $existingJson.permissions.allow) {
                        $beforeCount = @($existingJson.permissions.allow).Count
                    }
                } catch {
                    # Malformed existing JSON - Merge-LintasAllowList will handle (or report).
                    $beforeCount = 0
                }
            }

            $mergeResult = Merge-LintasAllowList `
                -ExistingPath $settingsTarget `
                -TemplatePath $settingsTemplate `
                -OutputPath $settingsTarget

            # Post-merge count: prefer return value, fall back to re-read.
            $afterCount = $beforeCount
            if ($mergeResult -is [hashtable] -and $mergeResult.ContainsKey('TotalCount')) {
                $afterCount = [int]$mergeResult.TotalCount
            } elseif ($mergeResult -is [hashtable] -and $mergeResult.ContainsKey('Count')) {
                $afterCount = [int]$mergeResult.Count
            } else {
                try {
                    $mergedJson = Get-Content -LiteralPath $settingsTarget -Raw -Encoding UTF8 | ConvertFrom-Json
                    if ($mergedJson.permissions -and $mergedJson.permissions.allow) {
                        $afterCount = @($mergedJson.permissions.allow).Count
                    }
                } catch {
                    $afterCount = $beforeCount
                }
            }
            $delta = $afterCount - $beforeCount
            Write-Host ("OK    Allow rules merged: {0} total entries (added: {1})" -f $afterCount, $delta) -ForegroundColor Green
            Write-Host ("      Target: {0}" -f $settingsTarget) -ForegroundColor DarkGray

            # GUI notification: only when popup helpers available + not in console mode.
            if (-not $useConsoleMode) {
                try {
                    Show-LintasInfoPopup `
                        -Title "Claude Code Permissions" `
                        -Message "Allow rules untuk install + dev otomatis ter-merge ke .claude/settings.local.json. Tutup + buka ulang VS Code untuk apply."
                } catch {
                    Write-Host "WARN  Popup permission notification gagal: $_" -ForegroundColor Yellow
                    Write-Host "INFO: Allow rules sudah ter-merge - tutup + buka ulang VS Code untuk apply." -ForegroundColor Cyan
                }
            } else {
                Write-Host "INFO: Tutup + buka ulang VS Code untuk apply allow rules baru." -ForegroundColor Cyan
            }
        }
    } catch {
        Write-Host "WARN  Merge allow-list di-skip: $_" -ForegroundColor Yellow
        Write-Host "      Setup TETAP berhasil, tapi Claude Code mungkin tanya permission tiap kali jalankan command." -ForegroundColor Yellow
    }

    # ---- (b) VS Code detect + launch ----
    # FULL PATH detection (NEVER PATH lookup) - cover 4 candidate locations.
    # Array-form ArgumentList for path with spaces/Unicode (project root might have those).
    # Defensive build: env vars may be null/empty on Server Core, sandboxed PS host, SSH
    # sessions without full env, or some Docker images. Join-Path with $null base throws
    # under $ErrorActionPreference='Stop' and aborts the script post-manifest. Guard each
    # candidate + wrap in try/catch as belt-and-suspenders, and reject non-rooted paths
    # to close any future CWD-injection regression.
    $vsCodeCandidates = @()
    try {
        if ($env:LOCALAPPDATA) {
            $vsCodeCandidates += (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\Code.exe")
            $vsCodeCandidates += (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code Insiders\Code - Insiders.exe")
        }
        if ($env:ProgramFiles) {
            $vsCodeCandidates += (Join-Path $env:ProgramFiles "Microsoft VS Code\Code.exe")
        }
        if (${env:ProgramFiles(x86)}) {
            $vsCodeCandidates += (Join-Path ${env:ProgramFiles(x86)} "Microsoft VS Code\Code.exe")
        }
    } catch {
        Write-Host "WARN  VS Code path probe skipped: $_" -ForegroundColor Yellow
        $vsCodeCandidates = @()
    }
    $vsCodeExe = $null
    foreach ($cand in $vsCodeCandidates) {
        if (-not $cand) { continue }
        if (-not [System.IO.Path]::IsPathRooted($cand)) { continue }
        if (Test-Path $cand) { $vsCodeExe = $cand; break }
    }
    if ($vsCodeExe) {
        if (-not $useConsoleMode) {
            try {
                $launch = Show-LintasYesNoPopup `
                    -Title "Setup selesai!" `
                    -Message "Buka VS Code sekarang? (disarankan: Ya - langsung buka VS Code lalu tempel kalimat pembuka). Catatan: isi papan-tempel (clipboard) akan diganti dengan kalimat pembuka - pastikan tidak ada password/rahasia yang sedang kamu salin sekarang. Lanjut?"
                if ($launch -ne "Yes") {
                    $script:__lintasAI_SkippedSteps += 'VS Code launch (user pilih No / cancel popup)'
                }
                if ($launch -eq "Yes") {
                    $starterPrompt = "halo aku staff baru pertama kali clone project ini, guide aku step-by-step"
                    # Track Set-Clipboard outcome so the subsequent info popup tells the truth.
                    # Under RDP with clipboard redirection locked, Set-Clipboard throws; without this
                    # flag we would still tell the user "starter prompt sudah di clipboard" (FALSE)
                    # and they would paste nothing or stale content.
                    $clipboardOk = $true
                    try {
                        Set-Clipboard -Value $starterPrompt
                    } catch {
                        $clipboardOk = $false
                        Write-Host "WARN  Set-Clipboard gagal: $_" -ForegroundColor Yellow
                    }
                    # Positional path argument avoids URI-encoding bugs with spaces/Unicode/reserved chars.
                    # Start-Process joins -ArgumentList entries with spaces WITHOUT adding quotes,
                    # so a $ProjectRoot containing a space (e.g. "C:\Users\John Doe\...") would be
                    # split by VS Code into multiple positional args. Wrap in literal double-quotes.
                    try {
                        Start-Process $vsCodeExe -ArgumentList @('"' + $ProjectRoot + '"')
                        if ($clipboardOk) {
                            $popupMessage = "Starter prompt sudah di clipboard. Buka Claude Code chat, tekan Ctrl+V, lalu Enter."
                            $consoleMessage = "INFO: Starter prompt sudah di clipboard. Buka Claude Code chat, Ctrl+V, Enter."
                        } else {
                            # Inline the prompt so user can copy it manually from the popup body.
                            $popupMessage = "Clipboard gagal di-set (kemungkinan RDP clipboard redirection terkunci). Copy manual starter prompt berikut, lalu paste di Claude Code chat dan tekan Enter:`r`n`r`n$starterPrompt"
                            $consoleMessage = "INFO: Clipboard gagal di-set. Copy manual starter prompt berikut ke Claude Code chat: $starterPrompt"
                        }
                        try {
                            Show-LintasInfoPopup `
                                -Title "Tip" `
                                -Message $popupMessage
                        } catch {
                            Write-Host $consoleMessage -ForegroundColor Cyan
                            Write-Host "INFO: GUI degraded - sisa prompt akan pakai console mode." -ForegroundColor Yellow
                            $script:useConsoleMode = $true
                            $useConsoleMode = $true
                        }
                    } catch {
                        Write-Host "WARN  Gagal launch VS Code: $_" -ForegroundColor Yellow
                    }
                }
            } catch {
                Write-Host "WARN  VS Code popup gagal: $_" -ForegroundColor Yellow
                Write-Host "INFO: GUI degraded - sisa prompt akan pakai console mode." -ForegroundColor Yellow
                $script:useConsoleMode = $true
                $useConsoleMode = $true
            }
        } else {
            Write-Host ("INFO: VS Code terdeteksi di {0} - launch dilewati karena console mode." -f $vsCodeExe) -ForegroundColor Cyan
        }
    } else {
        Write-Host "VS Code tidak terdeteksi - install dari code.visualstudio.com kalau perlu" -ForegroundColor Yellow
    }
}

# ---- Ringkasan akhir (structured + actionable) ----
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host ("  OK    KIT lintasAI - TER-INSTALL DI {0}" -f $ProjectName) -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""

Write-Host "SUDAH AKTIF (auto-load tiap sesi AI):" -ForegroundColor Cyan
Write-Host "  [x] Aturan AI         : 4 rule docs + Tinjauan lintasAI Divisi (programmer + non-programmer)"
if ($proyekHampirKosong) {
    Write-Host "  [ ] docs/             : SKIP (proyek hampir kosong) - akan auto-generate saat ada code"
    Write-Host "  [ ] .github/          : SKIP (proyek hampir kosong) - team files belum di-copy"
} else {
    Write-Host "  [x] docs/             : skeleton + panduan tim (architecture, glossary, _PATTERNS, dst.)"
    if (-not $SkipTeamFiles) {
        Write-Host "  [x] .github/          : ai-review.yml + CODEOWNERS + PR template"
    } else {
        Write-Host "  [ ] .github/          : SKIP (-SkipTeamFiles aktif)"
    }
}
Write-Host "  [x] Lokasi aturan     : dari folder .claude-kit/ di project ini"
Write-Host ""

Write-Host "HAL YANG PERLU KAMU LAKUKAN SENDIRI:" -ForegroundColor Yellow
$itemIdx = 1
if (-not $SkipTeamFiles -and -not $proyekHampirKosong) {
    Write-Host ("  [ ] ({0}) ~5 menit  Edit .github/CODEOWNERS - ganti placeholder @username dengan GitHub username actual." -f $itemIdx)
    $itemIdx++
    Write-Host ("  [ ] ({0}) ~2 menit  Setup ANTHROPIC_API_KEY di GitHub: Settings -> Secrets and variables -> Actions -> New secret." -f $itemIdx)
    $itemIdx++
}
Write-Host ("  [ ] ({0}) opsional  Baca docs/CLAUDE_TEAM_GUIDE.md (panduan tim) + docs/PROMPT_LIBRARY.md." -f $itemIdx)
$itemIdx++

# ---- v1.5.6 Fix #2: Package Manager surface ----
# Surfaced di closing supaya staff tahu install command yang benar
# (mis. `pnpm install` bukan salah ketik `npm install` yang corrupt lockfile).
try {
    if (Get-Command Get-PackageManager -ErrorAction SilentlyContinue) {
        $pm = Get-PackageManager -ProjectRoot $ProjectRoot
        if ($pm.Manager -ne 'none' -and $pm.InstallCmd) {
            Write-Host ""
            Write-Host ("=== Perintah pasang dependensi (deteksi: {0}) ===" -f $pm.Manager) -ForegroundColor Cyan
            Write-Host ("  Pakai: {0}" -f $pm.InstallCmd) -ForegroundColor Green
            if ($pm.LockFile) {
                Write-Host ("  Alasan: {0}" -f $pm.Reason) -ForegroundColor DarkGray
            } else {
                Write-Host ("  Alasan: {0} (keyakinan rendah/sedang)" -f $pm.Reason) -ForegroundColor DarkGray
            }
            Write-Host ("  Jalankan server lokal: {0}" -f $pm.RunCmd) -ForegroundColor DarkGray
        }
    }
} catch {
    # Silent - non-fatal. Package manager detection nice-to-have, jangan break setup kalau gagal.
    $null = $_
}

# ---- v1.5.6 Fix #3: Branch protection + adaptive commit guidance ----
try {
    $bp = Test-MainBranchProtected -ProjectRoot $ProjectRoot
    Write-Host ""
    Write-Host "=== Panduan simpan ke git (commit) ===" -ForegroundColor Cyan
    if ($bp.Protected -eq $true) {
        Write-Host ("[!] Branch '{0}' di GitHub TER-PROTECT - direct commit ke main akan ditolak." -f $bp.DefaultBranch) -ForegroundColor Yellow
        Write-Host "    Pakai pattern branch + PR:" -ForegroundColor Yellow
        Write-Host "      git checkout -b chore/setup-lintasai-kit" -ForegroundColor White
        Write-Host "      git add AGENTS.md .claude-kit/ docs/ .github/" -ForegroundColor White
        Write-Host "      git commit -m 'chore: setup standar tim IT (lintasAI v1.5.6)'" -ForegroundColor White
        Write-Host "      git push -u origin chore/setup-lintasai-kit" -ForegroundColor White
        Write-Host "      gh pr create --fill" -ForegroundColor White
    } elseif ($bp.Protected -eq $false) {
        Write-Host ("Branch default '{0}' tidak ter-protect - direct commit OK:" -f $bp.DefaultBranch) -ForegroundColor Green
        Write-Host "  git add AGENTS.md .claude-kit/ docs/ .github/" -ForegroundColor White
        Write-Host "  git commit -m 'chore: setup standar tim IT (lintasAI v1.5.6)'" -ForegroundColor White
    } else {
        # Protected = $null -> bisa karena gh missing / no remote / no auth.
        Write-Host ("[i] Tidak bisa detect branch protection ({0})." -f $bp.Reason) -ForegroundColor DarkGray
        Write-Host "    Cek manual di GitHub Settings -> Branches sebelum commit ke main." -ForegroundColor DarkGray
        Write-Host "    Kalau ragu, pakai pattern branch + PR (lebih safe):" -ForegroundColor DarkGray
        Write-Host "      git checkout -b chore/setup-lintasai-kit && git add ... && git commit ... && gh pr create --fill" -ForegroundColor White
    }
} catch {
    # Fallback ke pesan original kalau helper crash.
    Write-Host ("  [ ] ({0}) opsional  Commit setup ke git: git add AGENTS.md .claude-kit/ docs/ .github/ && git commit -m 'chore: setup standar tim IT'" -f $itemIdx)
}
Write-Host ""

Write-Host "LANGKAH SELANJUTNYA - BIASANYA OTOMATIS:" -ForegroundColor Cyan
Write-Host ("  Buka Claude Code di {0}." -f $ProjectRoot)
Write-Host "  Popup pemandu akan MUNCUL SENDIRI (kamu tinggal ketik angka) - kamu" -ForegroundColor Cyan
Write-Host "  TIDAK perlu paste apa-apa. AI yang baca + pandu langkah demi langkah."
Write-Host ""
Write-Host "  KALAU popup tidak muncul sendiri, ketik 1 kalimat ini ke Claude Code:" -ForegroundColor Yellow
Write-Host "      lanjutkan setup lintasAI" -ForegroundColor Green
Write-Host ("  (cara lama juga boleh: paste isi {0}\JALANKAN_KIT.md - hasil sama persis)." -f $KitDir) -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Kalau mau langsung kerja: boleh - aturan AI tetap otomatis kebaca tiap" -ForegroundColor DarkGray
Write-Host "  sesi, catatan kode dibuat otomatis saat dibutuhkan." -ForegroundColor DarkGray
Write-Host ""

# v1.5.7: Explicit AI-directed checklist. Cegah bug "AI stop di SIAP NGODING tanpa lanjut workflow"
# yang terdeteksi di dogfood akses 2026-06-08. AI yang invoke setup via npx WAJIB read + execute
# POST_SETUP_CHECKLIST_PROMPT_v1.md (Phase 5b). User-driven paste flow (LANGKAH SELANJUTNYA di atas)
# tetap valid sebagai alternative. Per CLAUDE_universal_v1.md Section 4.3b + 4.4 trigger #1.
Write-Host "(Catatan di bawah ini UNTUK AI, bukan untukmu. Kamu sebagai manusia TIDAK perlu" -ForegroundColor DarkGray
Write-Host " melakukan apa-apa - cukup biarkan AI yang baca + lanjut sendiri.)" -ForegroundColor DarkGray
Write-Host "=== AI: POST-INSTALL CHECKLIST (WAJIB EKSEKUSI - JANGAN STOP) ===" -ForegroundColor Magenta
Write-Host "Instalasi (Fase A) SELESAI - tapi tugasmu (AI) BELUM. Fase B (pemanduan chat)" -ForegroundColor Cyan
Write-Host "BELUM jalan. 'Status: SIAP NGODING' di bawah = Fase A beres, BUKAN akhir tugasmu." -ForegroundColor Cyan
Write-Host "Tugas KAMU (AI) sekarang - JANGAN berhenti, lanjut Fase B:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [ ] (1) WAJIB read .claude-kit/POST_SETUP_CHECKLIST_PROMPT_v1.md"
Write-Host "  [ ] (2) WAJIB jalankan popup flow dari SUMBER TUNGGAL JALANKAN_KIT.md Bagian 2-7"
Write-Host "          (Setup Mode + Ukuran Tim + Audit + Split). JANGAN definisikan popup sendiri"
Write-Host "          - itu bikin output beda antar jalur npx vs paste-manual (drift, di-fix v1.6.7)."
Write-Host "  [ ] (3) Eksekusi sesuai jawaban user (mapping lengkap di JALANKAN_KIT.md Bagian 2-6)."
Write-Host "  [ ] (4) WAJIB tawarkan Audit Post-Setup ke user (mode aman cuma-baca): 'ya/nanti'."
Write-Host "  [ ] (5) WAJIB lapor Pending Action Items - SUMBER TUNGGAL JALANKAN_KIT.md Bagian 7"
Write-Host "          + arahkan owner ke docs/OWNER_SETUP_CHECKLIST.md (tugas teknis sekali-pasang)."
Write-Host "  [ ] (6) WAJIB pakai Bahasa Non-Programmer di SEMUA output sesi setelah ini:"
Write-Host "          inline narasi antar tool, Update Todos label, body final response,"
Write-Host "          Tinjauan lintasAI Divisi (programmer + non-programmer)."
Write-Host "          Per Section 2.1.1 PRE-SEND CHECKLIST"
Write-Host "          (v1.5.9 reinforcement). Run checklist SEBELUM tutup setiap response."
Write-Host ""
Write-Host "LARANGAN: AI TIDAK BOLEH stop di 'Status: SIAP NGODING' tanpa lapor checklist (1-6)." -ForegroundColor Yellow
Write-Host "LARANGAN: AI TIDAK BOLEH skip Bahasa Non-Programmer (Section 2.1.1) — pattern violation" -ForegroundColor Yellow
Write-Host "          caught 2x (v1.5.0 + v1.5.8 ship sessions). Reinforcement v1.5.9 di Section 2.1.1." -ForegroundColor Yellow
Write-Host ""
Write-Host "Per CLAUDE_universal_v1.md Section 2.1.1 (PRE-SEND CHECKLIST) +"
Write-Host "Section 4.3b (Auto-Trigger Post-Install) +"
Write-Host "Section 4.4 trigger condition #1 (audit auto-offer setelah setup-pola-b)."
Write-Host ""
Write-Host "User boleh opt-out via chat: 'skip post-setup checklist' / 'cuma popup 3' / 'cuma audit'." -ForegroundColor DarkGray
Write-Host ""

Write-Host "UPDATE KIT KE VERSI BARU:" -ForegroundColor Cyan
Write-Host "  .\.claude-kit\update-kit.ps1   (auto re-clone + backup + detect [BREAKING]/[SCAN-REQUIRED])"
Write-Host ""

if ($DryRun) {
    Write-Host "Mode SIMULASI: jalankan ulang tanpa -DryRun untuk eksekusi sungguhan." -ForegroundColor Yellow
}
# Trace #1 graceful-cancel summary: lapor ke user kalau ada langkah yang di-skip
# karena cancel popup / no-input. Tetap exit 0 (graceful), bukan error.
if ($script:__lintasAI_SkippedSteps.Count -gt 0) {
    Write-Host ""
    Write-Host "Setup selesai dengan beberapa langkah di-skip oleh user:" -ForegroundColor Yellow
    foreach ($s in $script:__lintasAI_SkippedSteps) { Write-Host "  - $s" -ForegroundColor Yellow }
    Write-Host ""
}
Write-Host "Status: SIAP NGODING" -ForegroundColor Green
Write-Host ""
# v1.43.1: baris TERAKHIR sengaja = direktif AI lanjut Fase B, supaya kesan terakhir AI
# BUKAN "selesai" ('SIAP NGODING' di atas gampang disangka tugas kelar). Akar: saat AI yang
# pasang, aturan auto-lanjut (Sec 4.3b) belum ter-load di sesi ini -> satu-satunya pembawa ke
# Fase B = teks penutup ini. Lihat CLAUDE_universal_v1.md Sec 4.3b + POST_SETUP_CHECKLIST.
Write-Host "=== AI (penutup): JANGAN berhenti di 'SIAP NGODING' - itu cuma akhir Fase A. ===" -ForegroundColor Magenta
Write-Host "    LANJUT SEKARANG: baca .claude-kit/POST_SETUP_CHECKLIST_PROMPT_v1.md, lalu jalankan" -ForegroundColor Magenta
Write-Host "    popup pemandu Fase B (JALANKAN_KIT.md Bagian 2-7). Tugasmu belum kelar." -ForegroundColor Magenta
Write-Host ""
exit 0
