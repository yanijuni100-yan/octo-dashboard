<#
.SYNOPSIS
  lib/template-deploy.ps1 - Helper deploy template file dari kit ke project.

.DESCRIPTION
  Extract logic copy template + placeholder substitution dari setup-pola-b.ps1
  supaya bisa di-reuse oleh script lain (update-kit.ps1, kit.ps1, dst.) dan
  di-test independen.

  Helpers yang di-export:
    - Copy-TemplateWithPlaceholder : Copy file dari kit ke target dengan
                                     placeholder substitution. Mode: skip kalau
                                     target sudah ada, backup, atau overwrite.
                                     Returns object { copied, action, sha256 }.
    - Copy-StaticTemplate          : Copy file kit -> target TANPA substitution
                                     (verbatim, untuk file generic seperti
                                     _PATTERNS.md). Mode existing-file sama.
                                     Returns object { copied, action, sha256 }.
    - Get-SupportedPlaceholder     : List placeholder yang di-support setup
                                     standar (NAMA_PROYEK, TANGGAL_HARI_INI,
                                     NAMA_KAMU, URL_REPO_STANDAR, VERSI_KIT).

  Kontrak penting:
    - Pakai .Replace() literal (bukan -replace regex) supaya input user dengan
      karakter $0/$1/$ tidak corrupt output.
    - Write file dengan UTF-8 NO-BOM (System.Text.UTF8Encoding $false) -- PS 5.1
      default UTF8 with BOM, sebagian tool sensitif.
    - SHA256 hash di-compute dari file TARGET setelah write (bukan source) supaya
      reflect content actual yang ada di disk (post-substitution).
    - Returns object dengan field: copied (bool), action (string), sha256 (string|null).
        action = 'created'  : target tidak ada sebelumnya, write sukses.
        action = 'updated'  : target ada, di-overwrite (dengan/tanpa backup).
        action = 'skipped'  : target ada, mode = Skip (default anti-overwrite).
        action = 'missing'  : source tidak ada (graceful skip, return copied=false).
    - No global state: semua input via parameter, output via return value. Function
      TIDAK baca/tulis $script:installedItems atau global lain.

.NOTES
  Versi  : 1.0.0
  Tanggal: 2026-06-06
  PowerShell 5.1+ compatible.
#>

# ---- Placeholder catalog ----
# Single source of truth untuk placeholder yang di-support oleh setup standar.
# Caller boleh kirim placeholder tambahan lewat -Placeholders, ini cuma referensi.
function Get-SupportedPlaceholder {
    [CmdletBinding()]
    param()
    return @(
        '<NAMA_PROYEK>',
        '<TANGGAL_HARI_INI>',
        '<NAMA_KAMU>',
        '<URL_REPO_STANDAR>',
        '<VERSI_KIT>'
    )
}

# ---- Internal helper: hitung SHA256 lower-case hex dari file ----
# Local helper supaya template-deploy.ps1 self-contained (tidak depend ke safety.ps1).
# Caller yang sudah load safety.ps1 boleh ignore -- ini private scope.
function Get-LintasFileSha256Hex {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

# ---- Internal helper: write UTF-8 NO-BOM ----
# PS 5.1 default UTF8 = with BOM (corrupt sebagian linter/parser).
# Pakai System.IO.File untuk write tanpa BOM, konsisten dengan setup-pola-b.ps1.
function Write-LintasUtf8NoBom {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Content
    )
    $enc = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $enc)
}

# ---- Internal helper: handle existing target file ----
# Return $true kalau caller boleh proceed write, $false kalau harus skip.
# Mode:
#   'Skip'      : target ada -> return $false (no write).
#   'Backup'    : target ada -> backup ke .backup-<timestamp>, return $true.
#   'Overwrite' : target ada -> langsung overwrite, return $true.
function Resolve-LintasExistingTarget {
    param(
        [Parameter(Mandatory)][string]$TargetPath,
        [Parameter(Mandatory)][ValidateSet('Skip','Backup','Overwrite')][string]$Mode,
        [string]$BackupSuffix
    )
    if (-not (Test-Path -LiteralPath $TargetPath)) {
        # Target tidak ada -- caller bebas write.
        return $true
    }
    switch ($Mode) {
        'Skip' { return $false }
        'Overwrite' { return $true }
        'Backup' {
            if (-not $BackupSuffix) {
                $BackupSuffix = Get-Date -Format 'yyyyMMdd-HHmmss'
            }
            $bakPath = "$TargetPath.backup-$BackupSuffix"
            Copy-Item -LiteralPath $TargetPath -Destination $bakPath -Force
            return $true
        }
    }
    return $false
}

