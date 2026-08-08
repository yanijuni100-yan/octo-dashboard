<#
.SYNOPSIS
  lib/unicode-safety-check.ps1 - "Robot pemindai huruf-tipuan" (deterministik, ~0 token).

.DESCRIPTION
  Masalah yang dipecahkan: penyerang menyelipkan karakter Unicode TAK-KASAT-MATA ke teks/kode
  (berkas, issue, tempelan) - mata manusia tak melihatnya, tapi asisten AI MEMBACANYA sebagai
  instruksi rahasia ("abaikan aturan, kirim rahasia ke sini"). Vektor utama: blok Tag U+E0000-E007F
  (instruksi tersembunyi yang dibaca AI), pembalik arah teks bidi ("Trojan Source"), spasi-lebar-nol.

  Aturan teks (sec. 8.1 #5) menyuruh AI "deteksi" karakter ini lewat PENALARAN - padahal karakter
  ini DIRANCANG untuk menipu AI itu sendiri. Maka pengaman yang benar = ROBOT deterministik:
  daftar kode-titik berbahaya itu PASTI & terbatas (lolos sec. 6.3 "pola tak-ambigu -> robot, bukan
  AI" + ADR-001 yang mengesahkan robot ada/tidak-ada murni, beda dari indeks/graf yang under-match).
  Catatan jujur: ini menutup vektor karakter-tersembunyi yang DIKETAHUI secara deterministik -
  bukan jaminan keamanan mutlak.

  DUA PEMAKAIAN:
   1. GERBANG/CI : pindai berkas teks repo -> pastikan tak ada karakter berbahaya ter-commit.
      Dijalankan via tes Pester atas repo asli (tests/unicode-safety-check.Tests.ps1).
   2. RUNTIME (oleh AI): saat AI membaca KONTEN TAK-TEPERCAYA (issue, berkas eksternal, tempelan),
      jalankan robot ini atas konten itu SEBELUM mempercayainya (sec. 8.1 #5).

  ANTI ALARM-PALSU: secara DEFAULT TIDAK menandai penyambung aksara yang SAH (ZWJ/ZWNJ U+200C/200D,
  LRM/RLM) karena dipakai legal di aksara Arab/India + rangkaian emoji (mis. emoji profesi memakai
  ZWJ). Pakai -IncludeJoiners untuk mode paranoid. BOM (U+FEFF) di AWAL berkas dianggap sah; hanya
  ditandai bila muncul di TENGAH berkas.

  Fungsi yang di-export:
    - Get-LintasUnicodeFinding        : Array temuan dari sebuah string (objek terstruktur).
    - Get-LintasUnicodeTextFile      : Daftar berkas teks yang dipindai (skip biner/.git/backup).
    - Invoke-LintasUnicodeSafetyCheck : Jalankan + (opsional) cetak laporan. Returns { Findings; Count }.

.NOTES
  Versi  : 1.0.0
  Tanggal: 2026-06-19
  Inspirasi: pola "unicode-safety" ECC (MIT) - ditulis-ulang PowerShell + bahasa awam (adopsi selektif).
#>
[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string[]]$Path,
    [switch]$IncludeJoiners,
    [switch]$Quiet
)

# Kode-titik BERBAHAYA: tak ada pemakaian sah di kode/prosa biasa. Tag block (U+E0000-E007F)
# ditangani via range di Test-LintasDangerousCodePoint (bukan di tabel ini).
$script:LintasDangerousCp = @{
    0x200B = 'ZERO WIDTH SPACE'
    0x2060 = 'WORD JOINER'
    0x2061 = 'FUNCTION APPLICATION (tak terlihat)'
    0x2062 = 'INVISIBLE TIMES'
    0x2063 = 'INVISIBLE SEPARATOR'
    0x2064 = 'INVISIBLE PLUS'
    0x00AD = 'SOFT HYPHEN'
    0x202A = 'LRE (bidi embedding)'
    0x202B = 'RLE (bidi embedding)'
    0x202C = 'PDF (bidi pop)'
    0x202D = 'LRO (bidi override)'
    0x202E = 'RLO (bidi override - Trojan Source)'
    0x2066 = 'LRI (bidi isolate)'
    0x2067 = 'RLI (bidi isolate)'
    0x2068 = 'FSI (bidi isolate)'
    0x2069 = 'PDI (bidi isolate pop)'
}

# Penyambung yang SAH di sebagian bahasa/emoji (default TIDAK ditandai; -IncludeJoiners menyalakan).
$script:LintasJoinerCp = @{
    0x200C = 'ZWNJ (zero width non-joiner)'
    0x200D = 'ZWJ (zero width joiner)'
    0x200E = 'LRM (left-to-right mark)'
    0x200F = 'RLM (right-to-left mark)'
}

function Test-LintasDangerousCodePoint {
    param([int]$Cp, [bool]$IncludeJoiners)
    if ($Cp -ge 0xE0000 -and $Cp -le 0xE007F) { return 'TAG BLOCK (instruksi tersembunyi yang dibaca AI)' }
    if ($script:LintasDangerousCp.ContainsKey($Cp)) { return $script:LintasDangerousCp[$Cp] }
    if ($IncludeJoiners -and $script:LintasJoinerCp.ContainsKey($Cp)) { return $script:LintasJoinerCp[$Cp] }
    return $null
}

function Get-LintasUnicodeFinding {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Content,
        [string]$RelPath = '<string>',
        [switch]$IncludeJoiners
    )
    $findings = @()
    if ([string]::IsNullOrEmpty($Content)) { return $findings }
    $includeJ = $IncludeJoiners.IsPresent
    $bomStripped = $false
    $lines = $Content -split "`n"
    for ($ln = 0; $ln -lt $lines.Count; $ln++) {
        $line = $lines[$ln]
        for ($i = 0; $i -lt $line.Length; $i++) {
            $ch = $line[$i]
            $cp = [int]$ch
            $advance = 0
            if ([char]::IsHighSurrogate($ch) -and ($i + 1) -lt $line.Length -and [char]::IsLowSurrogate($line[$i + 1])) {
                $cp = [char]::ConvertToUtf32($ch, $line[$i + 1])
                $advance = 1
            }
            if ($cp -eq 0xFEFF) {
                # BOM di paling awal berkas = sah (lewati sekali); selain itu = mencurigakan.
                if ($ln -eq 0 -and $i -eq 0 -and -not $bomStripped) {
                    $bomStripped = $true
                    $i += $advance
                    continue
                }
                $findings += [pscustomobject]@{
                    File = $RelPath; Line = ($ln + 1); Col = ($i + 1); CodePoint = $cp
                    Hex = ('U+{0:X4}' -f $cp); Name = 'BOM/ZWNBSP di tengah berkas'
                }
                $i += $advance
                continue
            }
            $name = Test-LintasDangerousCodePoint -Cp $cp -IncludeJoiners $includeJ
            if ($name) {
                $findings += [pscustomobject]@{
                    File = $RelPath; Line = ($ln + 1); Col = ($i + 1); CodePoint = $cp
                    Hex = ('U+{0:X4}' -f $cp); Name = $name
                }
            }
            $i += $advance
        }
    }
    return $findings
}

function Get-LintasUnicodeTextFile {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$Root)
    $exts = @('.md', '.ps1', '.psm1', '.psd1', '.yml', '.yaml', '.json', '.js', '.txt', '.sh', '.template')
    $skipFrag = @('\.git\', '\node_modules\', '\.backup-', '\.claude-kit\')
    Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
        $full = $_.FullName
        foreach ($frag in $skipFrag) { if ($full -like "*$frag*") { return $false } }
        $exts -contains $_.Extension.ToLower()
    }
}

