<#
.SYNOPSIS
  lib/stack-check.ps1 - "Robot pemeriksa mutu kode per-bahasa" (deterministik, cuma-periksa).

.DESCRIPTION
  Masalah yang dipecahkan: Paket Stack (WORKFLOWS sec. 4.14) berisi checklist mutu per-bahasa
  (Python/Go/Rust/PHP/Node-TS) yang SELAMA INI cuma PRINSIP teks - AI baca + terapkan secara
  manual. Onderdil "review per-bahasa" ECC (agents/*-reviewer) MENJALANKAN alat nyata (go vet,
  ruff, mypy, clippy, ...). Robot ini menutup gap itu: ia auto-deteksi bahasa sebuah gudang kode,
  lalu MENJALANKAN alat-cek STATIS standar bahasa itu, dan menyerahkan hasil mentahnya ke AI untuk
  diterjemahkan ke bahasa awam. Pas untuk project tim terbagi-repo (frontend=node, backend=python/go).

  Pembagian peran (sama pola lib/ai-config-check.ps1): ROBOT kasih FAKTA (alat apa jalan, kode-keluar,
  cuplikan keluaran), AI kasih MAKNA (terjemah jargon alat + tentukan tingkat sebenarnya + saran).

  BATAS YANG JUJUR (penting - jangan diklaim lebih dari ini):
  1. CUMA alat STATIS (baca-saja): vet/lint/type-check/security-scan. Robot TIDAK menjalankan TES
     (`pytest`/`go test`/`cargo test`) - tes MENJALANKAN kode project (bisa sentuh DB/jaringan), jadi
     bukan "cuma-baca" (sec. 8.2 Aturan 3). Urusan tes = pola terpisah (WORKFLOWS sec. 4.15-B).
  2. TIDAK auto-perbaiki: pakai mode "cek" saja (eslint tanpa --fix, clippy bukan cargo-fix,
     pint --test). Perbaikan = keputusan owner (sec. 4.6 owner-gated). Robot tak pernah ubah berkas.
  3. CONFIG-GATED (anti alarm-palsu): sebuah alat hanya dijalankan kalau config-nya ADA (mis. tsc
     hanya kalau ada tsconfig.json; eslint hanya kalau ada config eslint; npm audit hanya kalau ada
     package-lock.json). Sebab: sebuah gudang bisa punya package.json tapi BUKAN app TS (mis. repo
     kit ini sendiri) - tanpa config-gate, alat node akan error/alarm-palsu.
  4. CEK ALAT DULU (sec. 6.3 #4 "timbangan mati tunjuk 0 kg bukan berarti barang nol"): kalau alat
     belum terpasang -> dilaporkan "DILEWATI", BUKAN diam-diam "0 masalah". Alat absen/error != bersih.
  5. ANTI-INJEKSI: daftar perintah alat = KONSTANTA di skrip ini (whitelist); satu-satunya input dari
     project = JENIS bahasa (dari nama berkas penanda). Tidak ada perintah yang dirakit dari isi project.
  6. Menjalankan toolchain project tetap memuat config project (mis. eslint.config.js = kode JS).
     Jalankan hanya di repo TEPERCAYA (sama prinsip menjalankan `npm install`).

  Tingkat keseriusan (bahasa non-programmer, sec. 2.1 #7): GENTING / PENTING / RAPIKAN.
  Robot SENGAJA tak pernah menandai GENTING (ia tak bisa menilai tingkat keamanan sebuah temuan secara
  deterministik) -> semua temuan alat = PENTING (peringatan); AI yang baca keluaran lalu MENAIKKAN ke
  GENTING kalau memang soal keamanan. Akibatnya gerbang (sec. 4.6) TIDAK pernah hard-fail dari robot ini
  = mutu kode bersifat saran owner-gated, bukan stempel LULUS/TOLAK otomatis (selaras sec. 8.2).

  Fungsi yang di-export:
    - Get-LintasStackToolSpec     : daftar spesifikasi alat-cek untuk sebuah jenis stack.
    - Get-LintasStackApplicability : 'run' | 'skip-not-configured' | 'skip-missing-tool' untuk 1 alat.
    - Invoke-LintasStackTool      : jalankan 1 alat (batas-waktu) -> { Ran; ExitCode; Output; TimedOut }.
    - Get-LintasStackFinding      : klasifikasi hasil-jalan 1 alat -> array temuan (PENTING/...) [murni].
    - Invoke-LintasStackCheck     : orkestrasi penuh. Returns { Stack; Findings; Count; Genting;
                                    Penting; Rapikan; Ran; SkippedMissingTool; SkippedNotConfigured }.

.NOTES
  Versi  : 1.0.0
  Tanggal: 2026-06-20
  Inspirasi: pola review per-bahasa ECC v2.0.0 (MIT) `agents/*-reviewer` + `*-build-resolver`
             (go/python/rust/django/php/react) - perintah toolchain-nya diadaptasi (sudah dikutip di
             WORKFLOWS sec. 4.14), ditulis-ulang sebagai ROBOT deterministik bahasa awam + label
             GENTING/PENTING/RAPIKAN + config-gated. Saudara lib/ai-config-check.ps1 +
             lib/unicode-safety-check.ps1 + lib/consistency-check.ps1. Selaras ADR-001 (robot
             deterministik, BUKAN hook Claude Code; keputusan owner-gated).
#>
[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string]$Stack,
    [int]$TimeoutSec = 120,
    [switch]$NoRun,
    [switch]$Quiet
)

# Pakai-ulang deteksi stack yang sudah ada (Get-StackType) - jangan duplikasi (sec. 5 reuse).
# project-detect.ps1 = fungsi murni tanpa auto-run, jadi aman di dot-source.
. (Join-Path $PSScriptRoot 'project-detect.ps1')

# ---- Spesifikasi alat-cek per bahasa (KONSTANTA - whitelist, tak dirakit dari project) ----
# RequiresAny = config-gate: alat hanya dipertimbangkan kalau SALAH SATU berkas ini ADA di akar gudang.
# Args = mode "cek/baca-saja" (TANPA --fix). Category cuma untuk pesan (lint/type/security).
function Get-LintasStackToolSpec {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$Stack)

    $specs = @{
        node   = @(
            @{ Lang = 'node';   Tool = 'tsc';         Args = @('--noEmit');            Category = 'type';     Why = 'Cek tipe TypeScript (tanpa hasilkan berkas)'; RequiresAny = @('tsconfig.json') }
            @{ Lang = 'node';   Tool = 'eslint';      Args = @('.');                   Category = 'lint';     Why = 'Cek gaya + bug umum (tanpa --fix)';           RequiresAny = @('eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml') }
            @{ Lang = 'node';   Tool = 'npm';         Args = @('audit');               Category = 'security'; Why = 'Cek library rentan (CVE)';                    RequiresAny = @('package-lock.json') }
        )
        python = @(
            @{ Lang = 'python'; Tool = 'ruff';        Args = @('check', '.');          Category = 'lint';     Why = 'Cek gaya + bug umum Python';                  RequiresAny = @('pyproject.toml', 'ruff.toml', '.ruff.toml', 'requirements.txt', 'Pipfile', 'setup.py', 'setup.cfg') }
            @{ Lang = 'python'; Tool = 'mypy';        Args = @('.');                   Category = 'type';     Why = 'Cek tipe Python';                            RequiresAny = @('pyproject.toml', 'mypy.ini', '.mypy.ini', 'setup.cfg', 'requirements.txt') }
            @{ Lang = 'python'; Tool = 'bandit';      Args = @('-r', '.', '-q');       Category = 'security'; Why = 'Cek keamanan statis Python';                  RequiresAny = @('pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile') }
        )
        go     = @(
            @{ Lang = 'go';     Tool = 'go';          Args = @('vet', './...');        Category = 'lint';     Why = 'Cek kesalahan umum Go';                      RequiresAny = @('go.mod') }
            @{ Lang = 'go';     Tool = 'staticcheck'; Args = @('./...');               Category = 'lint';     Why = 'Analisa statis Go mendalam';                 RequiresAny = @('go.mod') }
            @{ Lang = 'go';     Tool = 'govulncheck'; Args = @('./...');               Category = 'security'; Why = 'Cek dependency rentan (CVE) Go';              RequiresAny = @('go.mod') }
        )
        rust   = @(
            @{ Lang = 'rust';   Tool = 'cargo';       Args = @('clippy', '--', '-D', 'warnings'); Category = 'lint'; Why = 'Cek gaya + bug Rust (clippy)';      RequiresAny = @('Cargo.toml') }
            @{ Lang = 'rust';   Tool = 'cargo';       Args = @('fmt', '--check');      Category = 'lint';     Why = 'Cek format Rust (tanpa menulis)';            RequiresAny = @('Cargo.toml') }
        )
        php    = @(
            @{ Lang = 'php';    Tool = 'phpstan';     Args = @('analyse', '--no-progress'); Category = 'lint'; Why = 'Analisa statis PHP';                    RequiresAny = @('phpstan.neon', 'phpstan.neon.dist', 'phpstan.dist.neon', 'composer.json') }
            @{ Lang = 'php';    Tool = 'pint';        Args = @('--test');              Category = 'lint';     Why = 'Cek format Laravel Pint (tanpa menulis)';    RequiresAny = @('pint.json', 'composer.json') }
        )
    }

    if ($specs.ContainsKey($Stack)) { return @($specs[$Stack] | ForEach-Object { [pscustomobject]$_ }) }
    return @()
}

# ---- Config-gate: apakah config alat ini ADA di akar gudang (fungsi murni) ----
function Test-LintasStackConfigured {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)]$Spec
    )
    foreach ($req in $Spec.RequiresAny) {
        if (Test-Path -LiteralPath (Join-Path $Root $req) -PathType Leaf) { return $true }
    }
    return $false
}

# ---- Config-gate + ketersediaan alat -> apakah sebuah alat dijalankan ----
function Get-LintasStackApplicability {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)]$Spec
    )
    if (-not (Test-LintasStackConfigured -Root $Root -Spec $Spec)) { return 'skip-not-configured' }
    if (-not (Get-Command $Spec.Tool -ErrorAction SilentlyContinue)) { return 'skip-missing-tool' }
    return 'run'
}

# ---- Jalankan SATU alat dengan batas-waktu, tangkap kode-keluar + keluaran ----
function Invoke-LintasStackTool {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)]$Spec,
        [int]$TimeoutSec = 120
    )
    $cmd = Get-Command $Spec.Tool -ErrorAction SilentlyContinue
    if (-not $cmd) {
        return [pscustomobject]@{ Spec = $Spec; Ran = $false; Reason = 'missing-tool'; ExitCode = $null; Output = ''; TimedOut = $false }
    }

    # Pakai System.Diagnostics.Process langsung (BUKAN Start-Process): Start-Process -PassThru
    # mengembalikan ExitCode = $null di Windows PowerShell 5.1 (handle tak tertahan). Baca stdout/stderr
    # secara async supaya tak deadlock saat buffer penuh. Kompatibel 5.1 (.NET 4.5+) + pwsh 7.
    $timedOut = $false
    $exit = $null
    $output = ''
    $proc = $null
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $cmd.Source
        # Args sederhana (tanpa spasi); tetap kutip kalau ada spasi. ProcessStartInfo.ArgumentList
        # tak ada di .NET Framework 4.x (PS 5.1) -> rakit string Arguments manual.
        $psi.Arguments = (@($Spec.Args) | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' '
        $psi.WorkingDirectory = $Root
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true

        $proc = New-Object System.Diagnostics.Process
        $proc.StartInfo = $psi
        $null = $proc.Start()
        $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
        $stderrTask = $proc.StandardError.ReadToEndAsync()

        if (-not $proc.WaitForExit($TimeoutSec * 1000)) {
            $timedOut = $true
            try { $proc.Kill() } catch { $null = $_ }
            $null = $proc.WaitForExit(5000)
        }
        if (-not $timedOut) { $exit = $proc.ExitCode }
        $output = (@($stdoutTask.Result, $stderrTask.Result) -join "`n").Trim()
    } catch {
        return [pscustomobject]@{ Spec = $Spec; Ran = $false; Reason = ('run-error: ' + $_.Exception.Message); ExitCode = $null; Output = ''; TimedOut = $false }
    } finally {
        if ($proc) { $proc.Dispose() }
    }
    return [pscustomobject]@{ Spec = $Spec; Ran = $true; Reason = 'ran'; ExitCode = $exit; Output = $output; TimedOut = $timedOut }
}

function Add-LintasStackFinding {
    param([System.Collections.ArrayList]$Acc, [string]$Lang, [string]$Tool, [string]$Tingkat, [string]$Kode, [string]$Pesan)
    [void]$Acc.Add([pscustomobject]@{ Lang = $Lang; Tool = $Tool; Tingkat = $Tingkat; Kode = $Kode; Pesan = $Pesan })
}

# ---- Klasifikasi hasil-jalan SATU alat -> temuan (fungsi MURNI, mudah diuji) ----
function Get-LintasStackFinding {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)]$RunResult)
    $findings = [System.Collections.ArrayList]::new()
    if (-not $RunResult.Ran) { return @() }   # alat absen / gagal-jalan -> ditangani caller sebagai skip
    $tool = $RunResult.Spec.Tool
    $lang = $RunResult.Spec.Lang

    if ($RunResult.TimedOut) {
        Add-LintasStackFinding $findings $lang $tool 'PENTING' 'TOOL_TIMEOUT' ("Alat '{0}' tidak selesai dalam {1} detik - dilewati (BUKAN berarti bersih). Jalankan manual untuk hasil lengkap." -f $tool, $TimeoutSec)
        return @($findings.ToArray())
    }
    if ($null -ne $RunResult.ExitCode -and $RunResult.ExitCode -ne 0) {
        $snippet = if ($RunResult.Output) { $RunResult.Output.Substring(0, [Math]::Min(400, $RunResult.Output.Length)) } else { '(tanpa keluaran)' }
        Add-LintasStackFinding $findings $lang $tool 'PENTING' 'TOOL_FINDINGS' ("Alat '{0}' melaporkan masalah (kode keluar {1}). AI: baca keluaran + tentukan tingkat sebenarnya (naikkan ke GENTING kalau soal keamanan). Cuplikan: {2}" -f $tool, $RunResult.ExitCode, $snippet)
    }
    return @($findings.ToArray())
}

# ---- Orkestrasi penuh ----
function Invoke-LintasStackCheck {
    [CmdletBinding()]
    param(
        [string]$RepoRoot,
        [string]$Stack,
        [int]$TimeoutSec = 120,
        [switch]$NoRun,
        [switch]$Quiet
    )
    if (-not $RepoRoot) { $RepoRoot = Split-Path -Parent $PSScriptRoot }   # induk folder lib/
    if (-not $Stack) {
        $detected = Get-StackType -ProjectRoot $RepoRoot
        $Stack = $detected.StackType
    }

    $specs = Get-LintasStackToolSpec -Stack $Stack
    $findings = [System.Collections.ArrayList]::new()
    $ran = [System.Collections.ArrayList]::new()
    $skipMissing = [System.Collections.ArrayList]::new()
    $skipNotConfigured = [System.Collections.ArrayList]::new()

    foreach ($spec in $specs) {
        # Urutan: config-gate dulu -> SIMULASI (NoRun) -> ketersediaan alat -> jalankan.
        # (NoRun harus tampil walau alat belum terpasang: tujuannya "apa yang AKAN dijalankan".)
        if (-not (Test-LintasStackConfigured -Root $RepoRoot -Spec $spec)) { [void]$skipNotConfigured.Add($spec.Tool); continue }
        if ($NoRun) { [void]$ran.Add(('{0} (SIMULASI)' -f $spec.Tool)); continue }
        if (-not (Get-Command $spec.Tool -ErrorAction SilentlyContinue)) { [void]$skipMissing.Add($spec.Tool); continue }

        $res = Invoke-LintasStackTool -Root $RepoRoot -Spec $spec -TimeoutSec $TimeoutSec
        if (-not $res.Ran) { [void]$skipMissing.Add($spec.Tool); continue }
        [void]$ran.Add($spec.Tool)
        foreach ($f in (Get-LintasStackFinding -RunResult $res)) { [void]$findings.Add($f) }
    }

    $arr = @($findings.ToArray())
    $genting = @($arr | Where-Object { $_.Tingkat -eq 'GENTING' }).Count
    $penting = @($arr | Where-Object { $_.Tingkat -eq 'PENTING' }).Count
    $rapikan = @($arr | Where-Object { $_.Tingkat -eq 'RAPIKAN' }).Count

    if (-not $Quiet) {
        Write-Host "Robot pemeriksa mutu kode per-bahasa (stack: $Stack)"
        Write-Host ('-' * 60)
        if ($Stack -eq 'unknown' -or $specs.Count -eq 0) {
            Write-Host "Stack tidak dikenali / belum didukung - pakai baseline 8-divisi (sec. 4.13). Tidak ada alat dijalankan." -ForegroundColor Cyan
        } else {
            if (@($ran).Count -gt 0) { Write-Host ("Alat dijalankan : {0}" -f ((@($ran)) -join ', ')) -ForegroundColor Green }
            if (@($skipNotConfigured).Count -gt 0) { Write-Host ("Dilewati (config tak ada): {0}" -f ((@($skipNotConfigured)) -join ', ')) -ForegroundColor DarkGray }
            if (@($skipMissing).Count -gt 0) { Write-Host ("Dilewati (alat belum terpasang): {0}" -f ((@($skipMissing)) -join ', ')) -ForegroundColor Yellow }
            if ($arr.Count -eq 0) {
                Write-Host "BERSIH: alat yang dijalankan tidak melaporkan masalah." -ForegroundColor Green
            } else {
                foreach ($x in $arr) {
                    Write-Host ("  [{0}] {1}/{2}  {3}" -f $x.Tingkat, $x.Lang, $x.Tool, $x.Pesan) -ForegroundColor Yellow
                }
            }
            Write-Host ('-' * 60)
            Write-Host ("Ringkasan: GENTING {0} - PENTING {1} - RAPIKAN {2}. (Robot tak pernah GENTING; AI yang naikkan kalau keamanan.)" -f $genting, $penting, $rapikan) -ForegroundColor $(if ($penting -gt 0) { 'Yellow' } else { 'Green' })
        }
    }

    return [pscustomobject]@{
        Stack                = $Stack
        Findings             = $arr
        Count                = $arr.Count
        Genting              = $genting
        Penting              = $penting
        Rapikan              = $rapikan
        Ran                  = @($ran.ToArray())
        SkippedMissingTool   = @($skipMissing.ToArray())
        SkippedNotConfigured = @($skipNotConfigured.ToArray())
    }
}

# Auto-run saat dijalankan langsung (`& .\lib\stack-check.ps1`), BUKAN saat dot-source
# (Pester dot-source -> InvocationName '.'): keluar dengan kode = jumlah GENTING (0 = tak hard-fail gerbang).
if ($MyInvocation.InvocationName -ne '.' -and -not $env:LINTAS_STACKCHECK_NOAUTORUN) {
    $result = Invoke-LintasStackCheck -RepoRoot $RepoRoot -Stack $Stack -TimeoutSec $TimeoutSec -NoRun:$NoRun -Quiet:$Quiet
    exit $result.Genting
}
