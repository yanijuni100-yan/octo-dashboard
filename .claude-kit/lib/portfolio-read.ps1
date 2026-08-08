<#
.SYNOPSIS
  lib/portfolio-read.ps1 - Pembaca READ-ONLY "Buku Induk" portfolio (lintasai-portfolio.yml).

.DESCRIPTION
  Menutup celah yang ditemukan audit SSOT: lintasai-portfolio.yml MENGAKU "sumber tunggal"
  untuk kelola-banyak-repo, TAPI tak ada satu pun skrip yang membacanya (lihat
  docs/PETA_SUMBER_KEBENARAN.md). Library ini memberi Buku Induk sebuah KONSUMEN MESIN nyata:
  membaca strukturnya lalu mencetak ringkasan (repo + tingkat-akses + siapa boleh clone).

  PENTING - 100% READ-ONLY:
   - HANYA membaca + mencetak. TIDAK mengubah izin GitHub, TIDAK menulis berkas apa pun.
   - Penegakan akses tetap MANUAL (lihat ACCESS_CONTROL_NREPO_v1.md: AI cetak rencana,
     manusia yang klik). Ini sejalan: kartu/Buku Induk = CATATAN, bukan penegak.

  BATAS JUJUR (kenapa pembaca baris-per-baris, bukan parser YAML penuh):
   - PowerShell 5.1 tak punya ConvertFrom-Yaml native (itu yang dulu membuat portfolio.yml
     "mati" sebagai sumber). Library ini memakai pembaca BARIS-PER-BARIS untuk STRUKTUR YANG
     DIKENAL (blok portfolio/access_groups/repos dari templates/lintasai-portfolio.example.yml).
     Preseden serupa di kit: pembacaan staff-roster baris-per-baris.
   - Bukan parser YAML umum: hanya field yang tak ambigu (name/role/access_tier/allowed_teams
     inline-list, base_name/github_owner, id+jumlah member). Cocok untuk RINGKASAN, bukan untuk
     dijadikan sumber config-generate (yang butuh akurasi penuh).

  Fungsi yang di-export:
    - Read-LintasPortfolio       : parse Buku Induk -> objek terstruktur (Present/BaseName/Repos/Groups).
    - Show-LintasPortfolioPlan   : baca + cetak ringkasan READ-ONLY; return objek ringkasan.

.NOTES
  Versi  : 1.0.0
  Tanggal: 2026-06-19
  Target : PowerShell 5.1+ dan PowerShell 7+.
  Catatan: dot-source (test) -> hanya definisi fungsi (InvocationName='.'); dijalankan langsung
           -> cetak ringkasan Buku Induk di RepoRoot/cwd (exit 0; read-only, tak ada konsep "gagal").
#>

[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string]$Path,
    [switch]$Quiet
)

$script:LintasPortfolioFileName = 'lintasai-portfolio.yml'

# ---- Cari path Buku Induk (default = RepoRoot/lintasai-portfolio.yml) ----
function Resolve-LintasPortfolioPath {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$RepoRoot, [string]$Path)
    if ($Path) { return $Path }
    return (Join-Path $RepoRoot $script:LintasPortfolioFileName)
}

# ---- Parse Buku Induk -> objek terstruktur (pembaca baris-per-baris, struktur dikenal) ----
function Read-LintasPortfolio {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return @{ Present = $false; BaseName = $null; GithubOwner = $null; Repos = @(); Groups = @() }
    }
    $lines = Get-Content -LiteralPath $Path -Encoding UTF8

    $baseName = $null; $githubOwner = $null
    $repos = @(); $groups = @()
    $section = $null            # 'portfolio' | 'access_groups' | 'repos'
    $curRepo = $null; $curGroup = $null; $inMembers = $false

    foreach ($raw in $lines) {
        if ($raw -match '^\s*#') { continue }   # baris komentar penuh
        if ($raw -match '^\s*$') { continue }   # baris kosong
        $line = $raw -replace '\s+#.*$', ''     # buang komentar tempel di akhir baris

        # Baris top-level (header section atau kunci lain, tanpa indentasi).
        # FLUSH item yang sedang dirakit DULU sebelum pindah/reset -> item TERAKHIR sebelum
        # pindah section tidak hilang (mis. group terakhir sebelum 'repos:').
        if ($line -match '^\S') {
            if ($curGroup) { $groups += $curGroup; $curGroup = $null }
            if ($curRepo)  { $repos += $curRepo;  $curRepo = $null }
            $inMembers = $false
            if     ($line -match '^portfolio:\s*$')     { $section = 'portfolio' }
            elseif ($line -match '^access_groups:\s*$') { $section = 'access_groups' }
            elseif ($line -match '^repos:\s*$')         { $section = 'repos' }
            else                                        { $section = $null }
            continue
        }

        switch ($section) {
            'portfolio' {
                if     ($line -match '^\s+base_name:\s*(\S+)')    { $baseName = $Matches[1] }
                elseif ($line -match '^\s+github_owner:\s*(\S+)') { $githubOwner = $Matches[1] }
            }
            'access_groups' {
                if ($line -match '^\s+-\s+id:\s*(\S+)') {
                    if ($curGroup) { $groups += $curGroup }
                    $curGroup = @{ id = $Matches[1]; member_count = 0 }; $inMembers = $false
                } elseif ($line -match '^\s+members:\s*$') {
                    $inMembers = $true
                } elseif ($inMembers -and ($line -match '^\s+-\s+\S+')) {
                    if ($curGroup) { $curGroup.member_count++ }
                } elseif ($line -match '^\s+\w+:') {
                    $inMembers = $false
                }
            }
            'repos' {
                if ($line -match '^\s+-\s+name:\s*(\S+)') {
                    if ($curRepo) { $repos += $curRepo }
                    $curRepo = @{ name = $Matches[1]; role = $null; access_tier = $null; allowed_teams = @() }
                } elseif ($curRepo) {
                    if     ($line -match '^\s+role:\s*(\S+)')        { $curRepo.role = $Matches[1] }
                    elseif ($line -match '^\s+access_tier:\s*(\S+)') { $curRepo.access_tier = $Matches[1] }
                    elseif ($line -match '^\s+allowed_teams:\s*\[([^\]]*)\]') {
                        $curRepo.allowed_teams = @($Matches[1] -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
                    }
                }
            }
        }
    }
    if ($curRepo)  { $repos += $curRepo }
    if ($curGroup) { $groups += $curGroup }

    return @{ Present = $true; BaseName = $baseName; GithubOwner = $githubOwner; Repos = @($repos); Groups = @($groups) }
}

