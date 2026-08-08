#!/usr/bin/env node
// lib/config-loader.mjs - Pembaca config JSON-berkomentar (JSONC) untuk Node.
//
// FASE 3 (ADR-003 / migrasi .psd1 -> JSON, BERTAHAP + BERDAMPINGAN): robot Node TAK bisa baca
// `.psd1` (Import-PowerShellDataFile hanya PowerShell). Supaya config kit/staff bisa dibaca DUA
// runtime, target format = JSONC (JSON + komentar `//` + `/* */`) — komentar penting karena
// staff non-programmer baca penjelasan tiap kolom langsung di berkas (alasan dulu pilih .psd1).
//
// Langkah 1 (NOL risiko): modul ini + template `.jsonc` DI SAMPING `.psd1` (tak ada yang dihapus,
// installer/PowerShell-reader TAK disentuh). Bukti setara: data .jsonc (Node) == data .psd1 (PS).
//
// Penghapus komentar SADAR-STRING: `//` atau `/*` DI DALAM string TIDAK dipotong (mis. URL
// "https://x" atau Pattern regex). Trailing-comma juga sadar-string. Lalu JSON.parse standar.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripBom } from './fs-text.mjs'

// Buang komentar // dan /* */ TANPA menyentuh isi string (jejak quote + escape).
export function stripJsonComments(text) {
  let out = ''
  let i = 0
  const n = text.length
  let inStr = false
  while (i < n) {
    const c = text[i]
    const c2 = i + 1 < n ? text[i + 1] : ''
    if (inStr) {
      out += c
      if (c === '\\') { out += c2; i += 2; continue } // escape: salin pasangannya apa adanya
      if (c === '"') inStr = false
      i++
      continue
    }
    if (c === '"') { inStr = true; out += c; i++; continue }
    if (c === '/' && c2 === '/') { i += 2; while (i < n && text[i] !== '\n') i++; continue }
    if (c === '/' && c2 === '*') { i += 2; while (i < n && !(text[i] === '*' && (i + 1 < n ? text[i + 1] : '') === '/')) i++; i += 2; continue }
    out += c
    i++
  }
  return out
}

// Buang koma-ekor sebelum } atau ] (sadar-string). Dipanggil SETELAH stripJsonComments.
export function stripTrailingCommas(text) {
  let out = ''
  let i = 0
  const n = text.length
  let inStr = false
  while (i < n) {
    const c = text[i]
    const c2 = i + 1 < n ? text[i + 1] : ''
    if (inStr) {
      out += c
      if (c === '\\') { out += c2; i += 2; continue }
      if (c === '"') inStr = false
      i++
      continue
    }
    if (c === '"') { inStr = true; out += c; i++; continue }
    if (c === ',') {
      let j = i + 1
      while (j < n && /\s/.test(text[j])) j++
      if (j < n && (text[j] === '}' || text[j] === ']')) { i++; continue } // drop koma-ekor
    }
    out += c
    i++
  }
  return out
}

// Parse string JSONC -> object. Throw dengan pesan jelas kalau JSON rusak.
export function parseJsonc(text, label = '<jsonc>') {
  const t = stripBom(text) // buang BOM
  const cleaned = stripTrailingCommas(stripJsonComments(t))
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    throw new Error(`config-loader: JSON rusak di '${label}' (${e.message}). Perbaiki sintaks atau hapus berkas lalu buat ulang.`)
  }
}

// Baca berkas .jsonc/.json -> object. Throw kalau tak ada / rusak.
export function readLintasConfig(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`config-loader: berkas tidak ditemukan: '${filePath}'`)
  const raw = fs.readFileSync(filePath, 'utf8')
  return parseJsonc(raw, filePath)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const target = process.argv[2]
  if (!target) { console.error('Pakai: node lib/config-loader.mjs <berkas.jsonc>'); process.exit(2) }
  try { console.log(JSON.stringify(readLintasConfig(target), null, 2)) } catch (e) { console.error(e.message); process.exit(1) }
}
