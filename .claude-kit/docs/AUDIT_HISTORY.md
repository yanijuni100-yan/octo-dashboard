# Audit History - lintasAI

File ini menyimpan record audit komprehensif yang sudah dilakukan terhadap kit. Tujuan:
- AI sesi baru dapat continuity (jangan re-run scan yang mahal)
- Human (owner, Tier C delegates, future maintainers) tau konteks decisions
- Track trajectory dari findings ke remediation

## 2026-06-06 - 132-agent Comprehensive Audit (v1.1.3 → v1.2.2)

### Workflow Stats
- **Agents**: 132 (multi-lens scan + adversarial verify + gap analysis + synthesis)
- **Tokens**: 5.1M output
- **Duration**: 26 menit (full workflow), plus 4 patch ships
- **Trigger**: Owner request "pastikan tidak ada error/bug/crash, apa perlu ditambah/dihapus"

### Scope (6 Lenses)
1. **Runtime/Functional Bugs**: Pester full suite + PSScriptAnalyzer + smoke lifecycle + npx wrapper invocation
2. **Security/Privacy**: hardcoded secrets grep + manifest integrity + Invoke-Expression usage + network calls
3. **Distribution/NPX**: npm pack inspection + cross-platform behavior + README accuracy + tarball size
4. **Cross-File Consistency**: version markers + file references + lib/kit-files.psd1 sync + placeholders + YAML lint
5. **Edge Cases**: empty dir + existing AGENTS.md + re-run idempotency + no-kit doctor + uninstall no-kit + path with spaces + PS 5.1 vs 7+
6. **DX/UX**: error messages clarity + help completeness + MULAI_DI_SINI.md accessibility + verbosity + README completeness + terminology

### Findings
- **Raw**: 61 findings across 6 lenses
- **Confirmed**: 59/61 (adversarial verify majority vote - 2 verifiers per finding: skeptic refuter + repro)
- **Severity distribution**:
  - Critical: 3 (semua bin/lintasai.js wrapper bugs)
  - Major: 1 (null comparison kit.ps1)
  - Medium/Low: 4 security advisory
  - Minor/Info: rest

### Critical Issues (FIXED in v1.2.0-v1.2.2)

| ID | Issue | Fix Version |
|----|-------|-------------|
| L1-RUN-001 | npx lintasai uninstall hard-fail (kitFolderName check + manifest override) | v1.2.0 partial → v1.2.2 complete |
| L1-RUN-002 | npx lintasai update hard-fail (-ProjectRoot param missing) | v1.2.0 |
| L1-RUN-003 | npx lintasai doctor/version/rollback inspect wrong kit (npm cache vs project) | v1.2.0 |
| L1-RUN-004 | Null comparison style `$x -ne $null` | v1.2.1 |

### Trajectory
- **v1.1.3**: 🟡 YELLOW (3 critical wrapper bugs found)
- **v1.2.0**: 🟡 YELLOW (ship despite 2/7 commands still fail - pattern flaw: verify not gating ship)
- **v1.2.1**: 🟡 YELLOW (diff fixed, null fixed, tests aligned, BUT uninstall fix agent stalled)
- **v1.2.2**: 🟢 GREEN target (uninstall kitFolderName fix + DryRun ordering + this audit history doc)

### Deferred Items (NOT in v1.2.x)

**Security Advisory (4 items)** - non-blocker, defer ke v1.3.0:
- SEC-001 (medium): HMAC manifest key derivable dari public material → option per-install random salt di DPAPI store
- SEC-002 (medium): Kit code lands di disk SEBELUM GPG tag verify → clone ke staging dir, verify, lalu Move-Item
- SEC-003 (low): -AllowProjectRootMismatch bypass cross-project guard → tambah interactive confirmation
- SEC-004 (low): AI Reviewer workflow npm install caret semver no lockfile → ship package-lock.json + npm ci

