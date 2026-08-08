#!/usr/bin/env node
// lib/ai-config-check.mjs - "Robot pemindai konfigurasi-AI" (port Node dari ai-config-check.ps1).
//
// MIGRASI grup [A]/[C] (ADR-003 / keputusan-per-elemen): robot KEAMANAN cuma-baca (deteksi
// kunci-API bocor / izin lebar / hook unduh-jalankan / frasa-tembus-pagar di .mcp.json /
// .claude/settings.json / SKILLS_LOCAL.md). Strangler Fig = BERDAMPINGAN: versi .ps1 TETAP hidup.
//
// KEHATI-HATIAN KEAMANAN (port byte/temuan-identik):
//  - Operator PowerShell `-match` = CASE-INSENSITIVE default -> pola inline (type/url/npx/Bash/dll)
//    WAJIB flag `i` di JS. Rahasia vendor (sk-/ghp_/AKIA/...) = case-SENSITIVE (tanpa i) cermin [regex].
//  - env-var `${VAR}` TIDAK ditandai (pola aman); hanya rahasia LITERAL.
//  - Tingkat: GENTING / PENTING / RAPIKAN. Gerbang gagal hanya jika GENTING > 0.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripBom, isFile } from './fs-text.mjs'

// Pola rahasia VENDOR-SPESIFIK (case-SENSITIVE, cermin [regex] tanpa IgnoreCase).
const SECRET_PATTERNS = [
  { re: /sk-[A-Za-z0-9_]{20,}/, name: 'kunci-API gaya OpenAI (sk-...)' },
  { re: /sk-ant-[A-Za-z0-9_-]{20,}/, name: 'kunci-API Anthropic (sk-ant-...)' },
  { re: /gh[pousr]_[A-Za-z0-9]{30,}/, name: 'token GitHub (ghp_/gho_/...)' },
  { re: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key (AKIA...)' },
  { re: /xox[baprs]-[A-Za-z0-9-]{10,}/, name: 'token Slack (xox..-..)' },
  { re: /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}/, name: 'token JWT (eyJ...)' },
  { re: /AIza[0-9A-Za-z_-]{30,}/, name: 'kunci-API Google (AIza...)' },
]

// Frasa "menembus pagar" untuk skill kustom ((?i) -> flag i).
const BYPASS_PATTERNS = [
  { re: /dangerously-skip-permissions/i, name: 'mematikan portal izin (dangerously-skip-permissions)' },
  { re: /bypassPermissions/i, name: 'melewati izin (bypassPermissions)' },
  { re: /(menerobos|terobos|matikan|nonaktifkan|lewati)[^\n]{0,30}(pagar|izin|guard|keamanan|konfirmasi)/i, name: 'frasa menembus/mematikan pagar keamanan' },
  { re: /--no-verify/i, name: 'melewati pemeriksaan git (--no-verify)' },
]

// Pindai isi SATU berkas config-AI -> array temuan { File, Line, Tingkat, Kode, Pesan }.
// configType: 'mcp' | 'settings' | 'skills'. Rahasia LITERAL dicek di semua tipe.
export function getLintasAiConfigFinding(content, relPath = '<string>', configType = 'settings') {
  if (content == null || content === '') return []
  const findings = []
  const add = (line, tingkat, kode, pesan) => findings.push({ File: relPath, Line: line, Tingkat: tingkat, Kode: kode, Pesan: pesan })
  const lines = content.split('\n') // cermin PS: Content -split "`n"

  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln]
    const num = ln + 1

    // (1) RAHASIA LITERAL ber-pola vendor = GENTING (semua tipe).
    for (const p of SECRET_PATTERNS) {
      if (p.re.test(line)) add(num, 'GENTING', 'SECRET', `Rahasia/kunci ter-tulis di config: ${p.name} - JANGAN simpan rahasia di config (pakai env-var / secret manager).`)
    }

    if (configType === 'mcp') {
      if (/"type"\s*:\s*"(sse|http|streamable-http|streamableHttp)"/i.test(line)) add(num, 'PENTING', 'MCP_REMOTE', 'Server MCP jarak-jauh (transport remote) - data/perintah bisa keluar komputer; pastikan server tepercaya.')
      if (/"url"\s*:\s*"https?:\/\//i.test(line)) add(num, 'PENTING', 'MCP_REMOTE', 'Server MCP via URL jarak-jauh - pastikan alamatnya tepercaya (data bisa keluar komputer).')
      if (/"(command|args)"\s*:.*\bnpx\b/i.test(line) || /^\s*"npx"/i.test(line)) add(num, 'RAPIKAN', 'MCP_NPX', 'Server MCP dijalankan via npx (paket pihak-ketiga bisa berubah sewaktu-waktu) - pastikan dari sumber tepercaya + pin versi (mis. paket@1.2.3).')
    }

    if (configType === 'settings') {
      if (/"Bash\(\*\)"/i.test(line) || /"Bash"\s*[,\]]/i.test(line) || /"allow"\s*:\s*\[\s*"\*"/i.test(line)) add(num, 'PENTING', 'PERM_BROAD', 'Izin tool sangat lebar (mis. semua perintah Bash) - bisa disengaja, tapi periksa apakah memang perlu seluas itu (prinsip izin sesedikit mungkin).')
      if (/\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b/i.test(line) && /(\|\s*(iex|bash|sh|Invoke-Expression|node|python))/i.test(line)) add(num, 'GENTING', 'HOOK_FETCH_RUN', 'Hook "unduh-lalu-jalankan" (ambil dari internet lalu eksekusi) - sangat berisiko; jangan jalankan kode dari sumber tak tepercaya.')
      if (/dangerously.{0,3}skip.{0,3}permissions/i.test(line) || /"bypassPermissions"\s*:\s*true/i.test(line)) add(num, 'GENTING', 'PERM_BYPASS', 'Setting yang MEMATIKAN portal izin AI - melanggar pagar keamanan (sec. 8.1 #10); jangan dipakai kecuali kamu sangat paham risikonya.')
    }

    if (configType === 'skills') {
      for (const p of BYPASS_PATTERNS) {
        if (p.re.test(line)) add(num, 'GENTING', 'SKILL_BYPASS', `Skill kustom memuat frasa menembus pagar keamanan: ${p.name} - tahan + lapor owner (sec. 8.1 #10: skill TIDAK boleh melanggar pagar).`)
      }
    }
  }
  return findings
}

