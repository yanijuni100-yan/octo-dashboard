# AGENTS.md Templates - Split Repo (INDEX)

> Template AGENTS.md per repo hasil split. **Mode [1] (per-Lapisan):** pakai FRONTEND/BACKEND/SHARED (+TOOLS opt-in).
> **Mode [2] (per-Kapabilitas / microservice varian shared-DB):** pakai CORE→BACKEND, DASHBOARD (ganti FRONTEND), SHARED, dan ENGINE per kapabilitas rahasia.
> File ini cuma index. Detail per repo ada di split-agents/ subfolder.

## Templates Available

1. [Frontend Repo AGENTS.md](split-agents/FRONTEND.md) - Untuk <project>-frontend (Frontend staff: dapat edit data CRUD, tidak DDL) — **Mode [1]**
2. [Backend Repo AGENTS.md](split-agents/BACKEND.md) - Untuk <project>-backend / <project>-core (Backend staff + owner: full DB control termasuk DDL; di Mode [2] = aggregator)
3. [Shared Repo AGENTS.md](split-agents/SHARED.md) - Untuk <project>-shared (types only; both Frontend & Backend dapat akses read)
4. [Tools Repo AGENTS.md](split-agents/TOOLS.md) - Untuk <project>-tools (owner + Backend staff kalau pakai 4-repo split) **(OPT-IN)**
5. [Engine Repo AGENTS.md](split-agents/ENGINE.md) - Untuk <project>-<kapabilitas> (algoritma RAHASIA + schema sendiri; DILARANG bicara langsung ke dashboard) — **Mode [2]**
6. [Dashboard Repo AGENTS.md](split-agents/DASHBOARD.md) - Untuk <project>-dashboard (tampilan + BFF; NOL akses DB/engine; semua data lewat backend) — **Mode [2]**

## Cara AI Pakai

Saat split repo migration:
1. Owner pilih untuk deploy template (Y/N)
2. AI read template per file (FRONTEND.md, BACKEND.md, dst)
3. AI customize dengan project name + GitHub username staff
4. AI deploy ke masing-masing repo: 
   - <project>-frontend/AGENTS.md
   - <project>-backend/AGENTS.md
   - <project>-shared/AGENTS.md
   - <project>-tools/AGENTS.md
5. Commit per repo dengan message: "feat: add AGENTS.md from lintasAI v1.0.0 template"

## Customization Variables

Saat deploy, replace placeholder:
- `<project>` -> nama project user (e.g., "akses")
- `<project>-frontend` -> nama repo frontend
- `<project>-backend` -> nama repo backend
- `<owner>` -> GitHub username owner
