<#
.SYNOPSIS
  lib/agents-md.ps1 - Library helper untuk deploy AGENTS.md dari template kit.

.DESCRIPTION
  Extracted dari setup-pola-b.ps1 (v1.9) supaya logic fill AGENTS.md.template
  reusable dari kit.ps1, update-kit.ps1, atau script lain yang butuh refresh
  AGENTS.md tanpa run ulang full setup.

  Tanggung jawab:
    1. Detect AGENTS.md existing di project root (preserve customization)
    2. Backup pre-overwrite ke AGENTS.md.backup-<timestamp>
    3. Fill template dengan placeholder set yang dikasih caller
    4. Tulis UTF-8 tanpa BOM (PS 5.1 default = with BOM, beberapa tool sensitif)
    5. Pakai .Replace() literal (bukan -replace regex) supaya input user dengan
       karakter $0/$1/$ tidak corrupt output (defense vs regex injection)

  TIDAK tangani:
    - Manifest tracking (caller wajib panggil Add-ToManifest sendiri kalau perlu)
    - Template file resolution (caller kasih -TemplatePath absolute)
    - Project root validation (caller wajib pastikan path valid)

.NOTES
  Versi  : 1.0
  Tanggal: 2026-06-06
  Target : PowerShell 5.1+ (Windows Server 2025 / Win10 / Win11)
  Encoding: UTF-8 tanpa BOM (System.Text.UTF8Encoding $false)
#>

# Module-level guard supaya re-dot-source tidak duplikasi function definition
if ($script:__lintasAI_AgentsMdLoaded) { return }
$script:__lintasAI_AgentsMdLoaded = $true

