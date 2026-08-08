#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Manifest HMAC signing untuk prevent tampering attack.
.DESCRIPTION
  Sign .install-manifest.json dengan HMAC-SHA256 atas JSON KANONIK (penyusun baku:
  urut-abjad kunci + escape standar). Verify signature sebelum trust manifest entries.

  HMAC = anti-EDIT detection (manifest tidak diam-diam dimodifikasi),
  BUKAN forge-proof secret. Pakai detached signature kalau perlu real secret.

  PEMBAKUAN 2026-06-22 (ADR-004 / Gelombang 1 migrasi PS->Node): dulu tanda-tangan dihitung atas
  `ConvertTo-Json -Compress` yang urutan kuncinya = urutan-acak-internal .NET Hashtable -- TAK bisa
  ditiru Node. Sekarang pakai ConvertTo-LintasCanonicalJson (urut-abjad) yang DETERMINISTIK +
  byte-identik dengan lib/manifest-signing.mjs. Test-ManifestSignature punya CADANGAN baca segel
  format-lama supaya manifest lama yang masih utuh tidak salah dikira "dirusak" saat transisi.
#>

# =============================================================================
# Penyusun baku (canonical JSON) - urut-abjad kunci + escape standar + tanpa spasi.
# WAJIB byte-identik dengan canonicalize() di lib/manifest-signing.mjs (terbukti uji-banding).
# Escape: hanya " \ dan karakter kontrol (<0x20); non-ASCII & < > ' dibiarkan apa adanya.
# =============================================================================
function ConvertTo-LintasCanonicalJson {
    param($Value)
    $sb = [System.Text.StringBuilder]::new()
    Write-LintasCanonValue -V $Value -Sb $sb
    return $sb.ToString()
}
function Write-LintasCanonString {
    param([string]$S, $Sb)
    [void]$Sb.Append('"')
    foreach ($ch in $S.ToCharArray()) {
        $code = [int][char]$ch
        if     ($ch -ceq '"')  { [void]$Sb.Append('\"') }
        elseif ($ch -ceq '\')  { [void]$Sb.Append('\\') }
        elseif ($code -eq 8)   { [void]$Sb.Append('\b') }
        elseif ($code -eq 9)   { [void]$Sb.Append('\t') }
        elseif ($code -eq 10)  { [void]$Sb.Append('\n') }
        elseif ($code -eq 12)  { [void]$Sb.Append('\f') }
        elseif ($code -eq 13)  { [void]$Sb.Append('\r') }
        elseif ($code -lt 32)  { [void]$Sb.Append('\u' + $code.ToString('x4')) }
        else                   { [void]$Sb.Append($ch) }
    }
    [void]$Sb.Append('"')
}
function Write-LintasCanonValue {
    param($V, $Sb)
    if ($null -eq $V) { [void]$Sb.Append('null'); return }
    if ($V -is [bool]) { [void]$Sb.Append($(if ($V) { 'true' } else { 'false' })); return }
    if ($V -is [string]) { Write-LintasCanonString -S $V -Sb $Sb; return }
    if ($V -is [int] -or $V -is [long] -or $V -is [double] -or $V -is [decimal] -or $V -is [single] -or $V -is [byte] -or $V -is [int16]) {
        [void]$Sb.Append([string]::Format([System.Globalization.CultureInfo]::InvariantCulture, '{0}', $V)); return
    }
    if ($V -is [System.Collections.IDictionary]) {
        $keys = [string[]]@($V.Keys | ForEach-Object { [string]$_ })
        [Array]::Sort($keys, [System.StringComparer]::Ordinal)
        [void]$Sb.Append('{'); $first = $true
        foreach ($k in $keys) { if (-not $first) { [void]$Sb.Append(',') }; $first = $false; Write-LintasCanonString -S $k -Sb $Sb; [void]$Sb.Append(':'); Write-LintasCanonValue -V $V[$k] -Sb $Sb }
        [void]$Sb.Append('}'); return
    }
    if ($V -is [System.Management.Automation.PSCustomObject]) {
        $keys = [string[]]@($V.PSObject.Properties | ForEach-Object { [string]$_.Name })
        [Array]::Sort($keys, [System.StringComparer]::Ordinal)
        [void]$Sb.Append('{'); $first = $true
        foreach ($k in $keys) { if (-not $first) { [void]$Sb.Append(',') }; $first = $false; Write-LintasCanonString -S $k -Sb $Sb; [void]$Sb.Append(':'); Write-LintasCanonValue -V $V.$k -Sb $Sb }
        [void]$Sb.Append('}'); return
    }
    if ($V -is [System.Collections.IEnumerable]) {
        [void]$Sb.Append('['); $first = $true
        foreach ($item in $V) { if (-not $first) { [void]$Sb.Append(',') }; $first = $false; Write-LintasCanonValue -V $item -Sb $Sb }
        [void]$Sb.Append(']'); return
    }
    Write-LintasCanonString -S ([string]$V) -Sb $Sb
}

function Get-OrCreateLocalSecret {
    <#
    .SYNOPSIS
      Get-or-create per-install random secret di .manifest-secret.
    .DESCRIPTION
      Generate 32 byte cryptographically-secure random pakai RandomNumberGenerator,
      persist ke <kit-root>/.manifest-secret (gitignored). Same install = same secret
      = signature stable across runs di mesin yang sama.
    #>
    param([string]$KitRoot)

    if (-not $KitRoot) {
        # Resolve kit root dari lokasi script ini (lib/manifest-signing.ps1 -> ..)
        $KitRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
    }

    $secretFile = Join-Path $KitRoot '.manifest-secret'

    if (Test-Path $secretFile) {
        $existing = (Get-Content -Path $secretFile -Raw -ErrorAction Stop).Trim()
        if ($existing) { return $existing }
    }

    # Generate 32 bytes (256-bit) cryptographically-secure random
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    } finally {
        $rng.Dispose()
    }
    $secret = [Convert]::ToBase64String($bytes)

    # Persist (UTF8 no BOM, no trailing newline)
    [System.IO.File]::WriteAllText($secretFile, $secret, [System.Text.UTF8Encoding]::new($false))

    return $secret
}

