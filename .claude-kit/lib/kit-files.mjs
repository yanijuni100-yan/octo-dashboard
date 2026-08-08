#!/usr/bin/env node
// lib/kit-files.mjs - Pembaca daftar-file kit (kit-files.psd1) untuk Node.
//
// GELOMBANG 4 (ADR-004 / migrasi orkestrator besar ke Node, BERTAHAP + BERDAMPINGAN):
// `setup-pola-b.ps1` (pemasang), `kit.ps1 doctor`, `uninstall.ps1`, dan `smoke-fast.ps1`
// membaca `lib/kit-files.psd1` (SUMBER TUNGGAL daftar file kit) via `Import-PowerShellDataFile`
// — yang HANYA ada di PowerShell. Supaya orkestrator versi Node bisa baca daftar yang SAMA,
// modul ini mem-parse `.psd1` (subset data-file) jadi objek JavaScript yang IDENTIK hasilnya
// dengan `Import-PowerShellDataFile`.
//
// SIFAT NON-PERUSAK (Strangler Fig): modul ini cuma MEMBACA `kit-files.psd1` apa adanya —
// TIDAK mengubah `.psd1`, TIDAK menyentuh skrip PowerShell. PowerShell tetap baca `.psd1`
// secara native; Node baca lewat pembaca ini. Berdampingan, satu sumber kebenaran.
//
// Lingkup parser = subset DATA-FILE PowerShell (yang aman tanpa mengeksekusi PS): tabel
// `@{ ... }`, array `@( ... )`, string kutip-tunggal `'...'` (escape `''`) + kutip-ganda
// `"..."`, angka, `$true`/`$false`/`$null`, komentar `#` 1-baris + `<# ... #>` blok, dan
// pemisah baris/`;`/`,`. Sengaja TIDAK mendukung ekspresi/variabel/sub-ekspresi PS (itu butuh
// mesin PS) — kalau ketemu, parser MELEMPAR error yang jelas (gagal-nyaring, bukan diam-salah).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripBom } from './fs-text.mjs'

// Pecah teks .psd1 jadi token. SADAR-STRING: `#` / `@{` dst. DI DALAM string TIDAK ditafsir.
export function tokenizeKitFiles(text) {
  const toks = []
  let i = 0
  const n = text.length
  const push = (t, v) => toks.push(v === undefined ? { t } : { t, v })
  while (i < n) {
    const c = text[i]
    // Pemisah yang diabaikan: spasi, tab, CR, LF, dan `;` (PS pakai `;`/baris-baru antar-entri).
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === ';') { i++; continue }
    // Komentar baris `# ...`
    if (c === '#') { while (i < n && text[i] !== '\n') i++; continue }
    // Komentar blok `<# ... #>`
    if (c === '<' && text[i + 1] === '#') {
      i += 2
      while (i < n && !(text[i] === '#' && text[i + 1] === '>')) i++
      if (i >= n) throw new Error('komentar blok <# tidak ditutup dengan #>')
      i += 2
      continue
    }
    if (c === '@' && text[i + 1] === '{') { push('@{'); i += 2; continue }
    if (c === '@' && text[i + 1] === '(') { push('@('); i += 2; continue }
    if (c === '}') { push('}'); i++; continue }
    if (c === ')') { push(')'); i++; continue }
    if (c === '=') { push('='); i++; continue }
    if (c === ',') { push(','); i++; continue }
    // String kutip-tunggal: literal; `''` = satu tanda kutip.
    if (c === "'") {
      i++
      let s = ''
      let closed = false
      while (i < n) {
        if (text[i] === "'") {
          if (text[i + 1] === "'") { s += "'"; i += 2; continue }
          i++; closed = true; break
        }
        s += text[i]; i++
      }
      if (!closed) throw new Error("string kutip-tunggal tidak ditutup")
      push('str', s); continue
    }
    // String kutip-ganda: backtick = escape PS; `""` = satu tanda kutip ganda.
    if (c === '"') {
      i++
      let s = ''
      let closed = false
      while (i < n) {
        if (text[i] === '`' && i + 1 < n) { s += text[i + 1]; i += 2; continue }
        if (text[i] === '"') {
          if (text[i + 1] === '"') { s += '"'; i += 2; continue }
          i++; closed = true; break
        }
        s += text[i]; i++
      }
      if (!closed) throw new Error("string kutip-ganda tidak ditutup")
      push('str', s); continue
    }
    // $true / $false / $null (satu-satunya "variabel" yang sah di data-file)
    if (c === '$') {
      i++
      let id = ''
      while (i < n && /[A-Za-z]/.test(text[i])) { id += text[i]; i++ }
      const low = id.toLowerCase()
      if (low === 'true') push('val', true)
      else if (low === 'false') push('val', false)
      else if (low === 'null') push('val', null)
      else throw new Error(`variabel '$${id}' tak didukung (data-file hanya boleh $true/$false/$null)`)
      continue
    }
    // Angka (termasuk negatif/desimal)
    if (c === '-' || (c >= '0' && c <= '9')) {
      let num = c
      i++
      while (i < n && /[0-9.eE+-]/.test(text[i])) { num += text[i]; i++ }
      const v = Number(num)
      if (Number.isNaN(v)) throw new Error(`angka tak valid '${num}'`)
      push('num', v); continue
    }
    // Bareword (kunci tabel tak-berkutip, mis. core_prompts)
    if (/[A-Za-z_]/.test(c)) {
      let id = c
      i++
      while (i < n && /[A-Za-z0-9_]/.test(text[i])) { id += text[i]; i++ }
      push('ident', id); continue
    }
    throw new Error(`karakter tak dikenal '${c}' (kode ${c.charCodeAt(0)}) di posisi ${i}`)
  }
  return toks
}

