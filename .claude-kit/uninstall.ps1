<#
.SYNOPSIS
  uninstall.ps1 - Hapus lintasAI dari proyek dengan AMAN (manifest-based diff)

.DESCRIPTION
  Script ini baca .claude-kit/.install-manifest.json (manifest yang dibuat setup-pola-b.ps1)
  lalu compare hash sha256 tiap file kit-template vs file di disk:

    PRISTINE  (hash match) -> auto-delete, file persis sama dengan yang kit copy waktu install.
    MODIFIED  (hash beda)  -> SKIP by default (user sudah edit). -AllowModified -> backup ke
                              .pre-uninstall-<timestamp>.bak lalu hapus. (-Force = alias deprecated)
    SYMLINK   (reparse pt) -> SKIP selalu. Symlink / junction tidak pernah di-auto-delete
                              supaya tidak bocorin isi file di luar project ke .bak.
    BLOCKED   (out of root)-> SKIP. Manifest entry yang resolve ke luar project ditolak
                              (proteksi path traversal). Lihat juga -AllowProjectRootMismatch.
    LOCKED    (hash gagal) -> SKIP. File ke-lock editor/AV; user diminta tutup editor.
    MISSING   (file gone)  -> skip silent (user mungkin sudah hapus manual).

  Direktori yang dibuat saat install (docs/, .github/, dst.) hanya di-delete kalau EMPTY
  setelah file dihapus. Project file kamu di sana TETAP aman.

  AGENTS.md default SKIP delete (heavy customization expected). Pakai -DeleteAgents untuk hapus.

  Default uninstall TIDAK self-delete folder .claude-kit\ -- script tidak bisa hapus folder
  yang sedang dia jalankan dari sana. Instruksi 1-langkah ditampilkan di akhir.

.PARAMETER DryRun
  Tampilkan rencana hapus tanpa eksekusi (RECOMMENDED first run).
.PARAMETER AllowModified
  Hapus juga file yang MODIFIED (dengan backup .bak). Default = skip modified.
  Flag ini menggantikan -Force (deprecated) untuk bypass modified-file check.
.PARAMETER Force
  [DEPRECATED] Backward-compat alias untuk -AllowModified. Akan menampilkan
  deprecation warning. Pakai -AllowModified untuk explicit intent.
.PARAMETER DeleteAgents
  Ikut hapus AGENTS.md di project root. Default = skip (user heavy-edit).
.PARAMETER KeepKit
  Default-nya script memang TIDAK self-delete folder .claude-kit\ (tidak bisa saat running),
  tapi instruksi manual ditampilkan. Pakai -KeepKit untuk SUPPRESS instruksi tersebut kalau
  kamu memang mau retain folder kit (mis. lanjut pakai kit, cuma cleanup file deploy).
.PARAMETER Yes
  Auto-confirm prompt Y/N (skip Read-Host). Untuk CI/automation. Manual user: tidak perlu.
  PAKAI cuma kalau sudah lihat dry-run.
.PARAMETER AllowProjectRootMismatch
  Override hard-fail kalau manifest project_root TIDAK match lokasi sekarang (folder di-rename
  / di-move setelah install). Tanpa flag ini, script abort untuk mencegah delete ke salah lokasi.

.NOTES
  Versi  : 1.0.1
  Tanggal: 2026-06-03
  Run    : .\.claude-kit\uninstall.ps1 -DryRun           (lihat rencana dulu)
  Atau   : .\.claude-kit\uninstall.ps1                   (eksekusi konservatif)
  Atau   : .\.claude-kit\uninstall.ps1 -AllowModified    (hapus juga modified, dengan backup)
  Legacy : .\.claude-kit\uninstall.ps1 -Force            (DEPRECATED alias untuk -AllowModified)
  Lebih ringkas: .\.claude-kit\kit.ps1 uninstall
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$AllowModified,
    [switch]$Force,
    [switch]$DeleteAgents,
    [switch]$KeepKit,
    [switch]$Yes,
    [switch]$AllowProjectRootMismatch,
    [switch]$NoGui,
    [string]$ProjectRoot = $null
)

# ---- Resolve $ProjectRoot early (param-driven, fallback to script location) ----
# Kalau user pass -ProjectRoot via param (npx wrapper / smoke test / CI), TRUST it sebagai
# ground truth -- $PSBoundParameters check supaya kita honor explicit param meski empty string.
# Kalau tidak di-supply, derive dari $PSScriptRoot (script ada di .claude-kit\, parent = project root).
if ($PSBoundParameters.ContainsKey('ProjectRoot') -and $ProjectRoot) {
    $ProjectRoot = (Resolve-Path $ProjectRoot -ErrorAction Stop).Path
} else {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
}
Write-Host "Root proyek   : $ProjectRoot"

# ---- Deprecation handling: -Force jadi alias backward-compat untuk -AllowModified ----
# Sebelumnya -Force overloaded (modified bypass + signature bypass). Pisahkan supaya
# intent jelas. -Force masih bekerja untuk backward-compat tapi warn user.
if ($Force) {
    Write-Host ''
    Write-Host '[DEPRECATED] -Force flag. Pakai -AllowModified.' -ForegroundColor Yellow
    Write-Host '             -Force masih bekerja sebagai alias untuk backward-compat,' -ForegroundColor Yellow
    Write-Host '             tapi akan dihapus di versi mendatang. Ganti pemanggilan script kamu.' -ForegroundColor Yellow
    Write-Host ''
    if (-not $AllowModified) { $AllowModified = $true }
}

$ErrorActionPreference = 'Stop'

# ---- Resolve folder kit (tempat script ini berada) ----
# $ProjectRoot sudah di-resolve di awal (param-driven). Jangan override.
$KitDir = if ($PSScriptRoot) { $PSScriptRoot } elseif ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { (Get-Location).Path }
$ProjectName = Split-Path -Leaf $ProjectRoot
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

# ---- Load shared safety helpers (Resolve-SafeProjectPath, Test-PathHasReparsePoint) ----
# Dot-source supaya helper jalan di scope script ini (perlu akses $ProjectRoot &
# $script:ProjectRootCanonical). Import-Module .ps1 tidak supported di PS 5.1 dan
# function di module punya scope sendiri (helper tidak akan lihat $ProjectRoot caller).
. (Join-Path $PSScriptRoot 'lib\safety.ps1')

# ---- Load popup-helpers (GUI prompts for security-sensitive confirmations) ----
# Dot-source supaya Show-LintasYesNoPopup / Test-LintasGuiAvailable available di scope ini.
# Optional: kalau file hilang (kit pre-popup era), fallback ke console-only mode (no crash).
# Security-sensitive prompts (mis. unsigned/tampered manifest continue) butuh GUI popup
# supaya user secara EKSPLISIT click "Yes" -- bukan tertekan Enter di Read-Host yg gampang
# kelewat. Console fallback tetap dipertahankan untuk -NoGui / SSH / Server Core / CI.
$useConsoleMode = $false
$popupHelpersPath = Join-Path $PSScriptRoot 'lib\popup-helpers.ps1'
if (Test-Path $popupHelpersPath) {
    try {
        . $popupHelpersPath
        # Force console mode kalau user kasih -NoGui ATAU GUI tidak available
        # (headless: SSH, Server Core, services session, RDP w/o desktop, dst.).
        if ($NoGui -or -not (Test-LintasGuiAvailable)) {
            $useConsoleMode = $true
        }
    } catch {
        Write-Host "INFO: lib\popup-helpers.ps1 gagal di-load ($_). Fallback ke console mode." -ForegroundColor Yellow
        $useConsoleMode = $true
    }
} else {
    # popup-helpers.ps1 tidak ada (kit lama / partial extract) -- fallback console mode.
    $useConsoleMode = $true
}

