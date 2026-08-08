<#
.SYNOPSIS
  kit.ps1 - Single entry point untuk operasi kit lintasAI

.DESCRIPTION
  Router yang delegate ke script per-operation. Tujuan: 1 command yang gampang
  diingat staff IT, daripada hafal 3 nama script berbeda.

  Subcommand yang tersedia:
    setup     - Setup Pola B di proyek (delegate ke setup-pola-b.ps1)
    update    - Update kit ke versi terbaru via re-clone (delegate ke update-kit.ps1)
    check-update - Cek apakah ada versi baru tanpa mengubah apa pun (read-only)
    uninstall - Hapus kit dari proyek dengan AMAN (pakai daftar file kit, delegate ke uninstall.ps1)
    doctor    - Diagnostic: cek versi + file utuh + broken cross-ref + integrity (sha256)
    scan      - Re-run scan project (tanpa setup) - generate ringkasan kandidat CRITICAL
    status    - Ringkasan 1-layar (versi, install mode, AGENTS.md, daftar file kit, tier)
    version   - Print versi kit aktif (dari daftar file kit)
    rollback  - Pulihkan berkas project per-satuan dari cadangan (delegate ke lib\rollback.ps1). Untuk balik SELURUH folder kit yang rusak: kembalikan .claude-kit.backup-<tanggal>.
    help      - Tampilkan usage

.PARAMETER Command
  Subcommand yang mau dijalankan. Required.

.PARAMETER Args
  Arguments yang di-pass ke subcommand. Optional.

.EXAMPLE
  .\.claude-kit\kit.ps1 setup
  .\.claude-kit\kit.ps1 setup -Force
  .\.claude-kit\kit.ps1 update
  .\.claude-kit\kit.ps1 update -NoBackup
  .\.claude-kit\kit.ps1 uninstall -DryRun
  .\.claude-kit\kit.ps1 uninstall -Force
  .\.claude-kit\kit.ps1 doctor
  .\.claude-kit\kit.ps1 scan
  .\.claude-kit\kit.ps1 version
  .\.claude-kit\kit.ps1 help

.NOTES
  Versi  : 1.0
  Tanggal: 2026-06-03
  Run    : .\.claude-kit\kit.ps1 <command>
  Atau   : powershell -ExecutionPolicy Bypass -File .\.claude-kit\kit.ps1 <command>

  Backward compatibility: setup-pola-b.ps1 + update-kit.ps1 tetap bisa dipanggil
  langsung (masih dipakai). kit.ps1 cuma alternative entry point yang lebih ringkas.
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    # ValidateSet DILEPAS (perbaikan parity R1): dulu typo perintah ditolak param-binding -> error .NET
    # Inggris mentah yang menakutkan staff non-programmer. Tanpa ValidateSet, perintah tak-dikenal jatuh
    # ke cabang 'default' switch di bawah -> Show-Help RAMAH + exit 1 (cermin kit.mjs). switch PS default
    # case-insensitive, jadi 'Version'='version' tetap jalan. Perintah sah: setup, update, check-update,
    # uninstall, doctor, scan, version, rollback, bump, status, diff, help (didokumentasikan di Show-Help).
    [string]$Command = '',

    [string]$ProjectRoot = $null,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs
)

$ErrorActionPreference = 'Stop'

# ---- Resolve paths ----
# Script's own location (npm cache when invoked via `npx`, project's .claude-kit when invoked directly).
$ScriptRoot = if ($PSScriptRoot) { $PSScriptRoot } elseif ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { (Get-Location).Path }

# Kit-to-inspect: when -ProjectRoot is passed (npx launcher case), inspect the kit di USER CWD
# (.claude-kit di project), BUKAN script's own location ($ScriptRoot di npm cache). Tanpa
# -ProjectRoot (direct invocation via .\.claude-kit\kit.ps1), $ScriptRoot SUDAH .claude-kit
# project, jadi fallback pakai $ScriptRoot.
if ($ProjectRoot) {
    $KitDir = Join-Path $ProjectRoot '.claude-kit'
} else {
    $KitDir = $ScriptRoot
    $ProjectRoot = Split-Path -Parent $KitDir
}

# Inform user which kit is being inspected - penting buat differentiate "kit di project" vs
# "kit di npm cache". Subcommands yang inspect kit (doctor/version/rollback/scan) butuh ini.
if ($Command -in @('doctor', 'version', 'rollback', 'scan', 'status', 'diff')) {
    Write-Host ("Inspecting kit at: {0}" -f $KitDir) -ForegroundColor Cyan
}

# ---- Resolve lib paths (optional dependencies) ----
# Pakai $KitDir (bukan $PSScriptRoot) supaya respect -ProjectRoot override - saat dipanggil
# via npx launcher, kit yang di-inspect ada di project (.claude-kit), bukan di npm cache.
$libRollback = Join-Path $KitDir 'lib\rollback.ps1'

