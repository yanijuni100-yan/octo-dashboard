#!/usr/bin/env node
// lib/lang-reminder.mjs - Pengingat per-giliran (disuntik ke konteks AI TIAP user kirim pesan):
//   (1) BAHASA  : jawab Bahasa Indonesia + gaya non-programmer (sec.2.1).
//   (2) 8 DIVISI: pertimbangkan 8 lensa divisi profesional tiap prompt + perketat di titik risiko (sec.4.13/4.17).
//
// KENAPA: dua aturan ini hanya berupa TEKS yang terkubur jauh di dokumen aturan ~1900 baris. Bawaan model
// = Bahasa Inggris, DAN di bawah beban kerja AI gampang lupa menimbang lensa divisi - jadi di awal sesi
// (sebelum benar-benar menyerap aturan) AI sering "kabur" ke Inggris / mengerjakan permukaan saja.
// Berkas aturan = imbauan; berkas ini = rem-mesin LUNAK: dijalankan harness Claude Code lewat hook
// `UserPromptSubmit`, lalu apa pun yang dicetak ke stdout DITAMBAHKAN ke konteks AI untuk giliran itu -
// posisinya tepat sebelum AI menjawab, jadi jauh lebih kuat daripada teks di awal berkas panjang.
// "LUNAK" = pengingat, BUKAN pemblokir (selalu exit 0): ia MENGUATKAN kepatuhan, tak bisa memaksa.
//
// KENAPA 8 DIVISI IKUT DI SINI (audit 2026-06-28): audit menemukan asimetri - aturan BAHASA sudah diberi
// rem-mesin (hook ini), tapi aturan 8 DIVISI belum, padahal alasannya IDENTIK (teks panjang sering dilupakan
// AI di bawah beban). Menyatukannya di satu hook = REUSE wiring yang sudah terpasang di semua klien (penanda
// idempoten 'lang-reminder.mjs' di lib/lang-hook-wiring.mjs) - tanpa hook/berkas settings baru. Pengingat 8
// divisi sengaja MENEKANKAN "tampilkan pas-ukuran" supaya tak memicu AI meledakkan 15-lensa / mengarang
// temuan untuk hal sepele (lawan sec.4.17 + sec.8.2 Aturan 3b).
//
// WIRING: di repo kit -> .claude/settings.json (tunjuk lib/lang-reminder.mjs). Di project KLIEN ->
// dipasang OTOMATIS ke .claude/settings.json saat init/update oleh lib/lang-hook-wiring.mjs (tunjuk
// .claude-kit/lib/lang-reminder.mjs); contoh bentuk hook = templates/settings.json.template.
//
// SENGAJA SEDERHANA + TAK BISA GAGAL: cuma console.log lalu keluar 0. Tanpa baca berkas, tanpa
// I/O yang bisa melempar. Hook `UserPromptSubmit` yang keluar-kode 2 akan MEMBLOKIR pesan user -
// itu pantang di sini (pengingat tak boleh menghalangi kerja). Maka tak ada yang bisa melempar.
//
// BAHASA INDONESIA WAJIB: teks di bawah dipindai robot penjaga bahasa (lib/output-lang-check.mjs)
// karena berkas ini ada di lib/*.mjs. Kalau ditulis Inggris -> gerbang bahasa merah. Lagipula
// pengingat ke AI memang harus Indonesia: ia jadi "contoh hidup" mode bahasa yang diminta.

// Blok 1 - pengingat BAHASA (jalan TIAP giliran -> sengaja pendek demi hemat token).
const pengingatBahasa = [
  '[Pengingat lintasAI - bahasa output]',
  'Jawab SELALU dalam Bahasa Indonesia, BUKAN Bahasa Inggris - termasuk kalimat pertama,',
  'narasi antar-langkah, judul to-do, dan laporan akhir.',
  'Gaya wajib: mudah dipahami junior-programmer + staff non-programmer sekaligus; tiap istilah',
  'teknis langsung beri analogi singkat di tempat. Nama kode/perintah/identifier tetap bahasa',
  'aslinya. (Aturan §2.1 CLAUDE_universal_v1.md - ini menimpa bawaan model yang Inggris.)',
]

// Blok 2 - pengingat 8 DIVISI (pertimbangkan SELALU; tampilkan PAS-UKURAN, jangan diledakkan).
const pengingatDivisi = [
  '[Pengingat lintasAI - 8 divisi profesional]',
  'Pertimbangkan 8 lensa divisi tiap prompt (otomatis, TANPA staff mengetik nama skill): Backend,',
  'Frontend, Database, Webdesign, UI/UX, DevOps, Security, SEO - terapkan checklist yang relevan ke',
  'berkas yang disentuh. PERKETAT Security + Database + aksesibilitas saat menyentuh',
  'login/bayar/data-pribadi/upload/skema-DB/"mau rilis" (§4.13/§4.17).',
  'TAMPILKAN pas-ukuran: default 2 penjaga (Adversarial Reviewer + Reversibility); JANGAN ledakkan',
  '15 lensa untuk hal sepele; "nol temuan itu sah" - jangan mengarang temuan (§4.1/§8.2 Aturan 3b).',
]

console.log([...pengingatBahasa, '', ...pengingatDivisi].join('\n'))
// process.exitCode (bukan process.exit) = aman dari stdout ke-potong. 0 = jangan blokir pesan user.
process.exitCode = 0
