# =============================================================================
# Manifest helpers - extracted from setup-pola-b.ps1 v1.1.0
# =============================================================================
# Tujuan:
#   Helper functions untuk build + sign install manifest (.install-manifest.json)
#   yang dipakai uninstall.ps1 untuk safe-delete (hash-based pristine detection).
#
# Beda dengan versi inline di setup-pola-b.ps1:
#   - TIDAK pakai $script: scope variables. Setiap function terima parameter
#     eksplisit -> reusable dari script manapun (setup, update-kit, kit.ps1).
#   - State (installedItems + createdDirs) diwakili object [pscustomobject]
#     yang di-init via Initialize-Manifest, lalu di-mutate via Add-ToManifest /
#     Add-DirToManifest, lalu di-flush via Save-Manifest.
#
# PowerShell 5.1 compatible (no ternary, no null-coalescing, no class syntax).
#
# Public API:
#   - Initialize-Manifest -ProjectRoot <path>
#       -> returns [pscustomobject] state container
#   - Get-FileSha256 -FilePath <path>
#       -> returns hex SHA-256 string (uppercase, no separator)
#   - Add-ToManifest  -State <obj> -FilePath <path> -Kind <string> [-From <string>]
#       -> append file entry (path/kind/sha256[/from]) ke State.Files
#   - Add-DirToManifest -State <obj> -DirPath <path>
#       -> append dir relative path ke State.Directories (dedup)
#   - Save-Manifest -State <obj> -KitDir <path> -KitVersion <string> -ProjectName <string>
#                   [-NoPreserve] [-SkipSigning]
#       -> merge dengan manifest sebelumnya (kalau ada), HMAC sign, write JSON
#       -> returns [pscustomobject] dengan FilesCount, DirsCount, Merged, Signed, ManifestPath
#
# Catatan path:
#   - State.ProjectRoot disimpan supaya Add-ToManifest bisa compute relative path
#     tanpa minta caller pass ulang setiap call.
#   - Relative path pakai forward slash (portable di JSON, sama dengan setup-pola-b.ps1).
# =============================================================================

Set-StrictMode -Version Latest

function Initialize-Manifest {
    <#
    .SYNOPSIS
        Buat state container baru untuk tracking install manifest.
    .PARAMETER ProjectRoot
        Absolute path ke root proyek (dipakai untuk compute relative paths).
    #>
    param(
        [Parameter(Mandatory)][string]$ProjectRoot
    )
    return [pscustomobject]@{
        ProjectRoot = $ProjectRoot
        Files       = @()
        Directories = @()
    }
}

