<#
.SYNOPSIS
  update-kit.ps1 - Update kit lintasAI di proyek ke versi terbaru via re-clone fresh.

.DESCRIPTION
  Workflow atomic (zero half-state):
    1. Backup .claude-kit/ lama → .claude-kit.backup-<timestamp>
    2. Clone fresh dari GitHub ke .claude-kit/ baru
    3. Hapus .git/ internal supaya tidak konflik dengan git proyek user
    4. Re-run setup-pola-b.ps1 -Force (anti-overwrite preserve docs/ existing)
    5. Tampilkan diff CHANGELOG lama vs baru + action items

  Cara B (re-clone fresh) sesuai README - paling clean, no merge conflict
  possible, atomic operation.

.PARAMETER NoBackup
  Skip backup .claude-kit/ lama (irreversible). Default: backup aktif.

.PARAMETER RepoUrl
  Override GitHub URL (untuk fork private kamu sendiri).
  Default: https://github.com/ojokesusu/lintasAI.git

.PARAMETER Branch
  Branch yang di-clone. Default: main.

.PARAMETER DryRun
  Preview tindakan tanpa eksekusi nyata.

.PARAMETER AllowUntrustedRepo
  Bypass RepoUrl allowlist check (kalau pakai fork private / mirror tidak
  terdaftar di $allowedRepoUrls). Tanpa flag ini, RepoUrl di luar allowlist
  akan prompt user (interactive) atau abort (non-interactive).
  UNSAFE - pakai cuma kalau yakin sumber tepercaya atau di CI.

.PARAMETER Force
  [DEPRECATED] Backward-compat alias untuk -AllowUntrustedRepo (RepoUrl
  allowlist bypass). Akan menampilkan deprecation warning. Pakai
  -AllowUntrustedRepo untuk explicit intent.
  CATATAN: -Force TIDAK lagi bypass GPG verify-tag. Untuk GPG bypass pakai
  -AllowUnsignedTag (separation of concerns).
  CATATAN: -Force juga TIDAK mengonfirmasi hapus-permanen pada -NoBackup. Untuk
  auto-konfirmasi hapus-tanpa-backup secara unattended pakai -YesDeleteNoBackup
  (saklar eksplisit terpisah, supaya tidak ada kehilangan data tak disengaja).

.PARAMETER YesDeleteNoBackup
  Auto-konfirmasi penghapusan PERMANEN kit lama saat -NoBackup aktif (unattended/CI).
  Tanpa flag ini, -NoBackup non-interaktif akan ABORT (fail-closed) daripada menghapus
  tanpa cadangan. Aksi destruktif - pakai cuma kalau sadar konsekuensi.

.PARAMETER AllowUnsignedTag
  Bypass GPG tag signature verification (fail-closed by default).
  Default: false - kalau tag tidak signed atau pubkey owner tidak ter-import,
  update DI-ABORT (no interactive prompt). Pakai flag ini cuma kalau owner
  belum publish signed release / kamu sengaja jalanin dari fork tanpa key.
  Detail setup pubkey owner: docs/SIGNED_RELEASE.md.

.PARAMETER CleanupBackups
  Opt-in flag untuk auto-hapus backup lama (*.bak / *.backup-*) di project root.
  Default: false (SKIP cleanup) - supaya tidak kaget hapus AGENTS.md.backup-*
  atau file backup buatan user yang masih dipakai untuk recovery.
  Kalau aktif: hapus backup > 30 hari, dan per base-name keep latest 3.
  Sejak v1.3.1 cleanup tidak lagi otomatis (sebelumnya auto setiap update).

.NOTES
  Versi  : 1.0
  Tanggal: 2026-06-01
  Kit    :
  Run    : .\.claude-kit\update-kit.ps1
  Atau   : powershell -ExecutionPolicy Bypass -File .\.claude-kit\update-kit.ps1

  Jalankan dari root proyek (folder yang ada .claude-kit/ di dalamnya).

  Catatan keamanan:
  - Script tidak modify file di luar .claude-kit/. docs/ + .github/ proyek user AMAN
    (anti-overwrite dari setup-pola-b.ps1).
  - Kalau git clone gagal (network/auth issue), backup akan di-rollback otomatis
    untuk recovery.
#>

[CmdletBinding()]
param(
    [switch]$NoBackup,
    [string]$RepoUrl = 'https://github.com/ojokesusu/lintasAI.git',
    [string]$Branch = 'main',
    [switch]$DryRun,
    [switch]$CheckOnly,
    [switch]$AllowUntrustedRepo,
    [switch]$Force,
    [switch]$AllowUnsignedTag,
    [switch]$CleanupBackups,
    [switch]$YesDeleteNoBackup,
    [string]$ProjectRoot = $null
)

$ErrorActionPreference = 'Stop'

# ---- Dot-source popup-helpers untuk security-sensitive Read-Host -> popup conversion ----
# Pass 7 v1.4.0: untuk staff IT non-programmer di GUI session, security decision
# (untrusted repo URL) harus visible via popup WARNING - bukan console Read-Host.
$popupHelpersPath = Join-Path $PSScriptRoot 'lib/popup-helpers.ps1'
$script:__lintasAI_PopupAvailable = $false
if (Test-Path $popupHelpersPath) {
    try {
        . $popupHelpersPath
        $script:__lintasAI_PopupAvailable = $true
    } catch {
        # Popup helpers load fail = console fallback only (preserve behavior)
        Write-Host "INFO: popup-helpers tidak ter-load, console fallback aktif: $_" -ForegroundColor DarkGray
    }
}

# ---- Dot-source audit-helpers untuk Add-LintasAuditEntry (security decision log) ----
# v1.5.5 (2026-06-08): append-only audit log untuk GPG skip / bypass + future
# security-relevant ops. Format ISO 8601 UTC, plain text, di .claude-kit/.audit-log.
$auditHelpersPath = Join-Path $PSScriptRoot 'lib/audit-helpers.ps1'
if (Test-Path $auditHelpersPath) {
    try { . $auditHelpersPath } catch { Write-Host "INFO: audit-helpers tidak ter-load: $_" -ForegroundColor DarkGray }
}

# ---- Detect headless mode (no GUI) ----
$useConsoleMode = $false
if ($script:__lintasAI_PopupAvailable) {
    try {
        $isHeadless = -not (Test-LintasGuiAvailable)
        if ($isHeadless) { $useConsoleMode = $true }
    } catch { $useConsoleMode = $true }
} else {
    $useConsoleMode = $true
}

# ---- Resolve $ProjectRoot early (param-driven, fallback to script location) ----
# Kalau user pass -ProjectRoot pakai itu (untuk smoke test / CI). Kalau tidak, derive dari
# $PSScriptRoot (script ada di .claude-kit\, parent = project root).
# v1.33.1: tangkap APAKAH -ProjectRoot di-pass EKSPLISIT (sebelum $ProjectRoot di-overwrite di
# bawah). CATATAN cutover: `npx lintasai update` kini menjalankan port Node update-kit.mjs; skrip
# PS ini = CADANGAN manual (mis. `.\.claude-kit\update-kit.ps1 -ProjectRoot <proj>` atau via CI).
# Saat -ProjectRoot di-pass, $PSScriptRoot bisa = folder cache npm; maka kit yang BENAR untuk
# di-backup/diganti = $ProjectRoot\.claude-kit, BUKAN $PSScriptRoot. Lihat $kitDir di bawah.
$projectRootExplicit = $PSBoundParameters.ContainsKey('ProjectRoot') -and -not [string]::IsNullOrWhiteSpace($ProjectRoot)
if (-not $ProjectRoot) {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
} else {
    $ProjectRoot = (Resolve-Path $ProjectRoot -ErrorAction Stop).Path
}
Write-Host "Root proyek   : $ProjectRoot"

# ---- Deprecation handling: -Force jadi alias backward-compat untuk -AllowUntrustedRepo ----
# Sebelumnya -Force overloaded (GPG bypass + RepoUrl bypass). GPG bypass sekarang lewat
# -AllowUnsignedTag; -Force narrowed jadi alias RepoUrl-allowlist-bypass saja, dengan warn.
if ($Force) {
    Write-Host ''
    Write-Host '[DEPRECATED] -Force flag. Pakai -AllowUntrustedRepo.' -ForegroundColor Yellow
    Write-Host '             -Force masih bekerja sebagai alias untuk RepoUrl-allowlist bypass,' -ForegroundColor Yellow
    Write-Host '             tapi akan dihapus di versi mendatang. Ganti pemanggilan script kamu.' -ForegroundColor Yellow
    Write-Host '             Untuk GPG bypass, pakai -AllowUnsignedTag (bukan -Force lagi).' -ForegroundColor Yellow
    Write-Host ''
    if (-not $AllowUntrustedRepo) { $AllowUntrustedRepo = $true }
}

# ---- Resolve paths (do this FIRST, sebelum Move-Item rename folder) ----
# $ProjectRoot (PascalCase) sudah di-resolve dari param di awal. $projectRoot (camelCase)
# di-alias supaya legacy code di bawah tetap jalan tanpa rename massal.
# v1.33.1 FIX (GENTING): saat -ProjectRoot di-pass eksplisit (jalur `npx lintasai update`), kit
# yang di-backup/diganti = $ProjectRoot\.claude-kit -- BUKAN lokasi script ($PSScriptRoot =
# folder cache npm). Tiru pola kit.ps1:70-75 yang sudah benar. Tanpa -ProjectRoot (jalur
# langsung `.\.claude-kit\update-kit.ps1` atau via `kit.ps1 update`), $PSScriptRoot SUDAH
# folder .claude-kit project, jadi pakai itu apa adanya.
if ($projectRootExplicit) {
    $kitDir = Join-Path $ProjectRoot '.claude-kit'
} else {
    $kitDir = if ($PSScriptRoot) { $PSScriptRoot } elseif ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { (Get-Location).Path }
}
$kitFolderName = Split-Path -Leaf $kitDir
$projectRoot = $ProjectRoot
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = "$kitDir.backup-$timestamp"

