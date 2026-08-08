# lib/project-detect.ps1 - Project state detection helpers untuk monorepo + post-split.
# Versi 1.1 - 2026-06-08 - dipakai oleh JALANKAN_KIT.md Bagian 4 (Popup #3 ukuran-tim + bentuk-kode).
#
# Functions:
#   - Get-MonorepoState     : detect apakah project monorepo + flavor + confidence
#   - Get-DynamicPopup2Order: [USANG sejak v1.43.0] re-order skema Popup #2 LAMA (MIGRATION/SMALL TEAM/SOLO); TIDAK dipakai alur aktif. Jangan dipanggil tanpa diperbarui ke skema Popup #3 baru.
#   - Test-PostSplitState   : detect apakah project sudah pernah split (anti-spam)

function Get-MonorepoState {
    <#
    .SYNOPSIS
      Detect apakah project monorepo + classify flavor.
    .DESCRIPTION
      4 detection patterns (urut prioritas):
        1. Next.js fullstack monolith (next + src/app/api/ + src/components/)
        2. Workspace monorepo (backend/ + frontend/ + shared/ + workspaces field)
        3. Prisma + components co-existence (DB layer + UI layer mixed)
        4. Mixed backend/frontend deps (express+react, fastify+next, dst)
    .OUTPUTS
      PSCustomObject dengan IsMonorepo, MonorepoFlavor, FileCount, Confidence, Evidence, DetectedPatterns.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectRoot
    )

    $result = [PSCustomObject]@{
        IsMonorepo       = $false
        MonorepoFlavor   = 'None'
        FileCount        = 0
        Confidence       = 'low'
        Evidence         = @()
        DetectedPatterns = @()
    }

    if (-not (Test-Path $ProjectRoot)) { return $result }

    # Pre-scan: file count (cap at 500 supaya tidak full enum repo besar)
    # @(...) WAJIB: pipeline 0-hasil mengembalikan $null; akses .Count pada $null
    # MELEMPAR di Set-StrictMode (dipakai setup-pola-b.ps1). Bungkus array supaya
    # folder kosong / semua-tersaring jadi FileCount=0, bukan crash.
    $files = @(Get-ChildItem -Path $ProjectRoot -Recurse -File `
        -Exclude '*.log','*.lock' `
        -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\\(node_modules|\.git|\.next|dist|build|\.claude-kit)\\' } |
        Select-Object -First 500)
    $result.FileCount = $files.Count

    # Pattern 1: Next.js fullstack monolith
    $pkgPath = Join-Path $ProjectRoot 'package.json'
    $hasNext = $false; $hasReact = $false; $hasVue = $false; $hasSvelte = $false
    $hasExpress = $false; $hasFastify = $false; $hasHono = $false; $hasNest = $false

    if (Test-Path $pkgPath) {
        try {
            $pkg = Get-Content $pkgPath -Raw -ErrorAction Stop | ConvertFrom-Json
            $allDeps = @{}
            if ($pkg.dependencies)    { $pkg.dependencies.PSObject.Properties    | ForEach-Object { $allDeps[$_.Name] = $_.Value } }
            if ($pkg.devDependencies) { $pkg.devDependencies.PSObject.Properties | ForEach-Object { $allDeps[$_.Name] = $_.Value } }

            $hasNext     = $allDeps.ContainsKey('next')
            $hasReact    = $allDeps.ContainsKey('react') -and -not $hasNext
            $hasVue      = $allDeps.ContainsKey('vue')
            $hasSvelte   = $allDeps.ContainsKey('svelte') -or $allDeps.ContainsKey('@sveltejs/kit')
            $hasExpress  = $allDeps.ContainsKey('express')
            $hasFastify  = $allDeps.ContainsKey('fastify')
            $hasHono     = $allDeps.ContainsKey('hono')
            $hasNest     = $allDeps.ContainsKey('@nestjs/core')
            # Note: $hasPrisma dep tidak dipakai (Prisma signal pakai prisma/schema.prisma folder check di line ~76)
        } catch {
            Write-Verbose "Get-MonorepoState: parse package.json gagal: $($_.Exception.Message)"
        }
    }

    $hasApiFolder        = Test-Path (Join-Path $ProjectRoot 'src/app/api')
    $hasComponentsFolder = Test-Path (Join-Path $ProjectRoot 'src/components')
    $hasPrismaFolder     = Test-Path (Join-Path $ProjectRoot 'prisma/schema.prisma')

    if ($hasNext -and $hasApiFolder -and $hasComponentsFolder) {
        $result.IsMonorepo = $true
        $result.MonorepoFlavor = 'NextjsFullstack'
        $result.Confidence = 'high'
        $result.Evidence += 'package.json contains "next" + src/app/api/ + src/components/ co-exist'
        $result.DetectedPatterns += 'Pattern1_NextjsFullstack'
    }

    # Pattern 2: Workspace monorepo
    $hasBackendFolder  = (Test-Path (Join-Path $ProjectRoot 'backend'))  -or (Test-Path (Join-Path $ProjectRoot 'apps/backend'))  -or (Test-Path (Join-Path $ProjectRoot 'packages/backend'))
    $hasFrontendFolder = (Test-Path (Join-Path $ProjectRoot 'frontend')) -or (Test-Path (Join-Path $ProjectRoot 'apps/frontend')) -or (Test-Path (Join-Path $ProjectRoot 'packages/frontend')) -or (Test-Path (Join-Path $ProjectRoot 'apps/web'))
    $hasSharedFolder   = (Test-Path (Join-Path $ProjectRoot 'shared'))   -or (Test-Path (Join-Path $ProjectRoot 'packages/shared'))

    if (($hasBackendFolder -and $hasFrontendFolder) -or $hasSharedFolder) {
        $hasWorkspacesField = $false
        if (Test-Path $pkgPath) {
            $pkgRaw = Get-Content $pkgPath -Raw -ErrorAction SilentlyContinue
            if ($pkgRaw) { $hasWorkspacesField = $pkgRaw -match '"workspaces"\s*:' }
        }
        $hasPnpmWs = Test-Path (Join-Path $ProjectRoot 'pnpm-workspace.yaml')
        $hasTurbo  = Test-Path (Join-Path $ProjectRoot 'turbo.json')
        $hasNx     = Test-Path (Join-Path $ProjectRoot 'nx.json')

        if ($hasWorkspacesField -or $hasPnpmWs -or $hasTurbo -or $hasNx) {
            $result.IsMonorepo = $true
            $result.MonorepoFlavor = 'WorkspaceMonorepo'
            $result.Confidence = 'high'
            $result.Evidence += 'Sibling backend/frontend folders + workspace tool detected (Yarn/PNPM/Turbo/Nx)'
            $result.DetectedPatterns += 'Pattern2_WorkspaceMonorepo'
        } else {
            $result.IsMonorepo = $true
            $result.MonorepoFlavor = 'WorkspaceMonorepo'
            $result.Confidence = 'medium'
            $result.Evidence += 'Sibling backend/frontend/shared folders but no workspace tool (loose monorepo)'
        }
    }

    # Pattern 3: Prisma + components (lighter signal)
    if ($hasPrismaFolder -and $hasComponentsFolder -and -not $result.IsMonorepo) {
        $result.IsMonorepo = $true
        $result.MonorepoFlavor = 'PrismaPlusComponents'
        $result.Confidence = 'medium'
        $result.Evidence += 'prisma/schema.prisma + src/components/ co-exist (DB layer mixed with UI layer)'
        $result.DetectedPatterns += 'Pattern3_PrismaPlusComponents'
    }

    # Pattern 4: Mixed backend+frontend deps
    $hasBackendDep  = $hasExpress -or $hasFastify -or $hasHono -or $hasNest
    $hasFrontendDep = $hasReact -or $hasVue -or $hasSvelte -or $hasNext
    if ($hasBackendDep -and $hasFrontendDep -and -not $result.IsMonorepo) {
        $result.IsMonorepo = $true
        $result.MonorepoFlavor = 'MixedBackendFrontendDeps'
        $result.Confidence = 'medium'
        $result.Evidence += 'package.json has BOTH backend framework + frontend framework deps'
        $result.DetectedPatterns += 'Pattern4_MixedBackendFrontendDeps'
    }

    return $result
}