function Get-FileSha256 {
    <#
    .SYNOPSIS
        Compute SHA-256 hash file (hex uppercase, no separator).
    .PARAMETER FilePath
        Path ke file yang mau di-hash. Pakai -LiteralPath (no glob expansion).
    .OUTPUTS
        [string] hex SHA-256, atau $null kalau file tidak ada.
    #>
    param(
        [Parameter(Mandatory)][string]$FilePath
    )
    if (-not (Test-Path -LiteralPath $FilePath)) { return $null }
    return (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash
}

function ConvertTo-ManifestRelativePath {
    <#
    .SYNOPSIS
        Convert absolute path -> relative path (forward slash, no leading slash).
    .NOTES
        Helper internal. Sengaja TIDAK di-export dari API publik karena
        tightly coupled dengan State.ProjectRoot.
    #>
    param(
        [Parameter(Mandatory)][string]$AbsolutePath,
        [Parameter(Mandatory)][string]$ProjectRoot
    )
    $rel = $AbsolutePath.Replace($ProjectRoot, '')
    $rel = $rel.TrimStart('\','/')
    return $rel.Replace('\','/')
}

function Add-ToManifest {
    <#
    .SYNOPSIS
        Track file ke manifest state dengan sha256 hash.
    .PARAMETER State
        Object dari Initialize-Manifest.
    .PARAMETER FilePath
        Absolute path file (yang sudah di-copy ke project).
    .PARAMETER Kind
        Kategori file (mis. 'lib', 'backup', 'filled_template', 'skeleton', 'team_file').
        Dipakai uninstall.ps1 untuk decide treatment per kategori.
    .PARAMETER From
        Opsional source label (mis. 'AGENTS.md.template'). Disimpan ke field 'from'
        di manifest entry untuk audit trail.
    #>
    param(
        [Parameter(Mandatory)][pscustomobject]$State,
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string]$Kind,
        [string]$From
    )
    if (-not (Test-Path -LiteralPath $FilePath)) { return }

    $sha = Get-FileSha256 -FilePath $FilePath
    $relPath = ConvertTo-ManifestRelativePath -AbsolutePath $FilePath -ProjectRoot $State.ProjectRoot

    $entry = [ordered]@{
        path   = $relPath
        kind   = $Kind
        sha256 = $sha
    }
    if ($From) { $entry.from = $From }

    $State.Files += $entry
}

function Add-DirToManifest {
    <#
    .SYNOPSIS
        Track directory ke manifest state (dedup).
    .PARAMETER State
        Object dari Initialize-Manifest.
    .PARAMETER DirPath
        Absolute path directory yang baru dibuat kit.
    #>
    param(
        [Parameter(Mandatory)][pscustomobject]$State,
        [Parameter(Mandatory)][string]$DirPath
    )
    if (-not (Test-Path -LiteralPath $DirPath)) { return }

    $relPath = ConvertTo-ManifestRelativePath -AbsolutePath $DirPath -ProjectRoot $State.ProjectRoot
    if ($State.Directories -notcontains $relPath) {
        $State.Directories += $relPath
    }
}

function Save-Manifest {
    <#
    .SYNOPSIS
        Merge dengan manifest sebelumnya (kalau ada), HMAC sign, write JSON ke disk.
    .PARAMETER State
        Object dari Initialize-Manifest (sudah di-populate via Add-ToManifest / Add-DirToManifest).
    .PARAMETER KitDir
        Absolute path ke folder kit (mis. <project>/.claude-kit). Manifest ditulis ke
        $KitDir/.install-manifest.json.
    .PARAMETER KitVersion
        Versi kit (mis. 'v1.1.0' atau 'pre-launch (testing)'). Disimpan di metadata
        + dipakai untuk HMAC signing key derivation.
    .PARAMETER ProjectName
        Nama proyek (leaf dari ProjectRoot). Disimpan ke manifest untuk audit.
    .PARAMETER NoPreserve
        Kalau di-set: SKIP merge dengan manifest sebelumnya (overwrite langsung).
        Default OFF (preserve aktif): entries dari manifest lama yang file-nya masih ada
        di disk + path-nya tidak konflik dengan entry baru tetap di-keep.
    .PARAMETER SkipSigning
        Kalau di-set: SKIP HMAC sign manifest (mis. test mode). Default OFF (signing aktif
        via lib/manifest-signing.ps1).
    .OUTPUTS
        [pscustomobject] dengan: ManifestPath, FilesCount, DirsCount, Merged, Signed.
    #>
    param(
        [Parameter(Mandatory)][pscustomobject]$State,
        [Parameter(Mandatory)][string]$KitDir,
        [Parameter(Mandatory)][string]$KitVersion,
        [Parameter(Mandatory)][string]$ProjectName,
        # R7 (audit 2026-06-23): nama pemasang yang JUJUR dicatat di metadata.installer. Default tetap
        # 'setup-pola-b.ps1' supaya pemanggil lama (installer utama) tak berubah; pemanggil lain
        # (mis. team-setup.ps1) WAJIB kirim namanya sendiri supaya catatan tidak keliru.
        [string]$InstallerName = 'setup-pola-b.ps1',
        [switch]$NoPreserve,
        [switch]$SkipSigning
    )

    $manifestPath = Join-Path $KitDir '.install-manifest.json'
    $merged = $false

    # ---- Baca manifest sebelumnya (kalau ada) untuk merge ----
    $previous = $null
    if ((-not $NoPreserve) -and (Test-Path -LiteralPath $manifestPath)) {
        try {
            $previous = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        } catch {
            Write-Host "WARN  Manifest sebelumnya corrupt, akan di-overwrite: $_" -ForegroundColor Yellow
        }
    }

    # ---- Merge files: preserve entries dari manifest sebelumnya yang masih ada di disk ----
    if ($previous -and $previous.PSObject.Properties.Name -contains 'files' -and $previous.files) {
        $newPaths = @($State.Files | ForEach-Object { $_.path })
        foreach ($prevEntry in $previous.files) {
            if ($newPaths -contains $prevEntry.path) { continue }
            $fullPath = Join-Path $State.ProjectRoot (([string]$prevEntry.path) -replace '/', '\')
            if (Test-Path -LiteralPath $fullPath) {
                $entry = [ordered]@{
                    path   = [string]$prevEntry.path
                    kind   = [string]$prevEntry.kind
                    sha256 = [string]$prevEntry.sha256
                }
                if ($prevEntry.PSObject.Properties.Name -contains 'from' -and $prevEntry.from) {
                    $entry.from = [string]$prevEntry.from
                }
                $State.Files += $entry
                $merged = $true
            }
        }
    }

    # ---- Merge dirs: preserve yang masih ada ----
    if ($previous -and $previous.PSObject.Properties.Name -contains 'directories_created' -and $previous.directories_created) {
        foreach ($prevDir in $previous.directories_created) {
            $prevDirStr = [string]$prevDir
            if ($State.Directories -contains $prevDirStr) { continue }
            $fullDir = Join-Path $State.ProjectRoot ($prevDirStr -replace '/', '\')
            if (Test-Path -LiteralPath $fullDir) {
                $State.Directories += $prevDirStr
                $merged = $true
            }
        }
    }

    # ---- Build manifest object (anonymized project_root + installed_by) ----
    $manifestMetadata = [ordered]@{
        kit_version  = $KitVersion
        installed_at = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
        installer    = $InstallerName
    }
    $manifest = [ordered]@{
        schema_version      = 1
        kit_version         = $KitVersion
        installed_at        = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')
        installed_by        = '<USER>'
        project_name        = $ProjectName
        project_root        = '<PROJECT_ROOT>'
        metadata            = $manifestMetadata
        files               = $State.Files
        directories_created = $State.Directories
    }

    # ---- HMAC sign (optional) ----
    $signed = $false
    if (-not $SkipSigning) {
        try {
            . (Join-Path $KitDir 'lib\manifest-signing.ps1')
            $manifest.metadata.signature = New-ManifestSignature -Manifest $manifest -KitVersion $KitVersion
            $signed = $true
        } catch {
            Write-Host "WARN  Gagal sign manifest (manifest-signing.ps1 issue): $_" -ForegroundColor Yellow
            Write-Host "      Manifest tetap ditulis tanpa signature. Uninstall akan prompt karena unsigned." -ForegroundColor Yellow
        }
    }

    # ---- Write JSON (UTF-8 NO BOM, supaya hash deterministic + git-friendly) ----
    # ATOMIK (tmp+rename): tulis ke berkas sementara (.tmp) lebih dulu lalu ganti-nama ke tujuan.
    # Move-Item -Force di filesystem yang sama bersifat atomik (timpa berkas lama dgn aman) -> proses
    # yang ditebas / listrik mati di TENGAH-tulis tak meninggalkan catatan setengah-jadi (JSON rusak)
    # yang melumpuhkan rollback (Read-ManifestJson) DAN uninstall sekaligus persis saat dibutuhkan
    # (audit P3 2026-06-23). Cermin idiom fungsi Write-ManifestJson di lib/rollback.ps1 + writeJsonAtomic
    # di lib/manifest.mjs (sebut nama fungsi, bukan nomor baris -> tahan-basi saat berkas disunting).
    $json = $manifest | ConvertTo-Json -Depth 10
    $manifestTmp = "$manifestPath.tmp"
    [System.IO.File]::WriteAllText($manifestTmp, $json, (New-Object System.Text.UTF8Encoding $false))
    Move-Item -Path $manifestTmp -Destination $manifestPath -Force

    return [pscustomobject]@{
        ManifestPath = $manifestPath
        FilesCount   = $State.Files.Count
        DirsCount    = $State.Directories.Count
        Merged       = $merged
        Signed       = $signed
    }
}
