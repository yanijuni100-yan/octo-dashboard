<#
.SYNOPSIS
  lib/safety.ps1 - Shared safety helpers untuk lintasAI kit scripts.

.DESCRIPTION
  Module ini berisi helper path-safety yang dipakai bersama oleh script kit
  (setup-pola-b.ps1, uninstall.ps1, dst.) untuk mencegah path traversal,
  symlink/junction redirect, dan operasi pada path di luar project root.

  Helpers yang di-export:
    - Initialize-SafeProjectPath : Set $script:ProjectRoot + $script:ProjectRootCanonical
                                   sekaligus (containment base). Wajib dipanggil
                                   sekali sebelum Resolve-SafeProjectPath kalau caller
                                   ingin API eksplisit (bukan set variable manual).
    - Resolve-SafeProjectPath  : Validasi + resolve relative path dari manifest
                                 ke absolute path dalam project root. Reject
                                 absolute path, parent traversal ('..'), dan
                                 path yang escape root. Accept -RelPath (legacy)
                                 atau alias -RelativePath. Behavior reject =
                                 throw exception (non-recoverable security boundary).
    - Test-PathHasReparsePoint : Detect reparse point (junction/symlink) di
                                 target path ATAU di parent segment manapun
                                 antara $ProjectRoot dan target.
    - Get-FileSha256           : SHA-256 file hash dalam lower-case hex string.

  Kontrak penting:
    Caller bisa pakai Initialize-SafeProjectPath -ProjectRoot <full path> ATAU
    set manual: $script:ProjectRootCanonical = <full path with trailing separator>.
    Variable ini dibaca oleh helper sebagai base containment check.

.NOTES
  Versi  : 1.0.0
  Tanggal: 2026-06-04
  Catatan keamanan: jangan ubah logic reject tanpa review - ini security boundary.
#>

# ---- Project-root initializer ----
# Set $script:ProjectRoot + $script:ProjectRootCanonical sekaligus. API eksplisit
# supaya caller (dan test harness) tidak perlu tahu detail internal variable name.
# Test/caller equivalent ke pattern manual lama:
#   $ProjectRoot = $path
#   $script:ProjectRootCanonical = $path + '\'
function Initialize-SafeProjectPath {
    param(
        [Parameter(Mandatory)][string]$ProjectRoot
    )
    # Normalize via GetFullPath supaya '.', '..' di input ter-resolve sebelum kita simpan.
    try {
        $normalized = [System.IO.Path]::GetFullPath($ProjectRoot)
    } catch {
        throw "Initialize-SafeProjectPath: invalid ProjectRoot '$ProjectRoot' ($($_.Exception.Message))"
    }
    $script:ProjectRoot = $normalized
    # Pastikan trailing DirectorySeparatorChar supaya containment check structural (cegah prefix collision).
    if (-not $normalized.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $script:ProjectRootCanonical = $normalized + [System.IO.Path]::DirectorySeparatorChar
    } else {
        $script:ProjectRootCanonical = $normalized
    }
    # Set $ProjectRoot di parent scope juga supaya legacy callers yang baca $ProjectRoot tanpa $script:
    # tetap dapat value. Set-Variable -Scope 1 = scope caller (yang dot-source / panggil function ini).
    try {
        Set-Variable -Name ProjectRoot -Value $normalized -Scope 1 -ErrorAction SilentlyContinue
    } catch {
        # Set-Variable di parent scope best-effort; kalau gagal (dot-source vs call differ),
        # $script:ProjectRoot tetap reliable untuk caller modern.
        Write-Verbose "Parent-scope ProjectRoot propagation failed: $($_.Exception.Message)"
    }
}

