# json-merge-helpers.ps1
# PowerShell helpers untuk merge JSON allow lists (lintasAI kit).
#
# Compatibility: Windows PowerShell 5.1 + PowerShell 7+.
# ASCII-only. No &&, no ?:, no ?? operators.
# Dot-source friendly: . ./lib/json-merge-helpers.ps1

Set-StrictMode -Version Latest

# Soft warning threshold untuk allow-list. Bukan hard cap (kit tidak boleh
# refuse merge), tapi memicu Write-Warning supaya owner notice kalau allow-list
# tumbuh tidak wajar lintas update. Permission-surface bloat = erosi
# principle-of-least-privilege.
$script:LintasAllowListWarnThreshold = 200

# Canonical form regex: trailing ":*" pada Bash/Read/Glob/dst. menjadi WILDCARD
# yang superseed bentuk bare. Mis. "Bash(git status:*)" superseed
# "Bash(git status)". Pattern: <Tool>(<inner>:*) atau <Tool>(<inner>) generic.
# Tidak mencoba mem-parse argument shell-style - cukup string-prefix matching
# yang aman untuk shape settings.local.json yang dipakai Claude Code.

function Read-LintasJsonFileSafely {
    <#
    .SYNOPSIS
        Internal helper. Read + parse JSON file dengan graceful failure.
    .DESCRIPTION
        Return PSCustomObject hasil ConvertFrom-Json, atau $null kalau file
        tidak ada / kosong. Tidak throw saat path missing / empty - caller
        cek $null + lanjut "treat as empty".

        Untuk dua failure mode lain ada switch sopan-tapi-tegas:

        1. RAW READ GAGAL (file di-lock oleh VS Code / antivirus /
           OneDrive sync / concurrent installer). Default: THROW supaya
           caller destruktif (Merge-LintasAllowList) tidak salah anggap
           sebagai "file kosong" lalu menimpa config user.
           Read-only caller (Test-LintasAllowListMerged, Get-LintasAllowList)
           pass -SuppressLockError → return $null + Write-Warning.

        2. MALFORMED JSON (file EXIST + isi non-empty + ConvertFrom-Json
           throw). Sebelum patch ini, helper diam-diam return $null. Akibatnya
           Merge-LintasAllowList membangun [pscustomobject]@{} kosong → top-
           level keys user (permissions.deny, env, apiKeyHelper, denyList,
           dst.) HILANG saat ditulis ulang. Backup .bak.<ts> memang ada,
           tapi user hanya melihat satu Write-Warning kuning yang sering
           tertelan outer catch setup-pola-b.

           Default: THROW dengan pesan actionable (perbaiki / hapus file
           manual). Read-only caller pass -SuppressMalformedError → tetap
           return $null + Write-Warning (mereka tidak menulis ulang file).
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $false)]
        [switch]$SuppressLockError,

        [Parameter(Mandatory = $false)]
        [switch]$SuppressMalformedError
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    try {
        $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
    } catch {
        # File exists but unreadable (locked by VS Code, antivirus scan,
        # OneDrive sync, concurrent installer, dll). JANGAN treat as empty
        # karena caller destruktif akan menulis ulang file = config wipe.
        $msg = "Cannot read existing settings '$Path' - file may be locked by another process (close VS Code/editor and retry). Detail: $($_.Exception.Message)"
        if ($SuppressLockError) {
            Write-Warning "json-merge-helpers: $msg"
            return $null
        }
        throw $msg
    }

    if ($null -eq $raw -or $raw.Trim().Length -eq 0) {
        return $null
    }

    try {
        $obj = $raw | ConvertFrom-Json -ErrorAction Stop
        return $obj
    } catch {
        # File EXIST + isi non-empty + parse gagal = HIGH-RISK silent overwrite.
        # Lihat fix v1.3.1: sebelumnya return $null diam-diam mengakibatkan
        # caller destruktif menimpa custom top-level keys user.
        $parseError = $_.Exception.Message
        $msg = "JSON malformed di '$Path' ($parseError). File EXIST dengan isi non-empty - perbaiki sintaks JSON atau hapus file ini secara manual, lalu jalankan setup ulang. Penolakan ini sengaja untuk mencegah penghapusan custom keys (permissions.deny / env / apiKeyHelper)."
        if ($SuppressMalformedError) {
            Write-Warning "json-merge-helpers: $msg"
            return $null
        }
        throw $msg
    }
}