# ---- Trusted repo whitelist (auto-skip GPG verify untuk owner repo resmi) ----
# Filosofi: GPG signature membuktikan AUTHOR (siapa yang sign tag). RepoUrl
# allowlist membuktikan SOURCE (clone-nya dari mana). Untuk owner repo resmi
# (github.com/ojokesusu/lintasAI), HTTPS+TLS sudah jamin integrity transport
# dan GitHub-side branch protection jamin tidak ada force-push. GPG jadi
# defense-in-depth ketiga - tapi bisa di-skip kalau RepoUrl match trusted
# whitelist supaya staff IT non-programmer tidak ke-banjir warning palsu.
#
# Override via env var (comma-separated) untuk private fork/mirror tepercaya:
#   $env:LINTASAI_TRUSTED_REPOS = 'https://github.com/mycompany/lintasAI-fork.git'
$TrustedRepos = @(
    'https://github.com/ojokesusu/lintasAI.git',
    'https://github.com/ojokesusu/lintasAI',
    'git@github.com:ojokesusu/lintasAI.git'
)
if ($env:LINTASAI_TRUSTED_REPOS) {
    $extraTrusted = ($env:LINTASAI_TRUSTED_REPOS -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    if ($extraTrusted) { $TrustedRepos += $extraTrusted }
}

function Write-LintasRepoAccessHint {
    # Pesan panduan AWAM saat gagal hubungi repo standar tim (ls-remote / clone). Penyebab tersering di
    # lapangan = (a) repo TIM PRIVAT & belum diundang/login Git, atau (b) Git belum terpasang. Pesan git
    # mentah ("could not read Username") tak dimengerti staff non-programmer -> terjemahkan + langkah konkret.
    param([Parameter(Mandatory = $true)][string]$RepoUrl)
    Write-Host ""
    Write-Host "Kemungkinan penyebab (cek dari atas ke bawah):" -ForegroundColor Yellow
    Write-Host "  1. Repo standar tim bersifat PRIVAT + kamu belum punya akses. Minta owner UNDANG akun"
    Write-Host "     GitHub-mu ke repo, lalu login Git sekali (Git Credential Manager / 'gh auth login')."
    Write-Host "  2. Git belum terpasang di komputer ini. Pasang dari https://git-scm.com/ lalu buka terminal baru."
    Write-Host "  3. Sedang offline / jaringan kantor memblokir GitHub."
    Write-Host "  Repo yang dicoba: $RepoUrl"
}

function Restore-LintasOldKit {
    <#
    .SYNOPSIS
      Pulihkan folder cadangan kit lama (fail-closed). Dipakai saat clone gagal ATAU verifikasi GPG
      gagal / isi tak-bisa-diikat ke tag terverifikasi.
    .DESCRIPTION
      JANGAN biarkan kit BARU yang belum lolos pemeriksaan tetap aktif; kembalikan kit lama (yang
      sudah terverifikasi di update sebelumnya). Audit P1/P2 2026-06-23: dulu jalur abort-GPG `throw`
      TANPA memulihkan cadangan -> kit tak-terverifikasi malah jadi aktif (fail-closed TERBALIK).
      Cermin restoreBackupOrWarn() di update-kit.mjs.
    #>
    param(
        [Parameter(Mandatory=$true)][string]$BackupDir,
        [Parameter(Mandatory=$true)][string]$KitDir,
        [switch]$NoBackup
    )
    if ((-not $NoBackup) -and (Test-Path $BackupDir)) {
        Write-Host ''
        Write-Host 'PEMULIHAN: kembalikan folder cadangan (kit lama yang sudah terverifikasi)...' -ForegroundColor Yellow
        try {
            # Hapus folder partial .claude-kit kalau ada (clone gagal kadang bikin folder kosong).
            if (Test-Path $KitDir) {
                Remove-Item -Path $KitDir -Recurse -Force -ErrorAction SilentlyContinue
            }
            Move-Item -Path $BackupDir -Destination $KitDir -Force
            Write-Host "OK    Cadangan dipulihkan. Kit lama aktif lagi di $KitDir" -ForegroundColor Green
        } catch {
            Write-Host "GAGAL pulihkan: $_" -ForegroundColor Red
            Write-Host "       Pulihkan manual: Move-Item '$BackupDir' '$KitDir'" -ForegroundColor Yellow
        }
    } else {
        Write-Host 'TIDAK ada cadangan untuk dipulihkan (-NoBackup aktif atau folder cadangan tak ada).' -ForegroundColor Yellow
    }
}

function Test-LintasTrustedRepo {
    <#
    .SYNOPSIS
      Cek apakah $RepoUrl match whitelist trusted (owner repo resmi atau env override).
    .DESCRIPTION
      Normalize URL (lowercase + trim trailing '/' dan '.git') sebelum compare
      supaya 'https://github.com/x/y.git' = 'https://github.com/x/y/' = 'https://github.com/x/y'.
      SSH format (git@github.com:x/y.git) di-compare apa-adanya setelah lowercase+trim.
    .OUTPUTS
      [bool] $true kalau trusted, $false kalau tidak.
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoUrl
    )
    if ([string]::IsNullOrWhiteSpace($RepoUrl)) { return $false }
    $normalized = $RepoUrl.Trim().TrimEnd('/').ToLower()
    if ($normalized.EndsWith('.git')) {
        $normalized = $normalized.Substring(0, $normalized.Length - 4)
    }
    foreach ($trusted in $TrustedRepos) {
        if ([string]::IsNullOrWhiteSpace($trusted)) { continue }
        $trustedNorm = $trusted.Trim().TrimEnd('/').ToLower()
        if ($trustedNorm.EndsWith('.git')) {
            $trustedNorm = $trustedNorm.Substring(0, $trustedNorm.Length - 4)
        }
        if ($normalized -eq $trustedNorm) { return $true }
    }
    return $false
}

# === UPDATE STRATEGY ENHANCEMENT (v1.0.0+) ===
# 4 helper functions + hook integration. See section 4.5 di CLAUDE_universal_v1.md.