function Publish-AgentsMd {
    <#
    .SYNOPSIS
      Publish AGENTS.md ke project root: fill template + backup existing.

      Catatan rename: nama lama `Deploy-AgentsMd` pakai verb non-approved (Deploy).
      Rename ke `Publish-AgentsMd` supaya lulus PSScriptAnalyzer PSUseApprovedVerbs.
      Semantik tetap sama: tulis file final ke project tree (publish = release ke target).

    .DESCRIPTION
      Tiga mode behavior berdasarkan state existing AGENTS.md + flag -Preserve:
        - Tidak ada existing       -> CREATE (write template-filled fresh)
        - Existing + -Preserve     -> PRESERVE (skip, jangan timpa, return action=preserved)
        - Existing + tanpa flag    -> BACKUP + UPDATE (rename existing ke .backup-<timestamp>, tulis fresh)

      Placeholders adalah hashtable @{ '<KEY>' = 'value' } - caller bebas tentukan
      key set. Template biasanya pakai <NAMA_PROYEK>, <TANGGAL_HARI_INI>, <NAMA_KAMU>,
      <URL_REPO_STANDAR>, <VERSI_KIT>, tapi function ini agnostic - apa pun yang
      ada di hashtable di-replace pakai .Replace() literal.

    .PARAMETER ProjectRoot
      Absolute path ke root proyek (parent dari .claude-kit/). AGENTS.md akan
      ditulis ke <ProjectRoot>\AGENTS.md.

    .PARAMETER TemplatePath
      Absolute path ke AGENTS.md.template (biasanya <KitDir>\AGENTS.md.template).

    .PARAMETER Placeholders
      Hashtable berisi pair @{ '<PLACEHOLDER>' = 'replacement_value' }.
      Key biasanya wrap dengan angle bracket (e.g. '<NAMA_PROYEK>') sesuai konvensi
      template, tapi function tidak enforce - replace literal apa adanya.

    .PARAMETER Preserve
      Kalau aktif DAN AGENTS.md existing ada -> SKIP overwrite, return action='preserved'.
      Anti-destruktif default: protect user customization.

      Tanpa flag ini, behavior default = backup + overwrite (untuk -Force scenario).

    .OUTPUTS
      PSCustomObject:
        action      : 'created' | 'updated' | 'preserved'
        backup_path : string (path file backup) atau $null kalau tidak ada backup
        target_path : string (path AGENTS.md final di project root)
        placeholders_applied : int (jumlah key di hashtable yang di-replace)

    .EXAMPLE
      # Setup awal, project belum punya AGENTS.md
      $result = Publish-AgentsMd `
          -ProjectRoot 'C:\proyek\akses' `
          -TemplatePath 'C:\proyek\akses\.claude-kit\AGENTS.md.template' `
          -Placeholders @{
              '<NAMA_PROYEK>'         = 'akses'
              '<TANGGAL_HARI_INI>'    = '2026-06-06'
              '<NAMA_KAMU>'           = 'budi'
              '<URL_REPO_STANDAR>'    = 'https://github.com/foo/akses'
              '<VERSI_KIT>'           = 'v1.5.0'
          }
      # $result.action = 'created', $result.backup_path = $null

    .EXAMPLE
      # Re-run setup, AGENTS.md existing - mau preserve customization user
      $result = Publish-AgentsMd `
          -ProjectRoot 'C:\proyek\akses' `
          -TemplatePath 'C:\proyek\akses\.claude-kit\AGENTS.md.template' `
          -Placeholders @{ '<NAMA_PROYEK>' = 'akses' } `
          -Preserve
      # $result.action = 'preserved', $result.backup_path = $null
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$TemplatePath,

        [Parameter(Mandatory = $true)]
        [hashtable]$Placeholders,

        [switch]$Preserve
    )

    # ---- Validasi input ----
    if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
        throw "Publish-AgentsMd: ProjectRoot tidak ditemukan atau bukan folder: $ProjectRoot"
    }
    if (-not (Test-Path -LiteralPath $TemplatePath -PathType Leaf)) {
        throw "Publish-AgentsMd: TemplatePath tidak ditemukan: $TemplatePath"
    }

    $target = Join-Path $ProjectRoot 'AGENTS.md'
    $existing = Test-Path -LiteralPath $target -PathType Leaf

    # ---- Mode PRESERVE: existing + flag aktif -> skip, return early ----
    if ($existing -and $Preserve) {
        return [PSCustomObject]@{
            action               = 'preserved'
            backup_path          = $null
            target_path          = $target
            placeholders_applied = 0
        }
    }

    # ---- Mode BACKUP: existing tanpa Preserve -> rename ke backup ----
    $backupPath = $null
    if ($existing) {
        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backupPath = "$target.backup-$timestamp"
        try {
            Copy-Item -LiteralPath $target -Destination $backupPath -Force -ErrorAction Stop
        } catch {
            throw "Publish-AgentsMd: Gagal backup AGENTS.md existing ke '$backupPath': $_"
        }
    }

    # ---- Fill template + tulis ----
    try {
        $content = Get-Content -LiteralPath $TemplatePath -Raw -Encoding UTF8
    } catch {
        throw "Publish-AgentsMd: Gagal baca template '$TemplatePath': $_"
    }

    # Pakai .Replace() literal (bukan -replace regex) - input user dengan $0/$1/$
    # tidak akan corrupt output. Defensive default vs regex injection.
    $applied = 0
    foreach ($key in $Placeholders.Keys) {
        $val = [string]$Placeholders[$key]
        $content = $content.Replace([string]$key, $val)
        $applied++
    }

    # Tulis UTF-8 tanpa BOM (PS 5.1 default UTF8 = with BOM, beberapa tool sensitif)
    try {
        [System.IO.File]::WriteAllText($target, $content, (New-Object System.Text.UTF8Encoding $false))
    } catch {
        throw "Publish-AgentsMd: Gagal tulis AGENTS.md ke '$target': $_"
    }

    return [PSCustomObject]@{
        action               = $(if ($existing) { 'updated' } else { 'created' })
        backup_path          = $backupPath
        target_path          = $target
        placeholders_applied = $applied
    }
}

function Publish-ClaudeMd {
    <#
    .SYNOPSIS
      Publish CLAUDE.md "loader" ke project root supaya aturan kit benar-benar ke-load tiap sesi.

    .DESCRIPTION
      Claude Code OTOMATIS membaca CLAUDE.md (BUKAN AGENTS.md). Maka kit men-deploy CLAUDE.md
      kecil yang isinya @import ./.claude-kit/CLAUDE_universal_v1.md (aturan tim, versi terkunci)
      + @import ./AGENTS.md (override proyek). Ini bikin aturan ter-load secara MEKANIS, bukan
      sekadar pointer prosa yang bisa diabaikan AI.

      Behavior:
        - CLAUDE.md belum ada                       -> CREATE (tulis loader)
        - CLAUDE.md sudah loader kit (punya marker)  -> CURRENT (idempotent, tidak diubah)
        - CLAUDE.md custom (tanpa marker)            -> BACKUP existing + tulis loader

    .PARAMETER ProjectRoot
      Absolute path ke root proyek. CLAUDE.md ditulis ke <ProjectRoot>\CLAUDE.md.

    .PARAMETER TemplatePath
      Absolute path ke CLAUDE.md.template (biasanya <KitDir>\CLAUDE.md.template).

    .PARAMETER Placeholders
      Hashtable @{ '<PLACEHOLDER>' = 'value' } - di-replace literal (anti regex-injection).

    .OUTPUTS
      PSCustomObject: action ('created'|'updated'|'current'), backup_path, target_path.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$TemplatePath,

        [Parameter(Mandatory = $true)]
        [hashtable]$Placeholders
    )

    if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
        throw "Publish-ClaudeMd: ProjectRoot tidak ditemukan atau bukan folder: $ProjectRoot"
    }
    if (-not (Test-Path -LiteralPath $TemplatePath -PathType Leaf)) {
        throw "Publish-ClaudeMd: TemplatePath tidak ditemukan: $TemplatePath"
    }

    $target = Join-Path $ProjectRoot 'CLAUDE.md'
    # Marker = baris @import aturan kit. Kalau CLAUDE.md existing sudah punya ini, ia sudah loader.
    $marker = '@./.claude-kit/CLAUDE_universal_v1.md'
    $existing = Test-Path -LiteralPath $target -PathType Leaf

    # ---- Idempotent: CLAUDE.md sudah jadi loader kit -> jangan timpa ----
    if ($existing) {
        $cur = ''
        try { $cur = Get-Content -LiteralPath $target -Raw -Encoding UTF8 } catch { $cur = '' }
        if ($cur -and $cur.Contains($marker)) {
            return [PSCustomObject]@{
                action      = 'current'
                backup_path = $null
                target_path = $target
            }
        }
    }

    # ---- Existing CLAUDE.md custom (bukan loader) -> backup dulu ----
    $backupPath = $null
    if ($existing) {
        $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backupPath = "$target.backup-$ts"
        try {
            Copy-Item -LiteralPath $target -Destination $backupPath -Force -ErrorAction Stop
        } catch {
            throw "Publish-ClaudeMd: Gagal backup CLAUDE.md existing ke '$backupPath': $_"
        }
    }

    # ---- Fill template + tulis (UTF-8 tanpa BOM) ----
    try {
        $content = Get-Content -LiteralPath $TemplatePath -Raw -Encoding UTF8
    } catch {
        throw "Publish-ClaudeMd: Gagal baca template '$TemplatePath': $_"
    }
    foreach ($key in $Placeholders.Keys) {
        $content = $content.Replace([string]$key, [string]$Placeholders[$key])
    }
    try {
        [System.IO.File]::WriteAllText($target, $content, (New-Object System.Text.UTF8Encoding $false))
    } catch {
        throw "Publish-ClaudeMd: Gagal tulis CLAUDE.md ke '$target': $_"
    }

    return [PSCustomObject]@{
        action      = $(if ($existing) { 'updated' } else { 'created' })
        backup_path = $backupPath
        target_path = $target
    }
}
