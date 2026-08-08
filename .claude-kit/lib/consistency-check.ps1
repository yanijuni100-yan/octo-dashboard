<#
.SYNOPSIS
  lib/consistency-check.ps1 - "Robot pemeriksa kecocokan" lintas-berkas (kit lintasAI + project staff).

.DESCRIPTION
  Masalah yang dipecahkan: fakta yang sama (mis. NOMOR VERSI) ditulis tangan di banyak
  berkas. Ganti satu, gampang lupa salinan lainnya -> bug "angka basi" (file A & B lupa
  diganti, file C sudah). Robot ini membandingkan nilai-saat-ini di banyak berkas terhadap
  SATU sumber kebenaran, lalu mencetak laporan cocok/tidak. Jalan dalam hitungan detik,
  biaya token ~nol (ini skrip, bukan AI baca-baca berkas).

  DUA MODE:
   1. MODE KIT (default, tanpa -ChecksFile): jaga deklarasi versi-saat-ini di berkas kit
      sendiri (CHANGELOG, judul CLAUDE_universal, README, KEUNGGULAN, templates/INDEX) vs
      package.json. Daftar di $script:KitVersionChecks.
   2. MODE PROJECT (-ChecksFile <peta.psd1>): tiap project staff mendaftarkan fakta-berulang
      MEREKA SENDIRI (versi, nilai config, dll) di sebuah berkas .psd1. Lihat
      templates/consistency-map.example.psd1 untuk formatnya.

  PENTING - hanya deklarasi "nilai-saat-ini" yang dijaga. Penanda SEJARAH (mis.
  "fitur ini lahir di v1.30.0", berkas laporan audit bertanggal) SENGAJA menyimpan nilai
  lama -> JANGAN dimasukkan ke daftar/peta.

  Dipakai oleh:
    - Manusia/AI (kit)    : `pwsh lib/consistency-check.ps1`
    - Manusia/AI (project): `pwsh .claude-kit/lib/consistency-check.ps1 -RepoRoot . -ChecksFile docs/consistency-map.psd1`
    - Tes Pester          : tests/consistency-check.Tests.ps1 (dot-source -> panggil fungsi).
    - Gerbang Verifikasi Pra-Rilis (CLAUDE_universal_v1.md sec. 4.6): jalankan robot ini
      DULU (murah) sebelum AI menilai bagian yang butuh pertimbangan.

  Fungsi yang di-export:
    - Get-LintasCanonicalVersion    : Ambil nilai acuan (sumber kebenaran).
    - Get-LintasDeclaredVersion     : Ekstrak nilai yang dideklarasikan satu berkas.
    - Get-LintasVersionFinding     : Array temuan per berkas (objek terstruktur).
    - Invoke-LintasConsistencyCheck : Jalankan + (opsional) cetak laporan. Returns objek
                                      ringkasan { CanonicalVersion; Findings; MismatchCount }.

.NOTES
  Versi  : 1.1.0
  Tanggal: 2026-06-16
  Target : PowerShell 5.1+ (Windows PowerShell) dan PowerShell 7+.
  Catatan: Saat dot-source (test) -> hanya definisi fungsi, tidak auto-run/exit
           (InvocationName = '.'). Saat dijalankan langsung -> cetak laporan + exit code =
           jumlah ketidakcocokan (0 = bersih).
#>

[CmdletBinding()]
param(
    # Akar repo/project yang diperiksa. Default = folder induk dari lib/ (root repo kit).
    [string]$RepoRoot,

    # Opsional: berkas peta-konsistensi (.psd1) milik project staff. Kalau di-set,
    # robot pakai Source + Checks dari berkas ini (MODE PROJECT). Kalau tidak, MODE KIT.
    [string]$ChecksFile,

    # Kalau di-set, jangan cetak apa pun (dipakai test). Tetap return objek.
    [switch]$Quiet,

    # MODE CAP VERSI (kit dev): kalau di-set ke "X.Y.Z", stamp versi baru ke SEMUA
    # berkas deklarasi (pakai $KitVersionChecks yang SAMA dengan pemeriksa) + prepend
    # kerangka entri CHANGELOG, LALU jalankan pemeriksaan kecocokan. Guard: cuma jalan
    # di repo kit (package.json name='lintasai'). Setara `kit.ps1 bump <versi>`.
    [string]$SetVersion
)

