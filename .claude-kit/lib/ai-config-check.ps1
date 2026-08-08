<#
.SYNOPSIS
  lib/ai-config-check.ps1 - "Robot pemindai konfigurasi-AI" (deterministik, ~0 token).

.DESCRIPTION
  Masalah yang dipecahkan: pengaturan AI sebuah project (server MCP di `.mcp.json`, izin & hook di
  `.claude/settings.json`, skill kustom di `docs/SKILLS_LOCAL.md`) bisa MEMBUKA pintu bahaya tanpa
  disadari staff non-programmer: rahasia/kunci-API ikut ter-commit, izin tool kelewat lebar (mis.
  izinkan SEMUA perintah Bash), server MCP jarak-jauh yang mengirim data keluar komputer, hook yang
  "unduh-lalu-jalankan", atau skill kustom yang minta MENEMBUS pagar keamanan (langgar sec. 8.1 #10).

  Aturan teks (WORKFLOWS sec. 4.15-C) dulu menyuruh AI "baca + nalar" config ini. Untuk pola yang
  TAK-AMBIGU (rahasia berpola vendor, izin '*', transport remote, frasa-bypass) penjaga yang lebih
  benar = ROBOT deterministik (lolos sec. 6.3 "pola tak-ambigu -> robot, bukan AI"). Robot kasih
  FAKTA (berkas:baris + tingkat), AI kasih MAKNA (terjemah bahasa awam + saran).

  Catatan jujur (gaya unicode-safety-check): ini menutup pola berbahaya yang DIKETAHUI secara
  deterministik - BUKAN jaminan keamanan mutlak. Permukaan dinamis (hook yang dieksekusi saat
  runtime, server MCP yang perilakunya berubah) tetap butuh pagar perilaku-AI (sec. 8.1 #10
  anti-bypass) + verifikasi manusia. Robot ini SENGAJA tidak auto-memperbaiki apa pun (mode aman
  cuma-baca; perubahan config = keputusan owner, sec. 4.6 owner-gated).

  ANTI ALARM-PALSU: izin tool yang lebar BISA jadi disengaja untuk project tertentu -> ditandai
  PENTING (peringatan), BUKAN GENTING (tolak-keras). Referensi env-var (`${VAR}` / `$env:` /
  `process.env`) di config = pola AMAN -> TIDAK ditandai (cuma rahasia LITERAL yang ditandai).

  Tingkat keseriusan (bahasa non-programmer, sec. 2.1 #7): GENTING / PENTING / RAPIKAN
  (BUKAN CRITICAL/HIGH/LOW). Gerbang/CI hanya gagal kalau ada GENTING (yang lain = peringatan).

  Fungsi yang di-export:
    - Get-LintasAiConfigFinding   : Array temuan dari sebuah string config (objek terstruktur).
    - Get-LintasAiConfigTarget    : Daftar berkas config-AI yang dipindai (.mcp.json / settings / skills).
    - Invoke-LintasAiConfigCheck  : Jalankan + (opsional) cetak laporan.
                                    Returns { Findings; Count; Genting; Penting; Rapikan }.

.NOTES
  Versi  : 1.0.0
  Tanggal: 2026-06-19
  Inspirasi: pola "security-scan (AgentShield) / mcp-inventory" ECC v2.0.0 (MIT) - ditulis-ulang
             PowerShell ringan + bahasa awam + label GENTING/PENTING/RAPIKAN (adopsi selektif,
             bukan port). Saudara kembar lib/unicode-safety-check.ps1 + lib/consistency-check.ps1.
#>
[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string[]]$Path,
    [switch]$Quiet
)

# ---- Pola rahasia VENDOR-SPESIFIK (presisi tinggi, alarm-palsu rendah) ----
# Hanya bentuk yang khas kunci/token asli; placeholder `${VAR}` tak akan cocok (itu memang aman).
$script:LintasSecretPatterns = @(
    @{ Re = [regex]'sk-[A-Za-z0-9_]{20,}';                         Name = 'kunci-API gaya OpenAI (sk-...)' }
    @{ Re = [regex]'sk-ant-[A-Za-z0-9_-]{20,}';                    Name = 'kunci-API Anthropic (sk-ant-...)' }
    @{ Re = [regex]'gh[pousr]_[A-Za-z0-9]{30,}';                   Name = 'token GitHub (ghp_/gho_/...)' }
    @{ Re = [regex]'AKIA[0-9A-Z]{16}';                             Name = 'AWS Access Key (AKIA...)' }
    @{ Re = [regex]'xox[baprs]-[A-Za-z0-9-]{10,}';                 Name = 'token Slack (xox..-..)' }
    @{ Re = [regex]'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}'; Name = 'token JWT (eyJ...)' }
    @{ Re = [regex]'AIza[0-9A-Za-z_-]{30,}';                       Name = 'kunci-API Google (AIza...)' }
)

# ---- Frasa "menembus pagar" untuk skill kustom (sec. 8.1 #10) ----
$script:LintasBypassPatterns = @(
    @{ Re = [regex]'(?i)dangerously-skip-permissions';            Name = 'mematikan portal izin (dangerously-skip-permissions)' }
    @{ Re = [regex]'(?i)bypassPermissions';                       Name = 'melewati izin (bypassPermissions)' }
    @{ Re = [regex]'(?i)(menerobos|terobos|matikan|nonaktifkan|lewati)[^\n]{0,30}(pagar|izin|guard|keamanan|konfirmasi)'; Name = 'frasa menembus/mematikan pagar keamanan' }
    @{ Re = [regex]'(?i)--no-verify';                             Name = 'melewati pemeriksaan git (--no-verify)' }
)

function Add-LintasAiFinding {
    param([System.Collections.ArrayList]$Acc, [string]$File, [int]$Line, [string]$Tingkat, [string]$Kode, [string]$Pesan)
    [void]$Acc.Add([pscustomobject]@{ File = $File; Line = $Line; Tingkat = $Tingkat; Kode = $Kode; Pesan = $Pesan })
}

function Get-LintasAiConfigFinding {
    <#
      Pindai isi SATU berkas config-AI (sebagai string) -> array temuan terstruktur.
      $ConfigType: 'mcp' | 'settings' | 'skills'. Rahasia LITERAL dicek di semua tipe.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Content,
        [string]$RelPath = '<string>',
        [ValidateSet('mcp', 'settings', 'skills')][string]$ConfigType = 'settings'
    )
    $findings = [System.Collections.ArrayList]::new()
    if ([string]::IsNullOrEmpty($Content)) { return @() }
    $lines = $Content -split "`n"

    for ($ln = 0; $ln -lt $lines.Count; $ln++) {
        $line = $lines[$ln]
        $num = $ln + 1

        # (1) RAHASIA LITERAL ber-pola vendor = GENTING (di semua tipe config).
        foreach ($p in $script:LintasSecretPatterns) {
            if ($p.Re.IsMatch($line)) {
                Add-LintasAiFinding $findings $RelPath $num 'GENTING' 'SECRET' ("Rahasia/kunci ter-tulis di config: {0} - JANGAN simpan rahasia di config (pakai env-var / secret manager)." -f $p.Name)
            }
        }

        if ($ConfigType -eq 'mcp') {
            # (2) Server MCP jarak-jauh: transport remote / URL http = data keluar komputer.
            if ($line -match '"type"\s*:\s*"(sse|http|streamable-http|streamableHttp)"') {
                Add-LintasAiFinding $findings $RelPath $num 'PENTING' 'MCP_REMOTE' 'Server MCP jarak-jauh (transport remote) - data/perintah bisa keluar komputer; pastikan server tepercaya.'
            }
            if ($line -match '"url"\s*:\s*"https?://') {
                Add-LintasAiFinding $findings $RelPath $num 'PENTING' 'MCP_REMOTE' 'Server MCP via URL jarak-jauh - pastikan alamatnya tepercaya (data bisa keluar komputer).'
            }
            # (3) Perintah via npx = paket pihak-ketiga (bisa berubah) -> ingatkan pin versi.
            if ($line -match '"(command|args)"\s*:.*\bnpx\b' -or $line -match '^\s*"npx"') {
                Add-LintasAiFinding $findings $RelPath $num 'RAPIKAN' 'MCP_NPX' 'Server MCP dijalankan via npx (paket pihak-ketiga bisa berubah sewaktu-waktu) - pastikan dari sumber tepercaya + pin versi (mis. paket@1.2.3).'
            }
        }

        if ($ConfigType -eq 'settings') {
            # (4) Izin tool sangat lebar = PENTING (mungkin SENGAJA -> peringatan, bukan tolak-keras).
            if ($line -match '"Bash\(\*\)"' -or $line -match '"Bash"\s*[,\]]' -or $line -match '"allow"\s*:\s*\[\s*"\*"') {
                Add-LintasAiFinding $findings $RelPath $num 'PENTING' 'PERM_BROAD' 'Izin tool sangat lebar (mis. semua perintah Bash) - bisa disengaja, tapi periksa apakah memang perlu seluas itu (prinsip izin sesedikit mungkin).'
            }
            # (5) Hook "unduh-lalu-jalankan" = GENTING (jalankan kode dari internet).
            if ($line -match '(?i)\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b' -and
                $line -match '(?i)(\|\s*(iex|bash|sh|Invoke-Expression|node|python))') {
                Add-LintasAiFinding $findings $RelPath $num 'GENTING' 'HOOK_FETCH_RUN' 'Hook "unduh-lalu-jalankan" (ambil dari internet lalu eksekusi) - sangat berisiko; jangan jalankan kode dari sumber tak tepercaya.'
            }
            # (6) Mematikan portal izin lewat setting.
            if ($line -match '(?i)dangerously.{0,3}skip.{0,3}permissions' -or $line -match '(?i)"bypassPermissions"\s*:\s*true') {
                Add-LintasAiFinding $findings $RelPath $num 'GENTING' 'PERM_BYPASS' 'Setting yang MEMATIKAN portal izin AI - melanggar pagar keamanan (sec. 8.1 #10); jangan dipakai kecuali kamu sangat paham risikonya.'
            }
        }

        if ($ConfigType -eq 'skills') {
            # (7) Skill kustom yang minta menembus pagar (sec. 8.1 #10).
            foreach ($p in $script:LintasBypassPatterns) {
                if ($p.Re.IsMatch($line)) {
                    Add-LintasAiFinding $findings $RelPath $num 'GENTING' 'SKILL_BYPASS' ("Skill kustom memuat frasa menembus pagar keamanan: {0} - tahan + lapor owner (sec. 8.1 #10: skill TIDAK boleh melanggar pagar)." -f $p.Name)
                }
            }
        }
    }
    return @($findings.ToArray())
}