if ($PSBoundParameters.ContainsKey('ProjectRoot')) {
    # NPX mode: kit script invoked from npm cache, redirect KitDir to project .claude-kit
    $expectedKitDir = Join-Path $ProjectRoot '.claude-kit'
    if (Test-Path $expectedKitDir) {
        $KitDir = (Resolve-Path $expectedKitDir).Path
        Write-Host "[npx-mode] Redirected KitDir to: $KitDir"
    } else {
        Write-Host "[npx-mode] WARNING: .claude-kit tidak ditemukan di $ProjectRoot"
        Write-Host "Kit mungkin belum di-install. Jalankan: npx lintasai init"
        exit 1
    }
}

# ---- Validasi posisi script: script HARUS di dalam folder bernama .claude-kit ----
# Kalau bukan, user mungkin salah jalankan dari folder lain. Fail-aman dengan pesan jelas.
$kitFolderName = Split-Path -Leaf $KitDir
if ($kitFolderName -ne '.claude-kit') {
    Write-Host ''
    Write-Host 'STOP: Script ini tidak berada di dalam folder .claude-kit\.' -ForegroundColor Red
    Write-Host "      Lokasi script sekarang: $KitDir" -ForegroundColor Red
    Write-Host ''
    Write-Host 'Kemungkinan:' -ForegroundColor Yellow
    Write-Host '  (A) Kamu jalankan dari folder SALAH (proyek ini belum pernah install lintasAI).' -ForegroundColor Yellow
    Write-Host '      -> Cek di File Explorer: buka root proyek, lihat ada folder .claude-kit\ atau tidak.' -ForegroundColor Yellow
    Write-Host '  (B) Folder kit di-rename dari .claude-kit\ ke nama lain.' -ForegroundColor Yellow
    Write-Host '      -> Rename balik jadi .claude-kit, lalu ulangi.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'TIDAK ADA satu pun file proyek kamu yang disentuh script ini. Aman.' -ForegroundColor Green
    exit 1
}

# ---- Cek manifest ----
$manifestPath = Join-Path $KitDir '.install-manifest.json'
if (-not (Test-Path $manifestPath)) {
    Write-Host ''
    Write-Host 'STOP: Tidak bisa lanjut karena file pencatat install hilang.' -ForegroundColor Red
    Write-Host ''
    Write-Host 'Apa yang terjadi:' -ForegroundColor White
    Write-Host '  Setiap kali kit ter-install, dia bikin catatan kecil:' -ForegroundColor White
    Write-Host "    $manifestPath" -ForegroundColor DarkGray
    Write-Host '  Catatan ini berisi DAFTAR file kit + sidik-jari (hash) tiap file.' -ForegroundColor White
    Write-Host '  Tanpa catatan ini, script TIDAK BERANI hapus apapun karena' -ForegroundColor White
    Write-Host '  takut salah hapus file proyek kamu (BUKAN file kit).' -ForegroundColor White
    Write-Host ''
    Write-Host 'Kenapa hilang? Tiga kemungkinan:' -ForegroundColor Yellow
    Write-Host '  1. Kit kamu versi LAMA (sebelum fitur catatan ini ada).' -ForegroundColor Yellow
    Write-Host '  2. Install dulu cuma preview (pakai -DryRun) = catatan tidak ditulis.' -ForegroundColor Yellow
    Write-Host '  3. File catatan ter-hapus / kena git revert / setup gagal di tengah.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Recovery (pilih salah satu):' -ForegroundColor Cyan
    Write-Host '  A. Re-run setup: .\.claude-kit\setup-pola-b.ps1 -Force' -ForegroundColor Cyan
    Write-Host '     (akan re-generate manifest dari file kit yang ada di project).' -ForegroundColor Cyan
    Write-Host '  B. Hapus manual sambil pelan-pelan:' -ForegroundColor Cyan
    Write-Host '     1. Buka README.md, cari section "Kalau manifest TIDAK ADA".' -ForegroundColor Cyan
    Write-Host '     2. Di sana ada DAFTAR FILE yang kit install. Cek satu-satu.' -ForegroundColor Cyan
    Write-Host '     3. Hapus file dari list itu (yang BELUM kamu edit).' -ForegroundColor Cyan
    Write-Host '     4. Terakhir hapus folder .claude-kit\ sendiri.' -ForegroundColor Cyan
    exit 1
}

# ---- Load manifest signing helpers (HMAC verify) ----
# Dot-source supaya New-ManifestSignature + Test-ManifestSignature available di scope ini.
$signingLib = Join-Path $KitDir 'lib\manifest-signing.ps1'
$signingLibOk = $false
if (Test-Path -LiteralPath $signingLib) {
    try {
        . $signingLib
        $signingLibOk = $true
    } catch {
        Write-Host "WARN  Gagal load lib\manifest-signing.ps1: $_" -ForegroundColor Yellow
        Write-Host "      Manifest signature verification akan di-skip (legacy fallback)." -ForegroundColor Yellow
    }
}

# ---- Helper: deep-convert PSCustomObject (from ConvertFrom-Json) ke nested hashtable ----
# Diperlukan supaya hashtable-based signing function (Clone + Remove + ConvertTo-Json) bisa
# jalan ulang dengan output identik dengan saat manifest di-write (waktu setup-pola-b.ps1).
function ConvertTo-HashtableDeep {
    param($Object)
    if ($null -eq $Object) { return $null }
    if ($Object -is [System.Collections.IDictionary]) {
        $ht = [ordered]@{}
        foreach ($k in $Object.Keys) { $ht[$k] = ConvertTo-HashtableDeep -Object $Object[$k] }
        return $ht
    }
    if ($Object -is [System.Management.Automation.PSCustomObject]) {
        $ht = [ordered]@{}
        foreach ($prop in $Object.PSObject.Properties) {
            $ht[$prop.Name] = ConvertTo-HashtableDeep -Object $prop.Value
        }
        return $ht
    }
    if ($Object -is [System.Collections.IEnumerable] -and -not ($Object -is [string])) {
        $arr = @()
        foreach ($item in $Object) { $arr += ,(ConvertTo-HashtableDeep -Object $item) }
        return ,$arr
    }
    return $Object
}

# ---- Parse manifest ----
try {
    $manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
    Write-Host ''
    Write-Host 'ERROR: Manifest tidak bisa di-parse (corrupt JSON):' -ForegroundColor Red
    Write-Host "       Path : $manifestPath" -ForegroundColor Red
    Write-Host "       Error: $_" -ForegroundColor Red
    Write-Host ''
    Write-Host 'Saran:' -ForegroundColor Yellow
    Write-Host "  1. Rename file ke .install-manifest.json.corrupt-$Timestamp.bak supaya bisa di-debug." -ForegroundColor Yellow
    Write-Host '  2. Re-run setup-pola-b.ps1 -Force untuk regenerate manifest dari file yang ada.' -ForegroundColor Yellow
    Write-Host '  3. Atau lihat README section "Kalau manifest TIDAK ADA" untuk fallback manual.' -ForegroundColor Yellow
    exit 1
}

