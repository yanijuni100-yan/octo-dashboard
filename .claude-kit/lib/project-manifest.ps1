<#
.SYNOPSIS
  lib/project-manifest.ps1 - Pembaca + robot pemeriksa "kartu identitas project" (project.lintas.psd1).

.DESCRIPTION
  "Kartu identitas project" = SUMBER-TUNGGAL mesin-baca untuk identitas + struktur project client
  lintasAI. Tujuan: AI baca 1 tempat (tak meraba-raba tiap sesi = cepat + hemat token), dan
  ubah/baca project cukup di 1 tempat (visi owner: kayak $variable PHP / const React).

  KENAPA .psd1 (bukan JSON/YAML):
   - PowerShell 5.1 membacanya NATIVE via Import-PowerShellDataFile (data-only, tidak eksekusi kode)
     -> nol parser tambahan, nol risiko. (YAML TIDAK bisa native di PS 5.1 -> itu sebabnya
     lintasai-portfolio.yml gagal jadi sumber: tak ada yang mem-parse-nya.)
   - .psd1 bisa komentar '#' inline -> staff non-programmer baca penjelasan tiap kolom langsung.

  PRINSIP "deklarasi 1x, sisanya merujuk" (anti-duplikasi):
   - declared-here : fakta yang TAK bisa ditebak mesin (intent, modules->path, conventions, split).
   - derived-from  : ringkasan turunan (stack) -> diverifikasi cocok sumber asli (package.json).
   - referenced    : pointer ke sumber lain (kit_version, architecture.md) -> JANGAN salin nilainya.

  ROBOT ANTI-BASI (inti nilai manifest - tanpa ini, manifest = catatan mati seperti portfolio.yml):
   - PARSE-OK    : berkas bisa di-baca (tidak rusak) + punya schema_version.
   - PathExists  : tiap modules[].path + refs[] yang dideklarasikan WAJIB ada di disk.
   - DeriveMatch : ringkasan derive (stack) masih cocok dengan sumber aslinya (package.json/lockfile).
   Konservatif: hanya MISMATCH bila bukti jelas (anti alarm-palsu, selaras CLAUDE_universal sec. 8.2).

  Manifest OPSIONAL: project tanpa project.lintas.psd1 -> Present=$false, MismatchCount=0 (bukan error).

  Fungsi yang di-export:
    - Resolve-LintasManifestPath  : cari project.lintas.psd1 (default di akar RepoRoot).
    - Read-LintasProjectManifest  : baca + PARSE-OK (return @{ Ok; Manifest; Error }).
    - Get-LintasManifestSchemaFinding : cek schema_version + struktur dasar.
    - Get-LintasManifestFinding   : array temuan PathExists + DeriveMatch (objek terstruktur).
    - Invoke-LintasManifestCheck  : orkestrasi + (opsional) cetak laporan; return ringkasan.
    - Get-LintasDerivedStack      : derive {type;package_manager;frameworks} dari package.json.
    - Get-LintasManifestStarterContent : bangun TEKS .psd1 starter (lahir terisi + ber-komentar).
    - Write-LintasProjectManifestIfMissing : tulis kartu di akar project kalau belum ada (idempoten).
    - Get-LintasRegistryFinding    : array temuan registry docs (MISSING/ORPHAN) vs architecture_auto.md.
    - Invoke-LintasRegistryCheck   : orkestrasi cek registry + (opsional) cetak laporan; return ringkasan.
    - Add-LintasMissingRegistryEntry : APPEND entri docs/*.md yang belum terdaftar ke registry (tak menimpa).

.NOTES
  Versi  : 1.0.0
  Tanggal: 2026-06-18
  Target : PowerShell 5.1+ (Windows PowerShell) dan PowerShell 7+.
  Catatan: Saat dot-source (test) -> hanya definisi fungsi, tidak auto-run (InvocationName = '.').
           Saat dijalankan langsung -> cetak laporan + exit code = jumlah ketidakcocokan (0 = bersih).
#>

[CmdletBinding()]
param(
    # Akar project yang diperiksa. Default = folder kerja saat ini.
    [string]$RepoRoot,

    # Opsional: path manifest eksplisit. Kalau tidak, cari default (akar RepoRoot).
    [string]$ManifestPath,

    # Kalau di-set, jangan cetak apa pun (dipakai test). Tetap return objek.
    [switch]$Quiet
)

# Nama berkas manifest baku (sumber tunggal nama -> hindari salah ketik tersebar).
$script:LintasManifestFileName = 'project.lintas.psd1'

# Peta package-manager -> lockfile-nya (untuk DeriveMatch konservatif).
$script:LintasLockfiles = @{
    pnpm = 'pnpm-lock.yaml'
    npm  = 'package-lock.json'
    yarn = 'yarn.lock'
    bun  = 'bun.lockb'
}

# ---- Cari path manifest (default = akar RepoRoot) ----
function Resolve-LintasManifestPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [string]$ManifestPath
    )
    if ($ManifestPath) { return $ManifestPath }
    return (Join-Path $RepoRoot $script:LintasManifestFileName)
}

# ---- Baca manifest + PARSE-OK ----
# Return: @{ Ok=$bool; Present=$bool; Manifest=<hashtable|null>; Error=<string|null>; Path=<string> }
# Import-PowerShellDataFile = aman (data-only, tidak eksekusi kode). Malformed -> Ok=$false + Error.
function Read-LintasProjectManifest {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return @{ Ok = $false; Present = $false; Manifest = $null; Error = $null; Path = $Path }
    }
    try {
        $data = Import-PowerShellDataFile -LiteralPath $Path -ErrorAction Stop
        return @{ Ok = $true; Present = $true; Manifest = $data; Error = $null; Path = $Path }
    } catch {
        return @{ Ok = $false; Present = $true; Manifest = $null; Error = $_.Exception.Message; Path = $Path }
    }
}

# ---- Cek schema dasar (schema_version ada + integer >= 1) ----
# Return: array temuan (Kind='Schema').
function Get-LintasManifestSchemaFinding {
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$Manifest)

    $findings = @()
    if (-not $Manifest.ContainsKey('schema_version')) {
        $findings += [pscustomobject]@{ Kind = 'Schema'; Field = 'schema_version'; Expected = 'integer >= 1'; Found = '(tidak ada)'; Status = 'MISMATCH' }
    } else {
        $sv = $Manifest.schema_version
        $isValid = ($sv -is [int]) -and ($sv -ge 1)
        $findings += [pscustomobject]@{
            Kind = 'Schema'; Field = 'schema_version'; Expected = 'integer >= 1'
            Found = [string]$sv; Status = $(if ($isValid) { 'OK' } else { 'MISMATCH' })
        }
    }
    return @($findings)
}

# ---- Helper: baca semua nama dependency (deps + devDeps) dari package.json ----
# Return: array string nama paket; @() kalau package.json tak ada / tak ber-deps.
function Get-LintasPackageJsonDependency {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$RepoRoot)
    $pkgPath = Join-Path $RepoRoot 'package.json'
    if (-not (Test-Path -LiteralPath $pkgPath)) { return @() }
    try {
        $pkg = ([System.IO.File]::ReadAllText($pkgPath, [System.Text.Encoding]::UTF8)) | ConvertFrom-Json
    } catch { return @() }
    $names = @()
    foreach ($section in @('dependencies', 'devDependencies')) {
        if ($pkg.PSObject.Properties.Name -contains $section -and $pkg.$section) {
            $names += @($pkg.$section.PSObject.Properties.Name)
        }
    }
    return @($names)
}

# ---- Inti: kumpulkan temuan PathExists + DeriveMatch ----
# Konservatif: SKIP (tidak dihitung) kalau bukti kurang untuk menuduh basi (anti alarm-palsu).
function Get-LintasManifestFinding {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][hashtable]$Manifest
    )
    $findings = @()

    # --- PathExists: modules[].path ---
    if ($Manifest.ContainsKey('modules') -and $Manifest.modules) {
        foreach ($m in @($Manifest.modules)) {
            if (-not ($m -is [hashtable]) -or -not $m.ContainsKey('path') -or -not $m.path) { continue }
            $rel = [string]$m.path
            $full = Join-Path $RepoRoot $rel
            $exists = Test-Path -LiteralPath $full
            $name = if ($m.ContainsKey('name')) { [string]$m.name } else { $rel }
            $findings += [pscustomobject]@{
                Kind = 'PathExists'; Field = "module:$name"; Expected = "ada di disk: $rel"
                Found = $(if ($exists) { $rel } else { '(tidak ada di disk)' })
                Status = $(if ($exists) { 'OK' } else { 'MISSING' })
            }
        }
    }

    # --- PathExists: refs.* (pointer ke artefak prosa) ---
    if ($Manifest.ContainsKey('refs') -and $Manifest.refs -is [hashtable]) {
        foreach ($key in @('architecture', 'glossary', 'registry')) {
            if ($Manifest.refs.ContainsKey($key) -and $Manifest.refs.$key) {
                $rel = [string]$Manifest.refs.$key
                $full = Join-Path $RepoRoot $rel
                $exists = Test-Path -LiteralPath $full
                $findings += [pscustomobject]@{
                    Kind = 'PathExists'; Field = "ref:$key"; Expected = "ada di disk: $rel"
                    Found = $(if ($exists) { $rel } else { '(tidak ada di disk)' })
                    Status = $(if ($exists) { 'OK' } else { 'MISSING' })
                }
            }
        }
    }

    # --- DeriveMatch: stack vs package.json (konservatif) ---
    if ($Manifest.ContainsKey('stack') -and $Manifest.stack -is [hashtable]) {
        $deps = Get-LintasPackageJsonDependency -RepoRoot $RepoRoot

        # frameworks: tiap framework yang dideklarasikan harus muncul (substring) di salah satu nama dep.
        # SKIP kalau package.json tak ada / tak ber-deps (tak bisa verifikasi -> jangan alarm-palsu).
        if ($Manifest.stack.ContainsKey('frameworks') -and $Manifest.stack.frameworks -and $deps.Count -gt 0) {
            foreach ($fw in @($Manifest.stack.frameworks)) {
                $fwStr = [string]$fw
                $matched = @($deps | Where-Object { $_ -like "*$fwStr*" }).Count -gt 0
                $findings += [pscustomobject]@{
                    Kind = 'DeriveMatch'; Field = "stack.framework:$fwStr"; Expected = 'ada di package.json deps'
                    Found = $(if ($matched) { 'ada' } else { '(tidak ada di deps)' })
                    Status = $(if ($matched) { 'OK' } else { 'MISMATCH' })
                }
            }
        }

        # package_manager: hanya MISMATCH bila lockfile pm-yang-dideklarasikan TAK ADA
        # PADAHAL lockfile pm LAIN ADA (kontradiksi jelas). Selain itu -> SKIP (jangan alarm-palsu).
        if ($Manifest.stack.ContainsKey('package_manager') -and $Manifest.stack.package_manager) {
            $pm = [string]$Manifest.stack.package_manager
            if ($script:LintasLockfiles.ContainsKey($pm)) {
                $declaredLock = $script:LintasLockfiles[$pm]
                $declaredLockExists = Test-Path -LiteralPath (Join-Path $RepoRoot $declaredLock)
                $otherLockExists = $false
                foreach ($otherPm in $script:LintasLockfiles.Keys) {
                    if ($otherPm -eq $pm) { continue }
                    if (Test-Path -LiteralPath (Join-Path $RepoRoot $script:LintasLockfiles[$otherPm])) { $otherLockExists = $true; break }
                }
                if (-not $declaredLockExists -and $otherLockExists) {
                    $findings += [pscustomobject]@{
                        Kind = 'DeriveMatch'; Field = 'stack.package_manager'; Expected = "lockfile $declaredLock ada"
                        Found = "(tidak ada; lockfile pm lain ada)"; Status = 'MISMATCH'
                    }
                } else {
                    $findings += [pscustomobject]@{
                        Kind = 'DeriveMatch'; Field = 'stack.package_manager'; Expected = "$pm"
                        Found = $(if ($declaredLockExists) { "$declaredLock ada" } else { '(tak bisa verifikasi)' })
                        Status = $(if ($declaredLockExists) { 'OK' } else { 'SKIP' })
                    }
                }
            }
        }
    }

    return @($findings)
}

# ---- Orkestrasi: jalankan + (opsional) cetak laporan ----
# MismatchCount = jumlah status MISMATCH/MISSING + (parse gagal = 1). SKIP & OK tidak dihitung.
function Invoke-LintasManifestCheck {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [string]$ManifestPath,
        [switch]$Quiet
    )

    $path = Resolve-LintasManifestPath -RepoRoot $RepoRoot -ManifestPath $ManifestPath
    $read = Read-LintasProjectManifest -Path $path

    # Manifest tidak ada -> opsional, bukan error.
    if (-not $read.Present) {
        if (-not $Quiet) { Write-Host ("[INFO] Tidak ada {0} di {1} - kartu identitas project belum dibuat (opsional)." -f $script:LintasManifestFileName, $RepoRoot) -ForegroundColor DarkGray }
        return [pscustomobject]@{ Present = $false; Ok = $true; Findings = @(); MismatchCount = 0; Path = $path }
    }

    # Manifest ada tapi rusak -> PARSE-OK gagal = 1 mismatch.
    if (-not $read.Ok) {
        $finding = [pscustomobject]@{ Kind = 'ParseOk'; Field = '(berkas)'; Expected = 'bisa di-baca (.psd1 valid)'; Found = "RUSAK: $($read.Error)"; Status = 'MISMATCH' }
        if (-not $Quiet) {
            Write-Host ""
            Write-Host ("Kartu identitas project RUSAK - tidak bisa di-baca: {0}" -f $path) -ForegroundColor Red
            Write-Host ("  {0}" -f $read.Error) -ForegroundColor Red
            Write-Host ""
        }
        return [pscustomobject]@{ Present = $true; Ok = $false; Findings = @($finding); MismatchCount = 1; Path = $path }
    }

    $findings = @()
    $findings += Get-LintasManifestSchemaFinding -Manifest $read.Manifest
    $findings += Get-LintasManifestFinding -RepoRoot $RepoRoot -Manifest $read.Manifest
    $bad = @($findings | Where-Object { $_.Status -eq 'MISMATCH' -or $_.Status -eq 'MISSING' })

    if (-not $Quiet) {
        Write-Host ""
        Write-Host "Robot pemeriksa kartu identitas project (project.lintas.psd1)" -ForegroundColor Cyan
        Write-Host ("Berkas: {0}" -f $path)
        Write-Host ("-" * 64)
        foreach ($f in $findings) {
            switch ($f.Status) {
                'OK'       { Write-Host ("  [OK]       {0,-26} {1}" -f $f.Field, $f.Found) -ForegroundColor Green }
                'MISMATCH' { Write-Host ("  [TAK COCOK] {0,-25} {1} -> HARUS {2}" -f $f.Field, $f.Found, $f.Expected) -ForegroundColor Red }
                'MISSING'  { Write-Host ("  [HILANG]   {0,-26} {1}" -f $f.Field, $f.Expected) -ForegroundColor Red }
                'SKIP'     { Write-Host ("  [LEWAT]    {0,-26} {1}" -f $f.Field, '(tak bisa verifikasi - dilewati)') -ForegroundColor DarkGray }
            }
        }
        Write-Host ("-" * 64)
        if ($bad.Count -eq 0) {
            Write-Host ("BERSIH: kartu identitas cocok dengan kenyataan project." ) -ForegroundColor Green
        } else {
            Write-Host ("{0} ketidakcocokan - kartu identitas BASI, perbaiki sebelum rilis." -f $bad.Count) -ForegroundColor Red
        }
        Write-Host ""
    }

    return [pscustomobject]@{
        Present       = $true
        Ok            = ($bad.Count -eq 0)
        Findings      = @($findings)
        MismatchCount = $bad.Count
        Path          = $path
    }
}

# ============================================================================
# BOOTSTRAP WRITER (Increment 2) - tulis kartu identitas saat pasang (lahir terisi)
# WHY: manifest yang dikirim KOSONG [TBD] pasti terbengkalai (nasib architecture.md).
# Maka stack di-DERIVE otomatis dari package.json saat pasang; intent ditandai 'pending'
# (AI isi sesi pertama). Idempoten: kalau sudah ada, TIDAK ditimpa (knowledge user aman).
# ============================================================================

# Derive ringkasan stack dari package.json + lockfile (self-contained, tak butuh project-detect).
# Return: @{ type; package_manager; frameworks }.
function Get-LintasDerivedStack {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$RepoRoot)
    $pkgPath = Join-Path $RepoRoot 'package.json'
    if (-not (Test-Path -LiteralPath $pkgPath)) {
        return @{ type = 'unknown'; package_manager = $null; frameworks = @() }
    }
    $deps = Get-LintasPackageJsonDependency -RepoRoot $RepoRoot
    $pm = $null
    foreach ($k in $script:LintasLockfiles.Keys) {
        if (Test-Path -LiteralPath (Join-Path $RepoRoot $script:LintasLockfiles[$k])) { $pm = $k; break }
    }
    # Token framework dikenal -> nama ringkas. Cocok via substring nama dep (cukup untuk starter).
    $known = @(
        @{ Token = 'next';          Name = 'next' }
        @{ Token = 'nuxt';          Name = 'nuxt' }
        @{ Token = '@angular/core'; Name = 'angular' }
        @{ Token = 'svelte';        Name = 'svelte' }
        @{ Token = 'vue';           Name = 'vue' }
        @{ Token = 'react';         Name = 'react' }
        @{ Token = '@nestjs/core';  Name = 'nestjs' }
        @{ Token = 'express';       Name = 'express' }
        @{ Token = 'fastify';       Name = 'fastify' }
        @{ Token = 'prisma';        Name = 'prisma' }
        @{ Token = 'drizzle-orm';   Name = 'drizzle' }
    )
    $fw = @()
    foreach ($entry in $known) {
        if (@($deps | Where-Object { $_ -like "*$($entry.Token)*" }).Count -gt 0) { $fw += $entry.Name }
    }
    return @{ type = 'node'; package_manager = $pm; frameworks = @($fw | Select-Object -Unique) }
}

# Bangun TEKS .psd1 starter (lahir terisi + ber-komentar). Refs = hashtable path-ref yang ADA.
function Get-LintasManifestStarterContent {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][hashtable]$Stack,
        [hashtable]$Refs
    )
    $pmText = if ($Stack.package_manager) { "'" + $Stack.package_manager + "'" } else { '$null' }
    $fwItems = @(@($Stack.frameworks) | ForEach-Object { "'" + $_ + "'" })
    $fwText = if ($fwItems.Count -gt 0) { '@(' + ($fwItems -join ', ') + ')' } else { '@()' }

    $lines = @(
        '@{'
        '    # project.lintas.psd1 - KARTU IDENTITAS PROJECT (di-generate saat pasang lintasAI)'
        '    # Sumber-tunggal mesin-baca: AI baca 1 tempat (tak meraba tiap sesi). Dijaga robot anti-basi.'
        '    # Kolom stack diisi OTOMATIS dari package.json; intent diisi AI di sesi pertama.'
        ''
        '    schema_version = 1'
        ''
        "    # DEKLARASI: tujuan project (AI isi sesi pertama - ganti 'pending')."
        '    intent = @{'
        "        purpose = 'pending'"
        "        domain  = 'pending'"
        '    }'
        ''
        '    # DERIVE: diisi otomatis dari package.json. Robot cek masih cocok (DeriveMatch).'
        '    stack = @{'
        ("        type            = '" + $Stack.type + "'")
        ("        package_manager = " + $pmText)
        ("        frameworks      = " + $fwText)
        "        _derived_from   = 'package.json'"
        '    }'
        ''
        '    # RUJUK: pointer ke sumber lain - JANGAN salin nilainya.'
        '    refs = @{'
        "        kit_version = '.claude-kit/.install-manifest.json#metadata.kit_version'"
    )
    if ($Refs) {
        foreach ($k in @('architecture', 'glossary', 'registry')) {
            if ($Refs.ContainsKey($k) -and $Refs[$k]) {
                $lines += ("        " + $k + " = '" + $Refs[$k] + "'")
            }
        }
    }
    $lines += @(
        '    }'
        ''
        '    # DEKLARASI inti: peta modul -> lokasi (AI isi saat tahu struktur). Robot cek path ADA.'
        '    modules = @()'
        ''
        '    # DEKLARASI: konvensi mesin-relevan singkat (AI/tim isi).'
        '    conventions = @()'
        ''
        '    # (multi-repo, opsional) - CATATAN niat, BUKAN keamanan (akses nyata di GitHub+CODEOWNERS).'
        '    split = @{'
        '        role          = $null'
        '        access_tier   = $null'
        '        base_name     = $null'
        '        portfolio_ref = $null'
        '    }'
        '}'
    )
    return (($lines -join "`n") + "`n")
}

# Tulis project.lintas.psd1 di akar RepoRoot KALAU belum ada (idempoten). -Force timpa.
# Return: pscustomobject @{ Written; Path; Reason } (Reason: created|exists|whatif).
function Write-LintasProjectManifestIfMissing {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [switch]$Force
    )
    $path = Resolve-LintasManifestPath -RepoRoot $RepoRoot
    if ((Test-Path -LiteralPath $path) -and -not $Force) {
        return [pscustomobject]@{ Written = $false; Path = $path; Reason = 'exists' }
    }
    $stack = Get-LintasDerivedStack -RepoRoot $RepoRoot
    $refs = @{}
    $refCandidates = @(
        @{ Key = 'architecture'; File = 'docs/architecture.md' }
        @{ Key = 'glossary';     File = 'docs/glossary.md' }
        @{ Key = 'registry';     File = 'docs/architecture_auto.md' }
    )
    foreach ($rc in $refCandidates) {
        if (Test-Path -LiteralPath (Join-Path $RepoRoot $rc.File)) { $refs[$rc.Key] = $rc.File }
    }
    $content = Get-LintasManifestStarterContent -Stack $stack -Refs $refs
    if ($PSCmdlet.ShouldProcess($path, 'Tulis kartu identitas project')) {
        [System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))
        return [pscustomobject]@{ Written = $true; Path = $path; Reason = 'created' }
    }
    return [pscustomobject]@{ Written = $false; Path = $path; Reason = 'whatif' }
}

# ============================================================================
# REGISTRY ROBOT - anti-basi architecture_auto.md (tiap docs/*.md WAJIB terdaftar)
# WHY: registry docs di-maintain AI manual (sec. 7.4); AI bisa LUPA daftarkan .md baru
# -> registry tak cocok isi docs/ nyata (drift diakui di PETA_SUMBER_KEBENARAN). Robot ini
# bandingkan docs/*.md vs registry deterministik (~detik, ~0 token):
#   MISSING = ada .md belum terdaftar di architecture_auto.md.
#   ORPHAN  = entri/link registry menunjuk berkas yang sudah tak ada.
# ============================================================================

$script:LintasRegistryRelPath = 'docs/architecture_auto.md'
# Berkas indeks itu sendiri TIDAK dihitung sebagai "pendamping yang harus terdaftar".
$script:LintasRegistryExclude = @('architecture_auto.md', 'architecture.md')

function Get-LintasRegistryFinding {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$RepoRoot)

    $registryPath = Join-Path $RepoRoot $script:LintasRegistryRelPath
    $docsDir = Join-Path $RepoRoot 'docs'
    $findings = @()
    if (-not (Test-Path -LiteralPath $registryPath)) { return @($findings) }  # registry opsional
    if (-not (Test-Path -LiteralPath $docsDir)) { return @($findings) }

    $registryText = [System.IO.File]::ReadAllText($registryPath, [System.Text.Encoding]::UTF8)

    # MISSING: tiap docs/**/*.md (kecuali indeks) harus disebut (basename) di registry.
    # Pakai boundary non-alfanumerik di depan nama supaya 'auth.md' TIDAK keliru cocok di 'oauth.md'.
    $docFiles = Get-ChildItem -LiteralPath $docsDir -Recurse -File -Filter '*.md' -ErrorAction SilentlyContinue
    foreach ($df in $docFiles) {
        if ($script:LintasRegistryExclude -contains $df.Name) { continue }
        $registered = [regex]::IsMatch($registryText, '(?<![A-Za-z0-9])' + [regex]::Escape($df.Name))
        $findings += [pscustomobject]@{
            Kind = 'Registry'; Field = "docs/$($df.Name)"; Expected = 'terdaftar di architecture_auto.md'
            Found = $(if ($registered) { 'terdaftar' } else { '(belum terdaftar)' })
            Status = $(if ($registered) { 'OK' } else { 'MISSING' })
        }
    }

    # ORPHAN: tiap link [text](target.md) di registry -> target harus ada di disk.
    # Lewati link eksternal/parent/absolut (anti alarm-palsu).
    $linkMatches = [regex]::Matches($registryText, '\]\(([^)]+\.md)\)')
    foreach ($lm in $linkMatches) {
        $target = $lm.Groups[1].Value
        if ($target -match '^(https?:|\.\./|/)') { continue }
        $targetPath = Join-Path $docsDir ($target -replace '/', '\')
        if (-not (Test-Path -LiteralPath $targetPath)) {
            $findings += [pscustomobject]@{
                Kind = 'Registry'; Field = "link:$target"; Expected = 'berkas tertaut ada di disk'
                Found = '(berkas tak ada -> entri yatim)'; Status = 'ORPHAN'
            }
        }
    }
    return @($findings)
}

