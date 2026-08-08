<!--
  .github/pull_request_template.md - template PR tim AI-first
  Isi semua section di bawah. Yang tidak relevan: tulis "-" jangan dihapus.
  Bahasa: Indonesia. Singkat, padat, konkret.
-->

## Ringkasan
<!-- 1-3 kalimat: apa yang PR ini lakukan, dalam bahasa manusia. -->

## Kenapa
<!-- Link issue / task ID / keputusan. Contoh: Closes #123, ref TASK-456, diskusi di docs/decisions/2026-xx-xx.md -->

## Apa yang berubah
<!-- Bulleted list perubahan utama. Fokus ke "what", bukan baris kode. -->
- 
- 
- 

## Serah-terima ke peran lain
<!-- Kalau PR ini menyiapkan kontrak/API/tipe untuk peran lain (mis. backend → frontend/UI),
     tulis 1-2 baris: apa yang sudah READY + cara pakainya. Tulis "-" kalau tak ada.
     Contoh: "FE: halaman pakai getSalesReport(month) dari @project/shared (v1.2.0)." -->
- 

## Cara verifikasi
<!-- Langkah konkret supaya reviewer (atau AI) bisa reproduce hasilnya. -->
1. 
2. 
3. 

## Risk + Rollback
<!-- Risiko paling mungkin + cara balikin kalau ternyata bermasalah di produksi.
     Tulis "-" kalau PR-nya pure docs/refactor tanpa risk. -->
- Risk: 
- Rollback: 

## Checklist
- [ ] Commit pakai **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, dll.)
- [ ] File `.md` terkait di `docs/` sudah diupdate (sesuai aturan AUTO-SYNC kit)
- [ ] Edge case sudah dipikirkan (input kosong, null, error network, race)
- [ ] Sudah manual test di **preview URL** / lokal (sertakan link kalau ada)
- [ ] Kalau ada perubahan UI: **screenshot before/after** dilampirkan di bawah
- [ ] Tidak ada secret / API key / data sensitif yang ke-commit
- [ ] Reuse komponen yang sudah ada (cek `src/components/` & `docs/_PATTERNS.md`)

## Screenshot (kalau UI berubah)
<!-- Drag & drop gambar di sini. Hapus section ini kalau bukan perubahan UI. -->

---
<sub>Senior AI Reviewer akan otomatis posting review di PR ini. Tetap tunggu review manusia untuk perubahan kritis (auth, payment, migrasi DB).</sub>