# ---- Verify manifest HMAC signature (prevent tampering) ----
# Manifest unsigned (legacy / older kit) -> warn + prompt continue.
# Manifest signature INVALID -> warn + prompt continue (default ABORT kalau interactive).
# Manifest signature VALID -> silent, continue normally.
if ($signingLibOk) {
    $expectedSig = $null
    if ($manifest.metadata -and $manifest.metadata.signature) {
        $expectedSig = [string]$manifest.metadata.signature
    }

    if (-not $expectedSig) {
        Write-Host ''
        Write-Host '[!] Manifest tidak ber-signature (kit versi lama / install pre-HMAC).' -ForegroundColor Yellow
        if (-not $Force -and -not $Yes) {
            # Default = "No" (safe abort). Security-sensitive: manifest unsigned berarti
            # kita tidak bisa verify integrity -- file yang akan dihapus mungkin sudah
            # di-tamper (mis. manifest entry redirect ke file di luar kit). GUI popup
            # dipakai supaya user EKSPLISIT click "Yes" (bukan tertekan Enter).
            # Console fallback PRESERVE untuk -NoGui / headless / CI.
            $legacyAnswer = "No"
            if (-not $useConsoleMode) {
                try {
                    $legacyAnswer = Show-LintasYesNoPopup `
                        -Title "PERINGATAN KEAMANAN: Manifest unsigned (legacy/pre-HMAC)" `
                        -Message "Manifest .install-manifest.json tidak ber-signature HMAC (kit versi lama / install pre-HMAC).`n`nRESIKO: tidak ada cara verify manifest belum di-tamper. File yang akan dihapus berdasarkan manifest ini mungkin sudah di-modifikasi penyerang (mis. entry diarahkan ke file di luar folder kit).`n`nKalau kit di-install dari sumber tepercaya & belum disentuh, biasanya aman. Kalau ragu, BATAL (klik No) lalu re-install kit terbaru supaya manifest ter-sign HMAC.`n`nLanjut uninstall walaupun manifest unsigned?"
                    # Show-LintasYesNoPopup return "Yes" or "No". Default safe = No.
                } catch {
                    # Popup gagal (assemblies hilang mid-session) -> fallback console.
                    Write-Host "INFO: Popup gagal ($_). Fallback ke console prompt." -ForegroundColor Yellow
                    try {
                        $resp = Read-Host 'Lanjut uninstall dengan manifest unsigned? (y/N)'
                        $legacyAnswer = if ($resp -match '^[Yy]') { "Yes" } else { "No" }
                    } catch {
                        Write-Host 'INFO: NonInteractive shell. Pakai -Yes atau -Force untuk override.' -ForegroundColor Yellow
                        $legacyAnswer = "No"
                    }
                }
            } else {
                try {
                    $resp = Read-Host 'Lanjut uninstall dengan manifest unsigned? (y/N)'
                    $legacyAnswer = if ($resp -match '^[Yy]') { "Yes" } else { "No" }
                } catch {
                    Write-Host 'INFO: NonInteractive shell. Pakai -Yes atau -Force untuk override.' -ForegroundColor Yellow
                    $legacyAnswer = "No"
                }
            }
            if ($legacyAnswer -eq "Yes") {
                # Audit log: user EKSPLISIT memilih proceed dengan manifest yang tidak bisa
                # diverifikasi integrity-nya. Catat ke stderr supaya tertangkap di transcript
                # / CI log untuk forensics kalau ternyata uninstall menghapus file salah.
                Write-Warning "AUDIT: User pilih proceed uninstall dengan manifest UNSIGNED (legacy/pre-HMAC). Project=$ProjectRoot Timestamp=$Timestamp. Verifikasi integrity di-bypass atas eksplisit user consent."
            } else {
                throw 'Uninstall aborted: unsigned manifest (user declined to proceed)'
            }
        }
    } else {
        try {
            $manifestHt = ConvertTo-HashtableDeep -Object $manifest
            # Clone + drop signature field sebelum re-sign (signature dihitung pada manifest WITHOUT signature)
            $manifestCopy = ConvertTo-HashtableDeep -Object $manifest
            if ($manifestCopy.metadata -is [System.Collections.IDictionary]) {
                $null = $manifestCopy.metadata.Remove('signature')
            }
            $kitVerForVerify = ''
            if ($manifest.metadata -and $manifest.metadata.kit_version) {
                $kitVerForVerify = [string]$manifest.metadata.kit_version
            } elseif ($manifest.kit_version) {
                $kitVerForVerify = [string]$manifest.kit_version
            }
            $valid = Test-ManifestSignature -Manifest $manifestCopy -KitVersion $kitVerForVerify -ExpectedSignature $expectedSig
            if (-not $valid) {
                Write-Warning '[!] Manifest signature INVALID. Manifest mungkin di-tamper.'
                # -Yes ATAU -Force sama-sama bypass (konsisten dengan branch 'manifest unsigned' di atas).
                # Sebelumnya: cuma -Force di-cek -> asimetri vs unsigned branch -> bug di test fixture
                # yang sign manifest dengan secret berbeda dari secret runtime (per-install .manifest-secret).
                if (-not $Force -and -not $Yes) {
                    # Security-sensitive prompt: pakai GUI popup kalau GUI tersedia supaya
                    # user EKSPLISIT click "Yes" (mengurangi resiko default-Enter di Read-Host
                    # yg sering kelewat). Default = "No" (safe-abort) untuk SEMUA jalur:
                    # - GUI popup: outcome "No" kalau user close X / Escape (Show-LintasYesNoPopup contract).
                    # - Console Read-Host: default 'n' (parse non-Y).
                    # - NonInteractive (no console): default "No" via catch block.
                    # Audit log Write-Warning saat user pilih Yes (untrusted manifest proceed).
                    $tamperedAnswer = "No"
                    if (-not $useConsoleMode) {
                        try {
                            $tamperedAnswer = Show-LintasYesNoPopup `
                                -Title "PERINGATAN KEAMANAN: Manifest Ter-Tamper" `
                                -Message "Manifest signature INVALID -- file .install-manifest.json mungkin sudah di-modifikasi setelah install (sengaja atau tidak).`r`n`r`nKalau kamu LANJUT uninstall:`r`n  - Script akan trust DAFTAR FILE di manifest yang tidak terverifikasi.`r`n  - Attacker yg control manifest bisa arah-kan script ke file salah (path traversal mitigated, tapi entry inside kit-dir tetap rentan tipuan).`r`n  - File proyek yang ter-list palsu di manifest bisa kena delete.`r`n`r`nKalau RAGU: pilih No, lalu verifikasi kit (re-install dari source resmi).`r`nPilih Yes HANYA kalau kamu paham resiko + sudah inspect manifest manual."
                        } catch {
                            # GUI popup crash mid-execution -- fall back to console untuk prompt ini.
                            Write-Host "WARN  GUI popup gagal ($_). Fallback ke console prompt." -ForegroundColor Yellow
                            try {
                                $resp = Read-Host 'Lanjut uninstall dengan manifest unsigned/tampered? (y/N)'
                                if ($resp -match '^[Yy]') { $tamperedAnswer = "Yes" } else { $tamperedAnswer = "No" }
                            } catch {
                                Write-Host 'INFO: NonInteractive shell. Pakai -Force untuk override.' -ForegroundColor Yellow
                                $tamperedAnswer = "No"
                            }
                        }
                    } else {
                        try {
                            $resp = Read-Host 'Lanjut uninstall dengan manifest unsigned/tampered? (y/N)'
                            if ($resp -match '^[Yy]') { $tamperedAnswer = "Yes" } else { $tamperedAnswer = "No" }
                        } catch {
                            Write-Host 'INFO: NonInteractive shell. Pakai -Force untuk override.' -ForegroundColor Yellow
                            $tamperedAnswer = "No"
                        }
                    }
                    if ($tamperedAnswer -eq "Yes") {
                        # AUDIT LOG: user eksplisit memilih lanjut walau signature INVALID
                        # (= manifest tampered atau corrupted). Pakai Write-Warning supaya
                        # muncul di stderr stream dengan severity Warning (tertangkap di
                        # transcript log + CI dashboard) untuk forensik kalau later jadi insiden.
                        Write-Warning "AUDIT: User pilih proceed uninstall dengan manifest TAMPERED (signature INVALID). Project=$ProjectRoot KitDir=$KitDir Timestamp=$Timestamp User=$env:USERNAME. Integrity check di-bypass atas eksplisit user consent."
                    } else {
                        throw 'Uninstall aborted: untrusted manifest'
                    }
                }
            }
            $null = $manifestHt  # reserved for downstream tooling kalau perlu hashtable view
        } catch {
            if ($_.Exception.Message -match 'Uninstall aborted') { throw }
            # FAIL-SECURE (mirror Fix A dari lib/rollback.ps1 Invoke-Rollback):
            # Verifier crash JANGAN fall through ke legacy fallback (silent proceed = security
            # risk kalau attacker bisa trigger crash untuk skip verify). Sebagai gantinya,
            # ABORT dengan exit 1 supaya user investigate lib/manifest-signing.ps1 dulu
            # sebelum retry uninstall destructive.
            Write-Host ''
            Write-Host "WARN  Manifest signature verification ERRORED: $_" -ForegroundColor Yellow
            Write-Host '[ABORT] Uninstall dibatalkan: signature verification gagal jalan (fail-secure).' -ForegroundColor Red
            Write-Host '        Investigate lib/manifest-signing.ps1 sebelum retry uninstall.' -ForegroundColor Red
            exit 1
        }
    }
}

