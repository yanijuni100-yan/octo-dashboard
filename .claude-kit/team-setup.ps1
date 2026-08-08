<#
.SYNOPSIS
  team-setup.ps1 - Nyalakan / segarkan "kerja kelompok" (collaboration essentials) di project.
.DESCRIPTION
  Memasang berkas inti kerja-kelompok (idempotent, TIDAK menimpa yang sudah ada) lalu
  menampilkan langkah mengunci 'main' di GitHub (klik-demi-klik). Untuk project yang ingin
  menyalakan / menyegarkan mode tim kapan saja - terutama yang dulu init pakai -SkipTeamFiles.

  Berkas inti yang dipasang (subset terfokus; `init` memasang set tim LENGKAP):
    .github/CODEOWNERS, .github/pull_request_template.md,
    .github/scripts/setup-branch-protection.ps1,
    docs/KERJA_KELOMPOK.md, docs/CLAUDE_TEAM_GUIDE.md,
    docs/TEAM_FLOW_SKETCH_v1.md, docs/ACCESS_CONTROL_NREPO_v1.md

  Mengandalkan kit yang SUDAH terpasang di <project>/.claude-kit/ (jalankan `init` dulu).
.PARAMETER ProjectRoot
  Root project. Via `npx lintasai team-setup` di-inject otomatis oleh bin/lintasai.js.
  Kalau dijalankan langsung dari <project>/.claude-kit/, di-derive dari lokasi script.
.PARAMETER DryRun
  SIMULASI: tampilkan rencana tanpa menulis berkas apa pun.
.NOTES
  Versi 1 (2026-06-15). Bagian dari fitur kerja-kelompok lintasAI v1.27.0.
  Tidak ada Read-Host -> aman dijalankan otomatis (AI/CI) tanpa risiko menggantung.