function Get-ManifestSecret {
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute(
        'PSReviewUnusedParameter', 'KitVersion',
        Justification = 'Reserved for future per-version key derivation; kept for stable signature compat across callers New-ManifestSignature / Test-ManifestSignature.'
    )]
    param(
        [string]$KitVersion,
        [string]$KitRoot
    )

    if ($env:LINTASAI_MANIFEST_SECRET) {
        return $env:LINTASAI_MANIFEST_SECRET
    }

    # Tanpa kunci global, pakai kunci lokal per-install: aman, tapi segel tak bisa pindah komputer.
    Write-Warning "Catatan: kunci segel (LINTASAI_MANIFEST_SECRET) belum diatur. Memakai kunci lokal per-install di .manifest-secret (segel ini tidak bisa dipindah ke komputer lain)."

    # Per-install random secret (forge-resistant, but non-portable)
    return Get-OrCreateLocalSecret -KitRoot $KitRoot
}

function New-ManifestSignature {
    [CmdletBinding()]
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute(
        'PSUseShouldProcessForStateChangingFunctions',
        '',
        Justification = 'Pure-compute HMAC-SHA256 over canonical JSON input; tidak menulis ke filesystem/registry/env/network. Verb New- bersifat semantic (compute new signature value), bukan stateful mutation. Renaming ke Get-/ConvertTo- akan break public API yang sudah di-dot-source di update-kit.ps1 + tests.'
    )]
    param(
        [Parameter(Mandatory)][hashtable]$Manifest,
        [Parameter(Mandatory)][string]$KitVersion,
        [string]$KitRoot
    )

    $secret = Get-ManifestSecret -KitVersion $KitVersion -KitRoot $KitRoot
    $secretBytes = [System.Text.Encoding]::UTF8.GetBytes($secret)

    # Penyusun baku (urut-abjad + escape standar) = DETERMINISTIK + byte-identik dgn Node.
    # PENTING: JANGAN kembali ke ConvertTo-Json -Compress (urutan-acak .NET Hashtable -> tak bisa
    # ditiru Node + rapuh kalau .NET berubah). Urutan kunci di-sort, jadi input [ordered]/[hashtable]
    # menghasilkan tanda-tangan yang SAMA.
    $canonical = ConvertTo-LintasCanonicalJson -Value $Manifest
    $canonicalBytes = [System.Text.Encoding]::UTF8.GetBytes($canonical)

    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = $secretBytes
    $signature = $hmac.ComputeHash($canonicalBytes)
    return [Convert]::ToBase64String($signature)
}

function New-ManifestSignatureLegacy {
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute(
        'PSUseShouldProcessForStateChangingFunctions', '',
        Justification = 'Pure-compute HMAC; CADANGAN verifikasi segel format-LAMA (pra-pembakuan 2026-06-22) supaya manifest lama tidak salah alarm. Tidak menulis apa pun.'
    )]
    param(
        [Parameter(Mandatory)][hashtable]$Manifest,
        [Parameter(Mandatory)][string]$KitVersion,
        [string]$KitRoot
    )
    $secret = Get-ManifestSecret -KitVersion $KitVersion -KitRoot $KitRoot
    $secretBytes = [System.Text.Encoding]::UTF8.GetBytes($secret)
    # Cara LAMA: ConvertTo-Json -Compress (urutan-acak .NET). HANYA untuk verifikasi manifest lama
    # supaya tidak salah dikira "dirusak". JANGAN dipakai menandatangani manifest baru.
    $canonical = $Manifest | ConvertTo-Json -Depth 10 -Compress
    $canonicalBytes = [System.Text.Encoding]::UTF8.GetBytes($canonical)
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = $secretBytes
    return [Convert]::ToBase64String($hmac.ComputeHash($canonicalBytes))
}