# ---- Validate schema_version (forward-compat guard) ----
$schemaVersion = [int]([string]$manifest.schema_version)
if ($schemaVersion -ne 1) {
    Write-Host ''
    Write-Host "ERROR: Schema version manifest = $schemaVersion (script ini cuma kenal schema_version=1)." -ForegroundColor Red
    Write-Host '       Manifest mungkin dari kit versi lebih baru dari script uninstall ini.' -ForegroundColor Red
    Write-Host '       Update kit ke versi terbaru (.\.claude-kit\kit.ps1 update) atau gunakan uninstall.ps1 versi sama.' -ForegroundColor Red
    exit 1
}

# ---- Sanity check: project_root manifest match folder kit saat ini? ----
# Default HARD-FAIL untuk mencegah manifest dari project lain delete file di project ini.
# Override pakai -AllowProjectRootMismatch (mis. legitimate rename folder).
#
# GUARD: Kalau -ProjectRoot di-supply EXPLICIT via param (npx/CI/wrapper mode), TRUST it
# sebagai ground truth -- skip mismatch check (caller sudah explicit override).
$manifestProjectRoot = [string]$manifest.project_root
$projectRootSupplied = $PSBoundParameters.ContainsKey('ProjectRoot')
if (-not $projectRootSupplied -and $manifestProjectRoot -and $manifestProjectRoot -ne $ProjectRoot -and $manifestProjectRoot -ne '<PROJECT_ROOT>') {
    Write-Host ''
    if (-not $AllowProjectRootMismatch) {
        Write-Host 'ABORT: Project root di manifest TIDAK match lokasi sekarang.' -ForegroundColor Red
        Write-Host "  Manifest installed di : $manifestProjectRoot" -ForegroundColor Red
        Write-Host "  Lokasi sekarang        : $ProjectRoot" -ForegroundColor Red
        Write-Host ''
        Write-Host 'Kemungkinan:' -ForegroundColor Yellow
        Write-Host '  (A) Folder proyek di-rename / di-move setelah install.' -ForegroundColor Yellow
        Write-Host '  (B) Folder .claude-kit\ di-copy dari proyek lain (manifest milik proyek lain).' -ForegroundColor Yellow
        Write-Host ''
        Write-Host 'Untuk proceed:' -ForegroundColor Cyan
        Write-Host '  - Kalau (A): jalankan dengan -AllowProjectRootMismatch supaya pakai lokasi sekarang.' -ForegroundColor Cyan
        Write-Host '  - Kalau (B): JANGAN proceed. Manifest entries kemungkinan punya path proyek lain.' -ForegroundColor Cyan
        Write-Host '               Hapus manual sesuai daftar file di README section "Kalau manifest TIDAK ADA".' -ForegroundColor Cyan
        exit 1
    } else {
        Write-Host 'PERINGATAN: project_root mismatch di-override via -AllowProjectRootMismatch.' -ForegroundColor Yellow
        Write-Host "  Manifest installed di : $manifestProjectRoot" -ForegroundColor Yellow
        Write-Host "  Lokasi sekarang        : $ProjectRoot" -ForegroundColor Yellow
        Write-Host '  Script pakai lokasi sekarang ($ProjectRoot) sebagai base.' -ForegroundColor Yellow
        Write-Host ''
    }
} elseif ($projectRootSupplied -and $manifestProjectRoot -and $manifestProjectRoot -ne $ProjectRoot -and $manifestProjectRoot -ne '<PROJECT_ROOT>') {
    Write-Host ''
    Write-Host 'INFO: -ProjectRoot di-supply explicit, manifest project_root override di-skip.' -ForegroundColor DarkGray
    Write-Host "  Manifest installed di : $manifestProjectRoot" -ForegroundColor DarkGray
    Write-Host "  Param -ProjectRoot     : $ProjectRoot (ground truth)" -ForegroundColor DarkGray
    Write-Host ''
}

# ---- Setup canonical project root (consumed by lib/safety.ps1 helpers) ----
# Helpers Resolve-SafeProjectPath & Test-PathHasReparsePoint baca $script:ProjectRootCanonical
# sebagai base containment check. WAJIB di-set sebelum panggil helper apapun.
$script:ProjectRootCanonical = [System.IO.Path]::GetFullPath($ProjectRoot)
if (-not $script:ProjectRootCanonical.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
    $script:ProjectRootCanonical += [System.IO.Path]::DirectorySeparatorChar
}

# ---- Header ----
Write-Host ''
Write-Host '================================================================' -ForegroundColor Cyan
Write-Host '  lintasAI uninstall - safe diff-based delete' -ForegroundColor Cyan
Write-Host '================================================================' -ForegroundColor Cyan
Write-Host "Proyek         : $ProjectName ($ProjectRoot)"
Write-Host "Kit version    : $($manifest.kit_version)"
Write-Host "Installed at   : $($manifest.installed_at) by $($manifest.installed_by)"
Write-Host "Files tracked  : $((@($manifest.files)).Count)"
Write-Host "Dirs tracked   : $((@($manifest.directories_created)).Count)"

# Flag aktif (collected + bulleted, bukan repeated "Mode" lines)
$flags = @()
if ($DryRun)                    { $flags += 'SIMULASI (preview saja, tidak ada yang dihapus)' }
if ($AllowModified)             { $flags += '-AllowModified (modified files akan di-backup + hapus)' }
if ($Force -and -not $AllowModified) { $flags += '-Force (DEPRECATED, alias untuk -AllowModified)' }
if ($DeleteAgents)              { $flags += '-DeleteAgents (AGENTS.md ikut dievaluasi)' }
if ($KeepKit)                   { $flags += '-KeepKit (instruksi self-delete .claude-kit\ disuppress)' }
if ($Yes)                       { $flags += '-Yes (auto-confirm Y, skip prompt)' }
if ($AllowProjectRootMismatch)  { $flags += '-AllowProjectRootMismatch (project_root manifest override)' }
if ($flags.Count -gt 0) {
    Write-Host 'Flag aktif     :'
    foreach ($f in $flags) { Write-Host "  - $f" -ForegroundColor Yellow }
} else {
    Write-Host 'Flag aktif     : (default - konservatif, skip modified)' -ForegroundColor DarkGray
}
Write-Host ''

# ---- Classify each file: pristine / modified / symlink / blocked / locked / missing ----
$pristine = @()
$modified = @()
$symlinked = @()
$blocked = @()
$locked = @()
$missing  = @()
$skipped  = @()
$backups  = @()  # kind='backup' entries - preserved + reported, never auto-deleted

