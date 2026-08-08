#!/usr/bin/env node
/*
 * lib/risk-gate.js - "Palang Rem Otomatis" (PreToolUse hook Claude Code, deterministik, ~0 token).
 *
 * Masalah yang dipecahkan: aturan kit soal aksi merusak (sec. 8.2 Aturan 5 "konfirmasi verbatim",
 * sec. 8.1 #3, sec. 9 DB, sec. 4.14 #2 Prisma) selama ini = KEBIJAKAN TEKS yang bergantung AI patuh.
 * Robot ini = PENEGAK-MESIN: dipasang sebagai hook PreToolUse, membaca aksi yang akan dijalankan AI
 * lalu MEMINTA KONFIRMASI user (dialog klik native, mode "ask") untuk aksi berisiko - atau MENOLAK
 * keras (exit 2) untuk aksi menembus pagar / unduh-lalu-jalankan.
 *
 * Bukan aturan baru: memaksa sec. 8.2 Aturan 5 yang SUDAH ADA. Pola hook diadaptasi dari ECC v2.0.0
 * (MIT) config-protection.js / gateguard-fact-force.js - ditulis-ulang + mode "ask" bahasa Indonesia.
 *
 * RUNTIME = Node.js (keputusan owner 2026-06-20 + ADR-002 addendum): benchmark di RDP owner
 * menunjukkan Node ~7,7x lebih cepat dari PowerShell 5.1 (~66ms vs ~509ms/panggilan). Karena palang
 * akan dipakai aktif oleh semua staff, kecepatan jadi prioritas. Node dijamin ada (pasang via npm
 * `engines node>=18`). GOTCHA yang diperbaiki: exit DILAKUKAN SETELAH stdout/stderr ter-flush
 * (callback) - kalau tidak, output bisa kepotong pada pipa.
 *
 * KONTRAK Claude Code PreToolUse (cek ulang dokumen versi terpasang saat dipakai):
 *   - Input JSON di stdin: { tool_name, tool_input{ command|file_path }, ... }
 *   - "ask"  : exit 0 + stdout JSON { hookSpecificOutput:{ hookEventName:'PreToolUse',
 *              permissionDecision:'ask', permissionDecisionReason:<alasan> } } -> dialog Setujui/Tolak.
 *   - "block": exit 2 + pesan ke stderr -> aksi diblokir, pesan jadi umpan-balik ke AI.
 *   - "allow": exit 0 tanpa output -> aksi lanjut normal.
 *
 * FAIL-OPEN (sengaja): input rusak/kosong/error -> 'allow' (exit 0). Robot yang crash lalu fail-closed
 * = mengunci SELURUH kerja tim. PENGECUALIAN: kategori "menembus pagar" yang TERDETEKSI = blok-keras.
 *
 * ANTI ALARM-PALSU: hanya pola benar-benar berisiko yang dijaga. `deleteMany({ where })`,
 * `DELETE ... WHERE`, `prisma migrate deploy`, `rm berkas.txt` = AMAN -> lolos.
 *
 * Default OPT-IN (sec. 4.12: mode baru = default mati); nyalakan via .claude/settings.json
 * (lihat docs/risk-gate.md). Robot TIDAK auto-memperbaiki/menjalankan apa pun - cuma menilai lalu
 * meneruskan keputusan ke USER.
 *
 * Versi  : 2.0.0 (1.0.0 = versi PowerShell lama; 2.0.0 = port Node)
 * Tanggal: 2026-06-20
 * Diuji  : tests/risk-gate.Tests.ps1 (Pester spawn node, skip jika node absen).
 */
'use strict';

const fs = require('fs');

// PERBAIKAN GOTCHA: JANGAN panggil process.exit() (memotong tulisan async pada pipa). Cukup tulis
// lalu set process.exitCode; Node otomatis flush stdout/stderr + keluar natural dengan kode itu
// (tak ada handle terbuka setelah stdin habis dibaca). Ini pola benar untuk CLI "tulis lalu keluar".
function emitAsk(reason) {
  const payload = JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason }
  });
  process.exitCode = 0;                       // set kode DULU (anti EPIPE mengubah kode)
  try { process.stdout.write(payload); } catch (e) { /* pipa putus: kode tetap 0 */ }
}

