function Test-LintasParseAll {
    $kit = Split-Path -Parent $PSScriptRoot
    $errors = @()
    $passed = 0
    Get-ChildItem $kit -Recurse -Include *.ps1 -File | ForEach-Object {
        $e = $null
        $null = [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$null, [ref]$e)
        if ($e.Count -gt 0) { $errors += @{File=$_.Name; Count=$e.Count; First=$e[0].Message} }
        else { $passed++ }
    }
    return @{Passed=$passed; Failed=$errors.Count; Errors=$errors}
}

function Test-LintasCriticalFile {
    $kit = Split-Path -Parent $PSScriptRoot
    $critical = @("bin/lintasai.js", "README.md", "package.json", "lib/kit-files.psd1",
                  "setup-pola-b.ps1", "kit.ps1", "uninstall.ps1", "update-kit.ps1",
                  "install-windows.ps1", "AGENTS.md.template", "lib/popup-helpers.ps1",
                  "lib/json-merge-helpers.ps1")
    $missing = $critical | Where-Object { -not (Test-Path (Join-Path $kit $_)) }
    return @{Total=$critical.Count; Missing=$missing}
}

function Test-LintasManifestIntegrity {
    $kit = Split-Path -Parent $PSScriptRoot
    $manifestPath = Join-Path $kit "lib/kit-files.psd1"
    if (-not (Test-Path $manifestPath)) {
        return @{Total=0; Missing=@("lib/kit-files.psd1 not found")}
    }
    $manifest = Import-PowerShellDataFile $manifestPath
    $walk = {
        param($node)
        if ($node -is [hashtable]) {
            foreach ($key in $node.Keys) {
                & $walk $node[$key]
            }
        } elseif ($node -is [array] -or $node -is [System.Collections.IEnumerable] -and -not ($node -is [string])) {
            foreach ($item in $node) {
                & $walk $item
            }
        } elseif ($node -is [string]) {
            $script:totalCount++
            $full = Join-Path $kit $node
            if (-not (Test-Path $full)) {
                $script:missingList += $node
            }
        }
    }
    $script:totalCount = 0
    $script:missingList = @()
    & $walk $manifest
    return @{Total=$script:totalCount; Missing=$script:missingList}
}

function Test-LintasOrphanRef {
    $kit = Split-Path -Parent $PSScriptRoot
    # Detector keywords - DO NOT change format (auto-excluded from self-scan via filename)
    $deletedStubs = @("BOOTSTRAP_PROJECT_DOCS_PROMPT", "PROJECT_KICKOFF_PROMPT", "PROJECT_MIGRATION_PROMPT", "SETUP_POLA_B_PROMPT", "UPDATE_DOCS_PROMPT")
    $pattern = ($deletedStubs -join "|")
    # Self-exclude smoke-fast.ps1 (it contains the patterns as detection literals, not orphan refs).
    # Plus CHANGELOG/AUDIT_HISTORY (history files documenting the deletion are OK).
    $excludeFilenames = @("CHANGELOG.md", "AUDIT_HISTORY.md", "smoke-fast.ps1")
    $orphans = Get-ChildItem $kit -Recurse -Include *.md,*.ps1,*.psd1 |
        Where-Object { $_.Name -notin $excludeFilenames } |
        Select-String -Pattern $pattern |
        Measure-Object
    return @{Count=$orphans.Count}
}

function Test-LintasJsonValid {
    $kit = Split-Path -Parent $PSScriptRoot
    # .template files contain placeholders (mis. <NAMA_PROYEK>, [TBD]) yang BUKAN JSON valid by design.
    # Only validate file dengan extension persis ".json" (strict). settings.local.json.template is JSON-with-comments-friendly,
    # so include it eksplisit; other .template files = SKIP.
    # package-lock.json di-SKIP: npm-generated, VALID JSON (Node/npm parse OK + sudah di-validasi `npm ci`
    # di gerbang node-lint CI), TAPI PS 5.1 ConvertFrom-Json GAGAL pada kunci kosong "" (root package
    # lockfileVersion 2/3) -> error "argument name not valid". Bukan konten kit + tak ikut paket npm
    # (npm tak mempublish lockfile). Ini mengecualikan artefak npm yang tak-bisa-diurai PS 5.1, BUKAN
    # melemahkan cek (file-nya memang valid + tervalidasi di tempat lain).
    $jsonFiles = Get-ChildItem $kit -Recurse -Include *.json -File |
        Where-Object { $_.FullName -notlike "*\node_modules\*" -and $_.Name -ne 'package-lock.json' }
    # Add settings.local.json.template eksplisit (designed sebagai valid JSON template)
    $templateJson = Join-Path $kit "templates/settings.local.json.template"
    if (Test-Path $templateJson) { $jsonFiles += Get-Item $templateJson }
    $invalid = @()
    foreach ($f in $jsonFiles) {
        try { Get-Content $f.FullName -Raw | ConvertFrom-Json -ErrorAction Stop | Out-Null }
        catch { $invalid += $f.Name }
    }
    return @{Total=$jsonFiles.Count; Invalid=$invalid}
}