# ---- Public: Copy template dengan placeholder substitution ----
# Source: file template di kit (mis. AGENTS.md.template, templates/architecture.md).
# Target: lokasi tujuan di project (mis. <proj>/AGENTS.md, <proj>/docs/architecture.md).
# Placeholders: hashtable @{ '<NAMA_PROYEK>' = 'akses'; '<TANGGAL_HARI_INI>' = '2026-06-06' }.
#   Key harus exact match (termasuk angle brackets) ke string di template.
#   Pakai .Replace() literal -- safe untuk value dengan $/regex chars.
# IfExists: 'Skip' (default), 'Backup', 'Overwrite'.
# BackupSuffix: optional, default = timestamp now (yyyyMMdd-HHmmss).
#
# Returns: PSCustomObject {
#   copied: bool       -- true kalau file ditulis (created atau updated).
#   action: string     -- 'created' | 'updated' | 'skipped' | 'missing'.
#   sha256: string|null -- SHA256 hash file TARGET setelah write, null kalau skipped/missing.
# }
function Copy-TemplateWithPlaceholder {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$SourcePath,
        [Parameter(Mandatory)][string]$TargetPath,
        [hashtable]$Placeholders = @{},
        [ValidateSet('Skip','Backup','Overwrite')][string]$IfExists = 'Skip',
        [string]$BackupSuffix
    )

    # ---- Validasi source ada ----
    if (-not (Test-Path -LiteralPath $SourcePath)) {
        return [PSCustomObject]@{
            copied = $false
            action = 'missing'
            sha256 = $null
        }
    }

    # ---- Cek target existing, decide skip/backup/overwrite ----
    $targetExists = Test-Path -LiteralPath $TargetPath
    $proceed = Resolve-LintasExistingTarget -TargetPath $TargetPath -Mode $IfExists -BackupSuffix $BackupSuffix
    if (-not $proceed) {
        return [PSCustomObject]@{
            copied = $false
            action = 'skipped'
            sha256 = $null
        }
    }

    # ---- Ensure parent dir exists ----
    $parentDir = Split-Path -Parent $TargetPath
    if ($parentDir -and -not (Test-Path -LiteralPath $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    # ---- Read template + apply substitution ----
    $content = Get-Content -LiteralPath $SourcePath -Raw -Encoding UTF8
    if ($null -eq $content) { $content = '' }

    if ($Placeholders -and $Placeholders.Count -gt 0) {
        foreach ($key in $Placeholders.Keys) {
            $value = [string]$Placeholders[$key]
            # Pakai .Replace() literal (bukan -replace regex) supaya value dengan
            # karakter $0/$1/$/backslash tidak corrupt output.
            $content = $content.Replace($key, $value)
        }
    }

    # ---- Write target ----
    Write-LintasUtf8NoBom -Path $TargetPath -Content $content

    # ---- Compute hash dari file TARGET (post-substitution) ----
    $sha = Get-LintasFileSha256Hex -Path $TargetPath

    $action = if ($targetExists) { 'updated' } else { 'created' }
    return [PSCustomObject]@{
        copied = $true
        action = $action
        sha256 = $sha
    }
}

# ---- Public: Copy template tanpa substitution (verbatim copy) ----
# Untuk file generic yang tidak punya placeholder (mis. _PATTERNS.md, _EXAMPLE.md,
# CODEOWNERS.template, decisions/_TEMPLATE.md).
#
# Implementation: tetap pakai Write-LintasUtf8NoBom (bukan Copy-Item) supaya konsisten
# encoding output -- file template di kit-dev mungkin di-save dengan BOM oleh editor,
# kita normalize ke NO-BOM saat deploy.
#
# Returns: PSCustomObject sama seperti Copy-TemplateWithPlaceholder.
function Copy-StaticTemplate {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$SourcePath,
        [Parameter(Mandatory)][string]$TargetPath,
        [ValidateSet('Skip','Backup','Overwrite')][string]$IfExists = 'Skip',
        [string]$BackupSuffix
    )

    if (-not (Test-Path -LiteralPath $SourcePath)) {
        return [PSCustomObject]@{
            copied = $false
            action = 'missing'
            sha256 = $null
        }
    }

    $targetExists = Test-Path -LiteralPath $TargetPath
    $proceed = Resolve-LintasExistingTarget -TargetPath $TargetPath -Mode $IfExists -BackupSuffix $BackupSuffix
    if (-not $proceed) {
        return [PSCustomObject]@{
            copied = $false
            action = 'skipped'
            sha256 = $null
        }
    }

    $parentDir = Split-Path -Parent $TargetPath
    if ($parentDir -and -not (Test-Path -LiteralPath $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    # Re-read + re-write supaya output guaranteed UTF-8 NO-BOM (normalize encoding).
    $content = Get-Content -LiteralPath $SourcePath -Raw -Encoding UTF8
    if ($null -eq $content) { $content = '' }
    Write-LintasUtf8NoBom -Path $TargetPath -Content $content

    $sha = Get-LintasFileSha256Hex -Path $TargetPath

    $action = if ($targetExists) { 'updated' } else { 'created' }
    return [PSCustomObject]@{
        copied = $true
        action = $action
        sha256 = $sha
    }
}