# ---- Daftar deklarasi "versi-saat-ini" milik KIT (MODE KIT default) ----
# Tambah baris baru di sini kalau ada berkas kit baru yang mendeklarasikan versi-saat-ini.
# Pattern: regex dengan SATU capture group untuk nilai. Match PERTAMA yang dipakai.
# HeaderLines (opsional): kalau di-set, hanya cari di N baris pertama (hindari salah-tangkap
#                         penanda sejarah versi di badan berkas).
# UseChangelogParser: pakai Get-KitVersionFromChangelog (format-agnostic) alih-alih regex.
$script:KitVersionChecks = @(
    @{
        File               = 'CHANGELOG.md'
        Label              = 'Entri teratas CHANGELOG'
        UseChangelogParser = $true
    }
    @{
        File        = 'CLAUDE_universal_v1.md'
        Label       = 'Judul aturan (auto-baca tiap sesi staff)'
        Pattern     = 'Versi\s+(\d+\.\d+\.\d+)'
        HeaderLines = 10
    }
    @{
        File    = 'README.md'
        Label   = 'Baris "Versi stabil sekarang"'
        Pattern = 'Versi stabil sekarang:\s*\*\*v(\d+\.\d+\.\d+)\*\*'
    }
    @{
        File    = 'KEUNGGULAN_LINTASAI.md'
        Label   = 'Baris "Terakhir diselaraskan"'
        Pattern = 'Terakhir diselaraskan:\s*\*\*v(\d+\.\d+\.\d+)'
    }
    @{
        File    = 'templates/INDEX.md'
        Label   = 'Judul Index dokumen'
        Pattern = 'Daftar Lengkap Dokumen lintasAI v(\d+\.\d+\.\d+)'
    }
)

# Sumber kebenaran default (MODE KIT): field 'version' di package.json.
$script:KitSource = @{ File = 'package.json'; JsonField = 'version' }

# ---- Buku fakta: nilai-berulang NON-versi yang gampang drift (MODE KIT) ----
# Masalah: angka seperti "jumlah file tim" ditulis tangan di banyak dokumen; ganti satu,
# lupa lainnya (riwayat NYATA: 17 -> 28 -> 30 -> 32, padahal asli 31). Robot ini
# menghitung nilai ASLI dari SATU sumber kode (mis. variabel $teamFiles) lalu cek SEMUA
# tulisan angka itu di dokumen cocok. Beda dari versi: 1 dokumen boleh sebut angkanya
# >1x -> dicek SEMUA kemunculan, bukan cuma yang pertama.
#
# SYARAT fakta yang LAYAK dijaga (penting - biar robot tidak "alarm palsu"):
#   1. Punya SUMBER tunggal yang bisa dihitung otomatis (mis. variabel $teamFiles di kode).
#   2. Pola tulisannya TIDAK ambigu di dokumen. Contoh JANGAN dijaga: "X jargon" (ada 32 ANALOGI
#      vs 23 Reference Card vs angka historis) / "X prompt" (22 vs 5) -> regex bakal salah-tangkap.
# TAMBAH fakta BARU = tambah 1 blok di $script:KitFacts (ini "konfigurasi ke depan").
#   Source = cara hitung nilai ASLI (Kind 'CountInBlock' = hitung baris ber-Entry dalam blok array).
#   Filter (opsional, level fakta) = hanya hitung baris yang JUGA cocok Filter (sub-hitungan per folder).
#   Declarations = daftar { File; Pattern } tempat angka DITULIS (Pattern = regex 1 grup angka).
#   Beda dari versi: 1 dokumen boleh sebut angkanya >1x -> dicek SEMUA kemunculan, bukan cuma pertama.

# Sumber 'jumlah file tim' didefinisikan SEKALI (anti-DRY); tiap fakta cuma beda Filter.
$script:KitTeamFilesSource = @{ Kind = 'CountInBlock'; File = 'setup-pola-b.ps1'; BlockStart = '\$teamFiles\s*=\s*@\('; BlockEnd = '^\s*\)\s*$'; Entry = "Src\s*=\s*'templates" }