#>
[CmdletBinding()]
param(
    [string]$ProjectRoot = $null,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ---- Resolve KitDir + ProjectRoot (operate on the PROJECT's installed kit) ----
# Catatan: via npx, $PSScriptRoot = npm-cache (BUKAN project). Maka saat -ProjectRoot
# diberikan, KitDir = <project>/.claude-kit (kit yang sudah terpasang), bukan $PSScriptRoot.
if ($ProjectRoot) {
    $ProjectRoot = (Resolve-Path $ProjectRoot -ErrorAction Stop).Path
    $KitDir = Join-Path $ProjectRoot '.claude-kit'
} else {
    $KitDir = $PSScriptRoot
    $ProjectRoot = (Resolve-Path (Split-Path -Parent $KitDir) -ErrorAction Stop).Path
}

if (-not (Test-Path -LiteralPath $KitDir)) {
    Write-Host "ERROR: Kit lintasAI belum terpasang di project ini ($KitDir tidak ada)." -ForegroundColor Red
    Write-Host "       Jalankan dulu: npx lintasai init" -ForegroundColor Yellow
    exit 1
}

# ---- Dot-source lib helpers dari kit yang terpasang ----
$libsToLoad = @('lib\template-deploy.ps1', 'lib\version-detect.ps1', 'lib\manifest.ps1')
foreach ($lib in $libsToLoad) {
    $libPath = Join-Path $KitDir $lib
    try {
        if (-not (Test-Path -LiteralPath $libPath)) { throw "File tidak ditemukan: $libPath" }
        . $libPath
    } catch {
        Write-Host "ERROR: Gagal load file lib kit: $lib" -ForegroundColor Red
        Write-Host "       Detail: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "       Init ulang kit: npx lintasai init" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "=== lintasAI team-setup: nyalakan kerja kelompok ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
if ($DryRun) { Write-Host "(MODE SIMULASI - tidak ada berkas yang ditulis)" -ForegroundColor Yellow }
Write-Host ""

$docsDir = Join-Path $ProjectRoot 'docs'
$githubDir = Join-Path $ProjectRoot '.github'
$scriptsDir = Join-Path $githubDir 'scripts'

$manifestState = Initialize-Manifest -ProjectRoot $ProjectRoot

# ---- Buat folder yang perlu ----
foreach ($d in @($docsDir, $githubDir, $scriptsDir)) {
    if (-not (Test-Path -LiteralPath $d)) {
        if ($DryRun) {
            Write-Host ("[SIMULASI] BUAT folder {0}\" -f $d) -ForegroundColor Yellow
        } else {
            New-Item -ItemType Directory -Path $d -Force | Out-Null
            Add-DirToManifest -State $manifestState -DirPath $d
            Write-Host ("BUAT  {0}\" -f $d) -ForegroundColor Green
        }
    }
}

# ---- Collaboration essentials (subset terfokus; init memasang set tim lengkap) ----
$collabFiles = @(
    @{ Src = 'templates\github\CODEOWNERS.template';                Dst = (Join-Path $githubDir 'CODEOWNERS');                 Desc = 'Approver wajib (EDIT dgn username GitHub asli)' },
    @{ Src = 'templates\github\pull_request_template.md';           Dst = (Join-Path $githubDir 'pull_request_template.md');   Desc = 'Formulir minta-review (PR)' },
    @{ Src = 'templates\github\scripts\setup-branch-protection.ps1'; Dst = (Join-Path $scriptsDir 'setup-branch-protection.ps1'); Desc = 'Skrip kunci main (SIMULASI dulu, baru -Apply)' },
    @{ Src = 'templates\KERJA_KELOMPOK.md';                         Dst = (Join-Path $docsDir 'KERJA_KELOMPOK.md');            Desc = 'Pintu masuk kerja kelompok + langkah kunci main' },
    @{ Src = 'templates\CLAUDE_TEAM_GUIDE.md';                      Dst = (Join-Path $docsDir 'CLAUDE_TEAM_GUIDE.md');         Desc = 'Alur harian branch -> PR -> gabung' },
    @{ Src = 'templates\TEAM_FLOW_SKETCH_v1.md';                    Dst = (Join-Path $docsDir 'TEAM_FLOW_SKETCH_v1.md');       Desc = 'Pipa kerja tim + 5 peran' },
    @{ Src = 'templates\ACCESS_CONTROL_NREPO_v1.md';               Dst = (Join-Path $docsDir 'ACCESS_CONTROL_NREPO_v1.md');   Desc = 'Akses berjenjang (CODEOWNERS != izin clone)' }
)

$added = 0; $existed = 0; $missingSrc = 0
foreach ($f in $collabFiles) {
    $src = Join-Path $KitDir $f.Src
    $dst = $f.Dst
    if (Test-Path -LiteralPath $dst) {
        Write-Host ("SUDAH ADA  {0}" -f $dst) -ForegroundColor DarkGray
        $existed++
        continue
    }
    if (-not (Test-Path -LiteralPath $src)) {
        Write-Host ("HILANG di kit  {0} (skip)" -f $f.Src) -ForegroundColor Yellow
        $missingSrc++
        continue
    }
    if ($DryRun) {
        Write-Host ("[SIMULASI] PASANG {0} ({1})" -f $dst, $f.Desc) -ForegroundColor Yellow
        $added++
        continue
    }
    $r = Copy-StaticTemplate -SourcePath $src -TargetPath $dst -IfExists 'Skip'
    if ($r.copied) {
        Add-ToManifest -State $manifestState -FilePath $dst -Kind 'team_file' -From ($f.Src.Replace('\', '/'))
        Write-Host ("PASANG  {0} ({1})" -f $dst, $f.Desc) -ForegroundColor Green
        $added++
    }
}

# ---- Simpan manifest (MERGE dengan yang ada) supaya berkas baru ter-track utk uninstall ----
if (-not $DryRun -and $added -gt 0) {
    try {
        $kitChangelog = Join-Path $KitDir 'CHANGELOG.md'
        $kv = Get-KitVersionFromChangelog -ChangelogPath $kitChangelog
        if (-not $kv) { $kv = 'unknown' }
        $pn = Split-Path -Leaf $ProjectRoot
        # R7 (audit 2026-06-23): catat installer JUJUR = 'team-setup.ps1'. Tanpa -InstallerName,
        # Save-Manifest menulis metadata.installer ke default 'setup-pola-b.ps1' (catatan keliru).
        $null = Save-Manifest -State $manifestState -KitDir $KitDir -KitVersion $kv -ProjectName $pn -InstallerName 'team-setup.ps1'
        Write-Host "OK    manifest diperbarui (berkas baru ikut ter-track untuk uninstall)." -ForegroundColor DarkGray
    } catch {
        Write-Host "WARN  gagal perbarui manifest: $_" -ForegroundColor Yellow
        Write-Host "      Berkas tetap terpasang; cuma pelacakan uninstall yang tidak lengkap." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host ("Ringkasan: {0} dipasang, {1} sudah ada, {2} hilang-di-kit." -f $added, $existed, $missingSrc) -ForegroundColor Cyan
Write-Host ""
Write-Host "LANGKAH BERIKUTNYA (hanya OWNER yang bisa) - kunci main di GitHub:" -ForegroundColor Cyan
Write-Host "  1. GitHub repo -> Settings -> Branches (atau Rules -> Rulesets) -> Add rule, pattern: main"
Write-Host "  2. Centang: Require a pull request + Require approvals (1) + Require review from Code Owners"
Write-Host "  3. Centang: Require status checks to pass + Do not allow bypassing"
Write-Host "  4. Pastikan 'Allow force pushes' + 'Allow deletions' TIDAK dicentang -> Save"
Write-Host "  (Detail klik-demi-klik + analogi non-programmer: buka docs\KERJA_KELOMPOK.md Bagian 3.)"
Write-Host ""
Write-Host "  Lalu isi .github\CODEOWNERS dengan username GitHub asli (dari .github\staff-roster.yml)."
Write-Host "  Anti-keliru: CODEOWNERS = siapa WAJIB review, BUKAN siapa boleh clone (lihat ACCESS_CONTROL_NREPO_v1.md)." -ForegroundColor Yellow
Write-Host ""
Write-Host "SELESAI - kerja kelompok siap. Minta tim buka docs\KERJA_KELOMPOK.md dulu." -ForegroundColor Green
exit 0