function Get-LintasAiConfigTarget {
    <# Cari berkas config-AI yang relevan di sebuah root. Returns [pscustomobject]{ File; Type }. #>
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$Root)
    $out = [System.Collections.ArrayList]::new()
    # .mcp.json di akar + .claude/ (tidak rekursif dalam-dalam ke node_modules dsb).
    $mcpCandidates = @(
        (Join-Path $Root '.mcp.json'),
        (Join-Path $Root '.claude/.mcp.json'),
        (Join-Path $Root '.cursor/mcp.json')
    )
    foreach ($c in $mcpCandidates) { if (Test-Path -LiteralPath $c -PathType Leaf) { [void]$out.Add([pscustomobject]@{ File = $c; Type = 'mcp' }) } }
    $settingsCandidates = @(
        (Join-Path $Root '.claude/settings.json'),
        (Join-Path $Root '.claude/settings.local.json')
    )
    foreach ($c in $settingsCandidates) { if (Test-Path -LiteralPath $c -PathType Leaf) { [void]$out.Add([pscustomobject]@{ File = $c; Type = 'settings' }) } }
    $skillsFile = Join-Path $Root 'docs/SKILLS_LOCAL.md'
    if (Test-Path -LiteralPath $skillsFile -PathType Leaf) { [void]$out.Add([pscustomobject]@{ File = $skillsFile; Type = 'skills' }) }
    return @($out.ToArray())
}

