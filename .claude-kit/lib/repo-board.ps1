<#
.SYNOPSIS
  lib/repo-board.ps1 - "Papan Status Lintas-Repo" (cuma-baca, deterministik, ~0 token).

.DESCRIPTION
  Masalah yang dipecahkan: tim yang mengelola BANYAK repo (mis. portfolio multi-repo 3-7+) sulit
  melihat sekilas "repo mana yang berisiko" - ada perubahan belum disimpan, commit belum dikirim ke
  server (belum ter-backup), atau berkas rahasia (.env) belum aman. Tanpa pandangan terpusat, satu
  repo bisa "tertinggal" tanpa ketahuan.

  Onderdil ini = adaptasi RINGAN konsep "session-tracking + risk-scoring" ECC ecc2 (yang aslinya
  control-plane Rust + daemon + SQLite + TUI). Di lintasAI SENGAJA dibuat jauh lebih ringan + aman:
  satu robot PowerShell cuma-baca, jalan ON-DEMAND (BUKAN daemon yang nyala terus), TIDAK menyimpan
  state, TIDAK mengubah apa pun. Filosofi kit (ADR-001): jangan bangun otomasi spekulatif berat -
  ambil KONSEP-nya (pandangan risiko terpusat), buang mesin beratnya.

  Cara kerja: untuk tiap repo, baca status git (READ-ONLY: branch, ahead/behind upstream, daftar
  perubahan) lalu beri SKOR RISIKO berlabel awam (GENTING/PENTING/RAPIKAN/OK) + catatan Bahasa
  Indonesia. Robot kasih FAKTA + skor; AI/owner kasih tindakan.

  Skor risiko (yang TERTINGGI menang):
    - GENTING : ada perubahan berkas rahasia (.env) yang belum aman (bisa ke-commit tak sengaja).
    - PENTING : ada commit belum dikirim ke server (belum ter-backup) ATAU perubahan belum disimpan.
    - RAPIKAN : ketinggalan dari server (perlu pull) / kepala terlepas (detached) / belum ada remote.
    - OK      : bersih + sinkron dengan server.

  Catatan jujur (gaya ai-config-check / risk-gate): ini ALAT BANTU LIHAT, bukan jaminan. Tetap
  cuma-baca; keputusan (commit/push/pull) tetap di manusia.

  Fungsi yang di-export:
    - Get-LintasRepoRisk   : dari fakta git (branch/ahead/behind/perubahan) -> skor + catatan (PURE,
                             mudah dites tanpa repo nyata).
    - Get-LintasRepoStatus : baca git sebuah repo (READ-ONLY) -> objek status + skor.
    - Invoke-LintasRepoBoard: temukan repo (sub-folder ber-.git / daftar) -> papan + ringkasan.

.NOTES
  Versi  : 1.0.0
  Tanggal: 2026-06-20
  Inspirasi: KONSEP "session-tracking + risk-scoring" ecc2 ECC v2.0.0 (MIT) - diadaptasi RINGAN
             (robot PowerShell cuma-baca on-demand, bukan daemon/dashboard). Saudara:
             lib/ai-config-check.ps1, lib/risk-gate.js, lib/consistency-check.ps1.
#>
[CmdletBinding()]
param(
    [string]$Path,
    [string[]]$Repos,
    [switch]$Quiet
)