# ---- Helper: detect kit version (defense-in-depth fallback chain) ----
# Source 1: .install-manifest.json -> metadata.kit_version (PRIMARY - what was installed)
# Source 2: $script:KIT_VERSION constant (kit.ps1's own version awareness)
# Source 3: CHANGELOG.md first "## v X.Y.Z" line, or "## [X.Y.Z]" entry
# Last resort: "unknown" (NOT "not installed" - misleading; the kit itself is present)
function Get-KitVersion {
    $ver = $null

    # Source 1: manifest
    $manifestPath = Join-Path $KitDir '.install-manifest.json'
    if (Test-Path $manifestPath) {
        try {
            $json = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8)
            $m = ConvertFrom-Json $json -ErrorAction Stop
            if ($m.metadata -and $m.metadata.kit_version) {
                $ver = $m.metadata.kit_version
            }
        } catch {
            # Manifest hilang/corrupt -> fallback ke source berikutnya.
            Write-Verbose "Manifest read failed: $($_.Exception.Message)"
        }
    }

    # Source 2: $script:KIT_VERSION constant (optional - may not be defined)
    if (-not $ver -and $script:KIT_VERSION) {
        $ver = $script:KIT_VERSION
    }

    # Source 3: CHANGELOG.md (v1.13.3 fix) - UNIFIED scan, ambil heading versi PERTAMA
    # dari atas (= terbaru) lintas-format: '## [X.Y.Z]' (format sekarang) ATAU '## vX.Y.Z'
    # (gaya lama). Sebelumnya v-prefix dicoba DULU -> entri lama '## v1.12.0' menutupi
    # entri bracketed terbaru (## [1.13.x]) -> versi stale.
    if (-not $ver) {
        $changelogPath = Join-Path $KitDir 'CHANGELOG.md'
        if (Test-Path $changelogPath) {
            try {
                $first = Get-Content $changelogPath -Encoding UTF8 -ErrorAction Stop |
                    Where-Object { $_ -match '^##\s+\[?v?\d+\.\d+\.\d+' } |
                    Select-Object -First 1
                if ($first -and ($first -match '^##\s+\[?v?(\d+\.\d+\.\d+)')) {
                    $ver = 'v' + $Matches[1]
                }
            } catch {
                # CHANGELOG hilang/unreadable -> fallback ke 'unknown' di bawah.
                Write-Verbose "CHANGELOG read failed: $($_.Exception.Message)"
            }
        }
    }

    # Last resort
    if (-not $ver) { $ver = 'unknown' }

    return $ver
}

# ---- Helper: versi yang dinormalkan untuk DITAMPILKAN (cegah dobel-"v") ----
# Get-KitVersion bisa balik 'v1.2.3' (dari CHANGELOG, sudah ber-awalan 'v') ATAU '1.2.3' (dari
# manifest, tanpa 'v'). Dulu Show-Help + scan menulis "v$(Get-KitVersion)" -> "vv1.2.3" saat sumbernya
# CHANGELOG. Helper ini menormalkan: sudah 'v' -> apa adanya; 'unknown' -> 'unknown'; selain itu +'v'.
# (Cermin logika tampilan yang sudah benar di Invoke-Doctor + Invoke-Status.)
function Get-KitVersionDisplay {
    $v = Get-KitVersion
    if ($v -match '^v') { return $v }
    if ($v -eq 'unknown') { return 'unknown' }
    return "v$v"
}

# ---- Helper: print usage ----
function Show-Help {
    Write-Host ""
    Write-Host "kit.ps1 - Single entry point untuk kit lintasAI ($(Get-KitVersionDisplay))" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "USAGE:" -ForegroundColor Cyan
    Write-Host "  .\.claude-kit\kit.ps1 <command> [args]"
    Write-Host ""
    Write-Host "COMMANDS:" -ForegroundColor Cyan
    Write-Host "  setup     - Setup Pola B di proyek (copy AGENTS.md, docs skeleton, file tim)"
    Write-Host "              Args: -Force, -DryRun, -SkipTeamFiles"
    Write-Host ""
    Write-Host "  update    - Update kit ke versi terbaru via re-clone fresh dari GitHub"
    Write-Host "              Args: -NoBackup, -RepoUrl <url>, -Branch <name>, -DryRun"
    Write-Host ""
    Write-Host "  check-update - Cek apakah ada versi baru TANPA mengubah apa pun (read-only)"
    Write-Host "              (no args)"
    Write-Host ""
    Write-Host "  uninstall - Hapus kit dari proyek dengan AMAN (diff vs daftar file kit)"
    Write-Host "              Args: -DryRun, -Force, -DeleteAgents, -KeepKit, -Yes, -AllowProjectRootMismatch"
    Write-Host "              File project (yang BUKAN dari kit) AMAN tidak terhapus."
    Write-Host "              Path traversal + symlink protection aktif by default."
    Write-Host ""
    Write-Host "  doctor    - Diagnostic: cek versi + file inti utuh + cross-ref"
    Write-Host "              (no args)"
    Write-Host ""
    Write-Host "  scan      - Re-run scan project untuk identifikasi kandidat CRITICAL"
    Write-Host "              (tanpa setup ulang)"
    Write-Host ""
    Write-Host "  status    - Ringkasan 1-layar: versi, install mode, AGENTS.md, manifest, tier"
    Write-Host "              (no args)"
    Write-Host ""
    Write-Host "  version   - Print versi kit aktif (dari .install-manifest.json)"
    Write-Host ""
    Write-Host "  rollback  - Pulihkan berkas project per-satuan dari cadangan (AGENTS.md/docs)"
    Write-Host "              (cadangan per-berkas, bukan seluruh folder). Untuk balik SELURUH folder kit"
    Write-Host "              yang rusak: kembalikan .claude-kit.backup-<tanggal> (atau minta"
    Write-Host "              AI: 'rollback dong')."
    Write-Host ""
    Write-Host "  bump      - [kit dev] Naikkan versi 1-langkah: cap nomor versi ke semua"
    Write-Host "              berkas + tambah kerangka CHANGELOG + cek kecocokan otomatis."
    Write-Host "              Args: <versi> (mis. bump 1.42.0). Cuma untuk repo kit."
    Write-Host ""
    Write-Host "  help      - Tampilkan help ini"
    Write-Host ""
    Write-Host "EXAMPLES:" -ForegroundColor Cyan
    Write-Host "  .\.claude-kit\kit.ps1 setup -Force"
    Write-Host "  .\.claude-kit\kit.ps1 update"
    Write-Host "  .\.claude-kit\kit.ps1 doctor"
    Write-Host ""
    Write-Host "BACKWARD COMPATIBILITY:" -ForegroundColor Cyan
    Write-Host "  Setup script lama tetap bisa dipanggil langsung:"
    Write-Host "    .\.claude-kit\setup-pola-b.ps1 -Force"
    Write-Host "    .\.claude-kit\update-kit.ps1"
    Write-Host ""
    Write-Host "  kit.ps1 cuma alternative entry point yang lebih ringkas."
    Write-Host ""
}