foreach ($item in @($manifest.files)) {
    $relPath = [string]$item.path
    $itemKind = [string]$item.kind

    # Skip AGENTS.md by default (heavy customization expected)
    if ($relPath -eq 'AGENTS.md' -and -not $DeleteAgents) {
        $skipped += @{ item = $item; reason = 'AGENTS.md skipped (pakai -DeleteAgents untuk override)' }
        continue
    }

    # Backup files (kind='backup') - preserved + reported, never auto-deleted
    if ($itemKind -eq 'backup') {
        $backups += @{ item = $item }
        continue
    }

    # Path containment check (block traversal + absolute paths).
    # Resolve-SafeProjectPath throws on reject (security boundary). Catch supaya satu entry
    # bermasalah tidak abort seluruh uninstall - tetap append ke $blocked + lanjut entry berikutnya.
    $fullPath = $null
    try {
        $fullPath = Resolve-SafeProjectPath -RelPath $relPath -Label "file '$relPath'"
    } catch {
        $blocked += @{ item = $item; reason = "path escapes project root (rejected: $($_.Exception.Message))" }
        continue
    }
    if ($null -eq $fullPath) {
        $blocked += @{ item = $item; reason = 'path escapes project root (rejected, lihat REJECT log di atas)' }
        continue
    }

    if (-not (Test-Path -LiteralPath $fullPath)) {
        $missing += @{ item = $item; path = $fullPath }
        continue
    }

    # Reparse point check (junction / symlink)
    if (Test-PathHasReparsePoint -FullPath $fullPath) {
        $symlinked += @{ item = $item; path = $fullPath }
        continue
    }

    # Hash compute - guarded with try/catch supaya 1 file locked tidak abort seluruh script
    try {
        $currentHash = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256 -ErrorAction Stop).Hash
    } catch {
        $locked += @{ item = $item; path = $fullPath; reason = $_.Exception.Message }
        continue
    }

    if ($currentHash -eq $item.sha256) {
        $pristine += @{ item = $item; path = $fullPath }
    } else {
        $modified += @{ item = $item; path = $fullPath; current_sha = $currentHash }
    }
}

# ---- Print plan ----
Write-Host '--- RENCANA HAPUS ---' -ForegroundColor Cyan

if ($pristine.Count -gt 0) {
    Write-Host ''
    Write-Host ("[PRISTINE] {0} file (hash match, AUTO-DELETE):" -f $pristine.Count) -ForegroundColor Green
    foreach ($p in $pristine) {
        Write-Host ("  - {0}" -f $p.item.path)
    }
}

if ($modified.Count -gt 0) {
    Write-Host ''
    if ($AllowModified) {
        Write-Host ("[MODIFIED] {0} file (user-edited, BACKUP + DELETE karena -AllowModified):" -f $modified.Count) -ForegroundColor Yellow
    } else {
        Write-Host ("[MODIFIED] {0} file (user-edited, SKIP - pakai -AllowModified untuk hapus dengan backup):" -f $modified.Count) -ForegroundColor Yellow
    }
    foreach ($m in $modified) {
        Write-Host ("  [edit] {0}" -f $m.item.path) -ForegroundColor Yellow
    }
}

if ($symlinked.Count -gt 0) {
    Write-Host ''
    Write-Host ("[SYMLINK] {0} file (junction/symlink terdeteksi, SKIP selalu - cek manual):" -f $symlinked.Count) -ForegroundColor Magenta
    foreach ($s in $symlinked) {
        Write-Host ("  [link] {0}" -f $s.item.path) -ForegroundColor Magenta
    }
}

if ($locked.Count -gt 0) {
    Write-Host ''
    Write-Host ("[LOCKED] {0} file (hash gagal - mungkin di-buka editor/AV):" -f $locked.Count) -ForegroundColor DarkYellow
    foreach ($l in $locked) {
        Write-Host ("  [lock] {0}" -f $l.item.path) -ForegroundColor DarkYellow
        Write-Host ("         reason: {0}" -f $l.reason) -ForegroundColor DarkGray
    }
    Write-Host '         HINT: Tutup file di editor (VS Code/Notepad++/Notepad), lalu re-run.' -ForegroundColor DarkYellow
}

if ($blocked.Count -gt 0) {
    Write-Host ''
    Write-Host ("[BLOCKED] {0} file (path escape ke luar project - DITOLAK, lihat REJECT log di atas):" -f $blocked.Count) -ForegroundColor Red
    foreach ($b in $blocked) {
        Write-Host ("  [reject] {0}" -f $b.item.path) -ForegroundColor Red
    }
}

if ($missing.Count -gt 0) {
    Write-Host ''
    Write-Host ("[MISSING] {0} file (sudah tidak ada, skip):" -f $missing.Count) -ForegroundColor DarkGray
    foreach ($m in $missing) {
        Write-Host ("  - {0}" -f $m.item.path) -ForegroundColor DarkGray
    }
    Write-Host ('       INFO: kalau curiga file di-rename, cek manual di project tree.') -ForegroundColor DarkGray
}

if ($skipped.Count -gt 0) {
    Write-Host ''
    Write-Host ("[SKIPPED] {0} file:" -f $skipped.Count) -ForegroundColor Cyan
    foreach ($s in $skipped) {
        Write-Host ("  - {0} ({1})" -f $s.item.path, $s.reason) -ForegroundColor Cyan
    }
}

if ($backups.Count -gt 0) {
    Write-Host ''
    Write-Host ("[BACKUPS] {0} file backup pre-setup ditemukan (PRESERVED, hapus manual kalau mau):" -f $backups.Count) -ForegroundColor Cyan
    foreach ($b in $backups) {
        Write-Host ("  - {0} (dari setup -Force re-run sebelumnya)" -f $b.item.path) -ForegroundColor Cyan
    }
}

# Dirs plan
Write-Host ''
Write-Host '[DIRS] Direktori dari manifest (cek empty sebelum hapus):' -ForegroundColor DarkCyan
foreach ($d in @($manifest.directories_created)) {
    Write-Host ("  - {0}" -f $d) -ForegroundColor DarkCyan
}

# Self-delete plan
Write-Host ''
if ($KeepKit) {
    Write-Host '[KIT] Folder .claude-kit\ DIPERTAHANKAN (-KeepKit aktif - instruksi self-delete tidak akan ditampilkan)' -ForegroundColor Cyan
} else {
    Write-Host '[KIT] Folder .claude-kit\ harus kamu hapus MANUAL (script tidak bisa self-delete saat running, instruksi di akhir).' -ForegroundColor Cyan
}