function Get-DynamicPopup2Order {
    <#
    .SYNOPSIS
      [USANG sejak v1.43.0 - TIDAK dipakai alur aktif] Re-order skema Popup #2 LAMA (MIGRATION/SMALL TEAM/SOLO) berdasarkan project state. Popup #3 v1.43.0 (tetap-1/pecah-3/multi + TIM KECIL/BESAR/SENDIRI) pakai re-order AI manual berdasar Get-MonorepoState + roster count - JANGAN panggil fungsi ini tanpa diperbarui ke skema baru.
    .DESCRIPTION
      Decision tree (mutually exclusive):
        - Legacy (existing code + no AGENTS.md)        → [1] MIGRATION
        - Monorepo + existing + 5+ staff planning      → [1] GROWING TEAM
        - Monorepo + existing (no staff signal)        → [1] GROWING TEAM
        - Fresh project (< 10 files)                   → [1] SOLO
        - Uncertain / mid-state                        → [1] SMALL TEAM (sweet spot)
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory=$false)]
        [PSCustomObject]$MonorepoState,

        [Parameter(Mandatory=$false)]
        [int]$StaffPlannedCount = 0
    )

    if (-not $MonorepoState) {
        $MonorepoState = Get-MonorepoState -ProjectRoot $ProjectRoot
    }

    $isFresh    = ($MonorepoState.FileCount -lt 10)
    $isExisting = ($MonorepoState.FileCount -ge 50)
    $hasAgents  = Test-Path (Join-Path $ProjectRoot 'AGENTS.md')
    $hasPkgJson = Test-Path (Join-Path $ProjectRoot 'package.json')
    $isLegacy   = (-not $hasAgents) -and $hasPkgJson -and $isExisting
    $isMonorepo = $MonorepoState.IsMonorepo

    # Staff signal dari staff-roster.yml
    $rosterPath = Join-Path $ProjectRoot '.github/staff-roster.yml'
    if (Test-Path $rosterPath) {
        $rosterContent = Get-Content $rosterPath -Raw -ErrorAction SilentlyContinue
        if ($rosterContent) {
            $staffActualCount = ([regex]::Matches($rosterContent, '(?m)^\s*-\s+email:')).Count
            $StaffPlannedCount = [Math]::Max($StaffPlannedCount, $staffActualCount)
        }
    }

    $orderedChoices = @()
    $rationale = ''

    if ($isLegacy) {
        $orderedChoices = @(
            @{ id='4'; label='MIGRATION'   ; tag='recommended, default' }
            @{ id='1'; label='GROWING TEAM'; tag='' }
            @{ id='2'; label='SMALL TEAM'  ; tag='' }
            @{ id='3'; label='SOLO'        ; tag='' }
        )
        $rationale = 'Project legacy (existing code, no AGENTS.md) - MIGRATION workflow wajib jalan dulu.'
    }
    elseif ($isMonorepo -and $isExisting -and $StaffPlannedCount -ge 5) {
        $orderedChoices = @(
            @{ id='1'; label='GROWING TEAM'; tag='recommended, default - plan split-repo readiness' }
            @{ id='2'; label='SMALL TEAM'  ; tag='' }
            @{ id='3'; label='SOLO'        ; tag='' }
            @{ id='4'; label='MIGRATION'   ; tag='' }
        )
        $rationale = "Monorepo + existing code ($($MonorepoState.FileCount) files) + planning $StaffPlannedCount staff - GROWING TEAM optimal."
    }
    elseif ($isMonorepo -and $isExisting) {
        $orderedChoices = @(
            @{ id='1'; label='GROWING TEAM'; tag='recommended, default - monorepo benefits from split planning' }
            @{ id='2'; label='SMALL TEAM'  ; tag='' }
            @{ id='3'; label='SOLO'        ; tag='' }
            @{ id='4'; label='MIGRATION'   ; tag='' }
        )
        $rationale = "Monorepo + existing code ($($MonorepoState.FileCount) files) - GROWING TEAM recommended untuk plan split nanti."
    }
    elseif ($isFresh) {
        $orderedChoices = @(
            @{ id='3'; label='SOLO'        ; tag='recommended, default - fresh project' }
            @{ id='2'; label='SMALL TEAM'  ; tag='' }
            @{ id='1'; label='GROWING TEAM'; tag='' }
            @{ id='4'; label='MIGRATION'   ; tag='' }
        )
        $rationale = "Fresh project ($($MonorepoState.FileCount) files) - SOLO safe default, escalate kalau hire planning datang."
    }
    else {
        $orderedChoices = @(
            @{ id='2'; label='SMALL TEAM'  ; tag='recommended, default - sweet spot' }
            @{ id='3'; label='SOLO'        ; tag='' }
            @{ id='1'; label='GROWING TEAM'; tag='' }
            @{ id='4'; label='MIGRATION'   ; tag='' }
        )
        $rationale = "Project state uncertain - SMALL TEAM sweet spot."
    }

    return [PSCustomObject]@{
        OrderedChoices = $orderedChoices
        Rationale      = $rationale
        DefaultChoice  = $orderedChoices[0].id
        DetectedState  = @{
            IsFresh        = $isFresh
            IsExisting     = $isExisting
            IsLegacy       = $isLegacy
            IsMonorepo     = $isMonorepo
            FileCount      = $MonorepoState.FileCount
            StaffPlanned   = $StaffPlannedCount
            MonorepoFlavor = $MonorepoState.MonorepoFlavor
        }
    }
}