$script:KitFacts = @(
    @{ Name = 'file-tim-total';  Label = 'Jumlah file tim (total)';  Source = $script:KitTeamFilesSource; Filter = $null;
       Declarations = @(
           @{ File = 'README.md';       Pattern = '(\d+) file tim' }
           @{ File = 'JALANKAN_KIT.md'; Pattern = '(\d+) file tim' }
       ) }
    @{ Name = 'file-tim-github'; Label = 'Jumlah file tim di .github'; Source = $script:KitTeamFilesSource; Filter = 'workflowsDir|scriptsDir|githubDir';
       Declarations = @( @{ File = 'JALANKAN_KIT.md'; Pattern = '(\d+) di \.github' } ) }
    @{ Name = 'file-tim-docs';   Label = 'Jumlah file tim di docs';   Source = $script:KitTeamFilesSource; Filter = 'docsDir|decisionsDir';
       Declarations = @( @{ File = 'JALANKAN_KIT.md'; Pattern = '(\d+) di docs' } ) }
)

# ---- Penjaga ISTILAH-PENSIUN (retired-term guard) ----
# Masalah yang dipecahkan: istilah/heading kanonik diganti (mis. "Multi-Divisi" -> "Tinjauan
# lintasAI Divisi"), tapi salinan lama nyangkut di berkas instruksi -> klien lihat istilah usang.
# Ini drift TEKS (bukan angka). Robot MENOLAK rilis kalau pola istilah-pensiun muncul di berkas
# instruksi HIDUP (root *.md + templates/*.md + 2 skrip pemasang), KECUALI di berkas sejarah
# (CHANGELOG, di ExcludeFiles). CASE-SENSITIVE ([regex]::Match default .NET): "Multi-Divisi" (proper
# noun) ditangkap; "multi-divisi" (prosa umum) + "Multi-Divisional" (peran) TIDAK. Kembar dgn
# KIT_RETIRED_TERMS di consistency-check.mjs (dijaga tes paritas consistency-parity.Tests.ps1).
$script:KitRetiredTerms = @(
    @{
        Name         = 'heading-tinjauan-divisi'
        Label        = 'Istilah lama blok review (bagian 4.1)'
        Pattern      = 'Multi-Divisi(?!onal)'   # (?!onal) = izinkan "Multi-Divisional Engineer" (peran)
        Replacement  = 'Tinjauan lintasAI Divisi'
        ExcludeFiles = @('CHANGELOG.md')         # sejarah - boleh menyimpan istilah lama
    }
)

# Cakupan pindai: berkas instruksi HIDUP. Dir NON-rekursif. (docs/ + docs/plans/ di luar cakupan:
# laporan bertanggal = sejarah, seperti CHANGELOG.) Kembar KIT_RETIRED_SCAN di .mjs.
$script:KitRetiredScan = @{ Dirs = @('.', 'templates'); Extensions = @('.md'); ExtraFiles = @('setup-pola-b.ps1', 'setup-pola-b.mjs') }

# ---- Helper: enumerasi berkas yang dipindai (relatif, garis-miring-maju supaya identik PS<->Node) ----
function Get-LintasScanFile {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$RepoRoot, [Parameter(Mandatory)][hashtable]$Scan)
    $set = [System.Collections.Generic.List[string]]::new()
    foreach ($dir in $Scan.Dirs) {
        $full = if ($dir -eq '.') { $RepoRoot } else { Join-Path $RepoRoot $dir }
        if (-not (Test-Path -LiteralPath $full)) { continue }
        foreach ($ext in $Scan.Extensions) {
            Get-ChildItem -LiteralPath $full -File -Filter "*$ext" -ErrorAction SilentlyContinue | ForEach-Object {
                $set.Add( $(if ($dir -eq '.') { $_.Name } else { "$dir/$($_.Name)" }) )
            }
        }
    }
    foreach ($extra in $Scan.ExtraFiles) {
        if (Test-Path -LiteralPath (Join-Path $RepoRoot $extra)) { $set.Add($extra) }
    }
    return @($set | Sort-Object -Unique)
}

