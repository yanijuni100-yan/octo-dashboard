# kit-files.psd1 - SINGLE SOURCE OF TRUTH untuk file kit
# Update file ini WHEN add/rename/remove file kit
# Konsumen: setup-pola-b.ps1, kit.ps1 doctor, install-windows.ps1, uninstall.ps1

@{
    schema_version = 1

    # Tier 1: CORE prompts (selalu deploy, wajib ada)
    core_prompts = @(
        'MULAI_DI_SINI.md',
        'JALANKAN_KIT.md',
        'UPDATE_KIT_PROMPT_v1.md',
        'AUDIT_POST_SETUP_PROMPT_v1.md',
        'PROJECT_LIFECYCLE_PROMPT_v1.md',
        'POST_SETUP_CHECKLIST_PROMPT_v1.md',
        'SPLIT_REPO_MIGRATION_PROMPT_v1.md',
        'TEAM_ROLLOUT_GUIDE_v1.md'
    )

    # Tier 2: Universal rules (auto-loaded AI tiap sesi)
    universal_rules = @(
        'CLAUDE_universal_v1.md',
        'LINTASAI_WORKFLOWS_v1.md',
        'AGENTS.md.template',
        'CLAUDE.md.template'
    )

    # Tier 3: Orkestrator + skrip kit (PowerShell + entry-point Node). Dicek keberadaan oleh kit.ps1/
    # kit.mjs doctor & wajibAda setup-pola-b (sebagai PATH, tidak dieksekusi) -> aman memuat .mjs.
    # Port Node .mjs (CUTOVER Gelombang 4-6) DIDAFTARKAN BERPASANGAN dgn .ps1-nya supaya doctor ikut
    # mengawasi keberadaannya (cegah salin-sebagian tak terdeteksi); berkas ikut paket via files[] eksplisit.
    scripts = @(
        'kit.ps1',
        'kit.mjs',
        'setup-pola-b.ps1',
        'setup-pola-b.mjs',
        'team-setup.ps1',
        'team-setup.mjs',
        'update-kit.ps1',
        'update-kit.mjs',
        'uninstall.ps1',
        'uninstall.mjs',
        'install-windows.ps1',
        'install-windows.mjs'
    )

    # Tier 4: Lib modules
    lib_files = @(
        'lib/rollback.ps1',
        'lib/safety.ps1',
        'lib/manifest-signing.ps1',
        'lib/agents-md.ps1',
        'lib/template-deploy.ps1',
        'lib/git-helpers.ps1',
        'lib/version-detect.ps1',
        'lib/manifest.ps1',
        'lib/popup-helpers.ps1',
        'lib/json-merge-helpers.ps1',
        'lib/project-detect.ps1',
        'lib/audit-helpers.ps1',
        'lib/consistency-check.ps1',
        'lib/project-manifest.ps1',
        'lib/portfolio-read.ps1',
        'lib/unicode-safety-check.ps1',
        'lib/ai-config-check.ps1',
        'lib/stack-check.ps1',
        'lib/risk-gate.js',
        'lib/repo-board.ps1'
    )

    # Berkas Node (.mjs) - port Gelombang 4/5 PowerShell->Node (ikut paket via files[] 'lib/').
    # Didaftarkan supaya doctor + smoke + catatan-pasang ikut mengawasinya (cegah korupsi salin-
    # sebagian tak terdeteksi). Dijaga ANTI-DRIFT oleh tests/kit-files.test.mjs (= persis daftar
    # lib/*.mjs di disk) -> HANYA lib/*.mjs boleh di sini. CATATAN: setup-pola-b.mjs (orkestrator AKAR,
    # bukan lib/) kini ikut paket npm (package.json files[]) + didaftarkan di tier 'scripts' di atas
    # (BUKAN di node_lib, karena anti-drift mengunci node_lib = persis lib/*.mjs).
    node_lib = @(
        'lib/access-verify.mjs',
        'lib/agents-md.mjs',
        'lib/ai-config-check.mjs',
        'lib/audit-helpers.mjs',
        'lib/branch-protect.mjs',
        'lib/config-loader.mjs',
        'lib/consistency-check.mjs',
        'lib/ensure-preflight-ci.mjs',
        'lib/ensure-risk-gate-hook.mjs',
        'lib/env-check.mjs',
        'lib/fs-text.mjs',
        'lib/git-helpers.mjs',
        'lib/install-secret-hook.mjs',
        'lib/json-merge-helpers.mjs',
        'lib/kit-files.mjs',
        'lib/lang-hook-wiring.mjs',
        'lib/lang-reminder.mjs',
        'lib/manifest.mjs',
        'lib/manifest-signing.mjs',
        'lib/output-lang-check.mjs',
        'lib/parity-check.mjs',
        'lib/perf-budget.mjs',
        'lib/popup-shim.mjs',
        'lib/portfolio-read.mjs',
        'lib/portfolio-write.mjs',
        'lib/project-detect.mjs',
        'lib/project-manifest.mjs',
        'lib/reparse-guard.mjs',
        'lib/repo-board.mjs',
        'lib/rollback.mjs',
        'lib/safety.mjs',
        'lib/setup-interactive.mjs',
        'lib/split-guard.mjs',
        'lib/stack-check.mjs',
        'lib/staff-roster.mjs',
        'lib/template-deploy.mjs',
        'lib/unicode-safety-check.mjs',
        'lib/version-detect.mjs'
    )

    # Tier 5: Templates (deployed to project saat setup)
    templates = @(
        'templates/PROMPT_LIBRARY.md',
        'templates/ANALOGI_LIBRARY.md',
        'templates/UPDATE_GUIDE.md',
        'templates/glossary.md',
        'templates/INDEX.md',
        'templates/SPLIT_REPO_AGENTS_TEMPLATES.md',
        'templates/SPLIT_REPO_NON_PROGRAMMER_PROMPTS.md',
        'templates/SPLIT_REPO_TOOLS_SETUP.md',
        'templates/SPLIT_REPO_PREPROVISION_v1.md',
        'templates/lintasai-portfolio.example.yml',
        'templates/PORTFOLIO_REGISTRY_v1.md',
        'templates/ACCESS_CONTROL_NREPO_v1.md',
        'templates/WIZARD_BUKU_INDUK_v1.md',
        'templates/WIZARD_PENCEGAH_DRIFT_v1.md',
        'templates/WIZARD_SEO_CHECK_v1.md',
        'templates/THREAT_MODEL_NON_LEGAL.md',
        'templates/DISCORD_BOT_INTEGRATION.md',
        'templates/STACK_DETECTION_PATTERN.md',
        'templates/PROJECT_STARTER_TEMPLATES.md',
        'templates/split-agents/FRONTEND.md',
        'templates/split-agents/BACKEND.md',
        'templates/split-agents/SHARED.md',
        'templates/split-agents/TOOLS.md',
        'templates/split-agents/ENGINE.md',
        'templates/split-agents/DASHBOARD.md',
        'templates/CROSS_REPO_TYPES_PIPELINE.md',
        'templates/ROBOT_CI_TESTING_PLAYBOOK.md',
        'templates/OWNER_SETUP_CHECKLIST_v1.md',
        'templates/TEAM_FLOW_SKETCH_v1.md',
        'templates/github/RENOVATE_FRONTEND.json',
        'templates/github/PUBLISH_SHARED_WORKFLOW.yml',
        'templates/github/GENERATE_TYPES_SCRIPT.md',
        'templates/github/TRIGGER_FRONTEND_UPDATE.yml',
        'templates/github/RECEIVE_BACKEND_UPDATE.yml',
        'templates/github/AUTO_MERGE_SHARED_WORKFLOW.yml',
        'templates/github/scripts/setup-branch-protection.ps1',
        'templates/architecture.md',
        'templates/architecture_auto.md',
        'templates/KERJA_KELOMPOK.md',
        'templates/CLAUDE_TEAM_GUIDE.md',
        'templates/feature-flags-advanced.md',
        'templates/MCP_SETUP.md',
        'templates/ONBOARDING.md',
        'templates/RLS_SETUP_PROMPT.md',
        'templates/STACK_GUIDE.md',
        'templates/STACK_VERSIONS.md',
        'templates/MIGRATE_TO_SUBFOLDER_PROMPT_v1.md',
        'templates/_EXAMPLE.md',
        'templates/_PATTERNS.md',
        'templates/STACK_MIGRATION_GUIDE.md',
        'templates/REFACTOR_STANDARD.md',
        'templates/RESEP_PERUBAHAN.md',
        'templates/consistency-map.example.psd1',
        'templates/project.lintas.example.psd1',
        'templates/consistency-map.example.jsonc',
        'templates/project.lintas.example.jsonc',
        'templates/BUKU_PELAJARAN.example.md',
        'templates/GLOSSARY_NON_PROGRAMMER.md',
        'templates/SECURITY_INCIDENT_PLAYBOOK.md',
        'templates/DB_SCHEMA_SCAN_PROMPT.md',
        'templates/OPERASI_DATABASE_AMAN.md',
        'templates/OBSERVABILITY_PRODUKSI.md',
        'templates/settings.local.json.template',
        'templates/settings.json.template'
    )

    # Tier 5b: Deprecated stubs -- sekarang KOSONG (v1.7.5).
    # 5 legacy prompts (BOOTSTRAP_PROJECT_DOCS, PROJECT_KICKOFF, PROJECT_MIGRATION,
    # SETUP_POLA_B, UPDATE_DOCS) telah dikonsolidasikan ke PROJECT_LIFECYCLE_PROMPT_v1.md
    # (LIVE di core_prompts). Sebelumnya array ini KELIRU mencantumkan PROJECT_LIFECYCLE juga
    # -> file DOUBLE-listed (core_prompts + sini) -> ke-hitung 2x oleh manifest builder.
    # Dikosongkan: manifest 98 -> 97 (buang duplikat); file TETAP terkirim via core_prompts.
    deprecated_stubs = @()

    # Tier 5c: Decisions / ADR templates
    decisions = @(
        'templates/decisions/_TEMPLATE.md',
        'templates/decisions/README.md'
    )

    # Tier 5d: GitHub assets (CODEOWNERS, PR template, workflows, scripts)
    github_assets = @(
        'templates/github/CODEOWNERS.template',
        'templates/github/pull_request_template.md',
        'templates/github/scripts/ai-review.cjs',
        'templates/github/workflows/ai-review.yml',
        'templates/github/workflows/backup-schemas.yml',
        'templates/github/workflows/secret-guard.yml',
        'templates/github/workflows/audit-access.yml',
        'templates/github/workflows/preflight.yml'
    )

    # Tier 6: Docs
    docs = @(
        'docs/SIGNED_RELEASE.md'
    )

    # Tier 7: Tests
    tests = @(
        'tests/Run-Tests.ps1',
        'tests/lib-safety.Tests.ps1',
        'tests/rollback.Tests.ps1',
        'tests/update-kit.Tests.ps1',
        'tests/uninstall.Tests.ps1',
        'tests/lib-json-merge-helpers.Tests.ps1',
        'tests/install-mapping-sync.Tests.ps1',
        'tests/lib-popup-helpers.Tests.ps1',
        'tests/npx-init.Tests.ps1',
        'tests/package-bundle.Tests.ps1',
        'tests/claude-md-loader.Tests.ps1',
        'tests/setup-pola-b.Tests.ps1',
        'tests/version-detect.Tests.ps1',
        'tests/portfolio-registry.Tests.ps1',
        'tests/security-guard.Tests.ps1',
        'tests/consistency-check.Tests.ps1',
        'tests/consistency-parity.Tests.ps1',
        'tests/template-deploy.Tests.ps1',
        'tests/create-lintasai.Tests.ps1',
        'tests/skills-divisi.Tests.ps1',
        'tests/manifest-signing.Tests.ps1',
        'tests/manifest.Tests.ps1',
        'tests/team-setup.Tests.ps1',
        'tests/project-detect.Tests.ps1',
        'tests/git-helpers.Tests.ps1',
        'tests/audit-helpers.Tests.ps1',
        'tests/agents-md.Tests.ps1',
        'tests/kit-diff.Tests.ps1',
        'tests/secret-precommit.Tests.ps1',
        'tests/modify-workflow-rule.Tests.ps1',
        'tests/project-manifest.Tests.ps1',
        'tests/unicode-safety-check.Tests.ps1',
        'tests/ai-config-check.Tests.ps1',
        'tests/stack-check.Tests.ps1',
        'tests/risk-gate.Tests.ps1',
        'tests/repo-board.Tests.ps1',
        'tests/path-leak.Tests.ps1'
    )

    # Tier 8: CI
    ci = @(
        '.github/workflows/validate.yml'
    )

    # Tier 9: Project meta
    meta = @(
        'CHANGELOG.md',
        'README.md',
        'LICENSE',
        'CONTRIBUTING.md'
    )
}
