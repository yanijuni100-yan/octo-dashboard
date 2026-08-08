# Fast Smoke Test - SOP

> Tier 2 fast smoke = <5 sec. Catch 80% bugs sebelum push.

## Untuk Owner

### Install pre-commit hook (1x setup, 30 detik)

```powershell
pwsh -File ./.claude-kit/tests/install-pre-commit.ps1
```

### Manual run anytime

```powershell
pwsh -File ./.claude-kit/tests/smoke-fast.ps1
```

## Tier Pyramid (Speed vs Coverage)

| Tier | Duration | When | What |
|------|----------|------|------|
| **INSTANT** (<1 sec) | Pre-commit hook (auto on `git commit`) | Smart chars (staged PS1) + FAST smoke. Deteksi secret = GitHub Push Protection + AI Reviewer (bukan hook lokal) |
| **FAST** (<5 sec) | tests/smoke-fast.ps1 (every commit + CI first job) | Parse, critical files, orphans, JSON |
| **MEDIUM** (<30 sec) | tests/lib-*.Tests.ps1 (Pester unit) + PSSA Error severity (CI per-PR) | Behavior + lint Error |
| **SLOW** (1-3 min) | Full Pester + PSSA Warning + real install (CI nightly + pre-release) | Complete behavior + cross-platform |

## Untuk AI Workflow

### Sebelum apply edit, run fast smoke baseline

```
Bash: pwsh -File tests/smoke-fast.ps1 > /tmp/baseline.txt
```

### Setelah apply edits, run smoke comparison

```
Bash: pwsh -File tests/smoke-fast.ps1 > /tmp/after.txt
Bash: diff /tmp/baseline.txt /tmp/after.txt
```

### Skip Tier 3 (Pester + PSSA) kalau Tier 2 fail

Fail fast: kalau parse error / critical file missing / orphan refs > 0, tidak perlu run Pester + PSSA. Save 60-180 sec per workflow.

## Analogi Non-Programmer

Test pyramid kayak **security checkpoint di mal**:
- **INSTANT** = security scanner di pintu (5 detik scan tas)
- **FAST** = CCTV monitoring (real-time)
- **MEDIUM** = pemeriksaan rutin satpam (per jam)
- **SLOW** = audit komprehensif security firm (per bulan)

Tidak setiap orang yang masuk mal di-audit security firm - itu mahal + lambat. Tapi tiap orang lewat security scanner = fast catch obvious issues.