# ---- Inti: temuan istilah-pensiun (1 temuan per term/berkas/baris yang melanggar). CASE-SENSITIVE ----
# Return @() kalau bersih. Kembar Get-LintasRetiredFinding (consistency-check.mjs).
function Get-LintasRetiredFinding {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$RepoRoot, [array]$Terms, [hashtable]$Scan)
    if (-not $Terms) { $Terms = $script:KitRetiredTerms }
    if (-not $Scan)  { $Scan  = $script:KitRetiredScan }
    $files = Get-LintasScanFile -RepoRoot $RepoRoot -Scan $Scan
    $findings = foreach ($term in $Terms) {
        $rx = [regex]::new([string]$term.Pattern)   # CASE-SENSITIVE (.NET default), lookahead (?!...) didukung
        $exclude = @($term.ExcludeFiles)
        foreach ($rel in $files) {
            if ($exclude -contains $rel) { continue }
            # @(...) WAJIB: berkas 1-baris -> Get-Content kasih string, indexing string = KARAKTER (bug). Paksa array.
            $lines = @(Get-Content -LiteralPath (Join-Path $RepoRoot $rel) -Encoding UTF8 -ErrorAction SilentlyContinue)
            for ($i = 0; $i -lt $lines.Count; $i++) {
                $m = $rx.Match([string]$lines[$i])
                if ($m.Success) {
                    [pscustomobject]@{
                        Term  = $term.Name; File = $rel; Line = ($i + 1)
                        Label = $term.Label; Expected = $term.Replacement
                        Found = $m.Value; Status = 'TERLARANG'
                    }
                }
            }
        }
    }
    return @($findings)
}

# ---- Helper: ambil nilai acuan dari sumber kebenaran ----
# -Source: hashtable @{ File=...; JsonField=... } (baca field JSON) ATAU
#                    @{ File=...; Pattern=... }  (regex capture group 1).
function Get-LintasCanonicalVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [hashtable]$Source = $script:KitSource
    )

    $path = Join-Path $RepoRoot $Source.File
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Sumber kebenaran '$($Source.File)' tidak ditemukan di $RepoRoot - tak ada acuan."
    }
    $raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

    if ($Source.JsonField) {
        $obj = $raw | ConvertFrom-Json
        $val = $obj.$($Source.JsonField)
        if (-not $val) { throw "Field '$($Source.JsonField)' tidak ada di $($Source.File)." }
        return [string]$val
    }
    if ($Source.Pattern) {
        if ($raw -match $Source.Pattern) { return $Matches[1] }
        throw "Pola acuan tidak cocok di $($Source.File)."
    }
    throw "Source harus punya 'JsonField' atau 'Pattern'."
}

# ---- Helper: ekstrak nilai yang dideklarasikan satu berkas ----
# Returns string nilai atau $null kalau tidak ketemu.
function Get-LintasDeclaredVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][hashtable]$Check
    )

    $path = Join-Path $RepoRoot $Check.File
    if (-not (Test-Path -LiteralPath $path)) { return $null }

    if ($Check.UseChangelogParser) {
        # Reuse parser format-agnostic (satu sumber kebenaran, tak duplikat regex).
        $v = Get-KitVersionFromChangelog -ChangelogPath $path
        if ($v) { return ($v -replace '^v', '') }
        return $null
    }

    # Baca konten: kalau HeaderLines di-set, batasi ke N baris pertama (hindari
    # salah-tangkap penanda sejarah versi di badan berkas).
    if ($Check.HeaderLines) {
        $lines = Get-Content -LiteralPath $path -TotalCount $Check.HeaderLines -Encoding UTF8
        $content = ($lines -join "`n")
    } else {
        $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    }

    if ($content -match $Check.Pattern) {
        return $Matches[1]
    }
    return $null
}

# ---- Inti: kumpulkan temuan per berkas ----
# -Checks + -Canonical opsional (default = MODE KIT). MODE PROJECT mengisi keduanya dari peta.
function Get-LintasVersionFinding {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [array]$Checks,
        [string]$Canonical
    )

    if (-not $Checks)    { $Checks = $script:KitVersionChecks }
    if (-not $Canonical) { $Canonical = Get-LintasCanonicalVersion -RepoRoot $RepoRoot }

    $findings = foreach ($check in $Checks) {
        $declared = Get-LintasDeclaredVersion -RepoRoot $RepoRoot -Check $check
        $status =
            if ($null -eq $declared) { 'MISSING' }
            elseif ($declared -eq $Canonical) { 'OK' }
            else { 'MISMATCH' }

        [pscustomobject]@{
            File     = $check.File
            Label    = $check.Label
            Expected = $Canonical
            Found    = $declared
            Status   = $status
        }
    }
    return @($findings)
}