function Get-LintasAllowArrayFromObject {
    <#
    .SYNOPSIS
        Internal helper. Extract permissions.allow array dari parsed object.
    .DESCRIPTION
        Return string[] (mungkin kosong) - tidak pernah $null.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        $Obj
    )

    $result = New-Object 'System.Collections.Generic.List[string]'

    if ($null -eq $Obj) {
        return ,$result.ToArray()
    }

    $perms = $null
    try {
        if ($Obj.PSObject.Properties.Name -contains 'permissions') {
            $perms = $Obj.permissions
        }
    } catch {
        $perms = $null
    }

    if ($null -eq $perms) {
        return ,$result.ToArray()
    }

    $allow = $null
    try {
        if ($perms.PSObject.Properties.Name -contains 'allow') {
            $allow = $perms.allow
        }
    } catch {
        $allow = $null
    }

    if ($null -eq $allow) {
        return ,$result.ToArray()
    }

    foreach ($item in $allow) {
        if ($null -ne $item) {
            $result.Add([string]$item)
        }
    }

    return ,$result.ToArray()
}

function Compress-SupersededAllowEntry {
    <#
    .SYNOPSIS
        Internal helper. Hapus entry bare yang sudah di-cover oleh varian wildcard.
    .DESCRIPTION
        Dedup-by-superseder pass untuk allow-list. Kalau ada DUA entry:
            Bash(git status)        <-- narrower (bare)
            Bash(git status:*)      <-- broader (wildcard)
        bentuk bare jadi redundan + wajib di-drop. Kalau hanya bare yang ada
        (tanpa wildcard pasangannya), entry bare tetap dipertahankan apa adanya.

        Mencegah permission-surface bloat antar update template (mis. template
        v1.3.1 punya bare "Bash(git status)", v1.3.2 ganti ke "Bash(git status:*)";
        tanpa collapse pass, allow-list user akan kumpulin kedua bentuk forever).

        Algoritma (case-sensitive Ordinal):
        1. Bangun set semua entry.
        2. Untuk setiap entry yang berakhir dengan ":*)" (mis. "Bash(git status:*)"),
           derive "bare counterpart" dengan ganti ":*)" jadi ")" (mis.
           "Bash(git status)"). Kalau bare counterpart ada di set, tandai untuk
           penghapusan.
        3. Return list tanpa entry yang ter-superseder.

        Tidak menyentuh entry yang TIDAK match pattern "<Tool>(<inner>:*)" -
        mis. "Bash(npx prisma generate)" atau "Read(*)" lewat tanpa perubahan.

        Idempotent: run berulang return hasil sama.
    .PARAMETER Entries
        Array string entry permissions.allow. Boleh kosong.
    .OUTPUTS
        [string[]] (mungkin kosong, tidak pernah $null).
    #>
    [CmdletBinding()]
    [OutputType([string[]])]
    param(
        [Parameter(Mandatory = $false)]
        [AllowEmptyCollection()]
        [string[]]$Entries
    )

    $out = New-Object 'System.Collections.Generic.List[string]'
    if ($null -eq $Entries -or $Entries.Count -eq 0) {
        return ,$out.ToArray()
    }

    # Set semua entry untuk lookup O(1).
    $entrySet = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    foreach ($e in $Entries) {
        if ($null -ne $e) {
            [void]$entrySet.Add([string]$e)
        }
    }

    # Bangun set "to-drop": bare counterpart dari setiap entry wildcard.
    $toDrop = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    foreach ($e in $entrySet) {
        # Pattern: berakhir dengan ":*)" (5 char terakhir minimum "X:*)" = 4 char).
        # Mis. "Bash(git status:*)" -> bare "Bash(git status)".
        if ($e.Length -ge 4 -and $e.EndsWith(':*)')) {
            $bareCandidate = $e.Substring(0, $e.Length - 3) + ')'
            if ($entrySet.Contains($bareCandidate)) {
                [void]$toDrop.Add($bareCandidate)
            }
        }
    }

    # Emit hanya entry yang tidak ter-superseder. Preserve input order.
    foreach ($e in $Entries) {
        if ($null -eq $e) { continue }
        if (-not $toDrop.Contains([string]$e)) {
            [void]$out.Add([string]$e)
        }
    }

    return ,$out.ToArray()
}