# ---- Path-traversal & symlink helpers ----
# Resolve a manifest-supplied relative path safely:
#  - Reject absolute paths (drive-letter, leading \ or /).
#  - Reject paths containing '..' segments.
#  - Normalize via [System.IO.Path]::GetFullPath() and verify containment in $ProjectRoot.
#  - Throws on reject (security boundary - jangan silent-fallback).
function Resolve-SafeProjectPath {
    param(
        # Accept legacy nama -RelPath, alias -RelativePath untuk API yang lebih jelas.
        [Parameter(Mandatory)]
        [Alias('RelativePath')]
        [string]$RelPath,
        [string]$Label = 'entry'
    )
    # Defense-in-depth: pastikan $script:ProjectRootCanonical SELALU diakhiri DirectorySeparatorChar.
    # Tanpa trailing separator, StartsWith() bisa false-match: "C:\proj" matches "C:\proj-evil\foo".
    # Caller seharusnya sudah set ini, tapi normalize lagi di sini supaya containment check structural.
    if ($script:ProjectRootCanonical -and -not $script:ProjectRootCanonical.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $script:ProjectRootCanonical += [System.IO.Path]::DirectorySeparatorChar
    }
    if ([string]::IsNullOrWhiteSpace($script:ProjectRootCanonical)) {
        throw "Resolve-SafeProjectPath: ProjectRoot belum di-initialize. Panggil Initialize-SafeProjectPath dulu."
    }
    if ([string]::IsNullOrWhiteSpace($RelPath)) {
        $msg = "REJECT empty path for $Label"
        Write-Host $msg -ForegroundColor Red
        throw $msg
    }
    # Block absolute paths: drive-letter (C:\), UNC (\\server\), leading separators.
    if ([System.IO.Path]::IsPathRooted($RelPath) -or $RelPath -match '^[a-zA-Z]:' -or $RelPath -match '^[\\/]') {
        $msg = "REJECT absolute path in manifest ($Label): $RelPath"
        Write-Host $msg -ForegroundColor Red
        throw $msg
    }
    # Block parent traversal segments.
    if ($RelPath -match '(^|[\\/])\.\.([\\/]|$)') {
        $msg = "REJECT parent-traversal segment in manifest ($Label): $RelPath"
        Write-Host $msg -ForegroundColor Red
        throw $msg
    }
    # Pakai $script:ProjectRoot (ter-set oleh Initialize-SafeProjectPath) atau fallback ke $ProjectRoot caller scope.
    $rootForJoin = if ($script:ProjectRoot) { $script:ProjectRoot } else { $ProjectRoot }
    $candidate = Join-Path $rootForJoin ($RelPath -replace '/', '\')
    try {
        $full = [System.IO.Path]::GetFullPath($candidate)
    } catch {
        $msg = "REJECT invalid path in manifest ($Label): $RelPath"
        Write-Host $msg -ForegroundColor Red
        throw $msg
    }
    # Containment check (case-insensitive prefix-with-separator).
    if (-not $full.StartsWith($script:ProjectRootCanonical, [System.StringComparison]::OrdinalIgnoreCase)) {
        $msg = "REJECT path escapes project root ($Label): $RelPath -> $full"
        Write-Host $msg -ForegroundColor Red
        throw $msg
    }
    return $full
}

# Detect reparse points (junction / symlink) anywhere in the path between $ProjectRoot
# and the target. Junction in mid-path lets attacker redirect a contained path to outside.
# Returns $true kalau target ATAU parent segment apapun adalah reparse point.
function Test-PathHasReparsePoint {
    param([Parameter(Mandatory)][string]$FullPath)
    $rootClean = $script:ProjectRootCanonical.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
    # Structural ancestor walk: pakai DirectoryInfo.Parent (bukan Split-Path string-based)
    # supaya loop exit kondisi struktural (root drive), bukan length-based yang bisa kena edge case
    # (mis. UNC path, drive root tanpa trailing sep, atau path lebih pendek dari rootClean).
    $current = $null
    if (Test-Path -LiteralPath $FullPath) {
        try {
            $startItem = Get-Item -Force -LiteralPath $FullPath -ErrorAction Stop
            if ($startItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
                return $true
            }
            # Untuk file: pakai Directory; untuk folder: pakai DirectoryInfo itself.
            if ($startItem.PSIsContainer) {
                $current = [System.IO.DirectoryInfo]$startItem
            } else {
                $current = $startItem.Directory
            }
        } catch {
            # Kalau Get-Item gagal, defensive return true (treat as suspicious).
            return $true
        }
    } else {
        # Path tidak ada di disk: walk parents tetap perlu (parent bisa reparse point).
        try {
            $current = [System.IO.DirectoryInfo](Split-Path -Parent $FullPath)
        } catch {
            return $false
        }
    }
    while ($current -and $current.FullName -ne $current.Root.FullName) {
        try {
            $info = Get-Item -Force -LiteralPath $current.FullName -ErrorAction Stop
            if ($info.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
                return $true
            }
        } catch {
            return $true
        }
        $current = $current.Parent
        if (-not $current) { break }
        # Stop kalau sudah keluar (atau sama dengan) project root canonical.
        if ($current.FullName.Length -lt $rootClean.Length) { break }
    }
    return $false
}

# ---- File hashing helper ----
# Compute SHA-256 hash dari file, return lower-case hex string.
# Wrapper tipis di atas Get-FileHash supaya caller (manifest, integrity check, test) tidak
# perlu mikirin algo + casing setiap kali. Throws kalau file tidak ada / tidak bisa dibaca.
function Get-FileSha256 {
    param(
        [Parameter(Mandatory)][string]$FilePath
    )
    if (-not (Test-Path -LiteralPath $FilePath)) {
        throw "Get-FileSha256: file tidak ditemukan: $FilePath"
    }
    $hash = Get-FileHash -LiteralPath $FilePath -Algorithm SHA256 -ErrorAction Stop
    return $hash.Hash.ToLowerInvariant()
}

# Functions auto-exposed via dot-source (no Export-ModuleMember karena .ps1 di-load via `. $path`).
# Caller pakai pattern: . (Join-Path $PSScriptRoot 'lib\safety.ps1')
# Setelah dot-source, Initialize-SafeProjectPath, Resolve-SafeProjectPath,
# Test-PathHasReparsePoint, Get-FileSha256 accessible di caller scope.