function Test-PostSplitState {
    <#
    .SYNOPSIS
      Detect apakah project sudah pernah split (anti-spam guard untuk Bagian 4 Popup #3 + Bagian 5c).
    .DESCRIPTION
      3 detection layers:
        1. Marker file .claude-kit/.split-state (paling reliable)
        2. AGENTS.md mention post-split / multi-repo coordination
        3. Sibling folder repo dengan suffix -frontend/-backend/-shared
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectRoot
    )

    $result = [PSCustomObject]@{
        IsPostSplit    = $false
        Evidence       = @()
        SiblingRepos   = @{
            Frontend = $null
            Backend  = $null
            Shared   = $null
        }
        DetectionLayer = 'none'
        RoleOfThisRepo = 'unknown'
    }

    # Layer 1: marker file
    $markerPath = Join-Path $ProjectRoot '.claude-kit/.split-state'
    if (Test-Path $markerPath) {
        $result.IsPostSplit = $true
        $result.DetectionLayer = 'marker_file'
        $markerContent = Get-Content $markerPath -Raw -ErrorAction SilentlyContinue
        $result.Evidence += '.claude-kit/.split-state marker exists'
        if ($markerContent -match 'role:\s*(\w+)') {
            $result.RoleOfThisRepo = $matches[1].ToLower()
            $result.Evidence += "marker declares role: $($result.RoleOfThisRepo)"
        }
    }

    # Layer 2: AGENTS.md mentions
    $agentsPath = Join-Path $ProjectRoot 'AGENTS.md'
    if (Test-Path $agentsPath) {
        $agentsContent = Get-Content $agentsPath -Raw -ErrorAction SilentlyContinue
        if ($agentsContent) {
            $postSplitKeywords = @(
                'post-split',
                'multi-repo coordination',
                'sister repo:',
                'cross-repo types pipeline'
            )
            foreach ($kw in $postSplitKeywords) {
                if ($agentsContent -match $kw) {
                    $result.IsPostSplit = $true
                    $result.Evidence += "AGENTS.md mentions: '$kw'"
                    if ($result.DetectionLayer -eq 'none') { $result.DetectionLayer = 'agents_md_mention' }
                    elseif ($result.DetectionLayer -ne 'marker_file') { $result.DetectionLayer = 'multiple' }
                }
            }
        }
    }

    # Layer 3: sibling folders
    $parentDir = Split-Path $ProjectRoot -Parent
    $thisName  = Split-Path $ProjectRoot -Leaf
    # Peran mencakup Model 1 (frontend/backend/shared/web/api/ui/server) DAN Model 2 (microservice
    # varian shared-DB): engine/dashboard/core/service/worker. Tanpa peran Model 2, repo hasil-pecah
    # microservice salah-divonis "belum dipecah" -> kit menawarkan pecah-ulang. WAJIB identik dgn
    # project-detect.mjs (gerbang ADR-003). -replace di PS = case-insensitive default (tanpa /i flag).
    # Nama KAPABILITAS bebas (mis. <base>-data-domain) tetap mengandalkan penanda .split-state (Lapis 1).
    $baseName  = $thisName -replace '-(frontend|backend|shared|web|api|ui|server|engine|dashboard|core|service|worker)$', ''

    if ($baseName -ne $thisName) {
        $result.RoleOfThisRepo = ($thisName -replace "^$baseName-", '').ToLower()
        $result.Evidence += "Current repo name '$thisName' has role suffix"
    }

    # Bucket peran tetap Frontend/Backend/Shared (struktur output dijaga), tapi tiap bucket menampung
    # padanan Model 2: dashboard = tampilan (Frontend); core/engine = server rahasia (Backend).
    # Konsisten dgn roleToTier() split-guard. WAJIB identik dgn project-detect.mjs (gerbang ADR-003).
    $siblingCandidates = @{
        Frontend = @("$baseName-frontend", "$baseName-web", "$baseName-ui", "$baseName-dashboard")
        Backend  = @("$baseName-backend", "$baseName-api", "$baseName-server", "$baseName-core", "$baseName-engine")
        Shared   = @("$baseName-shared", "$baseName-types", "$baseName-common")
    }

    $siblingHits = 0
    foreach ($role in $siblingCandidates.Keys) {
        foreach ($candidate in $siblingCandidates[$role]) {
            $candidatePath = Join-Path $parentDir $candidate
            if ((Test-Path $candidatePath) -and ($candidatePath -ne $ProjectRoot)) {
                $result.SiblingRepos.$role = $candidatePath
                $siblingHits++
                $result.Evidence += "Sibling repo detected: ../$candidate"
                break
            }
        }
    }

    if ($siblingHits -ge 1) {
        $result.IsPostSplit = $true
        if ($result.DetectionLayer -eq 'none') { $result.DetectionLayer = 'sibling_folders' }
        elseif ($result.DetectionLayer -ne 'marker_file') { $result.DetectionLayer = 'multiple' }
    }

    return $result
}