function Test-LintasByteEqual {
    # Banding konstan-waktu byte-exact (Ordinal). base64 case-SENSITIVE -> JANGAN banding char
    # (operator PowerShell -ne pada [char] CASE-INSENSITIVE -> 2 tanda-tangan beda kapitalisasi
    # keliru dinilai sama). XOR-accumulate tanpa early-exit.
    param([string]$A, [string]$B)
    $ab = [System.Text.Encoding]::UTF8.GetBytes($A)
    $bb = [System.Text.Encoding]::UTF8.GetBytes($B)
    if ($ab.Length -ne $bb.Length) { return $false }
    $diff = 0
    for ($i = 0; $i -lt $ab.Length; $i++) {
        $diff = $diff -bor ($ab[$i] -bxor $bb[$i])
    }
    return ($diff -eq 0)
}

function Test-ManifestSignature {
    param(
        [Parameter(Mandatory)][hashtable]$Manifest,
        [Parameter(Mandatory)][string]$KitVersion,
        [Parameter(Mandatory)][string]$ExpectedSignature,
        [string]$KitRoot
    )

    # 1) Coba segel format-BARU (penyusun baku urut-abjad).
    $new = New-ManifestSignature -Manifest $Manifest -KitVersion $KitVersion -KitRoot $KitRoot
    if (Test-LintasByteEqual -A $new -B $ExpectedSignature) { return $true }

    # 2) CADANGAN transisi: segel format-LAMA (pra-pembakuan 2026-06-22). Cegah manifest lama yang
    #    MASIH UTUH salah dikira "dirusak". Manifest yang benar-benar diubah tetap gagal KEDUANYA.
    $legacy = New-ManifestSignatureLegacy -Manifest $Manifest -KitVersion $KitVersion -KitRoot $KitRoot
    return (Test-LintasByteEqual -A $legacy -B $ExpectedSignature)
}

function ConvertTo-LintasSignableHashtable {
    # Deep-convert (PSCustomObject hasil ConvertFrom-Json / hashtable) -> [ordered]
    # hashtable, MEMPERTAHANKAN urutan properti. (Penyusun baku akan sort, jadi urutan tak lagi
    # kritis, tapi tetap dipertahankan supaya cadangan-legacy bisa cocok untuk manifest lama.) Cermin
    # ConvertTo-HashtableDeep (uninstall.ps1) / ConvertTo-RollbackHashtableDeep (rollback.ps1).
    param($Object)
    if ($null -eq $Object) { return $null }
    if ($Object -is [System.Collections.IDictionary]) {
        $ht = [ordered]@{}
        foreach ($k in $Object.Keys) { $ht[$k] = ConvertTo-LintasSignableHashtable -Object $Object[$k] }
        return $ht
    }
    if ($Object -is [System.Management.Automation.PSCustomObject]) {
        $ht = [ordered]@{}
        foreach ($prop in $Object.PSObject.Properties) { $ht[$prop.Name] = ConvertTo-LintasSignableHashtable -Object $prop.Value }
        return $ht
    }
    if ($Object -is [System.Collections.IEnumerable] -and -not ($Object -is [string])) {
        $arr = @()
        foreach ($item in $Object) { $arr += ,(ConvertTo-LintasSignableHashtable -Object $item) }
        return ,$arr
    }
    return $Object
}

function Get-LintasManifestSignatureStatus {
    # Status keaslian manifest yang SUDAH di-parse (PSCustomObject dari ConvertFrom-Json).
    # Return:
    #   'verified' -> ada tanda-tangan + COCOK (format baru ATAU lama-yang-masih-utuh)
    #   'invalid'  -> ada tanda-tangan tapi TIDAK cocok (manifest mungkin di-tamper)
    #   'unsigned' -> tanpa tanda-tangan (legacy / pre-HMAC)
    # Melempar kalau verifikasi tak bisa dijalankan -> caller (doctor) memilih: skip + INFO.
    param(
        [Parameter(Mandatory)]$Manifest,
        [string]$KitRoot
    )
    $sig = $null
    if ($Manifest.metadata -and $Manifest.metadata.signature) { $sig = [string]$Manifest.metadata.signature }
    if ([string]::IsNullOrWhiteSpace($sig)) { return 'unsigned' }

    # Rekonstruksi manifest TANPA field signature (sign dihitung sebelum signature disisipkan).
    $copy = ConvertTo-LintasSignableHashtable -Object $Manifest
    if ($copy.metadata -is [System.Collections.IDictionary]) { $null = $copy.metadata.Remove('signature') }

    $kitVer = ''
    if ($Manifest.metadata -and $Manifest.metadata.kit_version) { $kitVer = [string]$Manifest.metadata.kit_version }
    elseif ($Manifest.kit_version) { $kitVer = [string]$Manifest.kit_version }

    if (Test-ManifestSignature -Manifest $copy -KitVersion $kitVer -ExpectedSignature $sig -KitRoot $KitRoot) {
        return 'verified'
    }
    return 'invalid'
}

# Functions auto-exposed via dot-source (no Export-ModuleMember karena .ps1)