# ---- Section: Get-LatestChangelogEntry ----
# Baca .claude-kit/CHANGELOG.md, ambil entry version paling atas (versi terbaru).
# Konvensi CHANGELOG: heading "## [X.Y.Z]" (format SEKARANG, Keep-a-Changelog) ATAU
# "## vX.Y.Z" (gaya lama) di awal baris. v1.13.3: 'v' opsional, capture digit-only.
# Return hashtable: @{ Version = '1.2.0' (digit-only, tanpa 'v'); Body = '...isi entry...' }
# Kalau gagal parse, return $null (caller harus handle).
function Get-LatestChangelogEntry {
    param(
        [string]$ChangelogPath = ".\.claude-kit\CHANGELOG.md"
    )

    try {
        if (-not (Test-Path $ChangelogPath)) {
            Write-Host "[WARN] CHANGELOG.md tidak ketemu di $ChangelogPath" -ForegroundColor Yellow
            return $null
        }

        # Baca raw biar BOM-safe; -Encoding UTF8 di PS 5.1 sudah handle BOM otomatis.
        $lines = Get-Content -Path $ChangelogPath -Encoding UTF8 -ErrorAction Stop

        $latestVersion = $null
        $bodyLines     = New-Object System.Collections.Generic.List[string]
        $inLatest      = $false

        # Pattern fleksibel (v1.13.3 fix): "## [1.13.2]" (format sekarang, TANPA 'v'),
        # "## v1.2.0" (gaya lama), "## [v1.2.0]", "## v1.2.0 - 2026-06-04". 'v' dibuat OPSIONAL
        # + capture digit-only supaya entri bracketed-tanpa-v (## [1.13.x]) tidak ter-skip
        # (dulu 'v' wajib -> entri terbaru ter-bayang oleh '## v1.12.0' lama -> versi stale).
        $versionPattern = '^##\s*\[?v?(\d+\.\d+\.\d+)\]?'

        foreach ($line in $lines) {
            if ($line -match $versionPattern) {
                if ($null -eq $latestVersion) {
                    # Heading versi pertama yang ketemu = versi terbaru (CHANGELOG urut desc).
                    $latestVersion = $Matches[1]
                    $inLatest = $true
                    continue
                } else {
                    # Heading versi kedua = stop, body entry pertama udah komplit.
                    break
                }
            }

            if ($inLatest) {
                $bodyLines.Add($line) | Out-Null
            }
        }

        if ($null -eq $latestVersion) {
            Write-Host "[WARN] Tidak ada heading versi (## vX.Y.Z) di CHANGELOG" -ForegroundColor Yellow
            return $null
        }

        $body = ($bodyLines -join "`n").Trim()

        return @{
            Version = $latestVersion
            Body    = $body
        }
    }
    catch {
        Write-Host "[ERROR] Gagal parse CHANGELOG: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}


# ---- Section: Get-ChangelogRangeBody ----
# v1.33.1: gabungkan body SEMUA entri CHANGELOG di rentang (FromVersionExclusive, ToVersionInclusive].
# Dipakai pasca-update untuk memindai label [SECURITY]/[BREAKING]/[SCAN-REQUIRED] di SELURUH versi
# yang DILEWATI pengguna (mis. lompat v1.20 -> v1.33), bukan cuma entri teratas. Tanpa ini,
# peringatan keamanan yang ada di versi-tengah bisa terlewat saat pengguna lompat banyak versi.
# Return string (body tergabung) atau '' kalau gagal/kosong (caller fallback ke entri teratas).
function Get-ChangelogRangeBody {
    param(
        [Parameter(Mandatory = $true)][string]$ChangelogPath,
        [Parameter(Mandatory = $true)][string]$FromVersionExclusive,
        [Parameter(Mandatory = $true)][string]$ToVersionInclusive
    )
    try {
        if (-not (Test-Path $ChangelogPath)) { return '' }
        $lines = Get-Content -Path $ChangelogPath -Encoding UTF8 -ErrorAction Stop

        # Pola heading versi konsisten dengan Get-LatestChangelogEntry (## [1.2.3] / ## v1.2.3).
        $versionPattern = '^##\s*\[?v?(\d+\.\d+\.\d+)\]?'

        $fromV = $null; $toV = $null
        try { $fromV = [version](($FromVersionExclusive) -replace '^v', '') } catch { return '' }
        try { $toV = [version](($ToVersionInclusive) -replace '^v', '') } catch { return '' }

        $collect = New-Object System.Collections.Generic.List[string]
        $inRange = $false
        foreach ($line in $lines) {
            if ($line -match $versionPattern) {
                $v = $null
                try { $v = [version]$Matches[1] } catch { $v = $null }
                # Sertakan entri yang versinya di (from, to]. Heading [Unreleased]/non-versi
                # tidak match -> di-skip sebagai konten saat $inRange=false (di atas versi pertama).
                $inRange = ($null -ne $v -and $v -gt $fromV -and $v -le $toV)
                continue  # heading-nya sendiri tidak ikut di-collect
            }
            if ($inRange) { $collect.Add($line) | Out-Null }
        }
        return ($collect -join "`n").Trim()
    }
    catch {
        return ''
    }
}


# ---- Section: Test-LintasChangelogLabel ----
# Deteksi apakah BODY entri CHANGELOG memuat label spesial ([SECURITY] / [BREAKING] /
# [SCAN-REQUIRED]) di POSISI KONVENSIONAL awal baris. Penanda awal yang diizinkan:
# heading markdown (#..######), butir list (- / *), penebalan (**), atau kombinasinya.
# Anchored ke awal baris ((?m)^) supaya penyebutan label di TENGAH prosa TIDAK memicu
# alarm palsu (mis. "tidak ada [BREAKING] changes di rilis ini" -> tetap tidak match).
#
# GENTING fix (2026-06-18): pola lama '(?m)^\s*[-*]?\s*\*{0,2}\[LABEL\]' TIDAK mengenali
# label yang ditulis sebagai SUB-JUDUL '### [SECURITY] ...' (karakter '#' tak ada di kelas
# [-*]). Akibatnya entri rilis NYATA yang menaruh [SECURITY] hanya di '### [SECURITY] ...'
# (mis. v1.35.0) LOLOS deteksi -> banner "pasang SEGERA" tidak muncul saat staff lompat
# versi -> peringatan keamanan hilang diam-diam.
# GENTING fix LANJUTAN (2026-06-25): pola 2026-06-18 ('### [LABEL]') masih meleset kalau label
# ditulis SETELAH teks judul -> '### Diperbaiki [SECURITY] ...' (gaya entri CHANGELOG kit ini)
# LOLOS deteksi lagi -> banner keamanan hilang. Sekarang pola (1) menangkap [LABEL] DI MANA PUN
# dalam baris heading (#..######), bukan cuma tepat setelah '#'. Dijaga tes pengunci di
# tests/update-kit.Tests.ps1 + tests/update-kit.test.mjs.
# SINGLE-SOURCE: dipakai Resolve-UpdateTier + banner Step 5 supaya dua deteksi tidak drift terpisah.
function Test-LintasChangelogLabel {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Body,
        [Parameter(Mandatory = $true)][ValidateSet('SECURITY', 'BREAKING', 'SCAN-REQUIRED')][string]$Label
    )
    if ([string]::IsNullOrWhiteSpace($Body)) { return $false }
    # Dua pola (cermin update-kit.mjs testChangelogLabel):
    #  (1) baris HEADING (#..######) yang DI MANA PUN memuat [LABEL] -> '### Diperbaiki [SECURITY]' + '### [SECURITY]'.
    #  (2) [LABEL] di AWAL baris setelah opsional butir (-/*) + bold (**) -> '- **[SECURITY]**', '[SECURITY]'.
    # Anchored awal baris ((?m)^) supaya label di TENGAH prosa / butir-prosa TIDAK memicu alarm palsu.
    $esc = [regex]::Escape($Label)
    $pattern = '(?m)^\s*#{1,6}\s+.*\[' + $esc + '\]' + '|^\s*[-*]?\s*\*{0,2}\[' + $esc + '\]'
    return [bool]($Body -match $pattern)
}


# ---- Section: Resolve-UpdateTier ----
# Klasifikasi tier dari isi CHANGELOG entry. Return string: "Tier 1" / "Tier 2" / "Tier 3" / "Tier 4".
# Urutan cek (paling spesifik dulu): SCAN-REQUIRED -> BREAKING -> Tier 2 keywords -> Tier 1 default.
# Catatan: nama lama `Classify-UpdateTier` dipakai dgn verb non-approved (Classify) - rename ke
# `Resolve-UpdateTier` (approved verb) supaya lulus PSScriptAnalyzer PSUseApprovedVerbs.
function Resolve-UpdateTier {
    param(
        [Parameter(Mandatory = $true)]
        [string]$EntryBody
    )

    try {
        if ([string]::IsNullOrWhiteSpace($EntryBody)) {
            # Entry kosong dianggap minor patch.
            return "Tier 1"
        }

        # Cek label eksplisit lebih dulu (paling spesifik). Deteksi via helper single-source
        # Test-LintasChangelogLabel: anchored awal baris (cegah false-positive label di tengah
        # prosa) + mengenali gaya sub-judul '### [LABEL]' (GENTING fix 2026-06-18, lihat helper).
        if (Test-LintasChangelogLabel -Body $EntryBody -Label 'SCAN-REQUIRED') {
            return "Tier 4"
        }

        if (Test-LintasChangelogLabel -Body $EntryBody -Label 'BREAKING') {
            return "Tier 3"
        }

        # Tier 2 = fitur/aturan baru. Keyword spesifik biar tidak false-positive.
        $tier2Keywords = @(
            'tambah section',
            'fitur baru',
            'aturan AI',
            'aturan baru',
            'panduan baru',
            'section baru',
            'rule baru',
            'tambah fitur',
            'tambah aturan',
            'tambah panduan'
        )

        foreach ($kw in $tier2Keywords) {
            # -match case-insensitive by default di PS.
            if ($EntryBody -match [regex]::Escape($kw)) {
                return "Tier 2"
            }
        }

        # Default: Tier 1 (typo, fix kecil, perbaikan ringan).
        return "Tier 1"
    }
    catch {
        Write-Host "[WARN] Classify error, fallback Tier 1: $($_.Exception.Message)" -ForegroundColor Yellow
        return "Tier 1"
    }
}


# ---- Section: Format-UpdateSummary ----
# Compose ringkasan ramah staff non-programmer, pakai analogi tools digital populer.
# Return string multi-line siap di-Write-Host.
function Format-UpdateSummary {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Tier,
        [Parameter(Mandatory = $true)]
        [hashtable]$Entry
    )

    $version = $Entry.Version
    $body    = $Entry.Body

    # Map tier -> analogi + action staff.
    $analogi = ""
    $action  = ""

    switch ($Tier) {
        "Tier 1" {
            $analogi = "Tier 1 (kayak WhatsApp minor update, 2.23.10 -> 2.23.11)"
            $action  = "Action: udah selesai. Tinggal pakai biasa, ga ada yang berubah cara kerjanya."
        }
        "Tier 2" {
            $analogi = "Tier 2 (kayak iPhone iOS 17.3 -> 17.4 minor, ada fitur baru)"
            $action  = "Action: AI bakal otomatis pakai aturan/fitur baru sesi berikutnya. Restart chat = aman."
        }
        "Tier 3" {
            $analogi = "Tier 3 BREAKING (kayak iPhone iOS 16 -> iOS 17 major, backup wajib)"
            $action  = "Action: BACA migration notes di CHANGELOG, jalanin PS commands yang tertera. Backup udah otomatis di .bak."
        }
        "Tier 4" {
            $analogi = "Tier 4 SCAN-REQUIRED (kayak Tokopedia ganti algoritma kategori, perlu re-mapping)"
            $action  = "Action: paste ulang isi JALANKAN_KIT.md ke Claude Code. AI bakal re-scan project & re-bootstrap."
        }
        default {
            $analogi = "Unknown tier - treat as Tier 1 (paling aman)"
            $action  = "Action: pakai biasa, monitor sesi berikutnya."
        }
    }

    # Build summary string.
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("============================================================")
    [void]$sb.AppendLine("  Kit Update Summary - v$version")
    [void]$sb.AppendLine("============================================================")
    [void]$sb.AppendLine("Klasifikasi: $analogi")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine($action)
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("--- CHANGELOG entry (verbatim) ---")
    if ([string]::IsNullOrWhiteSpace($body)) {
        [void]$sb.AppendLine("(entry kosong)")
    } else {
        # Trim biar tidak kebanyakan whitespace.
        [void]$sb.AppendLine($body)
    }
    [void]$sb.AppendLine("============================================================")

    return $sb.ToString()
}


