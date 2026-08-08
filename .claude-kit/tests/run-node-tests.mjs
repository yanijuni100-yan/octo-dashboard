#!/usr/bin/env node
// Runner tes Node lintas-versi untuk `npm test`. Kumpulkan tests/*.test.mjs lalu jalankan via `node --test`.
// WHY: `npm test` lama = `echo ... && exit 0` (rasa-aman-palsu: "lulus" tanpa menjalankan apa pun -
// menyesatkan kontributor lokal, selaras larangan §12 "melemahkan config mutu agar lulus"). `node --test
// <dir>` tak andal lintas-versi Node (dir dikira modul) -> pakai daftar berkas eksplisit, cermin CI validate.yml.
// Catatan: tes PowerShell (Pester) terpisah - jalankan ./tests/Run-Tests.ps1.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const files = fs.readdirSync(here)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()
  .map((f) => path.join(here, f))

if (files.length === 0) {
  console.error('Tidak ada berkas tes Node (tests/*.test.mjs).')
  process.exit(1)
}

// Teruskan bendera tambahan dari `npm run test:coverage` / `test:watch` (mis. --experimental-test-coverage,
// --watch) ke child `node --test`. Ditaruh SEBELUM --test (ini bendera Node, bukan argumen tes).
// WHY lewat runner ini, BUKAN `node --test tests/*.test.mjs` langsung di package.json: di Windows
// (paket ini os: win32) cmd.exe TIDAK meng-glob `tests/*.test.mjs` -> node dapat pola mentah -> gagal.
// Runner ini menemukan berkas sendiri (fs.readdirSync) -> tahan lintas-OS + lintas-versi-Node.
const passthroughFlags = process.argv.slice(2).filter((a) => a.startsWith('--'))

console.error(`Menjalankan ${files.length} berkas tes Node (node:test). Tes PowerShell/Pester terpisah: ./tests/Run-Tests.ps1`)
const r = spawnSync(process.execPath, [...passthroughFlags, '--test', ...files], { stdio: 'inherit' })
process.exit(r.status == null ? 1 : r.status)