function Get-PackageManager {
    <#
    .SYNOPSIS
        Detect Node package manager (pnpm/yarn/bun/npm) dari lockfile.
    .DESCRIPTION
        Prioritas: pnpm-lock.yaml > yarn.lock > bun.lockb > package-lock.json.
        Fallback ke 'npm' kalau cuma ada package.json. Return 'none' kalau bukan Node project.
        Tambahan: cek `packageManager` field di package.json (Corepack standard) - kalau ada, override detection.
    .OUTPUTS
        PSCustomObject dengan field: Manager, LockFile, InstallCmd, RunCmd, Confidence, Reason
    .EXAMPLE
        $pm = Get-PackageManager -ProjectRoot 'C:\projects\akses'
        Write-Host "Install pakai: $($pm.InstallCmd)"
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $result = [PSCustomObject]@{
        Manager     = 'none'
        LockFile    = $null
        InstallCmd  = $null
        RunCmd      = $null
        Confidence  = 'low'
        Reason      = 'No lockfile or package.json detected'
    }

    if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
        $result.Reason = "ProjectRoot does not exist: $ProjectRoot"
        return $result
    }

    # Detection order (FIRST match wins - paling spesifik di atas).
    $checks = @(
        @{ Lock = 'pnpm-lock.yaml';     Mgr = 'pnpm'; Install = 'pnpm install'; Run = 'pnpm dev' },
        @{ Lock = 'yarn.lock';          Mgr = 'yarn'; Install = 'yarn install'; Run = 'yarn dev' },
        @{ Lock = 'bun.lockb';          Mgr = 'bun';  Install = 'bun install';  Run = 'bun dev'  },
        @{ Lock = 'package-lock.json';  Mgr = 'npm';  Install = 'npm install';  Run = 'npm run dev' }
    )

    foreach ($check in $checks) {
        $lockPath = Join-Path $ProjectRoot $check.Lock
        if (Test-Path -LiteralPath $lockPath -PathType Leaf) {
            $result.Manager    = $check.Mgr
            $result.LockFile   = $check.Lock
            $result.InstallCmd = $check.Install
            $result.RunCmd     = $check.Run
            $result.Confidence = 'high'
            $result.Reason     = "Detected from $($check.Lock)"
            return $result
        }
    }

    # No lockfile found but package.json exists -> default ke npm (low confidence).
    $packageJsonPath = Join-Path $ProjectRoot 'package.json'
    if (Test-Path -LiteralPath $packageJsonPath -PathType Leaf) {
        $result.Manager    = 'npm'
        $result.LockFile   = $null
        $result.InstallCmd = 'npm install'
        $result.RunCmd     = 'npm run dev'
        $result.Confidence = 'medium'
        $result.Reason     = 'package.json found, no lockfile yet (default npm)'

        # Heuristic tambahan: cek packageManager field di package.json (Corepack standard).
        try {
            $pkgJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
            if ($pkgJson.packageManager) {
                $pmDeclared = ($pkgJson.packageManager -split '@')[0]
                if ($pmDeclared -in @('pnpm', 'yarn', 'bun', 'npm')) {
                    $result.Manager    = $pmDeclared
                    $result.InstallCmd = "$pmDeclared install"
                    $result.RunCmd     = if ($pmDeclared -eq 'npm') { 'npm run dev' } else { "$pmDeclared dev" }
                    $result.Confidence = 'high'
                    $result.Reason     = "Declared in package.json packageManager field: $($pkgJson.packageManager)"
                }
            }
        } catch {
            # Silent - pakai default npm kalau parse package.json gagal atau field packageManager invalid.
            $null = $_
        }
    }

    return $result
}

