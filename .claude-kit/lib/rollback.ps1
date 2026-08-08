#Requires -Version 5.1
Set-StrictMode -Version Latest
# NOTE: ErrorActionPreference sengaja TIDAK di-set 'Stop' di scope file ini, supaya
# rollback bisa graceful no-op kalau manifest tidak ada / tidak ada file backup.
# Critical calls pakai -ErrorAction Stop per-call, dibungkus try/catch lokal.

function Find-ManifestPath {
    param([Parameter(Mandatory=$true)][string]$ProjectRoot)
    # Probe 3 lokasi kandidat - setup-pola-b.ps1 bisa naruh manifest di project-root
    # ATAU di .claude-kit/ tergantung mode setup. Cek semua sebelum nyerah.
    $candidates = @(
        (Join-Path $ProjectRoot '.install-manifest.json'),
        (Join-Path $ProjectRoot '.claude-kit\.install-manifest.json'),
        (Join-Path $ProjectRoot '.claude-kit\install-manifest.json')
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

function Get-FileSha256 {
    param([Parameter(Mandatory=$true)][string]$Path)
    $hash = Get-FileHash -Path $Path -Algorithm SHA256
    return $hash.Hash.ToLowerInvariant()
}

# R5 (audit 2026-06-23): cek BENTUK-path saja - murni string/aritmetika path (~0 biaya, TAK sentuh
# disk): tolak null/kosong, absolute (drive-letter/UNC/leading-sep), parent-traversal '..', dan path
# yang keluar dari root. DIPISAH dari cek reparse-point (junction/symlink) yang mahal (sentuh disk)
# supaya bisa dipakai di SIMULASI/dry-run untuk pratinjau JUJUR ("would BLOCK") tanpa biaya cek disk.
# Cermin isRollbackPathShapeSafe (lib/rollback.mjs). Return $true kalau BENTUK aman.
function Test-LintasRollbackPathShapeSafe {
    param(
        [Parameter(Mandatory=$true)][string]$Root,
        [Parameter(Mandatory=$true)][AllowEmptyString()][string]$RelPath
    )
    if ([string]::IsNullOrWhiteSpace($RelPath)) { return $false }
    # Tolak absolute (drive-letter C:\, UNC \\, leading separator).
    if ([System.IO.Path]::IsPathRooted($RelPath) -or $RelPath -match '^[a-zA-Z]:' -or $RelPath -match '^[\\/]') { return $false }
    # Tolak parent-traversal segment.
    if ($RelPath -match '(^|[\\/])\.\.([\\/]|$)') { return $false }
    try {
        $rootFull = [System.IO.Path]::GetFullPath($Root)
        if (-not $rootFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
            $rootFull += [System.IO.Path]::DirectorySeparatorChar
        }
        $candidate = Join-Path $Root ($RelPath -replace '/', '\')
        $full = [System.IO.Path]::GetFullPath($candidate)
    } catch { return $false }
    # Containment: resolved path WAJIB di dalam root (prefix-with-separator, case-insensitive).
    if (-not $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) { return $false }
    return $true
}

# Guard path-traversal + reparse-point untuk entry manifest sebelum restore (overwrite).
# Mirror logika lib/safety.ps1 (Resolve-SafeProjectPath + Test-PathHasReparsePoint) tapi
# SELF-CONTAINED supaya tidak bentrok dgn Get-FileSha256 lokal di file ini. Manifest = untrusted:
# tolak path absolute / '..' / escape root / reparse-point (junction/symlink redirect).
# Return $true kalau aman di-restore, $false kalau harus di-BLOCK.
function Test-LintasRollbackPathSafe {
    param(
        [Parameter(Mandatory=$true)][string]$Root,
        [Parameter(Mandatory=$true)][AllowEmptyString()][string]$RelPath
    )
    # Tahap 1: cek BENTUK-path (murah, ~0 biaya). Gagal di sini -> langsung BLOCK.
    if (-not (Test-LintasRollbackPathShapeSafe -Root $Root -RelPath $RelPath)) { return $false }
    # Tahap 2: cek reparse-point (junction/symlink) di target ATAU parent manapun = redirect risk
    # (MAHAL - sentuh disk). Hanya dijalankan kalau BENTUK sudah lolos.
    try {
        $rootFull = [System.IO.Path]::GetFullPath($Root)
        if (-not $rootFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
            $rootFull += [System.IO.Path]::DirectorySeparatorChar
        }
        $candidate = Join-Path $Root ($RelPath -replace '/', '\')
        $full = [System.IO.Path]::GetFullPath($candidate)
    } catch { return $false }
    $rootClean = $rootFull.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
    $cursor = $full
    while ($cursor -and $cursor.Length -ge $rootClean.Length) {
        if (Test-Path -LiteralPath $cursor) {
            try {
                $item = Get-Item -Force -LiteralPath $cursor -ErrorAction Stop
                if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { return $false }
            } catch { return $false }
        }
        $parent = Split-Path -Parent $cursor
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
    return $true
}

function Read-ManifestJson {
    param([Parameter(Mandatory=$true)][string]$Path)
    $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    return (ConvertFrom-Json -InputObject $raw)
}

function Write-ManifestJson {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)]$Manifest
    )
    $json = ConvertTo-Json -InputObject $Manifest -Depth 12
    $tmp  = "$Path.tmp"
    [System.IO.File]::WriteAllText($tmp, $json, `
        (New-Object System.Text.UTF8Encoding($false)))
    Move-Item -Path $tmp -Destination $Path -Force
}

function Get-LintasBackupCandidate {
    # Kembalikan SEMUA file backup untuk satu OriginalPath, cocokkan DUA konvensi
    # nama yang dipakai kit:
    #   1. "<leaf>.bak.<timestamp>"     -> backup rutin merge JSON (lib/json-merge-helpers.ps1)
    #   2. "<leaf>.backup-<timestamp>"  -> backup deploy template (lib/agents-md.ps1,
    #                                      lib/template-deploy.ps1) -- ini yang dipakai
    #                                      mayoritas file ter-track (AGENTS.md, docs/, dst.)
    # BUG v1.5.13: dulu cuma cocokkan pola #1, jadi rollback tidak pernah menemukan
    # backup deploy (#2) dan diam-diam jadi no-op setelah update. Fix: cocokkan keduanya.
    # Snapshot ".malformed.bak.<ts>" (copy file JSON korup) sengaja DIKECUALIKAN --
    # itu bukan backup sehat untuk di-restore.
    param(
        [Parameter(Mandatory=$true)][string]$OriginalPath
    )
    $dir  = Split-Path -Parent $OriginalPath
    $leaf = Split-Path -Leaf   $OriginalPath
    if (-not (Test-Path $dir)) { return @() }
    $found = @()
    foreach ($pat in @("$leaf.bak.*", "$leaf.backup-*")) {
        $found += Get-ChildItem -Path $dir -Filter $pat -File -ErrorAction SilentlyContinue
    }
    $seen = @{}
    $unique = @()
    foreach ($f in $found) {
        if ($seen.ContainsKey($f.FullName)) { continue }
        $seen[$f.FullName] = $true
        if ($f.Name -like "$leaf.malformed.bak.*") { continue }
        $unique += $f
    }
    return @($unique)
}

function Find-LatestBackup {
    param(
        [Parameter(Mandatory=$true)][string]$OriginalPath
    )
    # Bungkus @() di sisi pemanggil: PowerShell membongkar array 1-elemen saat
    # return, jadi tanpa @() di sini, .Count bisa gagal di StrictMode saat cuma
    # ada 1 backup.
    $candidates = @(Get-LintasBackupCandidate -OriginalPath $OriginalPath)
    if ($candidates.Count -eq 0) { return $null }
    # "Terbaru" = LastWriteTime descending. Pakai waktu file (bukan urut nama)
    # karena dua konvensi nama (".bak." vs ".backup-") tidak sebanding secara
    # leksikal. Tie-break: Name descending supaya deterministik.
    $sorted = @($candidates | Sort-Object `
        -Property @{ Expression = 'LastWriteTime'; Descending = $true }, `
                  @{ Expression = 'Name'; Descending = $true })
    return $sorted[0].FullName
}

function Get-RollbackPopupHelper {
    # Locate popup-helpers.ps1 sibling kit lib/. Cek 2 lokasi (rollback.ps1
    # parent = kit lib/) lalu fallback ke .claude-kit/lib/ kalau dot-source dari
    # luar (mis. langsung lewat global path). Return $true kalau berhasil
    # dot-source (Show-LintasYesNoPopup + Test-LintasGuiAvailable available),
    # $false kalau tidak (caller fall back ke console prompt).
    if (Get-Command -Name 'Show-LintasYesNoPopup' -ErrorAction SilentlyContinue) {
        return $true
    }
    $candidates = @(
        (Join-Path $PSScriptRoot 'popup-helpers.ps1'),
        (Join-Path (Get-Location).Path '.claude-kit\lib\popup-helpers.ps1')
    )
    foreach ($p in $candidates) {
        if (Test-Path -LiteralPath $p) {
            try {
                . $p
                if (Get-Command -Name 'Show-LintasYesNoPopup' -ErrorAction SilentlyContinue) {
                    return $true
                }
            } catch {
                # Continue probing next candidate; log warn but don't crash rollback.
                Write-Warning ("[AUDIT] Rollback: gagal load popup-helpers.ps1 ({0}): {1}" -f $p, $_.Exception.Message)
            }
        }
    }
    return $false
}

function Format-RollbackPlanSummary {
    # Compose human-readable summary of destructive scope: count of files to
    # restore + sample names (max 5) untuk dipakai di popup Message body. Plan
    # entries punya .Original (path) + .Backup ($null kalau no backup → skip).
    param(
        [Parameter(Mandatory=$true)]$Plan,
        [Parameter(Mandatory=$true)][string]$ProjectRoot
    )
    $haveBackup = @($Plan | Where-Object { $null -ne $_.Backup })
    $count = $haveBackup.Count
    if ($count -eq 0) {
        return "Tidak ada file dengan backup yang bisa di-restore."
    }
    $sampleCount = [Math]::Min(5, $count)
    $samples = $haveBackup | Select-Object -First $sampleCount | ForEach-Object {
        $rel = $_.Original
        if ($rel.StartsWith($ProjectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            $rel = $rel.Substring($ProjectRoot.Length).TrimStart('\','/')
        }
        "  - $rel"
    }
    $sampleBlock = ($samples -join "`n")
    $more = ''
    if ($count -gt $sampleCount) {
        $more = "`n  ... dan " + ($count - $sampleCount) + " file lain"
    }
    return "Akan restore $count file dari backup (.bak.<ts> / .backup-<ts>):`n$sampleBlock$more`n`nFile yang sekarang ada di project akan DITIMPA dengan versi backup. Lanjut?"
}

function Confirm-Rollback {
    # Destructive consent gate. -Force bypass (CI / scripted). Default = 'No'
    # (safe) di SEMUA jalur:
    #   - GUI popup (Show-LintasYesNoPopup) : outcome "No" kalau X / Escape / Cancel.
    #   - Console Read-Host                 : default 'n', parse non-Y.
    #   - NonInteractive (no console)       : default 'n' via catch block.
    # Read-Host -> Show-LintasYesNoPopup migration: ganti modal prompt teks yang
    # gampang ke-skip Enter dengan GUI popup berisi count + sample names supaya
    # user paham scope sebelum confirm. Console fallback DIPRESERVE untuk
    # headless / -NoGui / SSH / Server Core / CI sesi.
    param(
        [switch]$Force,
        $Plan,
        [string]$ProjectRoot
    )
    if ($Force) { return $true }

    # Compose popup message body (count + sample names). Kalau Plan tidak di-pass
    # (caller lama), fallback ke pesan generic supaya backward-compatible.
    $msgBody = 'Lanjut rollback? File yang sekarang ada di project akan DITIMPA dengan versi backup.'
    if ($null -ne $Plan -and $Plan.Count -gt 0 -and $ProjectRoot) {
        $msgBody = Format-RollbackPlanSummary -Plan $Plan -ProjectRoot $ProjectRoot
    }

    $popupAvailable = Get-RollbackPopupHelper
    if ($popupAvailable -and (Test-LintasGuiAvailable)) {
        try {
            $answer = Show-LintasYesNoPopup `
                -Title 'Konfirmasi: Rollback kit ke snapshot backup' `
                -Message $msgBody
            # Show-LintasYesNoPopup return "Yes"/"No". X / Escape / Cancel -> "No"
            # (default-safe untuk destructive ops).
            return ($answer -eq 'Yes')
        } catch {
            # Popup gagal mid-execution (assemblies hilang, desktop hilang) ->
            # fallback console. JANGAN auto-proceed (security: silent yes-default
            # di destructive op = data loss risk).
            Write-Host ("INFO: Popup gagal ({0}). Fallback ke console prompt." -f $_.Exception.Message) -ForegroundColor Yellow
        }
    }

    # Console fallback: tetap default 'n' supaya Enter-skip = abort (safe).
    $c = 'n'
    try {
        Write-Host ''
        Write-Host 'Lanjut rollback? File yang sekarang ada di project akan DITIMPA dari snapshot backup.' -ForegroundColor Yellow
        Write-Host 'Pilihan: [1] Yes, rollback sekarang / [2] No, batal (default, safe choice)'
        Write-Host 'Default (Enter/kosong) -> [2] No, batal rollback'
        $c = Read-Host 'Pilih [1] / [2]'
        if ([string]::IsNullOrWhiteSpace($c) -or $c -eq '2') {
            $c = 'n'
        } elseif ($c -eq '1') {
            $c = 'y'
        } else {
            $c = 'n'
        }
    } catch {
        # NonInteractive shell (no console). Default abort.
        Write-Host 'INFO: NonInteractive shell. Pakai -Force untuk bypass rollback prompt.' -ForegroundColor Yellow
        $c = 'n'
    }
    if ($null -eq $c) { return $false }
    $cn = $c.Trim().ToLowerInvariant()
    return ($cn -eq 'y' -or $cn -eq 'yes')
}

function ConvertTo-RollbackHashtableDeep {
    # Deep-convert PSCustomObject (dari ConvertFrom-Json) ke nested hashtable supaya
    # signature verification (Test-ManifestSignature) bisa jalan dengan hash identik.
    param($Object)
    if ($null -eq $Object) { return $null }
    if ($Object -is [System.Collections.IDictionary]) {
        $ht = [ordered]@{}
        foreach ($k in $Object.Keys) { $ht[$k] = ConvertTo-RollbackHashtableDeep -Object $Object[$k] }
        return $ht
    }
    if ($Object -is [System.Management.Automation.PSCustomObject]) {
        $ht = [ordered]@{}
        foreach ($prop in $Object.PSObject.Properties) {
            $ht[$prop.Name] = ConvertTo-RollbackHashtableDeep -Object $prop.Value
        }
        return $ht
    }
    if ($Object -is [System.Collections.IEnumerable] -and -not ($Object -is [string])) {
        $arr = @()
        foreach ($item in $Object) { $arr += ,(ConvertTo-RollbackHashtableDeep -Object $item) }
        return ,$arr
    }
    return $Object
}

function Test-GitDirty {
    param([Parameter(Mandatory=$true)][string]$Root)
    try {
        $out = & git -C $Root status --porcelain 2>$null
        if ($LASTEXITCODE -ne 0) { return $false }
        if ([string]::IsNullOrWhiteSpace($out)) { return $false }
        return $true
    } catch {
        return $false
    }
}

function Invoke-Rollback {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-Location).Path,
        # -Force : bypass interactive confirm prompt + bypass UNSIGNED-manifest prompt
        #          (legacy compat untuk manifest dari kit lama yang belum punya HMAC).
        #          TIDAK bypass INVALID-signature (tampered manifest) — itu pakai
        #          -AcceptUntrustedManifest yang explicit dangerous opt-in.
        [switch]$Force,
        # -AcceptUntrustedManifest : explicit opt-in untuk proceed walau manifest
        #          signature INVALID (mungkin di-tamper). DANGEROUS — cuma dipakai
        #          kalau user yakin manifest legit tapi signature broken karena
        #          version skew / clock skew / manual edit yang sah.
        [switch]$AcceptUntrustedManifest,
        [switch]$DryRun
    )

    try {
        $root = (Resolve-Path -Path $ProjectRoot -ErrorAction Stop).Path
    } catch {
        Write-Host ("[INFO] ProjectRoot tidak valid: {0}. Tidak ada yang di-rollback." -f $ProjectRoot)
        return @{ status = 'no-project-root'; restored = 0; skipped = 0 }
    }

    $manifestPath = Find-ManifestPath -ProjectRoot $root
    if (-not $manifestPath) {
        Write-Host '[INFO] Tidak ada manifest. Belum pernah install atau setup belum jalan. Tidak ada yang di-rollback.'
        return @{ status = 'no-manifest'; restored = 0; skipped = 0 }
    }

    if (Test-GitDirty -Root $root) {
        Write-Warning ("Working tree git dirty di {0}. " + `
            "Pertimbangkan stash/commit sebelum rollback." -f $root)
    }

    try {
        $manifest = Read-ManifestJson -Path $manifestPath
    } catch {
        Write-Host ("[ERROR] Gagal parse manifest {0}: {1}" -f $manifestPath, $_.Exception.Message)
        return @{ status = 'manifest-parse-error'; restored = 0; skipped = 0 }
    }

    $hasFilesProp = $false
    if ($manifest -and $manifest.PSObject -and $manifest.PSObject.Properties) {
        $hasFilesProp = (@($manifest.PSObject.Properties.Name) -contains 'files')
    }
    if (-not $hasFilesProp) {
        Write-Host "[INFO] Manifest tidak punya properti 'files'. Tidak ada yang di-rollback."
        return @{ status = 'manifest-no-files'; restored = 0; skipped = 0 }
    }

    # ---- Verify manifest HMAC signature (prevent tampering) ----
    # Rollback = restore file dari .bak ke path arbitrary di project root → kalau
    # manifest di-tamper, attacker bisa overwrite file kritis project user. WAJIB
    # verify signature sebelum trust entries.
    #
    # Threat model:
    #   - UNSIGNED manifest    : legacy / kit lama → prompt user, -Force bypass.
    #   - INVALID signature    : kemungkinan tampered → ABORT default,
    #                            -AcceptUntrustedManifest bypass (explicit opt-in).
    #   - Verifier crash/error : fail-secure → set $verificationErrored=$true + exit 1.
    #                            JANGAN legacy fallback (security risk).
    $kitDirForSigning = Split-Path -Parent $manifestPath
    # Manifest bisa di $root/.install-manifest.json (project-root mode) atau
    # $root/.claude-kit/.install-manifest.json (kit-subfolder mode). lib/manifest-signing.ps1
    # selalu di $kitDir/lib/ — fallback ke project-root\.claude-kit\lib kalau parent
    # manifest bukan folder kit.
    $signingLib = Join-Path $kitDirForSigning 'lib\manifest-signing.ps1'
    if (-not (Test-Path -LiteralPath $signingLib)) {
        $signingLib = Join-Path $root '.claude-kit\lib\manifest-signing.ps1'
    }
    $signingLibOk = $false
    if (Test-Path -LiteralPath $signingLib) {
        try {
            . $signingLib
            $signingLibOk = $true
        } catch {
            Write-Warning ("[AUDIT] Rollback: gagal load manifest-signing.ps1 ({0}): {1}" -f $signingLib, $_.Exception.Message)
        }
    } else {
        Write-Warning "[AUDIT] Rollback: lib/manifest-signing.ps1 tidak ditemukan — signature verification di-skip."
    }

    # Lacak apakah manifest MEMANG bertanda-tangan, supaya bisa ditandatangani ULANG
    # setelah rollback mengubah sha256 (lihat blok re-sign sebelum Write-ManifestJson).
    $manifestWasSigned = $false

    if ($signingLibOk) {
        $expectedSig = $null
        if ($manifest.PSObject.Properties.Name -contains 'metadata' -and `
            $manifest.metadata -and `
            $manifest.metadata.PSObject.Properties.Name -contains 'signature' -and `
            $manifest.metadata.signature) {
            $expectedSig = [string]$manifest.metadata.signature
        }

        if (-not $expectedSig) {
            # ---- UNSIGNED manifest (kit versi lama / install pre-HMAC) ----
            Write-Warning "[AUDIT] Rollback: manifest UNSIGNED (kit versi lama / install pre-HMAC) di $manifestPath."
            if (-not $Force) {
                $unsignedChoice = 'n'
                $unsignedPopupAvailable = Get-RollbackPopupHelper
                $unsignedHandledViaPopup = $false
                if ($unsignedPopupAvailable -and (Test-LintasGuiAvailable)) {
                    try {
                        $unsignedAnswer = Show-LintasYesNoPopup `
                            -Title 'PERINGATAN KEAMANAN: Manifest UNSIGNED (legacy/pre-HMAC)' `
                            -Message ("Manifest backup tidak punya signature HMAC - tidak ada cara verify integrity.`n`n" + `
                                      "RESIKO: kalau file backup ter-tamper, rollback bisa restore versi malicious.`n`n" + `
                                      "Pilihan: [1] Yes, lanjut rollback walaupun unsigned / [2] No, batal (default, safe choice)`n`n" + `
                                      "Kalau ragu, pilih [2] No lalu re-install kit terbaru dari source resmi.")
                        if ($unsignedAnswer -eq 'Yes') { $unsignedChoice = 'y' } else { $unsignedChoice = 'n' }
                        $unsignedHandledViaPopup = $true
                    } catch {
                        Write-Host ("INFO: Popup gagal ({0}). Fallback ke console prompt." -f $_.Exception.Message) -ForegroundColor Yellow
                    }
                }
                if (-not $unsignedHandledViaPopup) {
                    try {
                        Write-Host ''
                        Write-Host 'Lanjut rollback dengan manifest UNSIGNED?' -ForegroundColor Yellow
                        Write-Host 'Pilihan: [1] Yes / [2] No (default, safe choice)'
                        Write-Host 'Default (Enter/kosong) -> [2] No'
                        $unsignedRaw = Read-Host 'Pilih [1] / [2]'
                        if ([string]::IsNullOrWhiteSpace($unsignedRaw) -or $unsignedRaw -eq '2') {
                            $unsignedChoice = 'n'
                        } elseif ($unsignedRaw -eq '1') {
                            $unsignedChoice = 'y'
                        } else {
                            $unsignedChoice = 'n'
                        }
                    } catch {
                        Write-Host 'INFO: NonInteractive shell. Pakai -Force untuk bypass unsigned-manifest prompt.' -ForegroundColor Yellow
                        $unsignedChoice = 'n'
                    }
                }
                if ($unsignedChoice -notmatch '^[Yy]') {
                    Write-Warning '[AUDIT] Rollback aborted: unsigned manifest (user declined).'
                    return @{ status = 'manifest-unsigned-aborted'; restored = 0; skipped = 0 }
                }
            } else {
                Write-Warning '[AUDIT] Rollback: -Force di-set -> bypass unsigned-manifest prompt (legacy compat).'
            }
        } else {
            # ---- SIGNED manifest → verify HMAC ----
            $manifestWasSigned = $true
            $verificationErrored = $false
            try {
                $manifestCopy = ConvertTo-RollbackHashtableDeep -Object $manifest
                if ($manifestCopy.metadata -is [System.Collections.IDictionary]) {
                    $null = $manifestCopy.metadata.Remove('signature')
                }
                $kitVerForVerify = ''
                if ($manifest.metadata -and $manifest.metadata.PSObject.Properties.Name -contains 'kit_version' -and $manifest.metadata.kit_version) {
                    $kitVerForVerify = [string]$manifest.metadata.kit_version
                } elseif ($manifest.PSObject.Properties.Name -contains 'kit_version' -and $manifest.kit_version) {
                    $kitVerForVerify = [string]$manifest.kit_version
                }
                $valid = Test-ManifestSignature -Manifest $manifestCopy -KitVersion $kitVerForVerify -ExpectedSignature $expectedSig
                if (-not $valid) {
                    Write-Warning "[AUDIT] Rollback: manifest signature INVALID di $manifestPath — mungkin di-tamper."
                    if (-not $AcceptUntrustedManifest) {
                        Write-Host '[ABORT] Rollback dibatalkan: signature INVALID.' -ForegroundColor Red
                        Write-Host '        Pakai -AcceptUntrustedManifest kalau yakin manifest legit (DANGEROUS).' -ForegroundColor Red
                        return @{ status = 'manifest-signature-invalid'; restored = 0; skipped = 0 }
                    }
                    Write-Warning '[AUDIT] Rollback: -AcceptUntrustedManifest di-set → proceed dengan signature INVALID (explicit opt-in).'
                }
            } catch {
                # FAIL-SECURE: verifier crash → JANGAN legacy fallback (silent proceed
                # = security risk kalau attacker bisa trigger crash untuk skip verify).
                # Sebagai gantinya, set flag + exit 1.
                $verificationErrored = $true
                Write-Warning ("[AUDIT] Rollback: signature verification ERRORED ({0}): {1}" -f $manifestPath, $_.Exception.Message)
                Write-Host '[ABORT] Rollback dibatalkan: signature verification gagal jalan (fail-secure).' -ForegroundColor Red
                Write-Host '        Investigate lib/manifest-signing.ps1 sebelum retry.' -ForegroundColor Red
                exit 1
            }
            # Defensive: kalau ada path yang lupa exit, tetap honor flag.
            if ($verificationErrored) { exit 1 }
        }
    }

    # Pre-scan: ada minimal 1 file backup (.bak.<ts> ATAU .backup-<ts>) yang
    # nyambung ke manifest entry? Kalau zero → fresh install belum pernah di-update,
    # return graceful no-op.
    $hasAnyBak = $false
    foreach ($entry in $manifest.files) {
        $absOrig = Join-Path $root $entry.path
        if (@(Get-LintasBackupCandidate -OriginalPath $absOrig).Count -gt 0) {
            $hasAnyBak = $true
            break
        }
    }
    if (-not $hasAnyBak) {
        Write-Host '[OK] Manifest ada tapi tidak ada file backup (.bak.<ts> / .backup-<ts>). Tidak ada yang di-rollback (fresh install belum di-update).'
        return @{ status = 'no-backups'; restored = 0; skipped = 0 }
    }

    $plan = New-Object System.Collections.ArrayList
    foreach ($entry in $manifest.files) {
        $orig = Join-Path $root $entry.path
        $bak  = Find-LatestBackup -OriginalPath $orig
        $null = $plan.Add([pscustomobject]@{
            Entry    = $entry
            Original = $orig
            Backup   = $bak
        })
    }

    if ($DryRun) {
        # R5 (audit 2026-06-23): jalankan juga cek BENTUK-path (murni, ~0 biaya) supaya pratinjau JUJUR
        # menandai entri yang akan DIBLOKIR saat run nyata - bukan menjanjikan "would restore" untuk
        # berkas yang nanti di-skip. Cek junction/symlink LENGKAP (mahal) tetap hanya di run nyata (--Yes).
        $wouldBlock = 0
        foreach ($p in $plan) {
            if ($null -eq $p.Backup) {
                Write-Host ("skip (no backup): {0}" -f $p.Original)
                continue
            }
            $relForShape = if ($null -eq $p.Entry.path) { '' } else { [string]$p.Entry.path }
            if (-not (Test-LintasRollbackPathShapeSafe -Root $root -RelPath $relForShape)) {
                Write-Host ("would BLOCK (path tidak aman: absolut/'..'/keluar-root): {0}" -f $p.Original) -ForegroundColor Red
                $wouldBlock++
                continue
            }
            Write-Host ("would restore: {0} <- {1}" -f $p.Original, $p.Backup)
        }
        if ($wouldBlock -gt 0) {
            Write-Host ("Catatan: {0} entri akan DIBLOKIR demi keamanan. Cek junction/symlink LENGKAP baru jalan saat rollback sungguhan." -f $wouldBlock) -ForegroundColor Yellow
        }
        return [pscustomobject]@{
            dryRun     = $true
            restored   = 0
            skipped    = ($plan | Where-Object { $null -eq $_.Backup }).Count
            wouldBlock = $wouldBlock
            items      = $plan
        }
    }

    if (-not (Confirm-Rollback -Force:$Force -Plan $plan -ProjectRoot $root)) {
        Write-Host 'Dibatalkan.'
        return [pscustomobject]@{
            cancelled = $true
            restored  = 0
            skipped   = $plan.Count
            items     = @()
        }
    }

    $restored = 0
    $skipped  = 0
    $items    = New-Object System.Collections.ArrayList

    foreach ($p in $plan) {
        if ($null -eq $p.Backup) {
            $skipped++
            $null = $items.Add([pscustomobject]@{
                path    = $p.Entry.path
                action  = 'skip'
                reason  = 'no-backup'
            })
            continue
        }
        # SECURITY: validasi path entry manifest (untrusted) sebelum overwrite.
        # Cegah path-traversal ('..') / absolute / reparse-point yang bisa nulis DI LUAR project root.
        if (-not (Test-LintasRollbackPathSafe -Root $root -RelPath $p.Entry.path)) {
            Write-Host ("BLOCKED (path tidak aman, di-skip demi keamanan): {0}" -f $p.Entry.path) -ForegroundColor Red
            $skipped++
            $null = $items.Add([pscustomobject]@{
                path   = $p.Entry.path
                action = 'blocked'
                reason = 'unsafe-path'
            })
            continue
        }
        Copy-Item -Path $p.Backup -Destination $p.Original -Force
        $newHash = Get-FileSha256 -Path $p.Original
        # Update manifest entry in place.
        if ($p.Entry.PSObject.Properties.Name -contains 'sha256') {
            $p.Entry.sha256 = $newHash
        } else {
            $p.Entry | Add-Member -NotePropertyName 'sha256' `
                -NotePropertyValue $newHash -Force
        }
        if ($p.Entry.PSObject.Properties.Name -contains 'rolledBackAt') {
            $p.Entry.rolledBackAt = (Get-Date).ToString('o')
        } else {
            $p.Entry | Add-Member -NotePropertyName 'rolledBackAt' `
                -NotePropertyValue ((Get-Date).ToString('o')) -Force
        }
        $restored++
        $null = $items.Add([pscustomobject]@{
            path    = $p.Entry.path
            action  = 'restore'
            backup  = $p.Backup
            sha256  = $newHash
        })
    }

    # ---- Tandatangani ULANG manifest setelah sha256 berubah (perbaikan REL/SEC) ----
    # Restore tadi memperbarui entry.sha256 (di atas). Tanda-tangan HMAC lama dihitung
    # atas sha256 LAMA → sekarang BASI. Tanpa re-sign: rollback BERIKUTNYA atau
    # `kit.ps1 doctor` akan menilai manifest "INVALID / di-tamper" padahal rollback
    # sendiri yang mengubahnya — alarm palsu yang justru mendorong user memakai
    # -AcceptUntrustedManifest (melemahkan pengaman). Hanya re-sign kalau manifest
    # MEMANG bertanda-tangan + ada perubahan nyata (restored > 0). Mirror cara sign
    # asli (lib/manifest.ps1:249): hitung HMAC atas manifest TANPA field signature.
    if ($manifestWasSigned -and $restored -gt 0) {
        try {
            $reSignable = ConvertTo-RollbackHashtableDeep -Object $manifest
            if ($reSignable.metadata -is [System.Collections.IDictionary]) {
                $null = $reSignable.metadata.Remove('signature')
            }
            $newSig = New-ManifestSignature -Manifest $reSignable -KitVersion $kitVerForVerify
            $manifest.metadata.signature = $newSig
        } catch {
            # Re-sign gagal → JANGAN tinggalkan tanda-tangan BASI (itu sumber false-tamper).
            # Hapus signature lama supaya manifest jadi UNSIGNED yang konsisten ("tak
            # bertanda" lebih aman daripada "bertanda tapi salah").
            Write-Warning ("[AUDIT] Rollback: gagal tandatangani ulang manifest ({0}). Tanda-tangan lama dihapus agar tidak memicu alarm 'di-tamper' palsu." -f $_.Exception.Message)
            # R3 (audit 2026-06-23): petunjuk pemulihan AWAM - berkas SUDAH dipulihkan dengan aman;
            # hanya 'segel' catatan yang gagal diperbarui, dan segel bisa dipulihkan tanpa melemahkan
            # pengaman. Cegah staff terbiasa pakai -Force sebagai jalan pintas (itu melemahkan pengaman).
            Write-Warning "[PENTING] Berkas SUDAH dipulihkan dengan aman; hanya 'segel' catatan yang gagal diperbarui."
            Write-Warning "          Pulihkan segel: jalankan 'npx lintasai init' (atau '.\.claude-kit\kit.ps1 doctor')."
            Write-Warning "          JANGAN biasakan pakai -Force / -AcceptUntrustedManifest sebagai jalan pintas (itu melemahkan pengaman)."
            try {
                if ($manifest.metadata -and ($manifest.metadata.PSObject.Properties.Name -contains 'signature')) {
                    $manifest.metadata.PSObject.Properties.Remove('signature')
                }
            } catch {
                Write-Warning ("[AUDIT] Rollback: gagal menghapus tanda-tangan basi: {0}" -f $_.Exception.Message)
            }
        }
    }

    Write-ManifestJson -Path $manifestPath -Manifest $manifest

    return [pscustomobject]@{
        restored = $restored
        skipped  = $skipped
        items    = $items
    }
}

function Get-RollbackPreview {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-Location).Path
    )
    return (Invoke-Rollback -ProjectRoot $ProjectRoot -DryRun)
}

# Functions auto-exposed via dot-source (no Export-ModuleMember karena .ps1 di-load via `. $path`)