function Merge-LintasAllowList {
    <#
    .SYNOPSIS
        Merge permissions.allow array dari template ke existing settings JSON.
    .DESCRIPTION
        Union antara existing.permissions.allow dan template.permissions.allow,
        dedup case-sensitive, sort alphabetical, preserve top-level keys lain
        di existing (mis. "denyList", "env", dst). Backup existing kalau ada
        perubahan. Idempotent: re-run tanpa perubahan return $false.

        Existing JSON malformed = HARD ERROR (throw). Sebelumnya v1.3.1
        diam-diam treat as empty, tapi itu menghapus custom top-level
        keys user (permissions.deny, env, apiKeyHelper, dst.) saat write.
        Sekarang: simpan copy mentah ke '<existing>.malformed.bak.<ts>'
        + throw dengan pesan actionable. User wajib perbaiki / hapus
        file rusak sebelum rerun setup. Template wajib parse-able -
        kalau gagal juga throw.

    .PARAMETER ExistingPath
        Path ke settings file existing (mis. .claude/settings.local.json).
        Boleh tidak ada - akan diperlakukan sebagai object kosong.

    .PARAMETER TemplatePath
        Path ke template JSON yang berisi permissions.allow baru. WAJIB ada
        dan valid JSON.

    .PARAMETER OutputPath
        Path tujuan tulis hasil merge. Biasanya sama dengan ExistingPath.

    .PARAMETER DryRun
        Kalau di-set, tidak menulis file dan tidak buat backup. Hanya return
        status apakah ada diff.

    .OUTPUTS
        [bool] $true kalau ada perubahan (atau akan ada perubahan saat DryRun),
        $false kalau sudah merged / tidak ada diff.

    .EXAMPLE
        Merge-LintasAllowList -ExistingPath .claude/settings.local.json `
            -TemplatePath .claude-kit/templates/settings.local.json `
            -OutputPath .claude/settings.local.json

    .EXAMPLE
        Merge-LintasAllowList -ExistingPath $existing -TemplatePath $tpl `
            -OutputPath $existing -DryRun

    .EXAMPLE
        # In-memory template variant (no template file on disk needed).
        Merge-LintasAllowList -SettingsPath .claude/settings.local.json `
            -TemplateAllowList @('Bash(git status)', 'Read(*)')
    #>
    [CmdletBinding(DefaultParameterSetName = 'FilePath')]
    param(
        # --- File-based template variant (production / setup-pola-b path) ---
        [Parameter(Mandatory = $true, ParameterSetName = 'FilePath')]
        [string]$ExistingPath,

        [Parameter(Mandatory = $true, ParameterSetName = 'FilePath')]
        [string]$TemplatePath,

        [Parameter(Mandatory = $true, ParameterSetName = 'FilePath')]
        [string]$OutputPath,

        # --- In-memory template variant (test / programmatic callers) ---
        # Settings file path is BOTH source and destination (read-modify-write).
        [Parameter(Mandatory = $true, ParameterSetName = 'InMemory')]
        [string]$SettingsPath,

        # Template allow-list passed directly as a string array, no template
        # file on disk. Equivalent shape: { permissions: { allow: [...] } }.
        [Parameter(Mandatory = $true, ParameterSetName = 'InMemory')]
        [AllowEmptyCollection()]
        [string[]]$TemplateAllowList,

        # --- Shared options ---
        [Parameter(Mandatory = $false)]
        [switch]$DryRun
    )

    # Normalise the InMemory parameter set onto the FilePath pipeline. We
    # synthesise a tiny in-memory template object that matches the shape the
    # rest of the function expects, and reuse ExistingPath/OutputPath as the
    # same SettingsPath so read-modify-write semantics fall out naturally.
    if ($PSCmdlet.ParameterSetName -eq 'InMemory') {
        $ExistingPath = $SettingsPath
        $OutputPath   = $SettingsPath
        $templateObj  = [pscustomobject]@{
            permissions = [pscustomobject]@{
                allow = @($TemplateAllowList)
            }
        }
        # TemplatePath stays $null - we skip the disk-read branch below.
    } else {
        if (-not (Test-Path -LiteralPath $TemplatePath)) {
            throw "Merge-LintasAllowList: TemplatePath tidak ditemukan: '$TemplatePath'"
        }

        $templateObj = Read-LintasJsonFileSafely -Path $TemplatePath
        if ($null -eq $templateObj) {
            throw "Merge-LintasAllowList: template '$TemplatePath' kosong atau malformed."
        }
    }

    # Existing-side read. Read-LintasJsonFileSafely default THROW on:
    #   - file ada tapi lock (mis. VS Code), atau
    #   - file ada + isi non-empty + JSON malformed (bug v1.3.1).
    # Untuk kasus malformed, sebelum re-throw kita simpan copy mentah ke
    # ".malformed.bak.<ts>" supaya user notice (nama berbeda dari backup
    # rutin ".bak.<ts>") dan punya jejak untuk memperbaiki manual sebelum
    # rerun. JANGAN proceed dengan $existingObj=$null + silent-overwrite.
    $existingExists = Test-Path -LiteralPath $ExistingPath
    try {
        $existingObj = Read-LintasJsonFileSafely -Path $ExistingPath
    } catch {
        $readErr = $_.Exception.Message
        if ($existingExists) {
            $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
            $malformedBackup = "$ExistingPath.malformed.bak.$timestamp"
            try {
                Copy-Item -LiteralPath $ExistingPath -Destination $malformedBackup -Force -ErrorAction Stop
                Write-Warning "Merge-LintasAllowList: existing settings rusak. Copy mentah disimpan ke '$malformedBackup' supaya tidak hilang. Perbaiki '$ExistingPath' atau hapus file itu lalu rerun setup."
            } catch {
                Write-Warning "Merge-LintasAllowList: gagal salin copy rescue '$ExistingPath' -> '$malformedBackup': $($_.Exception.Message). File asli BELUM di-overwrite."
            }
        }
        throw "Merge-LintasAllowList: refuse to write '$OutputPath'. $readErr"
    }

    $existingAllow = Get-LintasAllowArrayFromObject -Obj $existingObj
    $templateAllow = Get-LintasAllowArrayFromObject -Obj $templateObj

    # Union (case-sensitive dedup) preserving template-added items.
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    $merged = New-Object 'System.Collections.Generic.List[string]'

    foreach ($item in $existingAllow) {
        if ($seen.Add($item)) {
            [void]$merged.Add($item)
        }
    }
    foreach ($item in $templateAllow) {
        if ($seen.Add($item)) {
            [void]$merged.Add($item)
        }
    }

    # Collapse pass: drop "Bash(git status)" kalau "Bash(git status:*)" juga ada.
    # Mencegah permission-surface bloat antar update template (DoS soft growth +
    # erosi principle-of-least-privilege).
    $collapsed = Compress-SupersededAllowEntry -Entries $merged.ToArray()

    # Soft warning: kalau allow-list tumbuh besar abnormal, owner WAJIB notice
    # supaya review template + drop entry usang. Bukan hard cap (kit tetap merge).
    if ($collapsed.Count -gt $script:LintasAllowListWarnThreshold) {
        Write-Warning ("Merge-LintasAllowList: permissions.allow punya {0} entry (> threshold {1}). Review '{2}' untuk drop entry usang / superseded. Allow-list besar = erosi principle-of-least-privilege." -f $collapsed.Count, $script:LintasAllowListWarnThreshold, $OutputPath)
    }

    # Sort alphabetical (ordinal, case-sensitive).
    $mergedSorted = $collapsed | Sort-Object -CaseSensitive

    # Detect diff vs existing allow (order-independent set compare).
    $existingSet = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    foreach ($e in $existingAllow) { [void]$existingSet.Add($e) }
    $mergedSet = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    foreach ($m in $mergedSorted) { [void]$mergedSet.Add($m) }

    $hasDiff = $false
    if ($existingSet.Count -ne $mergedSet.Count) {
        $hasDiff = $true
    } else {
        foreach ($m in $mergedSet) {
            if (-not $existingSet.Contains($m)) {
                $hasDiff = $true
                break
            }
        }
    }

    if (-not $hasDiff) {
        return $false
    }

    if ($DryRun) {
        return $true
    }

    # Build output object: preserve existing top-level keys, override permissions.allow.
    if ($null -eq $existingObj) {
        $outObj = [pscustomobject]@{}
    } else {
        # Clone via JSON round-trip supaya tidak mutate referensi caller.
        $clone = $existingObj | ConvertTo-Json -Depth 20 | ConvertFrom-Json
        $outObj = $clone
    }

    # Ensure permissions object exists.
    $hasPerms = $false
    try {
        $hasPerms = ($outObj.PSObject.Properties.Name -contains 'permissions')
    } catch {
        $hasPerms = $false
    }

    if (-not $hasPerms) {
        Add-Member -InputObject $outObj -MemberType NoteProperty -Name 'permissions' -Value ([pscustomobject]@{}) -Force
    }

    $hasAllow = $false
    try {
        $hasAllow = ($outObj.permissions.PSObject.Properties.Name -contains 'allow')
    } catch {
        $hasAllow = $false
    }

    # Force-set allow as plain array.
    $allowArray = @($mergedSorted)
    if ($hasAllow) {
        $outObj.permissions.allow = $allowArray
    } else {
        Add-Member -InputObject $outObj.permissions -MemberType NoteProperty -Name 'allow' -Value $allowArray -Force
    }

    # Backup existing file kalau ada DAN ada diff.
    if ($existingExists) {
        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backupPath = "$ExistingPath.bak.$timestamp"
        try {
            Copy-Item -LiteralPath $ExistingPath -Destination $backupPath -Force -ErrorAction Stop
        } catch {
            Write-Warning "Merge-LintasAllowList: gagal backup '$ExistingPath' -> '$backupPath': $($_.Exception.Message)"
        }
    }

    # Ensure output dir exists.
    # NOTE: `Split-Path -LiteralPath $p -Parent` AMBIGUOUS di Windows PowerShell 5.1
    # (`-LiteralPath` dan `-Parent` ada di parameter set berbeda, dianggap ambiguous
    # walaupun PS 7+ resolve fine). `-Parent` adalah default action - omit aja.
    $outDir = Split-Path -LiteralPath $OutputPath
    if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
        try {
            New-Item -ItemType Directory -Path $outDir -Force -ErrorAction Stop | Out-Null
        } catch {
            throw "Merge-LintasAllowList: gagal buat folder output '$outDir': $($_.Exception.Message)"
        }
    }

    # Serialize + write (UTF-8 tanpa BOM, LF line ending agar konsisten).
    $json = $outObj | ConvertTo-Json -Depth 10
    try {
        # Use .NET WriteAllText supaya UTF-8 no-BOM lintas PS 5.1 / 7.
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($OutputPath, $json, $utf8NoBom)
    } catch {
        throw "Merge-LintasAllowList: gagal tulis '$OutputPath': $($_.Exception.Message)"
    }

    return $true
}