# ---- Helper: muat peta-konsistensi project (.psd1) ----
function Get-LintasChecksFromFile {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$ChecksFilePath)

    if (-not (Test-Path -LiteralPath $ChecksFilePath)) {
        throw "Peta-konsistensi tidak ditemukan: $ChecksFilePath"
    }
    # Import-PowerShellDataFile = aman (data-only, tidak eksekusi kode).
    $map = Import-PowerShellDataFile -LiteralPath $ChecksFilePath
    # Pisahkan 2 kondisi: '-not @()' = $true juga, jadi 'Checks = @()' (kunci ADA
    # tapi kosong) keliru dilaporkan "tidak punya kunci". Beri pesan yang akurat.
    if (-not $map.ContainsKey('Checks')) { throw "Peta-konsistensi '$ChecksFilePath' tidak punya kunci 'Checks'." }
    if (@($map.Checks).Count -eq 0)      { throw "Peta-konsistensi '$ChecksFilePath' punya kunci 'Checks' tapi kosong." }
    return $map
}

# ---- Helper: hitung nilai ASLI sebuah fakta dari sumber kode (Kind = CountInBlock) ----
# Hitung baris yang cocok 'Entry' di antara baris cocok 'BlockStart' dan baris cocok 'BlockEnd'.
# Filter (opsional): hanya hitung baris yang JUGA cocok Filter (sub-hitungan per kategori).
function Get-LintasCountFromBlock {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][hashtable]$Source,
        [string]$Filter
    )
    $path = Join-Path $RepoRoot $Source.File
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Sumber fakta '$($Source.File)' tidak ditemukan di $RepoRoot."
    }
    $lines = Get-Content -LiteralPath $path -Encoding UTF8
    $inBlock = $false
    $count = 0
    foreach ($line in $lines) {
        if (-not $inBlock) {
            if ($line -match $Source.BlockStart) { $inBlock = $true }
            continue
        }
        if ($line -match $Source.BlockEnd) { break }
        if ($line -match $Source.Entry) {
            if ((-not $Filter) -or ($line -match $Filter)) { $count++ }
        }
    }
    return $count
}

# ---- Helper: ambil SEMUA angka yang ditulis satu berkas untuk sebuah pola ----
# Return: $null kalau berkas tak ada; @() kalau pola tak ketemu; else array string angka.
function Get-LintasDeclaredNumber {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][hashtable]$Declaration
    )
    $path = Join-Path $RepoRoot $Declaration.File
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $mm = [regex]::Matches($content, $Declaration.Pattern)
    return @($mm | ForEach-Object { $_.Groups[1].Value })
}

# ---- Inti: temuan buku fakta (MODE KIT). Fakta yang sumbernya TAK ADA dilewati ----
# (mis. repo tiruan di tes tanpa setup-pola-b.ps1) -> tidak melempar, supaya tes lain aman.
function Get-LintasFactFinding {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [array]$Facts
    )
    if (-not $Facts) { $Facts = $script:KitFacts }
    $findings = foreach ($fact in $Facts) {
        $srcPath = Join-Path $RepoRoot $fact.Source.File
        if (-not (Test-Path -LiteralPath $srcPath)) { continue }  # sumber tak ada -> lewati
        $canonical = [string](Get-LintasCountFromBlock -RepoRoot $RepoRoot -Source $fact.Source -Filter $fact.Filter)
        foreach ($decl in $fact.Declarations) {
            $declared = Get-LintasDeclaredNumber -RepoRoot $RepoRoot -Declaration $decl
            if ($null -eq $declared) {
                $status = 'MISSING'; $found = '(berkas tak ada)'
            } elseif (@($declared).Count -eq 0) {
                $status = 'MISSING'; $found = '(angka tak ketemu)'
            } else {
                $wrong = @($declared | Where-Object { $_ -ne $canonical })
                if ($wrong.Count -gt 0) { $status = 'MISMATCH'; $found = (@($declared) -join ',') }
                else { $status = 'OK'; $found = $canonical }
            }
            [pscustomobject]@{
                Fact     = $fact.Name
                File     = $decl.File
                Label    = $fact.Label
                Expected = $canonical
                Found    = $found
                Status   = $status
            }
        }
    }
    return @($findings)
}

