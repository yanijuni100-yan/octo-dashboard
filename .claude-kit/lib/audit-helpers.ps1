# lib/audit-helpers.ps1 - Append-only audit log untuk security-relevant decisions.
# Versi 1 - 2026-06-08 - dipakai oleh update-kit.ps1 (GPG skip / bypass) + future ops.
#
# Format per baris (ISO 8601 UTC timestamp):
#   <TIMESTAMP> | <SOURCE> | <ACTION> | <DETAIL>
# Contoh:
#   2026-06-08T14:23:11Z | update-kit.ps1 | gpg-check-skipped | repo=https://github.com/ojokesusu/lintasAI.git branch=main reason=trusted-repo-whitelist
#
# Lokasi file default: <kitDir>/.audit-log (di .claude-kit/.audit-log dalam project user).

function Add-LintasAuditEntry {
    <#
    .SYNOPSIS
      Tulis 1 baris audit log dengan ISO 8601 UTC timestamp.
    .DESCRIPTION
      Append-only. Tidak fatal kalau gagal write (warn tapi jangan throw - audit
      transparency != availability requirement). PS 5.1 compatible: pakai
      ToUniversalTime() bukan -AsUTC (yang tidak available di 5.1).
    .PARAMETER Source
      Nama script yang call audit (mis. 'update-kit.ps1').
    .PARAMETER Action
      Kategori aksi (mis. 'gpg-check-skipped', 'gpg-check-passed', 'gpg-check-bypassed').
    .PARAMETER Detail
      Detail string (mis. "repo=URL tag=vX.Y.Z reason=trusted-repo-whitelist").
    .PARAMETER AuditDir
      Optional dir tempat .audit-log ditulis. Default: $kitDir (auto-detect dari caller scope).
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Action,
        [Parameter(Mandatory = $true)]
        [string]$Detail,
        [Parameter(Mandatory = $false)]
        [string]$AuditDir
    )
    try {
        if (-not $AuditDir) {
            # Auto-detect dari caller: pakai $kitDir kalau ada di scope parent
            if (Get-Variable -Name 'kitDir' -Scope 1 -ErrorAction SilentlyContinue) {
                $AuditDir = (Get-Variable -Name 'kitDir' -Scope 1).Value
            } else {
                $AuditDir = (Get-Location).Path
            }
        }
        $auditPath = Join-Path $AuditDir '.audit-log'
        $timestamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        $entry = "$timestamp | $Source | $Action | $Detail"
        Add-Content -Path $auditPath -Value $entry -Encoding UTF8 -ErrorAction Stop
    } catch {
        Write-Warning "AUDIT log gagal ditulis ke '$auditPath': $($_.Exception.Message)"
    }
}