# ---- DRY-RUN summary + exit ----
if ($DryRun) {
    Write-Host ''
    Write-Host '--- RINGKASAN SIMULASI ---' -ForegroundColor Cyan
    Write-Host ("  Aman dihapus (pristine)  : $($pristine.Count) file") -ForegroundColor Green
    if ($modified.Count -gt 0) {
        if ($AllowModified) {
            Write-Host ("  User-edit + backup       : $($modified.Count) file (karena -AllowModified)") -ForegroundColor Yellow
        } else {
            Write-Host ("  User-edit (DILEWATI)     : $($modified.Count) file - pakai -AllowModified kalau mau ikut hapus") -ForegroundColor Yellow
        }
    }
    if ($symlinked.Count -gt 0) {
        Write-Host ("  Symlink/junction         : $($symlinked.Count) file (SKIP selalu)") -ForegroundColor Magenta
    }
    if ($locked.Count -gt 0) {
        Write-Host ("  Locked (cek editor)      : $($locked.Count) file") -ForegroundColor DarkYellow
    }
    if ($blocked.Count -gt 0) {
        Write-Host ("  BLOCKED (path traversal) : $($blocked.Count) file - manifest mungkin di-tamper") -ForegroundColor Red
    }
    Write-Host ("  Sudah hilang             : $($missing.Count) file") -ForegroundColor DarkGray
    Write-Host ("  Sengaja dilewati         : $($skipped.Count) file (mis. AGENTS.md)") -ForegroundColor Cyan
    if ($backups.Count -gt 0) {
        Write-Host ("  Backup pre-setup         : $($backups.Count) file (preserved)") -ForegroundColor Cyan
    }
    Write-Host ''
    Write-Host 'Yakin dengan rencana di atas?' -ForegroundColor White
    Write-Host '  - Lanjut hapus beneran   : jalankan ulang TANPA -DryRun' -ForegroundColor White
    Write-Host '  - Batal                  : tutup window ini, tidak ada yang berubah' -ForegroundColor White
    if ($modified.Count -gt 0 -and -not $AllowModified) {
        Write-Host '  - Modified ikut          : jalankan dengan -AllowModified (akan dibackup .bak dulu)' -ForegroundColor White
    }
    Write-Host ''
    Write-Host 'Catatan: plan ini adalah SNAPSHOT saat dry-run. Kalau kamu edit file setelah ini' -ForegroundColor DarkGray
    Write-Host '         dan sebelum run eksekusi, ulangi -DryRun untuk lihat plan terbaru.' -ForegroundColor DarkGray
    exit 0
}

# ---- Confirm sebelum execute ----
Write-Host ''
$forceSuffix = ''
if ($AllowModified) { $forceSuffix = " + $($modified.Count) modified (with backup)" }
Write-Host ("Total file akan dihapus: {0} pristine{1}" -f $pristine.Count, $forceSuffix) -ForegroundColor Cyan
if ($Yes) {
    Write-Host 'Auto-confirm via -Yes (skip prompt).' -ForegroundColor Cyan
    $confirm = 'Y'
} else {
    # Destructive consent prompt: pakai GUI popup kalau GUI tersedia supaya user
    # EKSPLISIT click "Yes" (mengurangi resiko default-Enter di Read-Host yang
    # gampang kelewat untuk operasi destructive). Default = "No" (batal hapus)
    # untuk semua jalur: GUI popup (close X / Escape -> "No"), console Read-Host
    # (null/whitespace -> 'N'), NonInteractive (catch -> exit 0 dengan instruksi).
    # Console fallback PRESERVE untuk -NoGui / SSH / Server Core / CI.

    # Build preview message: total count + sample file names supaya user tahu
    # KONKRET apa yang akan dihapus (bukan cuma angka abstrak).
    $deleteTotal = $pristine.Count
    if ($AllowModified) { $deleteTotal += $modified.Count }
    $sampleNames = @()
    foreach ($p in $pristine | Select-Object -First 5) { $sampleNames += ("  - " + $p.item.path) }
    if ($AllowModified -and $modified.Count -gt 0) {
        foreach ($m in $modified | Select-Object -First 3) { $sampleNames += ("  - " + $m.item.path + " (modified, akan di-backup .bak)") }
    }
    $remaining = $deleteTotal - $sampleNames.Count
    $sampleBlock = $sampleNames -join "`r`n"
    if ($remaining -gt 0) { $sampleBlock += "`r`n  ... dan $remaining file lain (lihat plan di atas)" }

    $modifiedNote = ''
    if ($AllowModified -and $modified.Count -gt 0) {
        $modifiedNote = "`r`n`r`nCATATAN: $($modified.Count) file user-edited akan di-backup ke .bak sebelum dihapus (karena -AllowModified)."
    } elseif ($modified.Count -gt 0) {
        $modifiedNote = "`r`n`r`nCATATAN: $($modified.Count) file user-edited DI-SKIP (tidak dihapus). Pakai -AllowModified kalau mau ikut hapus dengan backup."
    }

    $popupMessage = "Akan menghapus $deleteTotal file dari kit di project ini.`r`n`r`nContoh file yang akan dihapus:`r`n$sampleBlock$modifiedNote`r`n`r`nOperasi ini DESTRUKTIF (tidak bisa undo via script ini -- kit harus di-install ulang kalau salah).`r`n`r`nLanjut hapus?"

    $deleteAnswer = "No"
    if (-not $useConsoleMode) {
        try {
            $deleteAnswer = Show-LintasYesNoPopup `
                -Title "Konfirmasi: Hapus $deleteTotal file kit" `
                -Message $popupMessage
            # Show-LintasYesNoPopup return "Yes" / "No". Default safe = No (close X / Escape).
        } catch {
            # Popup gagal (assemblies hilang mid-session) -> fallback console.
            Write-Host "INFO: Popup gagal ($_). Fallback ke console prompt." -ForegroundColor Yellow
            try {
                # RECOMMENDED default = N (batal hapus). User wajib ketik Y eksplisit untuk lanjut destructive uninstall.
                $resp = Read-Host 'Lanjut hapus? (Y/N) [RECOMMENDED default: N - batal hapus]'
                if ([string]::IsNullOrWhiteSpace($resp)) { $resp = 'N' }
                $deleteAnswer = if ($resp -match '^[Yy]') { "Yes" } else { "No" }
            } catch {
                Write-Host ''
                Write-Host 'INFO: Terminal sekarang tidak bisa nerima jawaban Y/N interaktif.' -ForegroundColor Yellow
                Write-Host '       (umumnya terjadi kalau dijalankan dari VSCode tab Output, CI, atau script wrapper).' -ForegroundColor Yellow
                Write-Host ''
                Write-Host 'Solusi:' -ForegroundColor Cyan
                Write-Host '  A. Buka PowerShell terpisah (Start Menu -> ketik PowerShell -> Enter), cd ke project, lalu ulangi.' -ForegroundColor Cyan
                Write-Host '  B. Sudah yakin dengan rencana? Jalankan ulang dengan tambah -Yes di akhir.' -ForegroundColor Cyan
                Write-Host '     CONTOH: .\.claude-kit\uninstall.ps1 -Yes' -ForegroundColor Cyan
                Write-Host '     (sama dengan jawab YA tanpa ditanya. PAKAI cuma kalau sudah lihat dry-run.)' -ForegroundColor Cyan
                exit 0
            }
        }
    } else {
        try {
            # RECOMMENDED default = N (batal hapus). User wajib ketik Y eksplisit untuk lanjut destructive uninstall.
            $resp = Read-Host 'Lanjut hapus? (Y/N) [RECOMMENDED default: N - batal hapus]'
            if ([string]::IsNullOrWhiteSpace($resp)) { $resp = 'N' }
            $deleteAnswer = if ($resp -match '^[Yy]') { "Yes" } else { "No" }
        } catch {
            Write-Host ''
            Write-Host 'INFO: Terminal sekarang tidak bisa nerima jawaban Y/N interaktif.' -ForegroundColor Yellow
            Write-Host '       (umumnya terjadi kalau dijalankan dari VSCode tab Output, CI, atau script wrapper).' -ForegroundColor Yellow
            Write-Host ''
            Write-Host 'Solusi:' -ForegroundColor Cyan
            Write-Host '  A. Buka PowerShell terpisah (Start Menu -> ketik PowerShell -> Enter), cd ke project, lalu ulangi.' -ForegroundColor Cyan
            Write-Host '  B. Sudah yakin dengan rencana? Jalankan ulang dengan tambah -Yes di akhir.' -ForegroundColor Cyan
            Write-Host '     CONTOH: .\.claude-kit\uninstall.ps1 -Yes' -ForegroundColor Cyan
            Write-Host '     (sama dengan jawab YA tanpa ditanya. PAKAI cuma kalau sudah lihat dry-run.)' -ForegroundColor Cyan
            exit 0
        }
    }
    $confirm = if ($deleteAnswer -eq "Yes") { 'Y' } else { 'N' }
}
if ($confirm -notmatch '^[Yy]') {
    Write-Host 'Dibatalkan oleh user. Tidak ada file yang dihapus.' -ForegroundColor Yellow
    exit 0
}