# ---- Section: Invoke-BackupCleanup ----
# Bersihin .bak files di project root:
#   1) Hapus yang > 30 hari old.
#   2) Per "base filename" (mis. AGENTS.md.backup-*), keep max 3 yang terbaru.
# Aman: kalau folder gak ada / gak ada .bak, return 0 tanpa error.
function Invoke-BackupCleanup {
    param(
        [string]$ProjectRoot = ".",
        [int]$MaxAgeDays     = 30,
        [int]$KeepLatest     = 3
    )

    try {
        if (-not (Test-Path $ProjectRoot)) {
            Write-Host "[WARN] Project root tidak ada: $ProjectRoot" -ForegroundColor Yellow
            return 0
        }

        # Tangkep dua pola backup: *.bak DAN *.backup-* (sesuai existing AGENTS.md.backup-YYYYMMDD-HHMMSS).
        $backupFiles = @()
        $backupFiles += Get-ChildItem -Path $ProjectRoot -Filter "*.bak" -File -ErrorAction SilentlyContinue
        $backupFiles += Get-ChildItem -Path $ProjectRoot -Filter "*.backup-*" -File -ErrorAction SilentlyContinue

        # v1.33.1: cek juga FOLDER cadangan (.claude-kit.backup-*) supaya rotasi folder (Step 3 di
        # bawah) tetap jalan walau tidak ada backup FILE (.bak/.backup-*) di root. Tanpa ini,
        # early-return di sini membuat Step 3 tak pernah tercapai saat hanya folder yang menumpuk.
        $backupDirsPre = @(Get-ChildItem -Path $ProjectRoot -Filter ".claude-kit.backup-*" -Directory -ErrorAction SilentlyContinue)
        if ((-not $backupFiles -or $backupFiles.Count -eq 0) -and $backupDirsPre.Count -eq 0) {
            Write-Host "Cleanup: tidak ada backup file/folder ditemukan." -ForegroundColor DarkGray
            return 0
        }

        $removed   = 0
        $cutoff    = (Get-Date).AddDays(-1 * $MaxAgeDays)

        # --- Step 1: hapus yang udah > MaxAgeDays ---
        foreach ($f in $backupFiles) {
            if ($f.LastWriteTime -lt $cutoff) {
                try {
                    Remove-Item -Path $f.FullName -Force -ErrorAction Stop
                    $removed++
                }
                catch {
                    Write-Host "[WARN] Gagal hapus $($f.Name): $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
        }

        # --- Step 2: per base-name, keep latest N saja ---
        # "Base name" = nama file sebelum suffix .bak / .backup-*. Contoh:
        #   AGENTS.md.backup-20260601-160733  -> base "AGENTS.md"
        #   docs.md.bak                       -> base "docs.md"
        $remaining = @()
        $remaining += Get-ChildItem -Path $ProjectRoot -Filter "*.bak" -File -ErrorAction SilentlyContinue
        $remaining += Get-ChildItem -Path $ProjectRoot -Filter "*.backup-*" -File -ErrorAction SilentlyContinue

        $groups = $remaining | Group-Object -Property {
            $name = $_.Name
            if ($name -match '^(.+?)\.backup-') { return $Matches[1] }
            if ($name -match '^(.+?)\.bak$')    { return $Matches[1] }
            return $name
        }

        foreach ($grp in $groups) {
            if ($grp.Count -le $KeepLatest) { continue }

            # Sort desc by LastWriteTime, ambil yang setelah index KeepLatest = excess (paling lama).
            $sorted = $grp.Group | Sort-Object -Property LastWriteTime -Descending
            $excess = $sorted | Select-Object -Skip $KeepLatest

            foreach ($f in $excess) {
                try {
                    Remove-Item -Path $f.FullName -Force -ErrorAction Stop
                    $removed++
                }
                catch {
                    Write-Host "[WARN] Gagal hapus $($f.Name): $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
        }

        # --- Step 3 (v1.33.1): rotasi FOLDER cadangan .claude-kit.backup-* ---
        # Versi lama Invoke-BackupCleanup cuma menyapu FILE (*.bak / *.backup-*); folder cadangan
        # kit (.claude-kit.backup-<ts>, dibuat saat update) tidak pernah dirotasi -> menumpuk.
        # Keep latest $KeepLatest folder (berdasarkan LastWriteTime), hapus sisanya.
        $backupDirs = @(Get-ChildItem -Path $ProjectRoot -Filter ".claude-kit.backup-*" -Directory -ErrorAction SilentlyContinue)
        if ($backupDirs.Count -gt $KeepLatest) {
            $excessDirs = $backupDirs | Sort-Object -Property LastWriteTime -Descending | Select-Object -Skip $KeepLatest
            foreach ($d in $excessDirs) {
                try {
                    Remove-Item -Path $d.FullName -Recurse -Force -ErrorAction Stop
                    $removed++
                }
                catch {
                    Write-Host "[WARN] Gagal hapus folder cadangan $($d.Name): $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
        }

        Write-Host "Cleanup: removed $removed old backup(s)/folder(s) (> $MaxAgeDays hari atau di luar latest-$KeepLatest)." -ForegroundColor DarkGray
        return $removed
    }
    catch {
        Write-Host "[ERROR] Backup cleanup gagal total: $($_.Exception.Message)" -ForegroundColor Red
        return 0
    }
}

# === END UPDATE STRATEGY ENHANCEMENT (functions) ===


# ---- Validasi posisi ----
if ($kitFolderName -ne '.claude-kit') {
    Write-Host "PERINGATAN: Folder kit ini bernama '$kitFolderName', bukan '.claude-kit'." -ForegroundColor Yellow
    Write-Host "          Script update-kit.ps1 dirancang untuk Pola B (.claude-kit/ di root proyek)." -ForegroundColor Yellow
    Write-Host "          Tetap lanjut? Sebagian fitur (rename atomic) mungkin tidak presisi." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Update Kit lintasAI ===" -ForegroundColor Cyan
Write-Host "Kit folder    : $kitDir"
Write-Host "Project root  : $projectRoot"
Write-Host "Repo URL      : $RepoUrl"
Write-Host "Branch        : $Branch"
Write-Host "Backup        : $(if ($NoBackup) { 'DISABLED (-NoBackup)' } else { $backupDir })"
if ($DryRun) {
    Write-Host "Mode          : SIMULASI (tidak ada perubahan file)" -ForegroundColor Yellow
}
Write-Host ""

# ---- Pre-check: git installed ----
try {
    $gitVersion = & git --version 2>$null
    Write-Host "OK    Git terdeteksi: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: git tidak terinstall atau tidak di PATH." -ForegroundColor Red
    Write-Host "       Install dari https://git-scm.com/ lalu buka PowerShell baru." -ForegroundColor Red
    exit 1
}

# ---- Pre-check: RepoUrl allowlist (anti-supply-chain) ----
# Cegah update dari fork/mirror tak dikenal yang bisa inject kode jahat.
# Kalau user override $RepoUrl ke URL di luar allowlist, harus konfirm eksplisit.
$allowedRepoUrls = @(
    'https://github.com/ojokesusu/lintasAI.git'
)
if (-not $CheckOnly -and ($RepoUrl -notin $allowedRepoUrls)) {
    Write-Warning "RepoUrl '$RepoUrl' BUKAN di allowlist. Default: github.com/ojokesusu/lintasAI."
    Write-Warning "Detail setup repo tepercaya: docs/SIGNED_RELEASE.md"
    if (-not $AllowUntrustedRepo) {
        # Pass 7 v1.4.0: security-sensitive decision = popup WARNING di GUI session,
        # Read-Host hanya di console mode. Default = safe "No".
        $choice = "n"
        if (-not $useConsoleMode -and $script:__lintasAI_PopupAvailable) {
            try {
                $popupAnswer = Show-LintasYesNoPopup `
                    -Title "PERINGATAN KEAMANAN: Repository Tidak Tepercaya" `
                    -Message "Repo URL '$RepoUrl' di luar allowlist. Default tepercaya: github.com/ojokesusu/lintasAI.`n`nRESIKO: kit dari source tidak resmi = potensi supply chain attack (malware, backdoor, credential exfil).`n`nPilihan: [1] Yes, lanjut clone dari URL tidak terdaftar / [2] No, batalkan (default, safe choice)`n`nKalau ragu, pilih [2] No lalu verifikasi URL ke owner via Signal sebelum retry."
                if ($popupAnswer -eq "Yes") { $choice = "y" }
            } catch {
                # Popup fail = console fallback dengan safe default
                try { $choice = Read-Host "Lanjut clone dari URL tidak terdaftar? [1] Yes / [2] No (default, safe choice)" } catch { $choice = "n" }
                if ($choice -eq '1') { $choice = 'y' } else { $choice = 'n' }
            }
        } else {
            try { $choice = Read-Host "Lanjut clone dari URL tidak terdaftar? [1] Yes / [2] No (default, safe choice)" } catch { $choice = "n" }
            if ($choice -eq '1') { $choice = 'y' } else { $choice = 'n' }
        }
        if ($choice -ne 'y') { throw "Update aborted: untrusted RepoUrl (pakai -AllowUntrustedRepo untuk bypass)" }
        Write-Warning "AUDIT: User bypass allowlist untuk RepoUrl '$RepoUrl' at $(Get-Date) (UNSAFE)"
    } else {
        Write-Warning "-AllowUntrustedRepo aktif: skip allowlist check (UNSAFE)"
    }
}

# ---- Pre-check: detect current kit version (dari .install-manifest.json) ----
$manifestPath = Join-Path $kitDir '.install-manifest.json'
$currentVersion = $null
$manifestPresent = $false
if (Test-Path $manifestPath) {
    $manifestPresent = $true
    try {
        $manifestRaw = Get-Content -Path $manifestPath -Raw -Encoding UTF8 -ErrorAction Stop
        $manifestObj = $manifestRaw | ConvertFrom-Json -ErrorAction Stop
        if ($manifestObj -and $manifestObj.metadata -and $manifestObj.metadata.kit_version) {
            $currentVersion = [string]$manifestObj.metadata.kit_version
            # Normalize: strip leading 'v' supaya semua print 'v$currentVersion' jadi single-v.
            # Manifest historis kadang nyimpen 'v1.5.0', kadang '1.5.0' - normalize sekali di sumber.
            if ($currentVersion) { $currentVersion = ($currentVersion -replace '^v','').Trim() }
        }
    } catch {
        Write-Host "WARN  Gagal parse .install-manifest.json: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

$canCheckRemote = [bool]$currentVersion
if ($currentVersion) {
    Write-Host "OK    Versi sekarang (manifest): $currentVersion" -ForegroundColor Green
} elseif ($manifestPresent) {
    Write-Host "WARN  manifest ada tapi metadata.kit_version kosong - skip version check." -ForegroundColor Yellow
    $currentVersion = 'unknown'
} else {
    Write-Host "INFO  .install-manifest.json tidak ada - asumsi fresh install, skip version check." -ForegroundColor Cyan
    $currentVersion = 'unknown'
}

# ---- Pre-check: query remote latest tag via git ls-remote ----
# Hanya dijalankan kalau ada manifest + kit_version (artinya ada baseline buat dibandingin).
if ($canCheckRemote -and -not $DryRun) {
    Write-Host ""
    Write-Host "Cek versi terbaru di remote..." -ForegroundColor Cyan

    $latestVersion = $null
    $lsRemoteOk = $false
    try {
        $oldEA = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'

        # Jangan pakai 2>&1 di native exe (PS 5.1 promote stderr ke ErrorRecord).
        # stderr akan auto ke console; kita cuma butuh stdout.
        $remoteRefs = & git ls-remote --tags $RepoUrl
        $lsExit = $LASTEXITCODE

        $ErrorActionPreference = $oldEA

        if ($lsExit -eq 0 -and $remoteRefs) {
            $lsRemoteOk = $true

            # Parse tags: format "<sha>\trefs/tags/vX.Y.Z" (optional ^{} dereference suffix).
            $semverRegex = 'refs/tags/(v\d+\.\d+\.\d+)(?:\^\{\})?$'
            $tagList = New-Object System.Collections.Generic.List[string]
            foreach ($refLine in $remoteRefs) {
                if ($refLine -match $semverRegex) {
                    $tagList.Add($Matches[1]) | Out-Null
                }
            }

            if ($tagList.Count -gt 0) {
                # Sort version-descending: strip leading 'v', cast ke [version], desc.
                $sorted = $tagList | Sort-Object -Unique | Sort-Object -Property @{
                    Expression = { [version]($_ -replace '^v','') }
                    Descending = $true
                }
                $latestVersion = @($sorted)[0]
            }
        }
    } catch {
        $ErrorActionPreference = $oldEA
        Write-Host "WARN  git ls-remote exception: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    if (-not $lsRemoteOk) {
        Write-Host "WARN  Gagal mengambil daftar versi dari repo standar tim." -ForegroundColor Yellow
        Write-LintasRepoAccessHint -RepoUrl $RepoUrl
        if ($CheckOnly) {
            # Mode cek-saja: JANGAN prompt (read-only). Lapor lalu berhenti.
            Write-Host "[i] Mode cek-saja: tidak bisa membandingkan versi (gagal hubungi remote). Coba lagi nanti." -ForegroundColor Yellow
            exit 0
        }
        $ans = $null
        try {
            Write-Host ""
            Write-Host "Lanjut update tanpa cek versi? [1] Yes / [2] No (default, safe choice)" -ForegroundColor Yellow
            Write-Host "Default (Enter/kosong) -> [2] No"
            $ans = Read-Host "Pilih [1] / [2]"
            if ([string]::IsNullOrWhiteSpace($ans) -or $ans -eq '2') {
                $ans = 'n'
            } elseif ($ans -eq '1') {
                $ans = 'y'
            } else {
                $ans = 'n'
            }
        } catch {
            # Non-interactive host -> default 'n'.
            $ans = 'n'
        }
        if ([string]::IsNullOrWhiteSpace($ans)) { $ans = 'n' }
        if ($ans -notmatch '^[Yy]') {
            Write-Host "Dibatalkan oleh user." -ForegroundColor Yellow
            exit 0
        }
        Write-Host "Lanjut update tanpa cek versi (atas konfirmasi user)..." -ForegroundColor Yellow
    } elseif ([string]::IsNullOrWhiteSpace($latestVersion)) {
        Write-Host "WARN  Tag remote tidak ditemukan/parse-able - fall back: lanjut update dengan warning." -ForegroundColor Yellow
    } else {
        # Normalize: kit_version di manifest mungkin "1.0.0" tanpa 'v', remote tag pakai 'vX.Y.Z'.
        $currentNorm = ($currentVersion -replace '^v','').Trim()
        $latestNorm  = ($latestVersion  -replace '^v','').Trim()

        if ($currentNorm -eq $latestNorm) {
            Write-Host "[OK] Sudah versi terbaru ($currentVersion). Tidak ada update." -ForegroundColor Green
            exit 0
        }

        # Compare semver-aware: kalau current >= latest, treat as up-to-date juga.
        try {
            $cv = [version]$currentNorm
            $lv = [version]$latestNorm
            if ($cv -ge $lv) {
                Write-Host "[OK] Versi lokal ($currentVersion) >= remote latest ($latestVersion). Tidak ada update." -ForegroundColor Green
                exit 0
            }
        } catch {
            # Cast gagal -> fallback ke string compare di atas; lanjut update.
            Write-Verbose "Semver cast failed: $($_.Exception.Message)"
        }

        Write-Host "[INFO] Update tersedia: $currentVersion -> $latestVersion" -ForegroundColor Cyan
    }
}

# ---- Mode cek-saja (read-only): lapor status versi lalu berhenti TANPA mengubah apa pun ----
# Dipakai `kit.ps1 check-update`. Kasus "sudah terbaru" sudah exit 0 di blok cek-versi di atas;
# sampai sini = (a) ada update tersedia (sudah dicetak "[INFO] Update tersedia"), atau
# (b) tak ada baseline / gagal cek remote.
if ($CheckOnly) {
    if (-not $canCheckRemote) {
        Write-Host "[i] Belum bisa bandingkan versi (belum ada manifest baseline / fresh install)." -ForegroundColor Yellow
        Write-Host "    Cek versi terbaru di npm: jalankan 'npm view lintasai version'." -ForegroundColor DarkGray
    }
    Write-Host "Mode cek-saja: TIDAK ada perubahan dilakukan." -ForegroundColor Cyan
    Write-Host "Kalau mau update: minta AI 'tolong update kit', atau jalankan '.\.claude-kit\kit.ps1 update'." -ForegroundColor Cyan
    exit 0
}

# v1.33.1 (RAPIKAN): ingatkan kalau ada editan DI DALAM .claude-kit/ akan diganti versi baru.
# (Editan lama tetap aman di folder cadangan yang dibuat di Step 1.)
if (-not $DryRun -and -not $NoBackup) {
    Write-Host ""
    Write-Host "Catatan: kalau kamu pernah MENGEDIT file DI DALAM .claude-kit/ (mis. aturan lokal)," -ForegroundColor DarkGray
    Write-Host "         editan itu akan diganti versi baru; versi lamamu tetap aman di folder cadangan." -ForegroundColor DarkGray
}

# ---- Step 1: Backup existing .claude-kit/ ----
if (-not $NoBackup) {
    if ($DryRun) {
        Write-Host "[DRY] Akan backup: $kitDir -> $backupDir" -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "Step 1: Backup .claude-kit/ lama..." -ForegroundColor Cyan
        try {
            Move-Item -Path $kitDir -Destination $backupDir -Force
            Write-Host "OK    Backup: $backupDir" -ForegroundColor Green
        } catch {
            Write-Host "ERROR: Backup gagal: $_" -ForegroundColor Red
            Write-Host "       Kemungkinan ada file yang di-lock (editor open, antivirus scan)." -ForegroundColor Red
            exit 1
        }
    }
} else {
    Write-Host "Step 1: Skip backup (-NoBackup aktif)" -ForegroundColor Yellow
    # Tanpa backup = hapus PERMANEN tanpa cadangan (IRREVERSIBLE). Konfirmasi dulu
    # supaya staff yang paste perintah ini tanpa sadar tidak kehilangan kit lama.
    if (-not $DryRun) {
        $confirmDelete = $false
        if ($YesDeleteNoBackup) {
            # Unattended/CI: -YesDeleteNoBackup = konsen EKSPLISIT untuk hapus permanen
            # tanpa cadangan. SENGAJA terpisah dari -Force (yang cuma bypass allowlist URL)
            # supaya tidak ada gabungan saklar yang diam-diam menghapus kit tanpa sadar.
            $confirmDelete = $true
        } else {
            $noBakMsg = "PERINGATAN: -NoBackup akan HAPUS PERMANEN '$kitDir' tanpa cadangan.`n`n" + `
                        "Kalau clone gagal / internet putus, kit lama TIDAK bisa dikembalikan.`n`n" + `
                        "Lanjut hapus tanpa backup?"
            $handledViaPopup = $false
            if ($script:__lintasAI_PopupAvailable -and -not $useConsoleMode) {
                try {
                    $ans = Show-LintasYesNoPopup -Title 'Konfirmasi: hapus kit lama TANPA backup' -Message $noBakMsg
                    $confirmDelete = ($ans -eq 'Yes')
                    $handledViaPopup = $true
                } catch {
                    Write-Host ("INFO: Popup gagal ({0}). Fallback ke console." -f $_.Exception.Message) -ForegroundColor Yellow
                }
            }
            if (-not $handledViaPopup) {
                try {
                    Write-Host ''
                    Write-Host $noBakMsg -ForegroundColor Yellow
                    Write-Host 'Pilihan: [1] Ya, hapus tanpa backup / [2] Tidak, batal (default, aman)'
                    $raw = Read-Host 'Pilih [1] / [2]'
                    $confirmDelete = ($raw -eq '1')
                } catch {
                    # Non-interaktif tanpa console: jangan auto-hapus. Minta -YesDeleteNoBackup eksplisit.
                    Write-Host 'INFO: Sesi non-interaktif. Pakai -YesDeleteNoBackup untuk hapus tanpa backup secara unattended.' -ForegroundColor Yellow
                    $confirmDelete = $false
                }
            }
        }
        if (-not $confirmDelete) {
            Write-Host 'Dibatalkan: hapus tanpa backup tidak dikonfirmasi.' -ForegroundColor Yellow
            Write-Host '            Jalankan tanpa -NoBackup (backup aktif) atau tambah -YesDeleteNoBackup untuk unattended.' -ForegroundColor Yellow
            exit 1
        }
        try {
            Remove-Item -Path $kitDir -Recurse -Force
            Write-Host "OK    Kit lama dihapus." -ForegroundColor Green
        } catch {
            Write-Host "ERROR: Gagal hapus kit lama: $_" -ForegroundColor Red
            exit 1
        }
    }
}

# ---- Step 2: Clone fresh ke .claude-kit/ baru ----
Write-Host ""
Write-Host "Step 2: Clone fresh dari GitHub..." -ForegroundColor Cyan

# v1.13.1 FIX #1: pin update ke TAG RILIS, bukan branch 'main' yang berjalan, supaya user
# yang update mendarat di kode SAMA dengan yang fresh-install via `npx ... init` (npm terbit
# saat tag). $latestVersion = tag semver-terbaru yang sudah di-resolve di cek-versi remote
# di atas. Hormati override -Branch eksplisit (fork/testing); kalau tidak, clone tag-nya;
# kalau tag tak ter-resolve (offline / tanpa baseline / SIMULASI), fallback ke 'main'.
$cloneRef = $Branch
if ($Branch -eq 'main' -and -not [string]::IsNullOrWhiteSpace($latestVersion)) {
    $cloneRef = $latestVersion
    Write-Host "  Pin ke versi rilis: $cloneRef (bukan 'main' yang bisa berisi kerjaan belum-rilis)" -ForegroundColor DarkGray
}

if ($DryRun) {
    Write-Host "[DRY] git clone --depth 1 -b $cloneRef $RepoUrl '$kitDir'" -ForegroundColor Yellow
    Write-Host "      (real run: pin ke tag rilis terbaru; '$cloneRef' di SIMULASI = fallback karena cek-versi di-skip saat SIMULASI)" -ForegroundColor DarkGray
} else {
    Push-Location $projectRoot
    # CRITICAL FIX (v1.0.0): wrap git clone di try/catch dengan ErrorActionPreference='Continue'
    # supaya $LASTEXITCODE bisa di-cek tanpa stderr promote ke terminating error.
    # Bug sebelumnya: $ErrorActionPreference='Stop' di scope file + 2>&1 di native exe
    # bikin stderr 'fatal:' jadi terminating error yang bypass cek $LASTEXITCODE → rollback gak jalan.
    $cloneOk = $false
    $cloneErrorMsg = ''
    try {
        # Local ErrorActionPreference=Continue supaya native stderr tidak terminating
        $oldErrorAction = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'

        # JANGAN pakai 2>&1 di native exe (PS 5.1 promote stderr lines ke ErrorRecord).
        # Stderr akan auto-ditampilkan ke console oleh native exe.
        # Pakai try/catch + cek $LASTEXITCODE untuk control flow.
        & git clone --depth 1 -b $cloneRef $RepoUrl '.claude-kit'
        $cloneExitCode = $LASTEXITCODE

        $ErrorActionPreference = $oldErrorAction

        if ($cloneExitCode -eq 0) {
            $cloneOk = $true
            Write-Host "OK    Clone selesai." -ForegroundColor Green
        } else {
            $cloneErrorMsg = "git clone exit code: $cloneExitCode (cek pesan error di atas)"
        }
    } catch {
        $cloneErrorMsg = "git clone exception: $_"
        $ErrorActionPreference = $oldErrorAction
    } finally {
        Pop-Location
    }

    if (-not $cloneOk) {
        Write-Host ""
        Write-Host "ERROR: $cloneErrorMsg" -ForegroundColor Red
        Write-LintasRepoAccessHint -RepoUrl $RepoUrl
        # Rollback: restore backup (CRITICAL: must run kalau clone gagal). Pakai helper bersama
        # supaya pesan + perilaku SAMA dengan jalur abort-GPG (audit P2 2026-06-23).
        Restore-LintasOldKit -BackupDir $backupDir -KitDir $kitDir -NoBackup:$NoBackup
        exit 1
    }
}

# ---- Step 2b: Verify tag signature (GPG) sebelum hapus .git/ ----
# BUG FIX: sebelumnya call `git verify-tag $Branch` di mana $Branch = "main".
# verify-tag butuh TAG name, bukan branch name -> selalu fail -> fall through
# ke prompt y/N = security theater. Sekarang resolve tag eksak dari HEAD dulu,
# fallback ke latest tag remote, baru call verify-tag dengan nama tag betulan.
# FAIL-CLOSED: kalau verify gagal -> throw. Bypass cuma via -AllowUnsignedTag
# (bukan -Force; separation of concerns: -Force = allowlist, -AllowUnsignedTag = GPG).
if (-not $DryRun -and (Test-Path (Join-Path $kitDir '.git'))) {
    Write-Host ""
    Write-Host "Step 2b: Verify tag signature (GPG)..." -ForegroundColor Cyan

    # --- Trusted repo auto-skip (defense-in-depth bypass untuk owner repo resmi) ---
    # Kalau RepoUrl match TrustedRepos whitelist (default: ojokesusu/lintasAI atau
    # env LINTASAI_TRUSTED_REPOS override), skip GPG verify SECARA EXPLICIT dengan
    # audit log entry. Rationale: HTTPS+TLS + GitHub branch protection sudah
    # provide source integrity untuk owner repo, GPG cuma tambahan layer 3.
    # Untuk staff IT non-programmer di GUI session, ini hilangkan warning palsu
    # "FAIL Tag bukan GPG-signed valid" yang muncul karena pubkey belum di-import.
    $isTrustedRepo = Test-LintasTrustedRepo -RepoUrl $RepoUrl
    if ($isTrustedRepo) {
        Write-Host "[OK] Repo URL: $RepoUrl (trusted owner repo, GPG check skipped)" -ForegroundColor Green
        if (Get-Command Add-LintasAuditEntry -ErrorAction SilentlyContinue) {
            Add-LintasAuditEntry -Source 'update-kit.ps1' -Action 'gpg-check-skipped' -Detail "repo=$RepoUrl branch=$Branch reason=trusted-repo-whitelist"
        }
        # Skip seluruh GPG verify block - lanjut ke Step 3.
    } else {

    # --- Resolve actual tag NAME pointing to cloned HEAD ---
    # `--depth 1 -b main` clone biasanya checkout commit yang juga ditag (latest release).
    # `git describe --exact-match --tags HEAD` return tag name persis kalau HEAD == tag commit,
    # otherwise exit non-zero. Itu signal yang kita mau (no fuzzy match).
    $resolvedTag = $null
    $oldEA = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $describeOut = & git -C $kitDir describe --exact-match --tags HEAD 2>$null
        $describeExit = $LASTEXITCODE
        if ($describeExit -eq 0 -and $describeOut) {
            $resolvedTag = ($describeOut | Select-Object -First 1).ToString().Trim()
            Write-Host "  Tag di HEAD (describe --exact-match): $resolvedTag" -ForegroundColor DarkGray
        }
    } catch {
        # Swallow - fallback path di bawah.
        Write-Verbose "git describe failed: $($_.Exception.Message)"
    }
    $ErrorActionPreference = $oldEA

    # --- Fallback: latest tag dari ls-remote (kalau HEAD bukan tag commit) ---
    if (-not $resolvedTag) {
        Write-Host "  HEAD bukan exact tag - fallback ke latest tag via ls-remote..." -ForegroundColor DarkGray
        $oldEA = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $lsTags = & git ls-remote --tags $RepoUrl 2>$null
            if ($LASTEXITCODE -eq 0 -and $lsTags) {
                $semverRegex = 'refs/tags/(v\d+\.\d+\.\d+)(?:\^\{\})?$'
                $fallbackTagList = New-Object System.Collections.Generic.List[string]
                foreach ($refLine in $lsTags) {
                    if ($refLine -match $semverRegex) {
                        $fallbackTagList.Add($Matches[1]) | Out-Null
                    }
                }
                if ($fallbackTagList.Count -gt 0) {
                    $sortedFallback = $fallbackTagList | Sort-Object -Unique | Sort-Object -Property @{
                        Expression = { [version]($_ -replace '^v','') }
                        Descending = $true
                    }
                    $resolvedTag = @($sortedFallback)[0]
                    Write-Host "  Latest tag remote: $resolvedTag" -ForegroundColor DarkGray

                    # Pastikan tag ada di local clone object DB (--depth 1 -b main biasanya tidak fetch tags lain).
                    # Fetch tag spesifik dulu supaya verify-tag bisa baca object-nya.
                    & git -C $kitDir fetch --depth 1 origin "refs/tags/${resolvedTag}:refs/tags/${resolvedTag}" 2>$null | Out-Null
                }
            }
        } catch {
            # Swallow - handled di bawah kalau $resolvedTag tetap null.
            Write-Verbose "ls-remote tags failed: $($_.Exception.Message)"
        }
        $ErrorActionPreference = $oldEA
    }

    if (-not $resolvedTag) {
        # Tidak ada tag sama sekali - FAIL-CLOSED kecuali user explicit bypass.
        if ($AllowUnsignedTag) {
            Write-Warning "Tidak ada tag GPG yang bisa di-resolve, tapi -AllowUnsignedTag aktif. Skip verify (UNSAFE)."
        } else {
            # fail-closed: kembalikan kit lama terverifikasi sebelum abort (audit P2 2026-06-23).
            Restore-LintasOldKit -BackupDir $backupDir -KitDir $kitDir -NoBackup:$NoBackup
            throw "Update aborted: tidak ada tag yang bisa di-resolve dari HEAD maupun ls-remote (release belum di-tag?). Pakai -AllowUnsignedTag untuk bypass (UNSAFE). Setup pubkey: docs/SIGNED_RELEASE.md"
        }
    } else {
        # --- Verify-tag dengan tag NAME (bukan branch) ---
        $oldEA = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $verifyOutput = & git -C $kitDir verify-tag $resolvedTag 2>&1
        $verifyExit = $LASTEXITCODE
        $ErrorActionPreference = $oldEA

        if ($verifyExit -eq 0) {
            Write-Host "[OK] Tag $resolvedTag GPG signature verified" -ForegroundColor Green
            if (Get-Command Add-LintasAuditEntry -ErrorAction SilentlyContinue) {
                Add-LintasAuditEntry -Source 'update-kit.ps1' -Action 'gpg-check-passed' -Detail "repo=$RepoUrl tag=$resolvedTag"
            }
            # P1 (audit 2026-06-23): IKAT isi yang dipasang ke commit tag terverifikasi. verify-tag
            # HANYA memeriksa tanda tangan TAG, bukan menjamin isi yang di-clone (HEAD 'main' yang
            # bergerak / clone yang mendarat di branch) SAMA dengan commit bertanda-tangan itu.
            # checkout mengikat isi terpasang = isi terverifikasi (pola docs/SIGNED_RELEASE.md:111).
            # Gagal mengikat -> perlakukan sebagai gagal verifikasi (fail-closed: pulihkan kit lama).
            $oldEA = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            $bindOutput = & git -C $kitDir checkout --quiet "refs/tags/$resolvedTag" 2>&1
            $bindExit = $LASTEXITCODE
            $ErrorActionPreference = $oldEA
            if ($bindExit -ne 0) {
                Write-Warning "[GAGAL] Tak bisa mengikat isi ke commit tag terverifikasi $resolvedTag"
                Write-Host "Detail: $bindOutput"
                if (Get-Command Add-LintasAuditEntry -ErrorAction SilentlyContinue) {
                    Add-LintasAuditEntry -Source 'update-kit.ps1' -Action 'gpg-bind-failed' -Detail "repo=$RepoUrl tag=$resolvedTag aborted=true"
                }
                # fail-closed: kembalikan kit lama terverifikasi sebelum abort (audit P1).
                Restore-LintasOldKit -BackupDir $backupDir -KitDir $kitDir -NoBackup:$NoBackup
                throw "Update aborted: isi terpasang tak bisa dipastikan = isi yang terverifikasi (gagal checkout ke refs/tags/$resolvedTag)."
            }
            Write-Host "[OK] Isi terpasang diikat ke commit tag $resolvedTag (yang dipasang = yang terverifikasi)." -ForegroundColor Green
        } else {
            Write-Warning "[FAIL] Tag $resolvedTag bukan GPG-signed valid (atau pubkey owner tidak ter-import)"
            Write-Host "Detail: $verifyOutput"
            Write-Host "Setup pubkey owner: docs/SIGNED_RELEASE.md" -ForegroundColor Yellow
            if ($AllowUnsignedTag) {
                Write-Warning "Bypass via -AllowUnsignedTag aktif: lanjut tanpa verifikasi (UNSAFE)."
                if (Get-Command Add-LintasAuditEntry -ErrorAction SilentlyContinue) {
                    Add-LintasAuditEntry -Source 'update-kit.ps1' -Action 'gpg-check-bypassed' -Detail "repo=$RepoUrl tag=$resolvedTag reason=AllowUnsignedTag-flag UNSAFE=true"
                }
            } else {
                if (Get-Command Add-LintasAuditEntry -ErrorAction SilentlyContinue) {
                    Add-LintasAuditEntry -Source 'update-kit.ps1' -Action 'gpg-check-failed' -Detail "repo=$RepoUrl tag=$resolvedTag aborted=true"
                }
                # FAIL-CLOSED: tidak ada prompt y/N. Kalau mau bypass harus explicit flag.
                # P2 (audit 2026-06-23): kembalikan kit lama terverifikasi - jangan biarkan clone baru
                # tak-terverifikasi jadi aktif (fail-closed TERBALIK).
                Restore-LintasOldKit -BackupDir $backupDir -KitDir $kitDir -NoBackup:$NoBackup
                throw "Update aborted: GPG verify-tag $resolvedTag gagal. Pakai -AllowUnsignedTag untuk bypass (UNSAFE)."
            }
        }
    }
    }  # end of else (not trusted repo)
}

# ---- Step 3: Hapus .git/ internal ----
$gitInternal = Join-Path $kitDir '.git'
Write-Host ""
Write-Host "Step 3: Hapus .git/ internal supaya tidak konflik dengan git proyek..." -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "[DRY] Remove-Item $gitInternal -Recurse -Force" -ForegroundColor Yellow
} elseif (Test-Path $gitInternal) {
    try {
        Remove-Item -Path $gitInternal -Recurse -Force
        Write-Host "OK    .git/ internal dihapus." -ForegroundColor Green
    } catch {
        Write-Host "WARN  Gagal hapus .git/: $_" -ForegroundColor Yellow
        Write-Host "      Bisa nested git issue. Hapus manual: Remove-Item '$gitInternal' -Recurse -Force" -ForegroundColor Yellow
    }
}

# ---- Step 4: Re-run setup-pola-b.ps1 ----
$setupScript = Join-Path $kitDir 'setup-pola-b.ps1'
Write-Host ""
Write-Host "Step 4: Re-run setup-pola-b.ps1 (anti-overwrite untuk docs/ existing)..." -ForegroundColor Cyan
if ($DryRun) {
    Write-Host ("[DRY] Call: '{0}' -Force -ProjectRoot '{1}'" -f $setupScript, $projectRoot) -ForegroundColor Yellow
} elseif (Test-Path $setupScript) {
    try {
        # Pass -ProjectRoot defensively supaya invocation lewat npx wrapper / non-standard CI
        # (yang derive $PSScriptRoot beda dari project root) tetap point ke project yang benar.
        # Untuk invocation tradisional, $projectRoot = parent dari $kitDir = sama dengan
        # fallback default di setup-pola-b.ps1 line 87-89 (no-op pass-through).
        & $setupScript -Force -ProjectRoot $projectRoot
    } catch {
        Write-Host "WARN  setup-pola-b.ps1 error: $_" -ForegroundColor Yellow
        Write-Host "      File kit sudah ter-copy, tapi setup mungkin gak komplit." -ForegroundColor Yellow
        Write-Host "      Run manual: .\.claude-kit\setup-pola-b.ps1 -Force" -ForegroundColor Yellow
    }
} else {
    Write-Host "WARN  setup-pola-b.ps1 tidak ada di kit baru - skip." -ForegroundColor Yellow
}

# ---- Step 5: Detect new version + diff CHANGELOG ----
if (-not $DryRun) {
    $newChangelog = Join-Path $kitDir 'CHANGELOG.md'
    $newVersion = 'unknown'
    $newEntry = $null
    if (Test-Path $newChangelog) {
        # Pakai helper Get-LatestChangelogEntry - single source of truth.
        # Pattern di helper fleksibel (v1.13.3): support '## [1.13.2]' (format sekarang,
        # bracketed TANPA 'v'), '## vX.Y.Z' (gaya lama), '## [vX.Y.Z]', '## vX.Y.Z - YYYY-MM-DD'
        # sekaligus, ambil heading PALING ATAS = terbaru. Heading non-versi ([Unreleased] dll) di-skip.
        $newEntry = Get-LatestChangelogEntry -ChangelogPath $newChangelog
        if ($null -ne $newEntry -and $newEntry.Version) {
            # Strip 'v' biar konsisten dengan $currentVersion (sudah ter-normalize di pre-check manifest).
            $newVersion = ($newEntry.Version -replace '^v','').Trim()
        }
    }

    Write-Host ""
    Write-Host "=== Update selesai ===" -ForegroundColor Cyan
    Write-Host "Versi lama   : v$currentVersion"
    Write-Host "Versi baru   : v$newVersion"

    if ($currentVersion -ne $newVersion -and $newVersion -ne 'unknown') {
        Write-Host ""
        Write-Host "Update v$currentVersion -> v$newVersion sukses!" -ForegroundColor Green

        # ---- Scan CHANGELOG entry v$newVersion untuk label [BREAKING] / [SCAN-REQUIRED] ----
        # Pakai $newEntry.Body dari helper Get-LatestChangelogEntry - sudah dijamin scoped
        # ke entry versi terbaru saja (helper parse line-by-line, stop di heading versi berikutnya).
        # Hindari raw regex slice yang gagal kalau format heading campur (## vX.Y.Z vs ## [X.Y.Z]).
        $breakingFound = $false
        $scanRequiredFound = $false
        $securityFound = $false
        if ($null -ne $newEntry -and $newEntry.Body) {
            $entryText = $newEntry.Body
            # v1.33.1: pindai SELURUH rentang entri CHANGELOG (versi-lama, versi-baru] — bukan cuma
            # entri teratas — supaya label [SECURITY]/[BREAKING] di versi yang DILEWATI (mis. lompat
            # v1.20 -> v1.33) tetap memunculkan banner 'pasang SEGERA'. Fallback ke entri teratas
            # kalau versi-lama tak diketahui (tanpa baseline manifest) atau rentang kosong.
            if ($currentVersion -and $currentVersion -ne 'unknown') {
                $rangeBody = Get-ChangelogRangeBody -ChangelogPath $newChangelog -FromVersionExclusive $currentVersion -ToVersionInclusive $newVersion
                if (-not [string]::IsNullOrWhiteSpace($rangeBody)) { $entryText = $rangeBody }
            }
            # Anchor label ke posisi konvensional via helper single-source Test-LintasChangelogLabel:
            # awal baris (cegah false-positive label di tengah prosa) + mengenali penanda heading
            # '### [LABEL]', list '- [LABEL]'/'* [LABEL]', dan bold '**[LABEL]**'. Gaya sub-judul
            # '### [SECURITY]' DULU lolos deteksi (GENTING 2026-06-18) -> peringatan keamanan hilang
            # saat lompat versi; helper kini menutupnya. Dipakai sama persis dgn Resolve-UpdateTier.
            if (Test-LintasChangelogLabel -Body $entryText -Label 'BREAKING') { $breakingFound = $true }
            if (Test-LintasChangelogLabel -Body $entryText -Label 'SCAN-REQUIRED') { $scanRequiredFound = $true }
            if (Test-LintasChangelogLabel -Body $entryText -Label 'SECURITY') { $securityFound = $true }
        }

        if ($breakingFound -or $scanRequiredFound -or $securityFound) {
            Write-Host ""
            Write-Host "================================================================" -ForegroundColor Red
            Write-Host "  PERHATIAN: VERSI INI ADA PERUBAHAN PENTING" -ForegroundColor Red
            Write-Host "================================================================" -ForegroundColor Red
            if ($securityFound) {
                Write-Host "  [SECURITY] Perbaikan KEAMANAN - pasang SEGERA, jangan tunda." -ForegroundColor Red
                Write-Host "             (Walau update kecil, ini menambal lubang keamanan.)" -ForegroundColor Red
            }
            if ($breakingFound) {
                Write-Host "  [BREAKING] Ada perubahan yang tidak backward-compatible." -ForegroundColor Red
                Write-Host "             Baca CHANGELOG ENTRY v$newVersion sebelum lanjut kerja." -ForegroundColor Red
            }
            if ($scanRequiredFound) {
                Write-Host "  [SCAN-REQUIRED] Wajib regenerate docs/ supaya kompatibel." -ForegroundColor Red
                Write-Host "                  Re-paste isi .claude-kit\PROJECT_LIFECYCLE_PROMPT_v1.md (Stage 2: Bikin Catatan Proyek)" -ForegroundColor Red
                Write-Host "                  ke Claude Code untuk regenerate docs lama." -ForegroundColor Red
            }
            Write-Host "================================================================" -ForegroundColor Red
        }

        Write-Host ""
        Write-Host "Action items recommended:" -ForegroundColor Cyan
        Write-Host "  1. Baca CHANGELOG entry [v$newVersion]:"
        Write-Host "     $newChangelog"
        Write-Host "  2. Verify file baru di docs/ + .github/ (kalau ada di release notes)."
        Write-Host "  3. Versi kit dibaca OTOMATIS dari baris atas .claude-kit/CHANGELOG.md (kini"
        Write-Host "     v$newVersion) - TIDAK perlu edit AGENTS.md manual. Kalau AGENTS.md-mu masih"
        Write-Host "     punya baris lama 'Versi kit di .claude-kit/: vX.Y.Z', itu tak dipakai lagi (boleh dihapus)."
        if (-not $breakingFound -and -not $scanRequiredFound -and -not $securityFound) {
            Write-Host "  4. Tidak ada label [BREAKING]/[SCAN-REQUIRED]/[SECURITY] - docs/ kamu AMAN, gak perlu scan ulang."
            Write-Host "  5. Kalau CHANGELOG sebut workflow change di JALANKAN_KIT.md:"
            Write-Host "     Re-paste isi .claude-kit\JALANKAN_KIT.md ke Claude Code."
        } else {
            Write-Host "  4. WAJIB ikuti instruksi PERHATIAN di atas sebelum kerja lanjut."
        }
    } elseif ($currentVersion -eq $newVersion) {
        Write-Host ""
        Write-Host "Tidak ada perubahan versi (v$currentVersion). Update mungkin cuma minor patch/refinement." -ForegroundColor Cyan
        Write-Host "Cek CHANGELOG untuk detail."
    }

    # ---- Step 6: Cek kesehatan kit baru (v1.13.1 FIX #2) ----
    # Updater profesional verifikasi versi baru benar-benar jalan SEBELUM bilang sukses.
    # Jalankan doctor kit baru (read-only: cek versi + file inti + integrity sha256).
    # Kalau doctor ERROR (exit 1), update mungkin separuh-jadi -> arahkan user ke backup +
    # rollback satu-baris. TIDAK auto-rollback (confirm-first; backup disimpan default,
    # biar user yang putuskan). `& script.ps1` -> `exit` di kit.ps1 set $LASTEXITCODE +
    # balik ke sini (TIDAK mematikan update-kit.ps1).
    $newKitPs1 = Join-Path $kitDir 'kit.ps1'
    if (Test-Path $newKitPs1) {
        Write-Host ""
        Write-Host "Step 6: Cek kesehatan kit baru (doctor)..." -ForegroundColor Cyan
        $oldEAdoctor = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & $newKitPs1 doctor
        $doctorExit = $LASTEXITCODE
        $ErrorActionPreference = $oldEAdoctor
        if ($doctorExit -ne 0) {
            Write-Host ""
            Write-Host "WARN  Doctor menemukan ERROR di kit baru (exit $doctorExit) - update mungkin tidak lengkap." -ForegroundColor Yellow
            if (-not $NoBackup -and (Test-Path $backupDir)) {
                # v1.33.1 GENTING FIX: kit baru rusak -> yang harus dipulihkan = FOLDER kit lama
                # utuh ($backupDir), BUKAN per-file. `kit.ps1 rollback` HANYA memulihkan berkas
                # project per-satuan (AGENTS.md dll) lewat manifest - TIDAK menyentuh folder
                # .claude-kit.backup-<ts>, jadi mengarahkan ke sana = rasa-aman palsu (staff kira
                # sudah balik padahal kit masih versi rusak). Arahkan ke pemulihan FOLDER yang benar.
                Write-Host "      Versi lama AMAN tersimpan UTUH di folder cadangan:" -ForegroundColor Yellow
                Write-Host "        $backupDir" -ForegroundColor Yellow
                Write-Host "      Cara balik ke versi lama (paling mudah): minta AI -> 'rollback dong'" -ForegroundColor Yellow
                Write-Host "      Atau manual - kembalikan folder cadangan (jalankan 2 baris ini):" -ForegroundColor Yellow
                Write-Host "        Move-Item '$kitDir' '$kitDir.broken-$timestamp'" -ForegroundColor Yellow
                Write-Host "        Move-Item '$backupDir' '$kitDir'" -ForegroundColor Yellow
                Write-Host "      (CATATAN: 'kit.ps1 rollback' hanya memulihkan berkas project per-satuan," -ForegroundColor Yellow
                Write-Host "       BUKAN folder kit ini - untuk balik VERSI KIT pakai cara di atas.)" -ForegroundColor Yellow
            } else {
                Write-Host "      Tidak ada backup (-NoBackup) - perbaiki manual: .\.claude-kit\kit.ps1 update" -ForegroundColor Yellow
            }
        } else {
            Write-Host "OK    Kit baru sehat (doctor lulus)." -ForegroundColor Green
        }
    }

    if (-not $NoBackup -and (Test-Path $backupDir)) {
        Write-Host ""
        Write-Host "Backup lama tersimpan di:" -ForegroundColor Cyan
        Write-Host "  $backupDir"
        Write-Host ""
        Write-Host "Hapus backup kalau sudah yakin update sukses:" -ForegroundColor Cyan
        Write-Host "  Remove-Item '$backupDir' -Recurse -Force"
    }
}

Write-Host ""

# === Tier classification + backup cleanup hooks ===
#   - $kitDir       : path .claude-kit/ di project (default ".\.claude-kit")
# Kalau nama beda, sesuaikan parameter pemanggilan di bawah.

try {
    Write-Host "" 
    Write-Host "[*] Klasifikasi tier update dari CHANGELOG..." -ForegroundColor Cyan

    # Resolve changelog path defensif (kalau $kitDir belum di-set, fallback default).
    $changelogPath = ".\.claude-kit\CHANGELOG.md"
    if ($kitDir) {
        $candidate = Join-Path $kitDir "CHANGELOG.md"
        if (Test-Path $candidate) { $changelogPath = $candidate }
    }

    $entry = Get-LatestChangelogEntry -ChangelogPath $changelogPath

    if ($null -ne $entry) {
        $tier = Resolve-UpdateTier -EntryBody $entry.Body
        $summary = Format-UpdateSummary -Tier $tier -Entry $entry

        # Warna terminal sesuai tier (visual cue cepat buat staff).
        $color = "Green"
        switch ($tier) {
            "Tier 1" { $color = "Green" }
            "Tier 2" { $color = "Cyan" }
            "Tier 3" { $color = "Yellow" }
            "Tier 4" { $color = "Magenta" }
        }

        Write-Host $summary -ForegroundColor $color
    } else {
        Write-Host "[WARN] Skip tier classification - CHANGELOG tidak bisa di-parse." -ForegroundColor Yellow
    }
}
catch {
    # Jangan gagalkan update cuma karena classification error.
    Write-Host "[WARN] Tier classification error (non-fatal): $($_.Exception.Message)" -ForegroundColor Yellow
}

# [B] Backup cleanup - OPT-IN via -CleanupBackups flag (default OFF).
# Rasional: cleanup auto bisa kaget hapus AGENTS.md.backup-* user yang masih dipakai
# untuk recovery. Sejak v1.3.1, user harus eksplisit pass -CleanupBackups.
# Tanpa flag: skip total, tampilkan hint sekali kalau ketemu backup file lama.
if ($CleanupBackups) {
    try {
        Write-Host ""
        Write-Host "[*] Bersih-bersih backup lama (-CleanupBackups aktif)..." -ForegroundColor Cyan

        # Scope: HANYA folder kit parent (default $kitDir parent = root proyek juga,
        # tapi flag opt-in jadikan user-aware bahwa scope mencakup project root).
        $rootForCleanup = "."
        if ($ProjectRoot) { $rootForCleanup = $ProjectRoot }

        [void](Invoke-BackupCleanup -ProjectRoot $rootForCleanup -MaxAgeDays 30 -KeepLatest 3)
    }
    catch {
        Write-Host "[WARN] Backup cleanup non-fatal error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
else {
    Write-Host ""
    Write-Host "[i] Backup cleanup SKIPPED (opt-in via -CleanupBackups)." -ForegroundColor DarkGray
    Write-Host "    File *.bak / *.backup-* di project root tidak diutak-atik." -ForegroundColor DarkGray
    Write-Host "    Jalankan ulang dengan -CleanupBackups kalau mau auto-hapus backup > 30 hari." -ForegroundColor DarkGray
}

# =============================================================================
# END ENHANCEMENT
# =============================================================================
# === END hooks ===

Write-Host "OK update-kit.ps1 selesai." -ForegroundColor Green
exit 0