# ---- Helper: doctor diagnostic ----
function Invoke-Doctor {
    Write-Host ""
    Write-Host "=== Kit Doctor (diagnostic) ===" -ForegroundColor Cyan
    Write-Host ""

    $ok = 0
    $warn = 0
    $err = 0

    # 1. Kit version
    $version = Get-KitVersion
    if ($version -match '^v?\d+\.\d+\.\d+') {
        $display = if ($version -match '^v') { $version } else { "v$version" }
        Write-Host ("OK    Kit version: {0}" -f $display) -ForegroundColor Green
        $ok++
    } elseif ($version -eq 'unknown') {
        Write-Host "WARN  Kit version: unknown (manifest hilang, `$script:KIT_VERSION kosong, CHANGELOG.md tidak parseable)" -ForegroundColor Yellow
        $warn++
    } else {
        Write-Host ("ERROR Kit version: format tidak dikenali ('{0}')" -f $version) -ForegroundColor Red
        $err++
    }

    # 2. File inti check
    # Source of truth: lib\kit-files.psd1 (single manifest, di-load semua konsumen)
    $kitFilesPsd1 = Join-Path $KitDir 'lib\kit-files.psd1'
    if (-not (Test-Path $kitFilesPsd1)) {
        Write-Host "ERROR lib\kit-files.psd1 hilang (manifest single-source-of-truth)" -ForegroundColor Red
        $err++
        $wajibAda = @()
    } else {
        # psd1 ADA tapi bisa RUSAK (sintaks salah / salah-edit SSOT). Di bawah $ErrorActionPreference='Stop',
        # Import-PowerShellDataFile yang gagal = error TERMINATING -> dulu Invoke-Doctor ABORT (error merah,
        # TANPA baris Result -> staf bingung). Tangkap + cetak pesan rapi + LANJUT (cermin kit.mjs).
        try {
            $kitFiles = Import-PowerShellDataFile -Path $kitFilesPsd1 -ErrorAction Stop
            $wajibAda = @(
                $kitFiles.core_prompts +
                $kitFiles.universal_rules +
                $kitFiles.scripts +
                $kitFiles.lib_files +
                $kitFiles.node_lib +
                $kitFiles.templates +
                $kitFiles.docs +
                $kitFiles.tests +
                $kitFiles.ci +
                $kitFiles.meta
            ) | ForEach-Object { $_ -replace '/', '\' }
        } catch {
            Write-Host "ERROR lib\kit-files.psd1 rusak / tak terbaca (cek sintaks .psd1)" -ForegroundColor Red
            $err++
            $wajibAda = @()
        }
    }

    if ($wajibAda.Count -gt 0) {
        $missing = @()
        foreach ($f in $wajibAda) {
            $p = Join-Path $KitDir $f
            if (-not (Test-Path $p)) { $missing += $f }
        }
        if ($missing.Count -eq 0) {
            Write-Host ("OK    {0} file inti utuh" -f $wajibAda.Count) -ForegroundColor Green
            $ok++
        } else {
            Write-Host ("ERROR {0} file missing:" -f $missing.Count) -ForegroundColor Red
            $missing | ForEach-Object { Write-Host ("        - {0}" -f $_) -ForegroundColor Red }
            $err++
            Write-Host "      Saran: .\.claude-kit\kit.ps1 update (re-clone fresh)" -ForegroundColor Yellow
        }
    }

    # 2b. Integrity check (sha256) - verifies files haven't been modified since install
    $manifestPath = Join-Path $KitDir '.install-manifest.json'
    if (Test-Path $manifestPath) {
        try {
            $manifestRaw = Get-Content -Path $manifestPath -Raw -ErrorAction Stop
            $manifest = $manifestRaw | ConvertFrom-Json -ErrorAction Stop
        } catch {
            # Pesan TETAP tanpa detail runtime: identik PS==Node + tak bocorkan isi manifest rusak (bisa memuat path). Cermin Invoke-Diff.
            Write-Host "WARN  Integrity check skipped: manifest .install-manifest.json rusak / tak terbaca (cek format JSON)." -ForegroundColor Yellow
            $warn++
            $manifest = $null
        }

        if ($null -ne $manifest) {
            # 2b-i. Verifikasi KEASLIAN manifest (HMAC) DULU supaya 'PRISTINE' di bawah tidak
            # menyesatkan: sha256 cuma membuktikan file cocok DAFTAR, bukan bahwa daftarnya
            # sendiri asli (belum di-tamper). Pakai helper yang sama dengan jalur uninstall/
            # rollback yang teruji. Gagal-muat/error => skip + INFO (JANGAN alarm palsu). (MANIFEST-01)
            $sigStatus = 'skipped'
            $signingLib = Join-Path $KitDir 'lib/manifest-signing.ps1'
            if (Test-Path $signingLib) {
                try {
                    . $signingLib
                    $sigStatus = Get-LintasManifestSignatureStatus -Manifest $manifest -KitRoot $KitDir
                } catch {
                    $sigStatus = 'skipped'
                }
            }
            switch ($sigStatus) {
                'verified' { Write-Host "OK    Manifest: tanda-tangan VALID (daftar berkas terverifikasi asli)" -ForegroundColor Green; $ok++ }
                'invalid'  { Write-Host "WARN  Manifest: tanda-tangan TIDAK COCOK - daftar mungkin diubah; hasil integrity di bawah BELUM tentu bisa dipercaya." -ForegroundColor Yellow; $warn++ }
                'unsigned' { Write-Host "INFO  Manifest: tanpa tanda-tangan (legacy) - integrity di bawah = cek sha256 saja, keaslian daftar belum diverifikasi." -ForegroundColor Cyan }
                default    { Write-Host "INFO  Manifest: verifikasi tanda-tangan dilewati (helper tidak tersedia)." -ForegroundColor Cyan }
            }

            $pristine = 0
            $modifiedList = @()
            $integrityMissing = 0

            $entries = @()
            if ($manifest.files) { $entries = $manifest.files }
            elseif ($manifest.entries) { $entries = $manifest.entries }

            foreach ($entry in $entries) {
                $relPath = $null
                if ($entry.path) { $relPath = $entry.path }
                elseif ($entry.file) { $relPath = $entry.file }
                if (-not $relPath) { continue }

                $expectedSha = $null
                if ($entry.sha256) { $expectedSha = $entry.sha256 }
                if (-not $expectedSha) { continue }

                $relPathNorm = $relPath -replace '/', '\'
                # Manifest stores paths relative to PROJECT ROOT (e.g. ".claude-kit/lib/rollback.ps1",
                # "AGENTS.md"), bukan relative ke $KitDir. Lihat setup-pola-b.ps1 Add-ToManifest:
                # `$relPath = $FilePath.Replace($script:ProjectRoot, '')`. Pakai $ProjectRoot
                # (sudah didefine di line ~61) supaya tidak double-prefix ".claude-kit/.claude-kit/...".
                $absPath = Join-Path $ProjectRoot $relPathNorm

                if (-not (Test-Path $absPath)) {
                    $integrityMissing++
                    continue
                }

                try {
                    $actualSha = (Get-FileHash -Path $absPath -Algorithm SHA256 -ErrorAction Stop).Hash
                    if ($actualSha -eq $expectedSha.ToUpper() -or $actualSha.ToLower() -eq $expectedSha.ToLower()) {
                        $pristine++
                    } else {
                        $modifiedList += $relPath
                    }
                } catch {
                    $modifiedList += ("{0} (hash error: {1})" -f $relPath, $_.Exception.Message)
                }
            }

            $modifiedCount = $modifiedList.Count
            Write-Host ("OK    Integrity: PRISTINE={0}, MODIFIED={1}, MISSING={2}" -f $pristine, $modifiedCount, $integrityMissing) -ForegroundColor Green
            if ($modifiedCount -gt 0) {
                Write-Host "WARN  File berikut dimodifikasi sejak install (mungkin disengaja):" -ForegroundColor Yellow
                $modifiedList | ForEach-Object { Write-Host ("        - {0}" -f $_) -ForegroundColor Yellow }
                $warn++
            } else {
                $ok++
            }
            if ($integrityMissing -gt 0) {
                Write-Host ("ERROR Integrity: {0} file di manifest tapi tidak ada di disk" -f $integrityMissing) -ForegroundColor Red
                $err++
            }
        }
    } else {
        Write-Host "INFO  Integrity check skipped: .install-manifest.json tidak ada (kit pre-manifest atau belum di-install)" -ForegroundColor Cyan
    }

    # 3. AGENTS.md di root proyek
    $agentsAtRoot = Join-Path $ProjectRoot 'AGENTS.md'
    if (Test-Path $agentsAtRoot) {
        Write-Host "OK    AGENTS.md ada di root proyek" -ForegroundColor Green
        $ok++
    } else {
        Write-Host "WARN  AGENTS.md belum di-copy ke root proyek" -ForegroundColor Yellow
        Write-Host "      Saran: .\.claude-kit\kit.ps1 setup" -ForegroundColor Yellow
        $warn++
    }

    # 4. docs/ folder
    $docsDir = Join-Path $ProjectRoot 'docs'
    if (Test-Path $docsDir) {
        $docsCount = (Get-ChildItem $docsDir -Recurse -File).Count
        Write-Host ("OK    docs/ ada ({0} file)" -f $docsCount) -ForegroundColor Green
        $ok++
    } else {
        Write-Host "WARN  docs/ belum dibuat" -ForegroundColor Yellow
        Write-Host "      Saran: .\.claude-kit\kit.ps1 setup" -ForegroundColor Yellow
        $warn++
    }

    # 5. .github/ folder (team mode files)
    $githubDir = Join-Path $ProjectRoot '.github'
    if (Test-Path $githubDir) {
        Write-Host "OK    .github/ ada (Team Mode aktif)" -ForegroundColor Green
        $ok++
    } else {
        Write-Host "INFO  .github/ tidak ada (Team Mode skipped, atau project non-GitHub)" -ForegroundColor Cyan
    }

    # 6. .git/ internal (should NOT exist for Pola B clone)
    $internalGit = Join-Path $KitDir '.git'
    if (Test-Path $internalGit) {
        Write-Host "WARN  .claude-kit\.git\ masih ada (sisa dari clone)" -ForegroundColor Yellow
        Write-Host "      Saran: Remove-Item '$internalGit' -Recurse -Force" -ForegroundColor Yellow
        $warn++
    } else {
        Write-Host "OK    .claude-kit/ tidak ada .git/ internal" -ForegroundColor Green
        $ok++
    }

    # Ringkasan
    Write-Host ""
    Write-Host ("Result: OK={0} WARN={1} ERROR={2}" -f $ok, $warn, $err) -ForegroundColor Cyan
    if ($err -eq 0 -and $warn -eq 0) {
        Write-Host "Kit sehat. Siap dipakai." -ForegroundColor Green
        return 0
    } elseif ($err -eq 0) {
        Write-Host "Kit OK dengan warning. Bisa dipakai, tapi fix warning kalau bisa." -ForegroundColor Yellow
        return 0
    } else {
        Write-Host "Kit BERMASALAH. Fix ERROR di atas dulu." -ForegroundColor Red
        return 1
    }
}

# ---- Helper: scan project ----
function Invoke-Scan {
    Write-Host ""
    Write-Host "=== Kit Scan - Universal Adaptive Scan (kit $(Get-KitVersionDisplay)) ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Catatan: kit.ps1 scan = scan ringan untuk count kandidat." -ForegroundColor Yellow
    Write-Host "        Untuk bulk-bootstrap actual, paste JALANKAN_KIT.md ke Claude Code (yang trigger AI workflow)." -ForegroundColor Yellow
    Write-Host ""

    # Patterns CRITICAL (universal, sesuai JALANKAN_KIT).
    # [ordered] = urutan kategori DETERMINISTIK (sesuai deklarasi), bukan urutan-hash acak .NET.
    # (PERBAIKAN: dulu @{} biasa -> urutan keluaran tak terduga + beda antar-mesin/versi PS.)
    $patterns = [ordered]@{
        'Auth'       = @('auth*', 'session*', 'login*', 'oauth*', 'jwt*', 'passport*')
        'DB'         = @('db.*', 'prisma*', 'drizzle*', 'repository*', 'schema*', 'models')
        'Security'   = @('crypto*', 'encrypt*', 'decrypt*', 'permissions*', 'acl*', 'policies*', '*-guard*', 'rate-limit*', 'csrf*', 'cors*')
        'API/Router' = @('routes', 'controllers', 'handlers', 'api', 'endpoints', 'resolvers', 'actions')
        'Entry/MW'   = @('main.*', 'index.*', 'app.*', 'server.*', 'layout.*', 'middleware.*', 'interceptor.*')
    }

    $sourceFolders = @('src', 'app', 'lib', 'internal', 'pkg', 'cmd', 'features', 'modules', 'routes', 'controllers', 'handlers', 'services', 'domain')
    $skipFolders = @('node_modules', 'dist', '.next', 'target', 'build', 'vendor', '__pycache__', '.venv', 'generated', '.git')

    $totalByCategory = @{}
    foreach ($cat in $patterns.Keys) { $totalByCategory[$cat] = 0 }

    foreach ($src in $sourceFolders) {
        $srcPath = Join-Path $ProjectRoot $src
        if (-not (Test-Path $srcPath)) { continue }

        $allFiles = Get-ChildItem -Path $srcPath -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object {
                $skipped = $false
                foreach ($skip in $skipFolders) {
                    if ($_.FullName -match "[\\/]$skip[\\/]") { $skipped = $true; break }
                }
                -not $skipped
            }

        foreach ($cat in $patterns.Keys) {
            foreach ($p in $patterns[$cat]) {
                # PERBAIKAN anti-crash: sebagian pola (mis. '*-guard*') = wildcard SAH untuk -like
                # tapi REGEX TAK-VALID (.NET melempar "Quantifier following nothing"). Dulu cabang
                # `-match $p` MELEMPAR di project nyata ber-folder src/ -> scan CRASH. Sekarang cabang
                # regex (FullName) HANYA dipakai kalau polanya regex sah; cabang wildcard (-like) jalan terus.
                $rxOk = $true
                try { [void][regex]::new($p) } catch { $rxOk = $false }
                $matched = $allFiles | Where-Object { $_.Name -like $p -or ($rxOk -and ($_.FullName -match $p)) }
                $totalByCategory[$cat] += $matched.Count
            }
        }
    }

    Write-Host "Kandidat CRITICAL per kategori (rough estimate):" -ForegroundColor Cyan
    $grandTotal = 0
    foreach ($cat in $patterns.Keys) {
        $count = $totalByCategory[$cat]
        Write-Host ("  {0,-15} {1,4} file" -f $cat, $count)
        $grandTotal += $count
    }
    Write-Host ""
    Write-Host ("Total kandidat (rough, may include duplicates): {0}" -f $grandTotal) -ForegroundColor Yellow
    Write-Host ""

    if ($grandTotal -ge 30) {
        Write-Host "Saran: total >= 30, pakai subfolder grouping saat bulk-bootstrap." -ForegroundColor Cyan
        Write-Host "      Mapping: docs/api/, docs/lib/, docs/security/, docs/features/<n>/, dst." -ForegroundColor Cyan
    } else {
        Write-Host "Saran: total < 30, flat docs/ masih oke." -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Host "Next step:" -ForegroundColor Cyan
    Write-Host "  1. Paste isi .claude-kit\JALANKAN_KIT.md ke Claude Code untuk full workflow."
    Write-Host "  2. AI akan tanya pilih (1)/(2)/(3)/(4) di step 12 (default (3) Skeleton-first)."
    Write-Host ""

    return 0
}

# ---- Helper: status ringkas (1-layar) ----
# Mirror Invoke-Doctor structure tapi output lebih ringkas - fokus pada snapshot cepat,
# bukan diagnostic mendalam. Kalau user butuh detail (file inti, integrity sha256, dst.),
# arahkan ke `doctor`.
function Invoke-Status {
    Write-Host ""
    Write-Host "=== Kit Status (ringkas) ===" -ForegroundColor Cyan
    Write-Host ""

    # 1. Kit version
    $version = Get-KitVersion
    $versionDisplay = if ($version -match '^v') { $version } elseif ($version -eq 'unknown') { 'unknown' } else { "v$version" }
    Write-Host ("Kit version    : {0}" -f $versionDisplay) -ForegroundColor Green

    # 2. Install mode (npx-mode vs git-clone-mode)
    # Heuristic: kalau $ScriptRoot path mengandung 'node_modules' atau 'npm-cache' atau
    # '_npx' (Windows npx cache), itu npx-mode. Selain itu git-clone-mode (atau direct).
    # Catatan: $ScriptRoot = lokasi kit.ps1 yang lagi running, $KitDir = kit yang di-inspect.
    $installMode = 'git-clone-mode'
    if ($ScriptRoot -match '(node_modules|npm-cache|_npx|AppData[\\/]+Local[\\/]+npm-cache)') {
        $installMode = 'npx-mode'
    }
    Write-Host ("Install mode   : {0}" -f $installMode) -ForegroundColor Green

    # 3. AGENTS.md present (Y/N + last modified)
    $agentsAtRoot = Join-Path $ProjectRoot 'AGENTS.md'
    if (Test-Path $agentsAtRoot) {
        try {
            $agentsMtime = (Get-Item $agentsAtRoot -ErrorAction Stop).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')
            Write-Host ("AGENTS.md      : Y (last modified: {0})" -f $agentsMtime) -ForegroundColor Green
        } catch {
            Write-Host "AGENTS.md      : Y (mtime unavailable)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "AGENTS.md      : N (belum di-copy ke project root)" -ForegroundColor Yellow
    }

    # 4. Manifest signed (Y/N + verify result)
    # "Signed" di sini = manifest punya field 'signature' atau 'sha256_of_manifest' atau
    # equivalent. Sekarang kit pakai per-file sha256 di manifest.files[].sha256 - anggap
    # itu "signed" kalau minimal ada N file dengan sha256 valid.
    $manifestPath = Join-Path $KitDir '.install-manifest.json'
    $manifestSignedDisplay = 'N (manifest hilang)'
    $manifestSignedColor = 'Yellow'
    $lastUpdateDisplay = 'unknown'
    if (Test-Path $manifestPath) {
        try {
            $manifestJson = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8)
            $manifest = ConvertFrom-Json $manifestJson -ErrorAction Stop

            # Cek "signed": ada signature field, atau minimal entries dengan sha256.
            # WHY metadata.signature (bukan top-level): tanda tangan disimpan di
            # $manifest.metadata.signature (lib/manifest.ps1) -- jalur top-level
            # selalu absen, bikin cabang display di bawah jadi kode mati.
            $hasSignature = $false
            if ($manifest.metadata -and $manifest.metadata.signature) { $hasSignature = $true }
            if (-not $hasSignature) {
                $entries = @()
                if ($manifest.files) { $entries = $manifest.files }
                elseif ($manifest.entries) { $entries = $manifest.entries }
                $shaCount = @($entries | Where-Object { $_.sha256 }).Count
                if ($shaCount -gt 0) {
                    $hasSignature = $true
                    $manifestSignedDisplay = ("Y ({0} files w/ sha256)" -f $shaCount)
                    $manifestSignedColor = 'Green'
                }
            } else {
                $manifestSignedDisplay = 'Y (manifest bertanda-tangan)'
                $manifestSignedColor = 'Green'
            }

            if (-not $hasSignature) {
                $manifestSignedDisplay = 'N (manifest ada tapi tidak signed)'
                $manifestSignedColor = 'Yellow'
            }

            # Last update timestamp dari manifest
            if ($manifest.metadata -and $manifest.metadata.installed_at) {
                $lastUpdateDisplay = $manifest.metadata.installed_at
            } elseif ($manifest.metadata -and $manifest.metadata.updated_at) {
                $lastUpdateDisplay = $manifest.metadata.updated_at
            } elseif ($manifest.installed_at) {
                $lastUpdateDisplay = $manifest.installed_at
            }
        } catch {
            # Pesan TETAP tanpa detail runtime (identik PS==Node + tak bocorkan isi manifest). Lihat Invoke-Diff.
            $manifestSignedDisplay = "N (manifest rusak / tak terbaca)"
            $manifestSignedColor = 'Red'
        }
    }
    Write-Host ("Daftar file kit signed: {0}" -f $manifestSignedDisplay) -ForegroundColor $manifestSignedColor

    # 5. Last update timestamp
    Write-Host ("Last update    : {0}" -f $lastUpdateDisplay) -ForegroundColor Green

    # 6. Tier setup (.staff-profile.md present?)
    $staffProfile = Join-Path $ProjectRoot '.staff-profile.md'
    if (Test-Path $staffProfile) {
        Write-Host "Tier setup     : Y (.staff-profile.md ada)" -ForegroundColor Green
    } else {
        Write-Host "Tier setup     : N (.staff-profile.md belum dibuat - solo/owner mode)" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Untuk detail lebih lengkap: .\.claude-kit\kit.ps1 doctor" -ForegroundColor Cyan
    Write-Host ""
    return 0
}

# ---- Helper: print version ----
# Uses Get-KitVersion fallback chain (manifest -> $script:KIT_VERSION -> CHANGELOG -> "unknown").
function Show-Version {
    Write-Host (Get-KitVersion)
}

# ---- Helper: diff vs manifest ----
# Compare current file hashes vs sha256 di .install-manifest.json. Tampilkan file yang
# modified atau missing sejak install. Berguna buat user yang mau cek apakah ada yang
# tweaked file kit secara manual sebelum jalankan `update` atau `uninstall`.
function Invoke-Diff {
    param([string]$ProjectRootResolved)
    $kitDir = Join-Path $ProjectRootResolved ".claude-kit"
    $manifestPath = Join-Path $kitDir ".install-manifest.json"
    if (-not (Test-Path $manifestPath)) {
        Write-Warning "Tidak ada manifest di $manifestPath. Kit belum di-install atau corrupt."
        return 1
    }
    # Manifest bisa RUSAK (JSON cacat / salah-edit). Di bawah $ErrorActionPreference='Stop',
    # ConvertFrom-Json yang gagal = error TERMINATING -> dulu kit.ps1 membocorkan jejak-error .NET
    # teknis ke staf (langgar prinsip non-programmer). Tangkap + peringatan rapi + keluar 1 (cermin kit.mjs).
    try {
        $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json -ErrorAction Stop
    } catch {
        Write-Warning "Manifest .install-manifest.json rusak / tak terbaca (cek format JSON)."
        return 1
    }
    $modified = @()
    $missing = @()
    foreach ($entry in $manifest.files) {
        $filePath = Join-Path $ProjectRootResolved $entry.path
        if (-not (Test-Path $filePath)) {
            $missing += $entry.path
        } elseif (-not $entry.sha256) {
            # Entry tanpa sidik-jari sha256 tercatat (mis. file hilang saat manifest dibuat,
            # atau manifest corrupt/di-tamper). Tak bisa diverifikasi "pristine" -> tandai
            # modified (konservatif/fail-safe). Tanpa guard ini, .ToLower() pada $null melempar
            # exception mentah karena $ErrorActionPreference='Stop' (REL-3, audit 2026-06-17).
            # Pola sama dengan Invoke-Doctor yang sudah skip entry tanpa sha (~line 310-312).
            $modified += $entry.path
        } else {
            $currentHash = (Get-FileHash -Algorithm SHA256 -Path $filePath).Hash.ToLower()
            if ($currentHash -ne $entry.sha256.ToLower()) {
                $modified += $entry.path
            }
        }
    }
    Write-Host "=== Kit Diff (vs daftar file kit) ==="
    Write-Host "Modified ($($modified.Count)):"
    $modified | ForEach-Object { Write-Host "  M $_" }
    Write-Host ""
    Write-Host "Missing ($($missing.Count)):"
    $missing | ForEach-Object { Write-Host "  - $_" }
    return 0
}

# ---- Router ----
switch ($Command) {
    'setup' {
        $script = Join-Path $KitDir 'setup-pola-b.ps1'
        if (-not (Test-Path $script)) {
            Write-Host "ERROR: setup-pola-b.ps1 tidak ada di $KitDir" -ForegroundColor Red
            exit 1
        }
        & $script @ExtraArgs
        exit $LASTEXITCODE
    }
    'update' {
        $script = Join-Path $KitDir 'update-kit.ps1'
        if (-not (Test-Path $script)) {
            Write-Host "ERROR: update-kit.ps1 tidak ada di $KitDir" -ForegroundColor Red
            exit 1
        }
        & $script @ExtraArgs
        exit $LASTEXITCODE
    }
    'check-update' {
        # Cek versi remote vs lokal TANPA mengubah apa pun (read-only). Delegate ke
        # update-kit.ps1 -CheckOnly (pakai logika deteksi-versi yang SAMA dengan update asli,
        # supaya yang dilaporkan check-update = yang akan dilakukan update).
        $script = Join-Path $KitDir 'update-kit.ps1'
        if (-not (Test-Path $script)) {
            Write-Host "ERROR: update-kit.ps1 tidak ada di $KitDir" -ForegroundColor Red
            exit 1
        }
        # CATATAN: panggil TANPA @ExtraArgs splat. Array-splat string '-Switch' (dari @ExtraArgs)
        # di PS 5.1 bisa salah-bind jadi argumen POSISIONAL -> RepoUrl rusak -> prompt allowlist ->
        # MACET. check-update = read-only, tak butuh argumen tambahan, jadi panggil polos.
        & $script -CheckOnly
        exit $LASTEXITCODE
    }
    'uninstall' {
        $script = Join-Path $KitDir 'uninstall.ps1'
        if (-not (Test-Path $script)) {
            Write-Host "ERROR: uninstall.ps1 tidak ada di $KitDir" -ForegroundColor Red
            Write-Host "       Kit ini di-install pakai versi <v1.0.0 (sebelum uninstall.ps1 ada)." -ForegroundColor Red
            Write-Host "       Saran: update kit dulu (.\.claude-kit\kit.ps1 update), atau hapus manual." -ForegroundColor Red
            exit 1
        }
        & $script @ExtraArgs
        exit $LASTEXITCODE
    }
    'doctor' {
        $code = Invoke-Doctor
        exit $code
    }
    'scan' {
        $code = Invoke-Scan
        exit $code
    }
    'status' {
        $code = Invoke-Status
        exit $code
    }
    'diff' {
        $code = Invoke-Diff -ProjectRootResolved $ProjectRoot
        exit $code
    }
    'version' {
        Show-Version
        exit 0
    }
    'rollback' {  # Kembalikan ke versi sebelumnya
        if (Test-Path $libRollback) {
            try {
                . $libRollback
                $result = Invoke-Rollback -ProjectRoot $ProjectRoot
                # Result hash bisa di-suppress kalau dipanggil di pipe; di sini kita
                # tidak butuh nilainya - biarin function-nya yang print status.
                $null = $result
                $global:LASTEXITCODE = 0
                exit 0
            } catch {
                Write-Host ("[ERROR] Rollback gagal: {0}" -f $_) -ForegroundColor Red
                $global:LASTEXITCODE = 2
                exit 2
            }
        } else {
            Write-Host "ERROR: lib\rollback.ps1 tidak ada di $KitDir" -ForegroundColor Red
            Write-Host "       Kit ini di-install pakai versi <v1.x (sebelum rollback ada)." -ForegroundColor Red
            Write-Host "       Saran: update kit dulu (.\.claude-kit\kit.ps1 update)." -ForegroundColor Red
            exit 1
        }
    }
    'bump' {  # [kit dev] Cap nomor versi baru ke semua berkas + kerangka CHANGELOG (1-langkah)
        $newVer = if ($ExtraArgs -and @($ExtraArgs).Count -ge 1) { $ExtraArgs[0] } else { '' }
        if (-not $newVer) {
            Write-Host "Pemakaian: kit.ps1 bump <versi>   (mis. .\.claude-kit\kit.ps1 bump 1.42.0)" -ForegroundColor Yellow
            Write-Host "Cap nomor versi baru ke semua berkas + tambah kerangka entri CHANGELOG + cek kecocokan." -ForegroundColor DarkGray
            exit 1
        }
        $ccPath = Join-Path $KitDir 'lib\consistency-check.ps1'
        if (-not (Test-Path $ccPath)) {
            Write-Host "ERROR: lib\consistency-check.ps1 tidak ada di $KitDir (perlu kit versi baru)." -ForegroundColor Red
            exit 1
        }
        . $ccPath
        try {
            $null = Invoke-LintasVersionBump -RepoRoot $KitDir -NewVersion $newVer
            $check = Invoke-LintasConsistencyCheck -RepoRoot $KitDir
            if ($check.MismatchCount -eq 0) {
                Write-Host ("Sekarang tulis deskripsi entri CHANGELOG [{0}] (ganti placeholder), lalu jalankan tests/Run-Tests.ps1." -f $newVer) -ForegroundColor Cyan
            }
            exit $check.MismatchCount
        } catch {
            Write-Host ("[ERROR] bump gagal: {0}" -f $_) -ForegroundColor Red
            exit 2
        }
    }
    'help' {
        Show-Help
        exit 0
    }
    default {
        Show-Help
        if ($Command -eq '') { exit 0 } else { exit 1 }
    }
}