# ---- Execute: delete pristine files (with re-hash before delete = TOCTOU close) ----
Write-Host ''
Write-Host '--- EKSEKUSI ---' -ForegroundColor Cyan
$deletedCount = 0
$errorCount = 0
$rehashSkipped = 0
foreach ($p in $pristine) {
    # Re-hash right before delete: kalau user edit file antara plan & confirm, skip.
    try {
        $rehash = (Get-FileHash -LiteralPath $p.path -Algorithm SHA256 -ErrorAction Stop).Hash
    } catch {
        Write-Host ("LOCK  {0}: {1}" -f $p.item.path, $_.Exception.Message) -ForegroundColor DarkYellow
        Write-Host '       HINT: Tutup file di editor (VS Code/Notepad++/Notepad), lalu re-run.' -ForegroundColor DarkYellow
        $errorCount++
        continue
    }
    if ($rehash -ne $p.item.sha256) {
        Write-Host ("SKIP  {0}: file berubah sejak plan dibuat (kemungkinan user edit setelah dry-run)" -f $p.item.path) -ForegroundColor Yellow
        $rehashSkipped++
        continue
    }
    # TOCTOU close: re-check reparse point IMMEDIATELY before Remove-Item.
    # Attacker bisa race-swap file ke junction antara plan phase dan execute phase.
    # Re-check di sini menutup window itu (best-effort, tidak atomic 100% tapi sangat menyempit window).
    if (Test-PathHasReparsePoint -FullPath $p.path) {
        Write-Host ("SKIP  {0}: TOCTOU - jadi reparse point setelah plan, tidak dihapus" -f $p.item.path) -ForegroundColor Magenta
        $rehashSkipped++
        continue
    }
    $itemInfo = Get-Item -Force -LiteralPath $p.path -ErrorAction SilentlyContinue
    if ($itemInfo -and $itemInfo.LinkType) {
        Write-Host ("SKIP  {0}: TOCTOU - sekarang symlink/junction (LinkType={1}), tidak dihapus" -f $p.item.path, $itemInfo.LinkType) -ForegroundColor Magenta
        $rehashSkipped++
        continue
    }
    try {
        Remove-Item -LiteralPath $p.path -Force -ErrorAction Stop
        Write-Host ("DEL   {0}" -f $p.item.path) -ForegroundColor Green
        $deletedCount++
    } catch {
        Write-Host ("FAIL  {0}: {1}" -f $p.item.path, $_.Exception.Message) -ForegroundColor Red
        Write-Host '       HINT: Tutup file di editor (VS Code/Notepad++/Notepad), lalu re-run.' -ForegroundColor DarkYellow
        $errorCount++
    }
}

# ---- Execute: backup + delete modified files (kalau -AllowModified) ----
if ($AllowModified -and $modified.Count -gt 0) {
    foreach ($m in $modified) {
        # Defense: derive bakPath dari validated $m.path (bukan $m.item.path raw)
        $bakPath = "$($m.path).pre-uninstall-$Timestamp.bak"
        # Defense: validate bakPath also stays inside project root (defense-in-depth)
        try {
            $bakResolved = [System.IO.Path]::GetFullPath($bakPath)
        } catch {
            Write-Host ("FAIL  {0}: backup path tidak valid" -f $m.item.path) -ForegroundColor Red
            $errorCount++
            continue
        }
        if (-not $bakResolved.StartsWith($script:ProjectRootCanonical, [System.StringComparison]::OrdinalIgnoreCase)) {
            Write-Host ("FAIL  {0}: backup path escape project root (REJECT)" -f $m.item.path) -ForegroundColor Red
            $errorCount++
            continue
        }
        # Re-check: file still exists + still MODIFIED candidate (TOCTOU close)
        if (-not (Test-Path -LiteralPath $m.path)) {
            Write-Host ("SKIP  {0}: file hilang sejak plan dibuat" -f $m.item.path) -ForegroundColor Yellow
            continue
        }
        # TOCTOU close: re-check reparse point IMMEDIATELY before Copy-Item + Remove-Item.
        # Attacker bisa race-swap file ke junction antara plan phase dan execute phase, yang
        # bisa bocorin isi file di luar project ke .bak ATAU bikin delete redirect ke luar.
        if (Test-PathHasReparsePoint -FullPath $m.path) {
            Write-Host ("SKIP  {0}: TOCTOU - jadi reparse point setelah plan, tidak di-backup/hapus" -f $m.item.path) -ForegroundColor Magenta
            continue
        }
        $itemInfoM = Get-Item -Force -LiteralPath $m.path -ErrorAction SilentlyContinue
        if ($itemInfoM -and $itemInfoM.LinkType) {
            Write-Host ("SKIP  {0}: TOCTOU - sekarang symlink/junction (LinkType={1}), tidak di-backup/hapus" -f $m.item.path, $itemInfoM.LinkType) -ForegroundColor Magenta
            continue
        }
        try {
            Copy-Item -LiteralPath $m.path -Destination $bakPath -Force -ErrorAction Stop
            Remove-Item -LiteralPath $m.path -Force -ErrorAction Stop
            Write-Host ("BAK   {0} -> {1}" -f $m.item.path, (Split-Path -Leaf $bakPath)) -ForegroundColor Yellow
            $deletedCount++
        } catch {
            Write-Host ("FAIL  {0}: {1}" -f $m.item.path, $_.Exception.Message) -ForegroundColor Red
            Write-Host '       HINT: Tutup file di editor (VS Code/Notepad++/Notepad), lalu re-run.' -ForegroundColor DarkYellow
            # Kalau .bak terbuat tapi Remove gagal, kasih info supaya user tahu state filesystem
            if (Test-Path -LiteralPath $bakPath) {
                Write-Host ("       NOTE: backup ada di {0} (file original tetap di tempat, hapus manual kalau perlu)" -f (Split-Path -Leaf $bakPath)) -ForegroundColor DarkGray
            }
            $errorCount++
        }
    }
}