function Get-StackType {
    <#
    .SYNOPSIS
        Detect tech stack project (node/python/go/rust/ruby/php/unknown).
    .DESCRIPTION
        Priority order (FIRST match wins): package.json -> node, pyproject.toml/
        requirements.txt/Pipfile -> python, go.mod -> go, Cargo.toml -> rust,
        Gemfile -> ruby, composer.json -> php. lintasAI v1.x cuma support Node.
    .OUTPUTS
        PSCustomObject @{ StackType; IsSupported; DetectedFiles; Reason }
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $result = [PSCustomObject]@{
        StackType     = 'unknown'
        IsSupported   = $false
        DetectedFiles = @()
        Reason        = 'No recognized stack marker file detected'
    }

    if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
        $result.Reason = "ProjectRoot does not exist: $ProjectRoot"
        return $result
    }

    # Priority order - FIRST match wins (hindari false positive di polyglot repo).
    # Node DI ATAS supaya project Next.js dengan tools Python script tetap detect = node.
    $stackChecks = @(
        @{ Marker = 'package.json';      Stack = 'node';   Supported = $true  },
        @{ Marker = 'pyproject.toml';    Stack = 'python'; Supported = $false },
        @{ Marker = 'requirements.txt';  Stack = 'python'; Supported = $false },
        @{ Marker = 'Pipfile';           Stack = 'python'; Supported = $false },
        @{ Marker = 'go.mod';            Stack = 'go';     Supported = $false },
        @{ Marker = 'Cargo.toml';        Stack = 'rust';   Supported = $false },
        @{ Marker = 'Gemfile';           Stack = 'ruby';   Supported = $false },
        @{ Marker = 'composer.json';     Stack = 'php';    Supported = $false }
    )

    foreach ($check in $stackChecks) {
        $markerPath = Join-Path $ProjectRoot $check.Marker
        if (Test-Path -LiteralPath $markerPath -PathType Leaf) {
            $result.StackType     = $check.Stack
            $result.IsSupported   = $check.Supported
            $result.DetectedFiles = @($check.Marker)
            $result.Reason        = "Detected from $($check.Marker)"

            # Tambahan: scan sibling markers untuk reporting (informational only).
            foreach ($otherCheck in $stackChecks) {
                if ($otherCheck.Marker -ne $check.Marker) {
                    $otherPath = Join-Path $ProjectRoot $otherCheck.Marker
                    if (Test-Path -LiteralPath $otherPath -PathType Leaf) {
                        $result.DetectedFiles += $otherCheck.Marker
                    }
                }
            }
            return $result
        }
    }

    return $result
}