function Invoke-LintasAiConfigCheck {
    [CmdletBinding()]
    param(
        [string]$RepoRoot,
        [string[]]$Path,
        [switch]$Quiet
    )
    if (-not $RepoRoot) { $RepoRoot = Split-Path -Parent $PSScriptRoot }  # induk folder lib/

    $targets = [System.Collections.ArrayList]::new()
    if ($Path) {
        foreach ($p in $Path) {
            if (-not (Test-Path -LiteralPath $p)) { continue }
            $name = Split-Path -Leaf $p
            $type = 'settings'
            if ($name -match 'mcp')        { $type = 'mcp' }
            elseif ($name -match 'SKILLS_LOCAL') { $type = 'skills' }
            elseif ($name -match 'settings') { $type = 'settings' }
            [void]$targets.Add([pscustomobject]@{ File = (Resolve-Path -LiteralPath $p).Path; Type = $type })
        }
    } else {
        foreach ($t in (Get-LintasAiConfigTarget -Root $RepoRoot)) { [void]$targets.Add($t) }
    }

    $all = [System.Collections.ArrayList]::new()
    foreach ($t in $targets) {
        # WAJIB -Encoding UTF8 (alasan sama unicode-safety-check: PS 5.1 default ANSI -> hasil beda).
        $content = Get-Content -LiteralPath $t.File -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        if ($null -eq $content) { continue }
        $rel = $t.File
        try { $rel = (Resolve-Path -LiteralPath $t.File -Relative -ErrorAction SilentlyContinue) } catch { $rel = $t.File }
        foreach ($f in (Get-LintasAiConfigFinding -Content $content -RelPath $rel -ConfigType $t.Type)) { [void]$all.Add($f) }
    }

    $arr = @($all.ToArray())
    $genting = @($arr | Where-Object { $_.Tingkat -eq 'GENTING' }).Count
    $penting = @($arr | Where-Object { $_.Tingkat -eq 'PENTING' }).Count
    $rapikan = @($arr | Where-Object { $_.Tingkat -eq 'RAPIKAN' }).Count

    if (-not $Quiet) {
        Write-Host "Robot pemindai konfigurasi-AI (.mcp.json / .claude/settings.json / SKILLS_LOCAL.md)"
        Write-Host ('-' * 60)
        if ($arr.Count -eq 0) {
            Write-Host "BERSIH: tidak ada pola berbahaya pada konfigurasi AI." -ForegroundColor Green
        } else {
            foreach ($x in $arr) {
                $color = switch ($x.Tingkat) { 'GENTING' { 'Red' } 'PENTING' { 'Yellow' } default { 'Cyan' } }
                Write-Host ("  [{0}] {1}:{2}  {3}" -f $x.Tingkat, $x.File, $x.Line, $x.Pesan) -ForegroundColor $color
            }
            Write-Host ('-' * 60)
            Write-Host ("Ringkasan: GENTING {0} - PENTING {1} - RAPIKAN {2}. (Gerbang gagal hanya jika GENTING > 0.)" -f $genting, $penting, $rapikan) -ForegroundColor $(if ($genting -gt 0) { 'Red' } else { 'Yellow' })
        }
    }
    return [pscustomobject]@{ Findings = $arr; Count = $arr.Count; Genting = $genting; Penting = $penting; Rapikan = $rapikan }
}

# Auto-run saat dijalankan langsung (`& .\lib\ai-config-check.ps1`), BUKAN saat dot-source
# (Pester dot-source -> InvocationName '.'): keluar dengan kode = jumlah GENTING (0 = aman untuk gerbang).
if ($MyInvocation.InvocationName -ne '.' -and -not $env:LINTAS_AICONFIG_NOAUTORUN) {
    $result = Invoke-LintasAiConfigCheck -RepoRoot $RepoRoot -Path $Path -Quiet:$Quiet
    exit $result.Genting
}