# ---- Try remove empty directories (deepest first supaya nested directories aman) ----
# Skip reparse-point dirs (junction redirect) untuk defense-in-depth.
$dirsSorted = @($manifest.directories_created) | Sort-Object -Descending @{
    Expression = { ($_.ToString() -split '[\\/]').Count }
}
$dirDeleted = 0
$dirsMissing = @()
foreach ($d in $dirsSorted) {
    $dStr = [string]$d
    # Resolve-SafeProjectPath throws on reject; catch supaya satu dir bermasalah tidak abort loop.
    $fullDir = $null
    try {
        $fullDir = Resolve-SafeProjectPath -RelPath $dStr -Label "dir '$dStr'"
    } catch {
        # Path traversal in dir entry - already logged by Resolve-SafeProjectPath
        $errorCount++
        continue
    }
    if ($null -eq $fullDir) {
        # Path traversal in dir entry - already logged by Resolve-SafeProjectPath
        $errorCount++
        continue
    }
    if (-not (Test-Path -LiteralPath $fullDir)) {
        $dirsMissing += $dStr
        continue
    }
    # Reparse-point guard: jangan ikuti junction yang mungkin redirect ke luar.
    if (Test-PathHasReparsePoint -FullPath $fullDir) {
        Write-Host ("KEEP  {0}\ (reparse point terdeteksi, tidak diikuti)" -f $dStr) -ForegroundColor Magenta
        continue
    }
    $entries = @(Get-ChildItem -LiteralPath $fullDir -Force -ErrorAction SilentlyContinue)
    # Whitelist: file system noise (Windows/mac) yang clearly bukan user-intent
    $systemNoise = @('desktop.ini', 'Thumbs.db', '.DS_Store')
    $realEntries = @($entries | Where-Object { $_.Name -notin $systemNoise })
    if ($realEntries.Count -eq 0) {
        # Cleanup noise sebelum RMDIR
        foreach ($noise in $entries) {
            if ($noise.Name -in $systemNoise) {
                try {
                    Remove-Item -LiteralPath $noise.FullName -Force -ErrorAction Stop
                } catch {
                    # Noise cleanup best-effort; kalau gagal, RMDIR berikutnya akan fail dengan pesan jelas.
                    Write-Verbose "Noise cleanup failed for $($noise.FullName): $($_.Exception.Message)"
                }
            }
        }
        try {
            Remove-Item -LiteralPath $fullDir -Force -ErrorAction Stop
            Write-Host ("RMDIR {0}\" -f $dStr) -ForegroundColor Green
            $dirDeleted++
        } catch {
            Write-Host ("FAIL  rmdir {0}: {1}" -f $dStr, $_.Exception.Message) -ForegroundColor Red
            $errorCount++
        }
    } else {
        # Print breakdown isi yang tersisa (max 5) supaya user audit
        $sample = @($realEntries | Select-Object -First 5 -ExpandProperty Name)
        $sampleStr = $sample -join ', '
        if ($realEntries.Count -gt 5) { $sampleStr += ', ...' }
        Write-Host ("KEEP  {0}\ ({1} file/dir user tersisa: {2})" -f $dStr, $realEntries.Count, $sampleStr) -ForegroundColor Cyan
    }
}

# ---- REASSURANCE FIRST (sebelum self-delete instruction supaya user tenang dulu) ----
Write-Host ''
Write-Host '=== FILE PROYEK KAMU - STATUS ===' -ForegroundColor Green
Write-Host 'Yang AMAN (tidak disentuh sama sekali oleh script ini):' -ForegroundColor Green
foreach ($d in @($manifest.directories_created)) {
    $dStr = [string]$d
    $fullDir = Join-Path $ProjectRoot ($dStr -replace '/', '\')
    if (Test-Path -LiteralPath $fullDir) {
        $userFiles = @(Get-ChildItem -LiteralPath $fullDir -Force -ErrorAction SilentlyContinue)
        if ($userFiles.Count -gt 0) {
            Write-Host ("  - {0}\ : {1} file/folder milikmu, AMAN" -f $dStr, $userFiles.Count) -ForegroundColor Green
        }
    }
}
if ($modified.Count -gt 0 -and -not $AllowModified) {
    Write-Host ("  - {0} file kit yang sudah kamu edit (modified) TETAP ADA di tempatnya." -f $modified.Count) -ForegroundColor Green
}
if ($skipped.Count -gt 0) {
    Write-Host ('  - AGENTS.md (kalau ada) TETAP ADA - default skip karena user edit.') -ForegroundColor Green
}
Write-Host 'Verifikasi: jalankan `git status` di project root - file project tidak boleh muncul sebagai deleted.' -ForegroundColor DarkGray

# ---- Self-delete instructions (kecuali -KeepKit) ----
if (-not $KeepKit) {
    Write-Host ''
    Write-Host '=== LANGKAH TERAKHIR (manual) ===' -ForegroundColor Cyan
    Write-Host 'Folder .claude-kit\ TIDAK BISA dihapus oleh script ini (karena script ada di dalamnya).' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Cara hapus:' -ForegroundColor White
    Write-Host '  1. TUTUP semua VSCode / editor yang sedang buka file di .claude-kit\ (cegah Access Denied).' -ForegroundColor White
    Write-Host '  2. Buka PowerShell baru di root proyek (folder INDUK dari .claude-kit\).' -ForegroundColor White
    Write-Host '  3. Copy-paste perintah berikut PERSIS:' -ForegroundColor White
    Write-Host ''
    Write-Host "     Remove-Item -Recurse -Force '$KitDir'" -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  4. Cek folder .claude-kit\ sudah hilang dari File Explorer.' -ForegroundColor White
    Write-Host ''
    Write-Host 'Kalau muncul error "Access Denied": tutup VSCode, restart PowerShell, ulangi langkah 3.' -ForegroundColor DarkGray
}

# ---- Summary ----
# R8 (audit 2026-06-23): kalau ada yang gagal/terkunci, kit terhapus SEBAGIAN - katakan TERANG di
# header + tegaskan AMAN diulang (penghapusan idempoten), supaya staff non-programmer tak kira "rusak".
$uninstallPartial = ($errorCount -gt 0 -or $locked.Count -gt 0)
$summaryHeader = if ($uninstallPartial) { '  lintasAI uninstall - SELESAI SEBAGIAN' } else { '  lintasAI uninstall - SELESAI' }
$summaryColor  = if ($uninstallPartial) { 'Yellow' } else { 'Green' }
Write-Host ''
Write-Host '================================================================' -ForegroundColor $summaryColor
Write-Host $summaryHeader -ForegroundColor $summaryColor
Write-Host '================================================================' -ForegroundColor $summaryColor
Write-Host ("File dihapus      : {0}" -f $deletedCount)
Write-Host ("Direktori dihapus : {0}" -f $dirDeleted)
if ($rehashSkipped -gt 0) {
    Write-Host ("Re-hash mismatch  : {0} (file berubah sejak plan, tidak dihapus)" -f $rehashSkipped) -ForegroundColor Yellow
}
if ($modified.Count -gt 0 -and -not $AllowModified) {
    Write-Host ("Modified disimpan : {0} (run dengan -AllowModified kalau mau ikut hapus)" -f $modified.Count) -ForegroundColor Yellow
}
if ($symlinked.Count -gt 0) {
    Write-Host ("Symlink dilewati  : {0} (cek manual)" -f $symlinked.Count) -ForegroundColor Magenta
}
if ($locked.Count -gt 0) {
    Write-Host ("Locked dilewati   : {0} (tutup editor, re-run)" -f $locked.Count) -ForegroundColor DarkYellow
}
if ($blocked.Count -gt 0) {
    Write-Host ("BLOCKED (traversal): {0} - manifest mungkin di-tamper, audit manual" -f $blocked.Count) -ForegroundColor Red
}
if ($dirsMissing.Count -gt 0) {
    Write-Host ("Dir tracked hilang: {0} (mungkin di-rename: {1})" -f $dirsMissing.Count, ($dirsMissing -join ', ')) -ForegroundColor Yellow
}
if ($backups.Count -gt 0) {
    Write-Host ("Backup pre-setup  : {0} (preserved, hapus manual kalau mau)" -f $backups.Count) -ForegroundColor Cyan
}
if ($skipped.Count -gt 0) {
    Write-Host ("Skipped           : {0} (AGENTS.md / lain-lain)" -f $skipped.Count) -ForegroundColor Cyan
}
if ($errorCount -gt 0) {
    Write-Host ("ERROR             : {0} (cek log di atas)" -f $errorCount) -ForegroundColor Red
}
# R8 (audit 2026-06-23): pesan eksplisit saat terhapus SEBAGIAN - aman diulang (idempoten).
if ($uninstallPartial) {
    Write-Host ''
    Write-Host 'CATATAN: kit terhapus SEBAGIAN - sebagian berkas/folder belum terhapus (mungkin terkunci editor/antivirus).' -ForegroundColor Yellow
    Write-Host '         AMAN diulang: tutup editor/antivirus lalu jalankan uninstall sekali lagi (yang sudah hilang akan dilewati).' -ForegroundColor Yellow
}
Write-Host ''

if ($errorCount -gt 0) { exit 1 }
exit 0