function Get-LintasRepoRisk {
    <#
      PURE: dari fakta git -> [pscustomobject]{ Risk; Label; Notes }. Risk yang TERTINGGI menang.
      $PorcelainLines = baris `git status --porcelain` (mis. ' M src/app.ts', '?? .env').
      $HasUpstream = apakah repo punya remote tracking branch.
    #>
    [CmdletBinding()]
    param(
        [string]$Branch = '',
        [int]$Ahead = 0,
        [int]$Behind = 0,
        [string[]]$PorcelainLines = @(),
        [bool]$HasUpstream = $true
    )
    $notes = [System.Collections.ArrayList]::new()
    $risk = 'OK'

    # Cek apakah ada berkas rahasia (.env) di antara perubahan -> GENTING.
    $hasEnv = $false
    foreach ($l in $PorcelainLines) {
        if ([string]::IsNullOrWhiteSpace($l)) { continue }
        # Format porcelain: 2 char status + spasi + path. Ambil path-nya (buang status code).
        $p = ($l -replace '^..\s+', '').Trim()
        $leaf = Split-Path -Leaf $p
        if ($leaf -match '(?i)^\.env($|\.)') { $hasEnv = $true }
    }
    $dirty = @($PorcelainLines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count -gt 0

    if ($hasEnv) {
        $risk = 'GENTING'
        [void]$notes.Add('ada perubahan berkas rahasia (.env) yang belum aman - cek jangan sampai ter-commit')
    }
    if ($Ahead -gt 0) {
        if ($risk -eq 'OK') { $risk = 'PENTING' }
        [void]$notes.Add(("$Ahead commit belum dikirim ke server (belum ter-backup)"))
    }
    if ($dirty -and -not $hasEnv) {
        if ($risk -eq 'OK') { $risk = 'PENTING' }
        [void]$notes.Add('ada perubahan belum disimpan (commit)')
    }
    if (-not $HasUpstream) {
        if ($risk -eq 'OK') { $risk = 'RAPIKAN' }
        [void]$notes.Add('belum ada remote tracking (kerja belum tentu ter-backup ke server)')
    }
    if ($Branch -eq 'HEAD') {
        if ($risk -eq 'OK') { $risk = 'RAPIKAN' }
        [void]$notes.Add('kepala terlepas (detached HEAD) - tidak di branch mana pun')
    }
    if ($Behind -gt 0) {
        if ($risk -eq 'OK') { $risk = 'RAPIKAN' }
        [void]$notes.Add(("ketinggalan $Behind dari server (perlu tarik/pull)"))
    }

    $label = switch ($risk) {
        'GENTING' { '[GENTING]' }
        'PENTING' { '[PENTING]' }
        'RAPIKAN' { '[RAPIKAN]' }
        default   { '[OK]' }
    }
    if ($notes.Count -eq 0) { [void]$notes.Add('bersih + sinkron dengan server') }
    return [pscustomobject]@{ Risk = $risk; Label = $label; Notes = ($notes -join '; ') }
}

function Get-LintasRepoStatus {
    <# Baca git sebuah repo (READ-ONLY) -> objek status + skor. #>
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$RepoPath)

    $name = Split-Path -Leaf $RepoPath
    $inside = (& git -C $RepoPath rev-parse --is-inside-work-tree 2>$null)
    if ($LASTEXITCODE -ne 0 -or $inside -ne 'true') {
        return [pscustomobject]@{ Repo = $name; Path = $RepoPath; Branch = '-'; Ahead = 0; Behind = 0
            Risk = 'RAPIKAN'; Label = '[RAPIKAN]'; Notes = 'bukan repo git (tak ada .git yang valid)' }
    }

    $branch = (& git -C $RepoPath rev-parse --abbrev-ref HEAD 2>$null)
    if ($LASTEXITCODE -ne 0) { $branch = 'HEAD' }
    $porcelain = @(& git -C $RepoPath status --porcelain 2>$null)

    # ahead/behind upstream: 'behind<TAB>ahead' dari rev-list --left-right --count @{u}...HEAD
    $hasUpstream = $true; $ahead = 0; $behind = 0
    $counts = (& git -C $RepoPath rev-list --left-right --count '@{u}...HEAD' 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($counts)) {
        $hasUpstream = $false
    } else {
        $parts = $counts -split '\s+'
        if ($parts.Count -ge 2) { $behind = [int]$parts[0]; $ahead = [int]$parts[1] }
    }

    $r = Get-LintasRepoRisk -Branch $branch -Ahead $ahead -Behind $behind -PorcelainLines $porcelain -HasUpstream $hasUpstream
    return [pscustomobject]@{ Repo = $name; Path = $RepoPath; Branch = $branch; Ahead = $ahead; Behind = $behind
        Risk = $r.Risk; Label = $r.Label; Notes = $r.Notes }
}

function Invoke-LintasRepoBoard {
    [CmdletBinding()]
    param([string]$Path, [string[]]$Repos, [switch]$Quiet)

    $repoPaths = [System.Collections.ArrayList]::new()
    if ($Repos) {
        foreach ($r in $Repos) { if (Test-Path -LiteralPath $r) { [void]$repoPaths.Add((Resolve-Path -LiteralPath $r).Path) } }
    } elseif ($Path) {
        # Auto-temukan sub-folder yang punya .git (tidak rekursif dalam-dalam).
        if (Test-Path -LiteralPath (Join-Path $Path '.git')) { [void]$repoPaths.Add((Resolve-Path -LiteralPath $Path).Path) }
        foreach ($d in (Get-ChildItem -LiteralPath $Path -Directory -ErrorAction SilentlyContinue)) {
            if (Test-Path -LiteralPath (Join-Path $d.FullName '.git')) { [void]$repoPaths.Add($d.FullName) }
        }
    }

    $rows = [System.Collections.ArrayList]::new()
    foreach ($rp in $repoPaths) { [void]$rows.Add((Get-LintasRepoStatus -RepoPath $rp)) }
    $arr = @($rows.ToArray())

    $genting = @($arr | Where-Object { $_.Risk -eq 'GENTING' }).Count
    $penting = @($arr | Where-Object { $_.Risk -eq 'PENTING' }).Count
    $rapikan = @($arr | Where-Object { $_.Risk -eq 'RAPIKAN' }).Count

    if (-not $Quiet) {
        Write-Host 'Papan Status Lintas-Repo (cuma-baca)'
        Write-Host ('-' * 70)
        if ($arr.Count -eq 0) {
            Write-Host 'Tidak ada repo ditemukan. Pakai -Path <folder-induk> atau -Repos <path1>,<path2>.' -ForegroundColor Yellow
        } else {
            foreach ($x in $arr) {
                $color = switch ($x.Risk) { 'GENTING' { 'Red' } 'PENTING' { 'Yellow' } 'RAPIKAN' { 'Cyan' } default { 'Green' } }
                Write-Host ("  {0,-22} {1,-12} {2}" -f $x.Repo, $x.Branch, $x.Label) -ForegroundColor $color
                Write-Host ("       -> {0}" -f $x.Notes) -ForegroundColor DarkGray
            }
            Write-Host ('-' * 70)
            Write-Host ("Ringkasan: GENTING {0} - PENTING {1} - RAPIKAN {2} - dari {3} repo." -f $genting, $penting, $rapikan, $arr.Count) -ForegroundColor $(if ($genting -gt 0) { 'Red' } elseif ($penting -gt 0) { 'Yellow' } else { 'Green' })
        }
    }
    return [pscustomobject]@{ Rows = $arr; Count = $arr.Count; Genting = $genting; Penting = $penting; Rapikan = $rapikan }
}

# Auto-run saat dijalankan langsung (BUKAN dot-source Pester). Exit 0 (papan = informasi, bukan gerbang).
if ($MyInvocation.InvocationName -ne '.' -and -not $env:LINTAS_REPOBOARD_NOAUTORUN) {
    [void](Invoke-LintasRepoBoard -Path $Path -Repos $Repos -Quiet:$Quiet)
    exit 0
}