# ---- Orkestrasi: jalankan + (opsional) cetak laporan ----
function Invoke-LintasConsistencyCheck {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [string]$ChecksFile,
        [switch]$Quiet
    )

    $factFindings = @()
    $retiredFindings = @()
    if ($ChecksFile) {
        # MODE PROJECT: pakai Source + Checks dari peta project.
        $map = Get-LintasChecksFromFile -ChecksFilePath $ChecksFile
        $source = if ($map.Source) { $map.Source } else { $script:KitSource }
        $canonical = Get-LintasCanonicalVersion -RepoRoot $RepoRoot -Source $source
        $findings = Get-LintasVersionFinding -RepoRoot $RepoRoot -Checks $map.Checks -Canonical $canonical
    } else {
        # MODE KIT: default kit. Cek versi + buku fakta (nilai-berulang non-versi).
        $canonical = Get-LintasCanonicalVersion -RepoRoot $RepoRoot
        $findings = Get-LintasVersionFinding -RepoRoot $RepoRoot
        $factFindings = Get-LintasFactFinding -RepoRoot $RepoRoot
        $retiredFindings = Get-LintasRetiredFinding -RepoRoot $RepoRoot
    }
    $bad = @($findings | Where-Object { $_.Status -ne 'OK' })
    $badFacts = @($factFindings | Where-Object { $_.Status -ne 'OK' })
    $badRetired = @($retiredFindings)

    if (-not $Quiet) {
        Write-Host ""
        Write-Host "Robot pemeriksa kecocokan versi lintasAI" -ForegroundColor Cyan
        Write-Host ("Sumber kebenaran: v{0}" -f $canonical)
        Write-Host ("-" * 60)
        foreach ($f in $findings) {
            switch ($f.Status) {
                'OK'       { Write-Host ("  [OK]      {0,-26} v{1}" -f $f.File, $f.Found) -ForegroundColor Green }
                'MISMATCH' { Write-Host ("  [TAK COCOK] {0,-24} v{1}  -> HARUS v{2}" -f $f.File, $f.Found, $f.Expected) -ForegroundColor Red }
                'MISSING'  { Write-Host ("  [HILANG]  {0,-26} baris versi tidak ditemukan ({1})" -f $f.File, $f.Label) -ForegroundColor Yellow }
            }
        }
        Write-Host ("-" * 60)
        if ($bad.Count -eq 0) {
            Write-Host ("BERSIH: semua {0} berkas cocok di v{1}." -f $findings.Count, $canonical) -ForegroundColor Green
        } else {
            Write-Host ("{0} berkas TIDAK cocok - perbaiki sebelum rilis." -f $bad.Count) -ForegroundColor Red
        }

        if ($factFindings.Count -gt 0) {
            Write-Host ""
            Write-Host "Buku fakta (nilai-berulang non-versi)" -ForegroundColor Cyan
            Write-Host ("-" * 60)
            foreach ($f in $factFindings) {
                switch ($f.Status) {
                    'OK'       { Write-Host ("  [OK]      {0,-20} {1} = {2}" -f $f.File, $f.Label, $f.Found) -ForegroundColor Green }
                    'MISMATCH' { Write-Host ("  [TAK COCOK] {0,-18} {1}: {2} -> HARUS {3}" -f $f.File, $f.Label, $f.Found, $f.Expected) -ForegroundColor Red }
                    'MISSING'  { Write-Host ("  [HILANG]  {0,-20} {1} {2}" -f $f.File, $f.Label, $f.Found) -ForegroundColor Yellow }
                }
            }
            Write-Host ("-" * 60)
            if ($badFacts.Count -eq 0) {
                Write-Host ("BERSIH: semua {0} fakta cocok dengan sumbernya." -f $factFindings.Count) -ForegroundColor Green
            } else {
                Write-Host ("{0} fakta TIDAK cocok - perbaiki sebelum rilis." -f $badFacts.Count) -ForegroundColor Red
            }
        }

        if (-not $ChecksFile) {
            Write-Host ""
            Write-Host "Penjaga istilah-pensiun (heading/SSOT)" -ForegroundColor Cyan
            Write-Host ("-" * 60)
            if ($badRetired.Count -eq 0) {
                Write-Host ("  [OK]      bersih - {0} istilah dijaga, 0 bocor di berkas instruksi." -f @($script:KitRetiredTerms).Count) -ForegroundColor Green
            } else {
                foreach ($f in $badRetired) { Write-Host ("  [TERLARANG] {0}:{1}  '{2}' -> pakai '{3}'" -f $f.File, $f.Line, $f.Found, $f.Expected) -ForegroundColor Red }
                Write-Host ("{0} istilah-pensiun bocor - perbaiki sebelum rilis." -f $badRetired.Count) -ForegroundColor Red
            }
        }
        Write-Host ""
    }

    return [pscustomobject]@{
        CanonicalVersion = $canonical
        Findings         = $findings
        FactFindings     = $factFindings
        RetiredFindings  = $retiredFindings
        MismatchCount    = $bad.Count + $badFacts.Count + $badRetired.Count
    }
}