# ---- Baca + cetak ringkasan READ-ONLY ----
function Show-LintasPortfolioPlan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [string]$Path,
        [switch]$Quiet
    )
    $p = Resolve-LintasPortfolioPath -RepoRoot $RepoRoot -Path $Path
    $data = Read-LintasPortfolio -Path $p

    if (-not $data.Present) {
        if (-not $Quiet) { Write-Host ("[INFO] Tidak ada {0} di {1} - Buku Induk portfolio belum dibuat (opsional)." -f $script:LintasPortfolioFileName, $RepoRoot) -ForegroundColor DarkGray }
        return [pscustomobject]@{ Present = $false; BaseName = $null; GithubOwner = $null; RepoCount = 0; GroupCount = 0; Repos = @(); Groups = @() }
    }

    if (-not $Quiet) {
        Write-Host ""
        Write-Host "Buku Induk portfolio (RINGKASAN - READ-ONLY, tidak mengubah izin apa pun)" -ForegroundColor Cyan
        Write-Host ("Identitas : base_name='{0}'  github_owner='{1}'" -f $data.BaseName, $data.GithubOwner)
        Write-Host ("-" * 70)
        Write-Host ("Repo ({0}):" -f @($data.Repos).Count) -ForegroundColor Cyan
        foreach ($r in $data.Repos) {
            $teams = if (@($r.allowed_teams).Count -gt 0) { ($r.allowed_teams -join ', ') } else { '(tak ada)' }
            Write-Host ("  - {0,-22} peran={1,-10} tingkat={2,-10} boleh-clone: {3}" -f $r.name, $r.role, $r.access_tier, $teams)
        }
        Write-Host ("Kelompok akses ({0}):" -f @($data.Groups).Count) -ForegroundColor Cyan
        foreach ($g in $data.Groups) {
            Write-Host ("  - {0,-18} {1} anggota" -f $g.id, $g.member_count)
        }
        Write-Host ("-" * 70)
        Write-Host "CATATAN: 'boleh-clone' (allowed_teams) = izin clone GitHub = SATU-SATUNYA yang benar-benar" -ForegroundColor DarkGray
        Write-Host "         memblokir salin kode. Ringkasan ini READ-ONLY - penegakan tetap MANUAL (kamu" -ForegroundColor DarkGray
        Write-Host "         yang klik di GitHub). Lihat ACCESS_CONTROL_NREPO_v1.md." -ForegroundColor DarkGray
        Write-Host ""
    }

    return [pscustomobject]@{
        Present     = $true
        BaseName    = $data.BaseName
        GithubOwner = $data.GithubOwner
        RepoCount   = @($data.Repos).Count
        GroupCount  = @($data.Groups).Count
        Repos       = @($data.Repos)
        Groups      = @($data.Groups)
    }
}

# ---- Bootstrap: auto-run kalau dijalankan langsung (bukan dot-source dari test) ----
if ($MyInvocation.InvocationName -ne '.') {
    if (-not $RepoRoot) { $RepoRoot = (Get-Location).Path }
    $null = Show-LintasPortfolioPlan -RepoRoot $RepoRoot -Path $Path -Quiet:$Quiet
    exit 0
}