// Cari berkas config-AI relevan di sebuah root -> [{ File, Type }].
export function getLintasAiConfigTarget(root) {
  const out = []
  const add = (rel, type) => { const f = path.join(root, rel); if (isFile(f)) out.push({ File: f, Type: type }) }
  add('.mcp.json', 'mcp'); add('.claude/.mcp.json', 'mcp'); add('.cursor/mcp.json', 'mcp')
  add('.claude/settings.json', 'settings'); add('.claude/settings.local.json', 'settings')
  add('docs/SKILLS_LOCAL.md', 'skills')
  return out
}
// isFile dipindah ke sumber bersama lib/fs-text.mjs (audit fungsi-kembar 2026-06-25).

export function invokeLintasAiConfigCheck(repoRoot, { paths = null, quiet = false } = {}) {
  let targets
  if (paths && paths.length) {
    targets = []
    for (const p of paths) {
      if (!fs.existsSync(p)) continue
      const name = path.basename(p)
      let type = 'settings'
      if (/mcp/i.test(name)) type = 'mcp'
      else if (/SKILLS_LOCAL/i.test(name)) type = 'skills'
      else if (/settings/i.test(name)) type = 'settings'
      targets.push({ File: path.resolve(p), Type: type })
    }
  } else {
    targets = getLintasAiConfigTarget(repoRoot)
  }

  const all = []
  for (const t of targets) {
    let content
    try { content = fs.readFileSync(t.File, 'utf8') } catch { continue }
    content = stripBom(content) // cermin Get-Content -Encoding UTF8 (buang BOM)
    for (const f of getLintasAiConfigFinding(content, t.File, t.Type)) all.push(f)
  }
  const genting = all.filter((x) => x.Tingkat === 'GENTING').length
  const penting = all.filter((x) => x.Tingkat === 'PENTING').length
  const rapikan = all.filter((x) => x.Tingkat === 'RAPIKAN').length

  if (!quiet) {
    console.log('Robot pemindai konfigurasi-AI (.mcp.json / .claude/settings.json / SKILLS_LOCAL.md)')
    console.log('-'.repeat(60))
    if (all.length === 0) console.log('BERSIH: tidak ada pola berbahaya pada konfigurasi AI.')
    else {
      for (const x of all) console.log(`  [${x.Tingkat}] ${x.File}:${x.Line}  ${x.Pesan}`)
      console.log('-'.repeat(60))
      console.log(`Ringkasan: GENTING ${genting} - PENTING ${penting} - RAPIKAN ${rapikan}. (Gerbang gagal hanya jika GENTING > 0.)`)
    }
  }
  return { Findings: all, Count: all.length, Genting: genting, Penting: penting, Rapikan: rapikan }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  const quiet = args.includes('--quiet')
  // --repo-root <dir>: pindai folder project itu (cermin -RepoRoot di versi PowerShell). TANPA ini,
  // robot keamanan diam-diam memindai folder kit sendiri -> bisa "BERSIH" PALSU saat dipakai per-project.
  const getFlag = (flag) => { const i = args.indexOf(flag); return i >= 0 && i + 1 < args.length ? args[i + 1] : null }
  const repoRootFlag = getFlag('--repo-root')
  // path eksplisit = arg non-flag yang BUKAN nilai dari --repo-root (cermin -Path string[] di PS).
  const flagVals = new Set([repoRootFlag].filter(Boolean))
  const paths = args.filter((a) => !a.startsWith('--') && !flagVals.has(a))
  const repoRoot = repoRootFlag
    ? path.resolve(repoRootFlag)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const r = invokeLintasAiConfigCheck(repoRoot, { paths: paths.length ? paths : null, quiet })
  // exit = jumlah GENTING (0 = aman untuk gerbang). process.exitCode (bukan process.exit) supaya
  // stdout selesai di-flush saat di-pipa (cermin pola aman lib/risk-gate.js).
  process.exitCode = r.Genting
}