function emitBlock(message) {
  process.exitCode = 2;                        // set kode DULU - walau stderr putus, blokir tetap exit 2
  try { process.stderr.write(message + '\n'); } catch (e) { /* pipa putus: kode tetap 2 */ }
}

/**
 * Keputusan murni dari sebuah tool-call (objek). Dipisah supaya logika mudah dinalar.
 * Mengembalikan { decision: 'ask'|'block'|'allow', reason, category }.
 */
function decide(obj) {
  if (!obj || typeof obj !== 'object') return { decision: 'allow' };
  const tool = typeof obj.tool_name === 'string' ? obj.tool_name : '';
  const ti = obj.tool_input && typeof obj.tool_input === 'object' ? obj.tool_input : {};
  const cmd = typeof ti.command === 'string' ? ti.command : '';
  const filePath = typeof ti.file_path === 'string' ? ti.file_path : (typeof ti.file === 'string' ? ti.file : '');

  // ===== KATEGORI 7 - BLOK KERAS (menembus pagar / unduh-lalu-jalankan) =====
  if (cmd) {
    if (/dangerously.{0,3}skip.{0,3}permissions/i.test(cmd) || /bypassPermissions/i.test(cmd)) {
      return { decision: 'block', category: 'BYPASS_PAGAR',
        reason: 'DITOLAK: aksi ini mematikan portal izin AI (menembus pagar keamanan). Dilarang (sec. 8.1 #10). Kalau memang perlu, KAMU sendiri yang jalankan manual di luar AI.' };
    }
    if (/\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b/i.test(cmd) &&
        /\|\s*(iex|bash|sh|Invoke-Expression|node|python)\b/i.test(cmd)) {
      return { decision: 'block', category: 'UNDUH_JALANKAN',
        reason: 'DITOLAK: aksi ini mengunduh kode dari internet lalu menjalankannya langsung (sangat berisiko, sec. 8.1 #2). Kalau memang perlu, unduh + periksa dulu, baru jalankan manual.' };
    }
  }

  // ===== KATEGORI 1-6 - ASK (minta konfirmasi klik user) =====
  if (cmd) {
    // (1) Hapus rekursif + paksa
    const rmRf = /\brm\b/i.test(cmd) && /(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|-r[a-z]*\s+-f|--recursive\b.*--force\b|--force\b.*--recursive\b)/i.test(cmd);
    const removeItemRF = /Remove-Item/i.test(cmd) && /-Recurse/i.test(cmd) && /-Force/i.test(cmd);
    if (rmRf || removeItemRF) {
      return { decision: 'ask', category: 'HAPUS_REKURSIF',
        reason: 'Aksi ini menghapus banyak berkas sekaligus secara paksa (hapus rekursif) - sulit dibatalkan. Tekan Setujui kalau ini memang yang kamu mau; kalau ragu, Tolak lalu minta AI jelaskan dulu.' };
    }
    // (2) SQL merusak: DROP/TRUNCATE
    if (/\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE?)\b/is.test(cmd)) {
      return { decision: 'ask', category: 'SQL_DESTRUKTIF',
        reason: 'Perintah database ini bisa menghapus seluruh tabel/struktur data (DROP/TRUNCATE) - data bisa hilang permanen. Setujui hanya kalau kamu yakin.' };
    }
    // (2b) DELETE FROM tanpa WHERE
    if (/\bDELETE\s+FROM\b/is.test(cmd) && !/\bWHERE\b/i.test(cmd)) {
      return { decision: 'ask', category: 'SQL_DELETE_ALL',
        reason: 'Perintah ini menghapus SELURUH baris tabel (DELETE tanpa syarat WHERE). Setujui hanya kalau memang itu maksudnya.' };
    }
    // (3) Prisma migrate dev
    if (/prisma\s+migrate\s+dev\b/i.test(cmd)) {
      return { decision: 'ask', category: 'PRISMA_MIGRATE_DEV',
        reason: "'prisma migrate dev' bisa MERESET database (hapus semua data) kalau dipakai di luar DB lokal pribadi. Untuk staging/produksi mestinya 'migrate deploy'. Setujui hanya kalau ini DB lokalmu." };
    }
    // (3b) deleteMany/updateMany tanpa where
    if ((/\bdeleteMany\s*\(/i.test(cmd) || /\bupdateMany\s*\(/i.test(cmd)) && !/where/i.test(cmd)) {
      return { decision: 'ask', category: 'PRISMA_BULK_NO_WHERE',
        reason: "'deleteMany/updateMany' tanpa syarat (where) mengubah/menghapus SELURUH baris tabel. Setujui hanya kalau memang itu maksudnya." };
    }
    // (4) Git berbahaya
    if (/\bgit\b/i.test(cmd) && (
        /push\b.*(--force\b|--force-with-lease\b|\s-f\b)/i.test(cmd) ||
        /reset\s+--hard\b/i.test(cmd) ||
        /--no-verify\b/i.test(cmd))) {
      return { decision: 'ask', category: 'GIT_BERBAHAYA',
        reason: 'Perintah git ini berisiko menimpa/membuang riwayat atau melewati pemeriksaan (force / reset --hard / --no-verify). Setujui hanya kalau paham dampaknya.' };
    }
    // (6) Format / partisi disk
    if (/\b(Format-Volume|diskpart|mkfs(\.\w+)?)\b/i.test(cmd) || /\bdd\b.*of=\s*\/dev\//i.test(cmd)) {
      return { decision: 'ask', category: 'FORMAT_DISK',
        reason: 'Perintah ini bisa MEMFORMAT / menghapus seluruh isi disk atau partisi. Sangat berbahaya + sulit dibatalkan. Setujui hanya kalau benar-benar yakin.' };
    }
  }

  // (5) Sentuh berkas rahasia .env (Edit/Write/MultiEdit)
  if (filePath && /^(Edit|Write|MultiEdit)$/i.test(tool)) {
    const leaf = filePath.split(/[\\/]/).pop();
    if (/^\.env($|\.)/i.test(leaf)) {
      return { decision: 'ask', category: 'SENTUH_ENV',
        reason: 'Kamu akan menulis/mengubah berkas rahasia (' + leaf + '). Pastikan tak ada kunci yang bocor + berkas ini tak ikut ter-commit. Setujui untuk lanjut.' };
    }
  }

  return { decision: 'allow' };
}

function main() {
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch (e) { process.exitCode = 0; return; }  // fail-open
  // Buang BOM (penanda tak-kasat-mata) yang sebagian shell/pipa Windows prepend -> JSON.parse anti-throw.
  const cleaned = (raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw).trim();
  let obj = null;
  try { obj = cleaned ? JSON.parse(cleaned) : null; } catch (e) { process.exitCode = 0; return; }  // fail-open
  if (!obj) { process.exitCode = 0; return; }

  const d = decide(obj);
  if (d.decision === 'block') return emitBlock(d.reason);
  if (d.decision === 'ask') return emitAsk(d.reason);
  process.exitCode = 0;  // allow
}

// Jalankan hanya saat di-run langsung; saat di-require (kalau kelak ada unit test JS) jangan auto-run.
if (require.main === module) {
  // Redam EPIPE (pipa putus) supaya hook TAK PERNAH crash dengan kode salah - kode keluar sudah
  // ditetapkan emitAsk/emitBlock; tulisan yang gagal di-flush tak boleh mengubahnya.
  process.stdout.on('error', function () {});
  process.stderr.on('error', function () {});
  main();
}
module.exports = { decide };
