<!--
  PR template repo lintasAI (kit). Isi semua section; tulis "-" kalau tak relevan.
  Bahasa Indonesia, singkat + konkret.
-->

## Ringkasan
<!-- 1-3 kalimat: apa yang PR ini lakukan, dalam bahasa manusia. -->

## Kenapa + dampak
<!-- Masalah/kebutuhan yang diselesaikan + dampak ke user kit (staff non-programmer). Link issue kalau ada. -->

## Apa yang berubah
- 
- 

## Cara verifikasi
1. `powershell -File ./tests/Run-Tests.ps1` — semua Pester lulus.
2. `powershell -File ./tests/smoke-fast.ps1` — PASS.
3. <langkah manual kalau ada, mis. `npm create lintasai` di project uji>

## Versi + CHANGELOG (kalau ada perubahan yang user lihat)
- [ ] Versi dinaikkan di 5 tempat (lihat checklist CONTRIBUTING.md) sesuai semver
- [ ] Entri CHANGELOG ditambah ("apa yang berubah untuk user")
- [ ] Label `[BREAKING]` / `[SECURITY]` ditambahkan kalau relevan

## Risk + Rollback
- Risk: 
- Rollback: 

## Checklist
- [ ] Commit pakai **Conventional Commits** (`feat:`/`fix:`/`docs:`/`chore:`/`refactor:`)
- [ ] Output ke user = **bahasa non-programmer** (CLAUDE_universal_v1.md §2.1)
- [ ] Tidak ada secret / API key / data sensitif yang ter-commit
- [ ] Dokumen `.md` terkait + `KEUNGGULAN_LINTASAI.md` ter-update (AUTO-SYNC §7.1/§7.8)
- [ ] `main` tidak diubah langsung — perubahan ini lewat branch + PR (lihat templates/KERJA_KELOMPOK.md)