function Invoke-LintasRegistryCheck {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [switch]$Quiet
    )
    $registryPath = Join-Path $RepoRoot $script:LintasRegistryRelPath
    if (-not (Test-Path -LiteralPath $registryPath)) {
        if (-not $Quiet) { Write-Host ("[INFO] Tidak ada {0} - registry docs belum dibuat (opsional)." -f $script:LintasRegistryRelPath) -ForegroundColor DarkGray }
        return [pscustomobject]@{ Present = $false; Ok = $true; Findings = @(); MismatchCount = 0 }
    }
    $findings = Get-LintasRegistryFinding -RepoRoot $RepoRoot
    $bad = @($findings | Where-Object { $_.Status -ne 'OK' })
    if (-not $Quiet) {
        Write-Host ""
        Write-Host "Robot pemeriksa registry docs (architecture_auto.md)" -ForegroundColor Cyan
        Write-Host ("-" * 64)
        foreach ($f in $findings) {
            switch ($f.Status) {
                'OK'      { Write-Host ("  [OK]              {0}" -f $f.Field) -ForegroundColor Green }
                'MISSING' { Write-Host ("  [BELUM TERDAFTAR] {0}" -f $f.Field) -ForegroundColor Red }
                'ORPHAN'  { Write-Host ("  [YATIM]           {0} {1}" -f $f.Field, $f.Found) -ForegroundColor Red }
            }
        }
        Write-Host ("-" * 64)
        if ($bad.Count -eq 0) { Write-Host "BERSIH: registry cocok dengan isi docs/." -ForegroundColor Green }
        else { Write-Host ("{0} ketidakcocokan registry - perbarui architecture_auto.md." -f $bad.Count) -ForegroundColor Red }
        Write-Host ""
    }
    return [pscustomobject]@{ Present = $true; Ok = ($bad.Count -eq 0); Findings = @($findings); MismatchCount = $bad.Count }
}