// Bangun objek dari daftar token (rekursif: tabel @{} + array @() boleh bersarang).
export function parseKitFilesTokens(toks) {
  let p = 0
  const peek = () => toks[p]
  const next = () => toks[p++]
  const expect = (t) => {
    const tk = next()
    if (!tk || tk.t !== t) throw new Error(`harap '${t}' tapi dapat '${tk ? tk.t : 'akhir-berkas'}'`)
    return tk
  }

  function parseValue() {
    const tk = peek()
    if (!tk) throw new Error('nilai hilang (akhir-berkas)')
    if (tk.t === 'num' || tk.t === 'str' || tk.t === 'val') { next(); return tk.v }
    if (tk.t === '@{') return parseHashtable()
    if (tk.t === '@(') return parseArray()
    throw new Error(`nilai tak dikenal '${tk.t}'`)
  }

  function parseArray() {
    expect('@(')
    const arr = []
    while (peek() && peek().t !== ')') {
      if (peek().t === ',') { next(); continue } // toleransi koma pemisah
      arr.push(parseValue())
    }
    expect(')')
    return arr
  }

  function parseHashtable() {
    expect('@{')
    const obj = {}
    while (peek() && peek().t !== '}') {
      if (peek().t === ',') { next(); continue } // toleransi pemisah nyasar
      const keyTok = next()
      let key
      if (keyTok.t === 'ident') key = keyTok.v
      else if (keyTok.t === 'str') key = keyTok.v
      else if (keyTok.t === 'num') key = String(keyTok.v)
      else throw new Error(`kunci tabel tak valid '${keyTok.t}'`)
      // Cermin Import-PowerShellDataFile: kunci ganda DILARANG (PS melempar). Gagal-nyaring,
      // jangan diam-menimpa (kalau diam, daftar file bisa salah tanpa ketahuan).
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        throw new Error(`kunci ganda '${key}' tak diizinkan dalam tabel`)
      }
      expect('=')
      obj[key] = parseValue()
    }
    expect('}')
    return obj
  }

  // Lewati apa pun sebelum tabel utama @{ (mis. blok komentar sudah dibuang tokenizer).
  while (peek() && peek().t !== '@{') next()
  if (!peek()) throw new Error('tidak menemukan tabel @{ ... } di berkas')
  const result = parseHashtable()
  // Cermin data-file PS: setelah tabel utama tak boleh ada isi lain (gagal-nyaring).
  if (peek()) throw new Error(`token berlebih setelah tabel utama ('${peek().t}')`)
  return result
}

// Parse string .psd1 -> objek. Buang BOM. Lempar pesan jelas kalau sintaks tak didukung.
export function parseKitFilesPsd1(text, label = '<psd1>') {
  const t = stripBom(text) // buang BOM
  try {
    return parseKitFilesTokens(tokenizeKitFiles(t))
  } catch (e) {
    throw new Error(`kit-files: gagal baca '${label}' (${e.message}). Cek sintaks .psd1 (subset data-file).`)
  }
}

// Baca berkas kit-files.psd1 -> objek. Lempar kalau tak ada / rusak.
export function readKitFiles(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`kit-files: berkas tidak ditemukan: '${filePath}'`)
  return parseKitFilesPsd1(fs.readFileSync(filePath, 'utf8'), filePath)
}

// Gabung daftar "file wajib ada" persis seperti setup-pola-b.ps1 ($wajibAda): 9 grup,
// urutan SAMA. Path dikembalikan apa adanya (forward-slash seperti di .psd1) — pemanggil
// yang menormalkan separator sesuai kebutuhan (PS pakai backslash; Node lintas-platform).
export const REQUIRED_GROUPS = [
  'core_prompts',
  'universal_rules',
  'scripts',
  'lib_files',
  'templates',
  'docs',
  'tests',
  'ci',
  'meta',
]
export function getRequiredKitFiles(kitFiles) {
  const out = []
  for (const g of REQUIRED_GROUPS) {
    const v = kitFiles[g]
    if (Array.isArray(v)) out.push(...v)
  }
  return out
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const target = process.argv[2]
  if (!target) { console.error('Pakai: node lib/kit-files.mjs <kit-files.psd1> [--required|--canonical]'); process.exit(2) }
  try {
    const data = readKitFiles(target)
    const mode = process.argv[3]
    if (mode === '--required') {
      console.log(getRequiredKitFiles(data).join('\n'))
    } else if (mode === '--canonical') {
      // Output deterministik untuk uji-banding vs Import-PowerShellDataFile (kunci diurut).
      const lines = Object.keys(data).sort().map((k) => {
        const v = data[k]
        return `${k}=${Array.isArray(v) ? v.join(',') : v}`
      })
      console.log(lines.join('\n'))
    } else {
      console.log(JSON.stringify(data, null, 2))
    }
  } catch (e) {
    console.error(e.message); process.exit(1)
  }
}