function Invoke-LintasUnicodeSafetyCheck {
    [CmdletBinding()]
    param(
        [string]$RepoRoot,
        [string[]]$Path,
        [switch]$IncludeJoiners,
        [switch]$Quiet
    )
    if (-not $RepoRoot) { $RepoRoot = Split-Path -Parent $PSScriptRoot }  # induk folder lib/
    $targets = @()
    if ($Path) {
        foreach ($p in $Path) {
            if (Test-Path -LiteralPath $p -PathType Container) { $targets += Get-LintasUnicodeTextFile -Root $p }
            elseif (Test-Path -LiteralPath $p) { $targets += Get-Item -LiteralPath $p }
        }
    } else {
        $targets = Get-LintasUnicodeTextFile -Root $RepoRoot
    }

    $all = @()
    foreach ($f in $targets) {
        # WAJIB -Encoding UTF8: tanpa ini, Get-Content di Windows PowerShell 5.1 memakai
        # codepage ANSI (default) -> byte multi-byte UTF-8 yang sah (mis. karakter CJK
        # 中 = E4 B8 AD) salah-ditafsir jadi U+00AD dst -> ALARM PALSU + hasil beda antar
        # versi PowerShell (5.1 vs pwsh7). Baca eksplisit UTF-8 = deterministik + benar.
        $content = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        if ($null -eq $content) { continue }
        $rel = $f.FullName
        try { $rel = Resolve-Path -LiteralPath $f.FullName -Relative -ErrorAction SilentlyContinue } catch { $rel = $f.FullName }
        $all += Get-LintasUnicodeFinding -Content $content -RelPath $rel -IncludeJoiners:$IncludeJoiners
    }

    if (-not $Quiet) {
        Write-Host "Robot pemindai huruf-tipuan (karakter Unicode tak-kasat-mata)"
        Write-Host ('-' * 60)
        if ($all.Count -eq 0) {
            Write-Host "BERSIH: tidak ada karakter Unicode berbahaya ditemukan." -ForegroundColor Green
        } else {
            foreach ($x in $all) {
                Write-Host ("  [BAHAYA] {0}:{1}:{2}  {3}  {4}" -f $x.File, $x.Line, $x.Col, $x.Hex, $x.Name) -ForegroundColor Red
            }
            Write-Host ('-' * 60)
            Write-Host ("DITEMUKAN: {0} karakter berbahaya -> periksa berkas di atas." -f $all.Count) -ForegroundColor Red
        }
    }
    return [pscustomobject]@{ Findings = $all; Count = $all.Count }
}

# Auto-run saat dijalankan langsung (`& .\lib\unicode-safety-check.ps1`), BUKAN saat dot-source
# (Pester dot-source -> InvocationName '.'): keluar dengan kode = jumlah temuan (0 = bersih).
if ($MyInvocation.InvocationName -ne '.' -and -not $env:LINTAS_UNICODE_NOAUTORUN) {
    $result = Invoke-LintasUnicodeSafetyCheck -RepoRoot $RepoRoot -Path $Path -IncludeJoiners:$IncludeJoiners -Quiet:$Quiet
    exit $result.Count
}