**Code Quality (3 dead variables)** - info, defer ke v1.3.0:
- $signatureValid (update-kit.ps1) - hapus atau wire ke install manifest audit
- $libSafety (kit.ps1) - dot-source dan refactor inline Get-FileHash
- $shouldPreserve (setup-pola-b.ps1) - audit logic preserve AGENTS.md

**Deprecated Stubs (5 files, sekarang dikonsolidasikan ke PROJECT_LIFECYCLE_PROMPT_v1.md)** - medium risk, defer ke v1.3.0:
- PROJECT_LIFECYCLE_PROMPT_v1.md (Stage Bootstrap Docs — eks BOOTSTRAP_PROJECT_DOCS_PROMPT_v1.md)
- PROJECT_LIFECYCLE_PROMPT_v1.md (Stage Kickoff — eks PROJECT_KICKOFF_PROMPT_v1.md)
- PROJECT_LIFECYCLE_PROMPT_v1.md (Stage Migration — eks PROJECT_MIGRATION_PROMPT_v1.md)
- PROJECT_LIFECYCLE_PROMPT_v1.md (Stage Setup Pola B — eks SETUP_POLA_B_PROMPT_v1.md)
- PROJECT_LIFECYCLE_PROMPT_v1.md (Stage Update Docs — eks UPDATE_DOCS_PROMPT_v1.md)

Masih ada cross-reference di CLAUDE_universal_v1.md + PROJECT_LIFECYCLE_PROMPT_v1.md + AGENTS.md.template + CHANGELOG.md. **Wajib update referensi DULU** sebelum delete.

**Already Removed**:
- FIRST_SESSION_PROMPT_v1.md (verified no active consumers, deleted di v1.2.0)

### Roadmap

**v1.3.0 (target Q3 2026)**: Cleanup + Security
- Address 4 SEC advisory items
- Remove 3 dead variables
- Update cross-refs + delete 5 deprecated stubs
- Refactor opportunity: more lib/ modularization

**v2.0.0 (target Q4 2026)**: Cross-platform
- Bash/Linux/macOS support (currently Windows-only)
- Migration guide untuk existing Windows install

### Distribution Rollout Plan (post v1.2.2 GREEN)

1. **Pilot (Week 1-2)**: 2 Tier C delegates (yang melek PowerShell + bisa debug manual)
   - Dogfood + collect real-world issues
   - Owner stand-by 1-2 jam pertama

2. **Tier B (Week 3-4)**: After pilot stabil 1 minggu tanpa hotfix
   - 2 staff Tier B
   - Onboarding via docs/NPX_INSTALL.md + Tier C delegate coaching

3. **Tier A (Week 5-6)**: After Tier B stabil 1 minggu
   - 2 staff Tier A
   - Full team running

4. **Scale-up (Month 2+)**: Add 10-20 more staff dengan template proven

### Lessons Learned

1. **Verify pattern flaw**: Workflow agent yang ship despite verify failures. v1.2.0 example. Fix: workflow design harus GATE ship pada verify result, bukan unconditional ship.

2. **Stalled agent silent fail**: v1.2.1 fix:uninstall-override agent output was "Background completion notification will come. Let me wait for it." - bukan real fix. Detection: cross-reference agent claim vs actual git diff.

3. **Windows 8.3 short-name pitfall**: `Join-Path $env:TEMP` di ADMINI~1 short-name vs Resolve-Path long-name (Administrator) → tests fail dengan regex mismatch + scripts infinite-recurse. Fix: normalize via [System.IO.Path]::GetFullPath() di kedua sisi compare.

4. **Adversarial verify works**: 2/61 findings refuted via majority vote (96.7% confirmation rate). High signal, low false positive.

5. **132-agent audit ROI**: Detection efficiency 5.9 findings per 1k tokens (61 findings / 10.3M tokens including verify). Worth re-running per major version (every 3-6 months).

---

## (Future audit entries di sini)

Format untuk entry baru:
```
## YYYY-MM-DD - <N>-agent <Topic> Audit (v<X.Y.Z>)
[same structure as above]
```