function Invoke-LintasFastSmoke {
    param([switch]$ShowDetail)
    $start = Get-Date
    $results = @{}
    $results.Parse = Test-LintasParseAll
    $results.CriticalFiles = Test-LintasCriticalFile
    $results.Manifest = Test-LintasManifestIntegrity
    $results.Orphans = Test-LintasOrphanRef
    $results.Json = Test-LintasJsonValid
    $duration = (Get-Date) - $start

    Write-Host ""
    Write-Host "=== lintasAI Fast Smoke ===" -ForegroundColor Cyan
    $parseColor = if ($results.Parse.Failed -eq 0) {"Green"} else {"Red"}
    Write-Host ("Parse PS1   : " + $results.Parse.Passed + " OK, " + $results.Parse.Failed + " fail") -ForegroundColor $parseColor
    $critColor = if ($results.CriticalFiles.Missing.Count -eq 0) {"Green"} else {"Red"}
    Write-Host ("Critical    : " + $results.CriticalFiles.Total + " expected, " + $results.CriticalFiles.Missing.Count + " missing") -ForegroundColor $critColor
    $manifestColor = if ($results.Manifest.Missing.Count -eq 0) {"Green"} else {"Red"}
    Write-Host ("Manifest    : " + $results.Manifest.Total + " files, " + $results.Manifest.Missing.Count + " missing") -ForegroundColor $manifestColor
    $orphanColor = if ($results.Orphans.Count -eq 0) {"Green"} else {"Yellow"}
    Write-Host ("Orphan refs : " + $results.Orphans.Count) -ForegroundColor $orphanColor
    $jsonColor = if ($results.Json.Invalid.Count -eq 0) {"Green"} else {"Red"}
    Write-Host ("JSON files  : " + $results.Json.Total + " checked, " + $results.Json.Invalid.Count + " invalid") -ForegroundColor $jsonColor
    Write-Host ("Duration    : " + [math]::Round($duration.TotalSeconds, 2) + " sec") -ForegroundColor Cyan
    Write-Host ""

    if ($ShowDetail) {
        if ($results.Parse.Failed -gt 0) {
            Write-Host "Parse errors:" -ForegroundColor Red
            $results.Parse.Errors | ForEach-Object { Write-Host ("  " + $_.File + ": " + $_.First) -ForegroundColor Red }
        }
        if ($results.CriticalFiles.Missing.Count -gt 0) {
            Write-Host "Missing critical files:" -ForegroundColor Red
            $results.CriticalFiles.Missing | ForEach-Object { Write-Host ("  " + $_) -ForegroundColor Red }
        }
        if ($results.Manifest.Missing.Count -gt 0) {
            Write-Host "Missing manifest entries:" -ForegroundColor Red
            $results.Manifest.Missing | ForEach-Object { Write-Host ("  " + $_) -ForegroundColor Red }
        }
        if ($results.Json.Invalid.Count -gt 0) {
            Write-Host "Invalid JSON files:" -ForegroundColor Red
            $results.Json.Invalid | ForEach-Object { Write-Host ("  " + $_) -ForegroundColor Red }
        }
    }

    $passed = ($results.Parse.Failed -eq 0) -and ($results.CriticalFiles.Missing.Count -eq 0) -and ($results.Manifest.Missing.Count -eq 0) -and ($results.Orphans.Count -eq 0) -and ($results.Json.Invalid.Count -eq 0)
    if ($passed) {
        Write-Host "PASS: FAST SMOKE PASSED" -ForegroundColor Green
        return 0
    } else {
        Write-Host "FAIL: FAST SMOKE FAILED - run with -ShowDetail for details" -ForegroundColor Red
        return 1
    }
}

if ($MyInvocation.InvocationName -ne ".") {
    exit (Invoke-LintasFastSmoke)
}