# ============================================================================
# MODE CAP VERSI (kit dev) - "tombol bump 1-langkah"
# WHY: nomor versi-saat-ini ditulis tangan di 6 tempat (package.json + 5 deklarasi
# di $KitVersionChecks). Naik versi = gampang lupa salah satu (riwayat nyata: README
# nyangkut 5 rilis). Fungsi ini PAKAI ULANG daftar yang SAMA dengan pemeriksa (satu
# sumber kebenaran lokasi versi) untuk MENULIS, bukan cuma cek. Hanya mengganti
# substring nomor versi (regex group 1) supaya format berkas + status BOM tidak ikut
# berubah -> diff bersih. CHANGELOG dapat kerangka entri baru (deskripsi ditulis manusia).
# ============================================================================

# Tulis ulang teks berkas dengan MEMPERTAHANKAN status BOM aslinya (anti diff palsu).
function Set-LintasFileTextPreservingBom {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Text)
    $hasBom = $false
    try {
        $head = [System.IO.File]::ReadAllBytes($Path)
        $hasBom = ($head.Length -ge 3 -and $head[0] -eq 0xEF -and $head[1] -eq 0xBB -and $head[2] -eq 0xBF)
    } catch { $hasBom = $false }
    $enc = New-Object System.Text.UTF8Encoding($hasBom)
    [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

# Ganti HANYA substring "nilai" (regex group 1) pada kemunculan PERTAMA pola.
# Return: $true kalau berhasil ganti, $false kalau berkas/pola tak ada.
function Set-LintasDeclaredVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][hashtable]$Check,
        [Parameter(Mandatory)][string]$NewVersion
    )
    $path = Join-Path $RepoRoot $Check.File
    if (-not (Test-Path -LiteralPath $path)) { return $false }
    $raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $m = [regex]::Match($raw, $Check.Pattern)
    if (-not $m.Success -or -not $m.Groups[1].Success) { return $false }
    $g = $m.Groups[1]
    $new = $raw.Substring(0, $g.Index) + $NewVersion + $raw.Substring($g.Index + $g.Length)
    Set-LintasFileTextPreservingBom -Path $path -Text $new
    return $true
}

# Set field "version" di package.json LEWAT regex (BUKAN ConvertTo-Json) supaya
# indentasi + urutan field tidak ikut berubah. Ganti kemunculan pertama saja.
function Set-LintasPackageJsonVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$NewVersion,
        [string]$File = 'package.json'
    )
    $path = Join-Path $RepoRoot $File
    if (-not (Test-Path -LiteralPath $path)) { return $false }
    $raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $rx = [regex]'("version"\s*:\s*")\d+\.\d+\.\d+(")'
    if (-not $rx.IsMatch($raw)) { return $false }
    $new = $rx.Replace($raw, ('${1}' + $NewVersion + '${2}'), 1)
    Set-LintasFileTextPreservingBom -Path $path -Text $new
    return $true
}

# Sisipkan kerangka entri CHANGELOG baru DI ATAS entri teratas (sebelum '## [' pertama).
# Tidak menghapus apa pun. Idempoten: kalau entri teratas SUDAH versi ini -> skip.
function Add-LintasChangelogSkeleton {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$NewVersion,
        [string]$Date,
        [string]$File = 'CHANGELOG.md'
    )
    if (-not $Date) { $Date = (Get-Date -Format 'yyyy-MM-dd') }
    $path = Join-Path $RepoRoot $File
    if (-not (Test-Path -LiteralPath $path)) { return $false }
    $raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $m = [regex]::Match($raw, '(?m)^## \[(\d+\.\d+\.\d+)\]')
    if (-not $m.Success) { return $false }
    if ($m.Groups[1].Value -eq $NewVersion) { return $false }  # idempoten: entri versi ini sudah ada
    $skeleton = "## [$NewVersion] - $Date`n`n### <Diubah/Ditambah/Diperbaiki> - <ringkas apa yang berubah + manfaatnya>`n`n- <ISI deskripsi (untuk programmer + non-programmer). Ganti baris placeholder ini.>`n`n"
    $new = $raw.Substring(0, $m.Index) + $skeleton + $raw.Substring($m.Index)
    Set-LintasFileTextPreservingBom -Path $path -Text $new
    return $true
}

