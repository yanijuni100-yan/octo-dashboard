#!/usr/bin/env node
// Helper PARITAS (bukan berkas tes): cetak daftar fakta/versi MODE KIT dari
// lib/consistency-check.mjs sebagai JSON 1-baris ke stdout.
//
// WHY: robot pemeriksa kecocokan punya DUA implementasi kembar — PowerShell
// (lib/consistency-check.ps1: $KitVersionChecks/$KitFacts) dipakai gerbang Pester,
// dan Node (lib/consistency-check.mjs: KIT_VERSION_CHECKS/KIT_FACTS) dipakai
// `npm run preflight`. Kalau seseorang menambah/mengubah fakta di SATU sisi lalu
// lupa sisi lain -> masing-masing menjaga fakta berbeda -> DRIFT SENYAP (tak ada
// yang merah). Helper ini dipanggil tes paritas tests/consistency-parity.Tests.ps1
// untuk membandingkan NILAI-JADI daftar Node vs daftar PowerShell.
//
// SENGAJA bukan `*.test.mjs` -> tidak ikut dijalankan run-node-tests.mjs; dipanggil
// eksplisit (`node tests/dump-kit-consistency.mjs`). Import statik relatif ke berkas
// ini (tests/) -> '../lib/' = lib/, benar apa pun direktori-kerja saat dipanggil.
import {
  KIT_VERSION_CHECKS,
  KIT_FACTS,
  KIT_SOURCE,
  KIT_TEAM_FILES_SOURCE,
  KIT_RETIRED_TERMS,
  KIT_RETIRED_SCAN,
} from '../lib/consistency-check.mjs'

process.stdout.write(
  JSON.stringify({
    versionChecks: KIT_VERSION_CHECKS,
    facts: KIT_FACTS,
    source: KIT_SOURCE,
    teamFilesSource: KIT_TEAM_FILES_SOURCE,
    retiredTerms: KIT_RETIRED_TERMS,
    retiredScan: KIT_RETIRED_SCAN,
  }),
)
