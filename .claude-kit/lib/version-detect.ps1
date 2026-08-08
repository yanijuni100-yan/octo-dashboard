<#
.SYNOPSIS
  lib/version-detect.ps1 - Shared kit version detection untuk lintasAI kit scripts.

.DESCRIPTION
  Module ini berisi helper detect versi kit yang dipakai bersama oleh script
  (kit.ps1, setup-pola-b.ps1, doctor, dst.). Sebelumnya logic ini di-duplicate
  di tiap script dengan regex yang slightly berbeda - berisiko drift kalau
  format CHANGELOG.md berubah. Library ini jadi satu sumber kebenaran.

  Helpers yang di-export:
    - Get-KitVersionFromChangelog : Parse versi dari CHANGELOG.md. Support
                                    DUA format header (current + strict).
                                    Returns string dengan prefix 'v' atau $null.
    - Get-KitVersionFromManifest  : Read metadata.kit_version dari
                                    .install-manifest.json di project root.
                                    Returns string atau $null.
    - Get-KitVersionFallback      : Defense-in-depth chain:
                                    manifest -> $script:KIT_VERSION ->
                                    CHANGELOG regex -> "unknown".

  Format CHANGELOG yang di-support (regex):
    1. "## [X.Y.Z]"        (Keep-a-Changelog, format SEKARANG/dominan sejak v1.13.0, mis. "## [1.21.0]")
    2. "## vX.Y.Z [date]"  (gaya lama lintasAI, entri legacy)

  Satu scan terpadu menerima KEDUA format; heading versi PERTAMA dari atas
  (= terbaru) yang diambil.

.NOTES
  Versi  : 1.0.0
  Tanggal: 2026-06-06
  Target : PowerShell 5.1+ (Windows PowerShell).
  Catatan: Function-only module. Caller harus dot-source: . .\lib\version-detect.ps1
#>

# ---- Helper: parse versi dari CHANGELOG.md ----
# Support 2 format header (1 scan terpadu, ambil heading PALING ATAS = terbaru):
#   "## [X.Y.Z]"       (Keep-a-Changelog strict) - format SEKARANG (sejak v1.13.0)
#   "## vX.Y.Z [date]" (gaya lama lintasAI) - entri legacy, tetap kebaca
# Returns: string 'vX.Y.Z' (selalu prefix 'v') atau $null kalau tidak ketemu.
# Tidak throw - caller yang memutuskan fallback.
function Get-KitVersionFromChangelog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ChangelogPath
    )

    if (-not (Test-Path -LiteralPath $ChangelogPath)) {
        return $null
    }

    try {
        # UNIFIED scan (v1.13.3 fix): ambil heading versi PERTAMA dari atas (= terbaru),
        # terima KEDUA format sekaligus: '## vX.Y.Z' (lama) ATAU '## [X.Y.Z]' / '## [vX.Y.Z]'
        # (Keep-a-Changelog, format SEKARANG). Pendekatan dua-strategi lama (coba v-prefix
        # DULU) keliru: entri lama '## v1.12.0' ter-tangkap duluan sehingga entri bracketed
        # terbaru (## [1.13.x]) ter-bayang -> versi STALE. Heading non-versi ('## [Unreleased]',
        # '## Label spesial', '## Disiplin penomoran versi') otomatis ter-skip (tak ada digit
        # versi tepat setelah '## '). Return 'v'+versi (mis. 'v1.13.2') agar konsisten caller.
        $first = Get-Content -LiteralPath $ChangelogPath -Encoding UTF8 -ErrorAction Stop |
            Where-Object { $_ -match '^##\s+\[?v?\d+\.\d+\.\d+' } |
            Select-Object -First 1

        if ($first -and ($first -match '^##\s+\[?v?(\d+\.\d+\.\d+)')) {
            return 'v' + $Matches[1]
        }
    } catch {
        # Read error / encoding error - treat sebagai "tidak ketemu"
        # supaya caller bisa fallback ke source lain.
        return $null
    }

    return $null
}

# ---- Helper: parse versi dari .install-manifest.json ----
# Manifest = PRIMARY source (what was actually installed, bukan apa yang ada
# di file kit sekarang). Penting kalau user pakai kit lama tapi CHANGELOG-nya
# nge-track kit yang lebih baru.
#
# Returns: string (mis. 'v1.5.0' atau '1.5.0' - tergantung apa yang tersimpan)
# atau $null kalau manifest tidak ada / corrupt / tidak ada metadata.kit_version.
function Get-KitVersionFromManifest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ProjectRoot
    )

    $manifestPath = Join-Path $ProjectRoot '.install-manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath)) {
        return $null
    }

    try {
        # Pakai [System.IO.File]::ReadAllText supaya force UTF-8 read
        # (Get-Content default encoding di PS 5.1 bisa ANSI / unreliable).
        $json = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8)
        $m = ConvertFrom-Json $json -ErrorAction Stop

        if ($m.metadata -and $m.metadata.kit_version) {
            return [string]$m.metadata.kit_version
        }
    } catch {
        # JSON parse error / file unreadable - fallback ke source lain.
        return $null
    }

    return $null
}

# ---- Helper: full fallback chain ----
# Defense-in-depth: coba semua source berurutan, return yang pertama berhasil.
# Last resort = "unknown" (bukan "not installed" - kit-nya ada, cuma versi-nya
# tidak ke-detect).
#
# Order:
#   1. Manifest (.install-manifest.json) - PRIMARY (what was installed)
#   2. $script:KIT_VERSION constant      - kit.ps1's own awareness
#   3. CHANGELOG.md regex                - last code-based source
#   4. "unknown"                         - last resort
#
# -ProjectRoot : folder yang ada .install-manifest.json (biasanya = KitDir).
# -ChangelogPath : optional override path CHANGELOG. Default = $ProjectRoot\CHANGELOG.md.
function Get-KitVersionFallback {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ProjectRoot,

        [string]$ChangelogPath
    )

    # Source 1: manifest
    $ver = Get-KitVersionFromManifest -ProjectRoot $ProjectRoot
    if ($ver) { return $ver }

    # Source 2: $script:KIT_VERSION constant (caller-scoped, optional).
    # Catatan: ini akses scope variable di caller. Di PS 5.1, $script:
    # me-resolve ke script scope yang dot-sourcing kita.
    if ($script:KIT_VERSION) {
        return $script:KIT_VERSION
    }

    # Source 3: CHANGELOG regex
    if (-not $ChangelogPath) {
        $ChangelogPath = Join-Path $ProjectRoot 'CHANGELOG.md'
    }
    $ver = Get-KitVersionFromChangelog -ChangelogPath $ChangelogPath
    if ($ver) { return $ver }

    # Last resort
    return 'unknown'
}