# APPEND entri yang hilang ke registry (BUKAN read-only -> JANGAN dipanggil di gerbang verifikasi).
# Aman: append-only (tak pernah menimpa/menghapus entri/ringkasan yang sudah ada). Ringkasan diisi
# placeholder '<ringkasan: AI lengkapi>' -> AI/manusia lengkapi (robot cek tak butuh isi ringkasan).
# Idempoten: kalau semua sudah terdaftar -> Changed=$false. Kalau registry belum ada -> tak bikin baru
# (di luar lingkup "append"); pakai aturan sec. 7.4 untuk membuat registry awal.
function Add-LintasMissingRegistryEntry {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$RepoRoot)

    $registryPath = Join-Path $RepoRoot $script:LintasRegistryRelPath
    if (-not (Test-Path -LiteralPath $registryPath)) {
        return [pscustomobject]@{ Changed = $false; Added = @(); Reason = 'no-registry'; Path = $registryPath }
    }
    $missing = @(
        Get-LintasRegistryFinding -RepoRoot $RepoRoot |
            Where-Object { $_.Status -eq 'MISSING' } |
            ForEach-Object { $_.Field -replace '^docs/', '' }
    )
    if ($missing.Count -eq 0) {
        return [pscustomobject]@{ Changed = $false; Added = @(); Reason = 'already-complete'; Path = $registryPath }
    }
    $registryText = [System.IO.File]::ReadAllText($registryPath, [System.Text.Encoding]::UTF8)
    $heading = '## Auto-terdaftar (AI: lengkapi ringkasan)'
    $sep = if ($registryText.EndsWith("`n")) { '' } else { "`n" }
    $block = if ($registryText -notmatch [regex]::Escape($heading)) { "$sep`n$heading`n`n" } else { $sep }
    foreach ($name in $missing) {
        $block += "- [$name]($name) - <ringkasan: AI lengkapi>`n"
    }
    if ($PSCmdlet.ShouldProcess($registryPath, "Tambah $($missing.Count) entri registry yang hilang")) {
        [System.IO.File]::AppendAllText($registryPath, $block, (New-Object System.Text.UTF8Encoding $false))
        return [pscustomobject]@{ Changed = $true; Added = @($missing); Reason = 'appended'; Path = $registryPath }
    }
    return [pscustomobject]@{ Changed = $false; Added = @($missing); Reason = 'whatif'; Path = $registryPath }
}

# ---- Bootstrap: auto-run kalau dijalankan langsung (bukan dot-source dari test) ----
# Saat dot-source (test / setup-pola-b) -> InvocationName='.' -> lewati (tak polusi scope caller).
# Jalankan KEDUA robot pengetahuan project: kartu identitas + registry docs (KEDUANYA read-only).
if ($MyInvocation.InvocationName -ne '.') {
    if (-not $RepoRoot) { $RepoRoot = (Get-Location).Path }
    $mResult = Invoke-LintasManifestCheck -RepoRoot $RepoRoot -ManifestPath $ManifestPath -Quiet:$Quiet
    $rResult = Invoke-LintasRegistryCheck -RepoRoot $RepoRoot -Quiet:$Quiet
    exit ($mResult.MismatchCount + $rResult.MismatchCount)
}