function Test-LintasAllowListMerged {
    <#
    .SYNOPSIS
        Cek apakah semua entry RequiredAllowList sudah ada di permissions.allow.
    .DESCRIPTION
        Return $true kalau setiap item di RequiredAllowList terdapat di
        file JSON pada Path. Case-sensitive. Kalau file tidak ada / malformed,
        return $false (treat sebagai "belum merged").

    .PARAMETER Path
        Path ke file settings JSON.

    .PARAMETER RequiredAllowList
        Array string yang wajib ada di permissions.allow.

    .OUTPUTS
        [bool]

    .EXAMPLE
        Test-LintasAllowListMerged -Path .claude/settings.local.json `
            -RequiredAllowList @('Bash(git status)', 'Read(*)')
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [string[]]$RequiredAllowList
    )

    if ($null -eq $RequiredAllowList -or $RequiredAllowList.Count -eq 0) {
        return $true
    }

    # Read-only check - kalau file di-lock / malformed kita tidak menulis
    # apapun, cukup return $false (treat as "belum merged"). Caller (verifier)
    # tidak akan over-write file user, jadi suppress kedua failure mode aman.
    $obj = Read-LintasJsonFileSafely -Path $Path -SuppressLockError -SuppressMalformedError
    if ($null -eq $obj) {
        return $false
    }

    $allow = Get-LintasAllowArrayFromObject -Obj $obj
    $set = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    foreach ($a in $allow) { [void]$set.Add($a) }

    foreach ($req in $RequiredAllowList) {
        if (-not $set.Contains($req)) {
            return $false
        }
    }
    return $true
}

function Get-LintasAllowList {
    <#
    .SYNOPSIS
        Return permissions.allow array dari file settings JSON.
    .DESCRIPTION
        Return string[] (mungkin kosong). Kalau file tidak ada, malformed,
        atau permissions.allow tidak ada, return empty array - tidak throw.

    .PARAMETER Path
        Path ke file settings JSON.

    .OUTPUTS
        [string[]]

    .EXAMPLE
        $allow = Get-LintasAllowList -Path .claude/settings.local.json
        $allow.Count
    #>
    [CmdletBinding()]
    [OutputType([string[]])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    # Read-only getter - return empty array kalau file di-lock / malformed
    # supaya caller tidak crash. Caller pure-read tidak akan menulis ulang
    # file, jadi suppress kedua failure mode aman.
    $obj = Read-LintasJsonFileSafely -Path $Path -SuppressLockError -SuppressMalformedError
    $arr = Get-LintasAllowArrayFromObject -Obj $obj
    return ,$arr
}
