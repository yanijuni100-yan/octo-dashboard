<#
.SYNOPSIS
  lib/git-helpers.ps1 - Git metadata cleanup + Mark-of-the-Web unblock helpers
  untuk lintasAI kit scripts.

.DESCRIPTION
  Modul ini berisi dua helper yang sebelumnya tertanam inline di setup-pola-b.ps1
  (dan kemungkinan di-share dengan update-kit.ps1 / install-windows.ps1):

    - Remove-GitMetadata : Hapus folder .git/ di dalam kit directory.
                           Penting karena kalau kit di-CLONE (bukan zip-extract),
                           folder .git/ ikut ke project user. Itu menyebabkan:
                             * Bloat (history kit-dev, potensial ratusan MB)
                             * Expose history internal kit-dev ke user repo
                             * User accidentally bikin `git submodule` /
                               confuse `git log`
                           Idempotent: skip kalau folder .git/ tidak ada.

    - Remove-MotwBlock    : Unblock-File recursive untuk semua file di kit.
                           Mark-of-the-Web (MOTW) = NTFS Alternate Data Stream
                           Zone.Identifier yang di-set Windows kalau file
                           di-download dari internet (zip dari GitHub, dst.).
                           File MOTW-blocked = script .ps1 di-reject oleh
                           ExecutionPolicy walaupun signed. Unblock = strip
                           Zone.Identifier ADS supaya kit bisa di-eksekusi.

  Behavior umum:
    - Best-effort: gagal hapus / gagal unblock TIDAK throw - return $false.
                   Caller bisa pilih lanjut atau abort. Konsisten dengan
                   pattern inline di setup-pola-b.ps1 (try/catch + warn).
    - PowerShell 5.1 compatible: tidak pakai operator $?:, ??, ?., -AsHashtable,
                                 atau syntax PS 7+ lainnya.
    - Verbose logging via Write-Verbose (silent secara default). Caller bisa
      enable dengan -Verbose untuk debugging.

.NOTES
  Versi  : 1.0.0
  Tanggal: 2026-06-06
  Extracted from: setup-pola-b.ps1 v1.9 (lines 173-200)
  Compat: PowerShell 5.1+
#>

# ---- Remove-GitMetadata ----
# Hapus folder .git/ di -Path. Idempotent (skip kalau tidak ada).
# Return: $true kalau sukses ATAU folder .git/ tidak ada (no-op success).
#         $false kalau gagal hapus (folder ada tapi Remove-Item throw).
function Remove-GitMetadata {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute(
        'PSUseSingularNouns',
        '',
        Justification = 'Kata "metadata" dalam usage modern English = mass/uncountable noun (kayak "information"), bukan plural dari "datum". Git documentation, ECMA, dan W3C semua pakai "metadata" sebagai singular. PSSA di PS 7 detect false-positive ini; PSSA di PS 5.1 tidak. Rename ke Remove-GitMetadatum akan break public API + tidak idiomatic. Suppress per-function lebih aman dari global exclude.'
    )]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Verbose ("Remove-GitMetadata: Path tidak ada, skip: {0}" -f $Path)
        return $true
    }

    $gitDir = Join-Path $Path '.git'
    if (-not (Test-Path -LiteralPath $gitDir)) {
        Write-Verbose ("Remove-GitMetadata: .git/ tidak ada di {0}, no-op." -f $Path)
        return $true
    }

    try {
        if ($PSCmdlet.ShouldProcess($gitDir, 'Remove .git metadata folder')) {
            Remove-Item -Recurse -Force -LiteralPath $gitDir -ErrorAction Stop
            Write-Verbose ("Remove-GitMetadata: .git/ removed dari {0}" -f $Path)
        }
        return $true
    } catch {
        Write-Warning ("Remove-GitMetadata: gagal hapus {0}: {1}" -f $gitDir, $_)
        Write-Warning ("  Fix manual: Remove-Item -Recurse -Force '{0}'" -f $gitDir)
        return $false
    }
}

# ---- Remove-MotwBlock ----
# Recursive Unblock-File untuk semua file di -Path. Best-effort.
# Return: $true kalau semua file ter-unblock (atau tidak ada file sama sekali).
#         $false kalau Unblock-File throw error fatal di top-level enumeration.
# Individual file fail = silent (Unblock-File -ErrorAction SilentlyContinue),
# konsisten dengan pattern inline di setup-pola-b.ps1.
function Remove-MotwBlock {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Verbose ("Remove-MotwBlock: Path tidak ada, skip: {0}" -f $Path)
        return $true
    }

    try {
        if ($PSCmdlet.ShouldProcess($Path, 'Unblock files recursively (remove MOTW Zone.Identifier)')) {
            Get-ChildItem -LiteralPath $Path -Recurse -File -ErrorAction SilentlyContinue |
                Unblock-File -ErrorAction SilentlyContinue
            Write-Verbose ("Remove-MotwBlock: MOTW di-unblock untuk semua file di {0}" -f $Path)
        }
        return $true
    } catch {
        Write-Warning ("Remove-MotwBlock: Unblock-File gagal di {0}: {1}" -f $Path, $_)
        Write-Warning "  Script tetap bisa lanjut, tapi mungkin perlu Unblock-File manual."
        return $false
    }
}