# Bandingkan 2 versi semver "X.Y.Z". Return -1 (A<B) / 0 (sama) / 1 (A>B).
function Compare-LintasSemver {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$A, [Parameter(Mandatory)][string]$B)
    $pa = @($A.Split('.') | ForEach-Object { [int]$_ })
    $pb = @($B.Split('.') | ForEach-Object { [int]$_ })
    for ($i = 0; $i -lt 3; $i++) {
        if ($pa[$i] -lt $pb[$i]) { return -1 }
        if ($pa[$i] -gt $pb[$i]) { return 1 }
    }
    return 0
}

# ---- Orkestrasi cap versi (1-langkah) ----
# Guard: cuma jalan kalau package.json name == 'lintasai' (repo kit) supaya tak salah
# jalan di project staf. Tolak format invalid + tolak DOWNGRADE (cegah salah ketik).
function Invoke-LintasVersionBump {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$NewVersion,
        [string]$Date,
        [switch]$Quiet
    )
    if ($NewVersion -notmatch '^\d+\.\d+\.\d+$') {
        throw "Versi '$NewVersion' tidak valid. Format wajib BESAR.MENENGAH.KECIL (mis. 1.42.0)."
    }
    $pkgPath = Join-Path $RepoRoot 'package.json'
    if (-not (Test-Path -LiteralPath $pkgPath)) {
        throw "package.json tidak ada di $RepoRoot - ini bukan repo kit; bump dibatalkan."
    }
    $pkg = ([System.IO.File]::ReadAllText($pkgPath, [System.Text.Encoding]::UTF8)) | ConvertFrom-Json
    if ($pkg.name -ne 'lintasai') {
        throw "Perintah 'bump' cuma untuk repo kit lintasAI (package.json name='lintasai'), bukan project staf. Dibatalkan (name='$($pkg.name)')."
    }
    $current = [string]$pkg.version
    if ($current -and ($current -match '^\d+\.\d+\.\d+$')) {
        if ((Compare-LintasSemver -A $NewVersion -B $current) -lt 0) {
            throw "Versi baru $NewVersion LEBIH RENDAH dari versi sekarang $current (downgrade). Dibatalkan - kalau memang sengaja, ganti manual."
        }
    }

    $stamped = @()
    if (Set-LintasPackageJsonVersion -RepoRoot $RepoRoot -NewVersion $NewVersion) { $stamped += 'package.json' }
    foreach ($check in $script:KitVersionChecks) {
        if ($check.UseChangelogParser) {
            if (Add-LintasChangelogSkeleton -RepoRoot $RepoRoot -NewVersion $NewVersion -Date $Date) { $stamped += "$($check.File) (kerangka entri baru)" }
        } elseif ($check.Pattern) {
            if (Set-LintasDeclaredVersion -RepoRoot $RepoRoot -Check $check -NewVersion $NewVersion) { $stamped += $check.File }
        }
    }

    if (-not $Quiet) {
        Write-Host ""
        Write-Host ("Cap versi: {0} -> {1}" -f $current, $NewVersion) -ForegroundColor Cyan
        foreach ($s in $stamped) { Write-Host ("  [stamped] {0}" -f $s) -ForegroundColor Green }
        Write-Host ""
    }

    return [pscustomobject]@{
        OldVersion = $current
        NewVersion = $NewVersion
        Stamped    = $stamped
    }
}

# ---- Bootstrap: dot-source dependency + auto-run kalau dijalankan langsung ----
# Resolve repo root (default = induk lib/).
if (-not $RepoRoot) {
    $RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..') | Select-Object -ExpandProperty Path
}

# Dot-source parser CHANGELOG dari LOKASI SKRIP INI (bukan RepoRoot) supaya tetap ketemu
# saat robot dipakai di project staff (.claude-kit/lib/) dengan -RepoRoot = akar project.
. (Join-Path $PSScriptRoot 'version-detect.ps1')

# Auto-run HANYA kalau dijalankan langsung (bukan dot-source dari test).
# Saat dot-source, $MyInvocation.InvocationName = '.' -> lewati (test panggil fungsi sendiri).
if ($MyInvocation.InvocationName -ne '.') {
    if ($SetVersion) {
        # MODE CAP VERSI: stamp dulu, lalu lanjut pemeriksaan kecocokan (verifikasi hasil).
        $null = Invoke-LintasVersionBump -RepoRoot $RepoRoot -NewVersion $SetVersion
    }
    $result = Invoke-LintasConsistencyCheck -RepoRoot $RepoRoot -ChecksFile $ChecksFile -Quiet:$Quiet
    exit $result.MismatchCount
}
