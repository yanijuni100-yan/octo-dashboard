# ADR-001: Percepatan task modifikasi TANPA indeks/graf simbol otomatis

---

## Metadata

- **Tanggal:** 2026-06-19
- **Status:** Accepted
- **Author:** Tim lintasAI (analisa AI-assisted, keputusan didelegasikan owner)
- **Reviewer:** owner — commit/rilis tetap owner-gated

---

## Context

**Problem statement:** Owner bertanya — saat orang menambah/menghapus/mengubah/merevisi kode di
sebuah project, bagaimana AI bisa **cepat mengeksekusi/menganalisa + hemat token** TANPA menurunkan
standar profesional? AI awalnya mengusulkan 5 fitur "percepatan": indeks fungsi→berkas
(*symbol-index*), peta pemanggil-balik otomatis (*caller-graph*), pemetaan tes↔kode (*test-map*),
*impact-map* berbasis `git diff`, dan ringkasan antarmuka per-modul. Owner menantang dengan benar:
**"kalau memang bagus, kenapa belum dibuat sebelum v1.45.0?"** + minta analisa yang matang & benar
sebelum memutuskan.

**Penyelidikan:** 3 putaran pemeriksaan READ-ONLY (mode aman) + adu-skeptis adversarial, tiap temuan
berbukti `berkas:baris`. Hasil menjawab tantangan owner dengan tegas.

**Constraints:**
- Kit ditulis dengan **PowerShell (.ps1)**, tapi project klien default = **Next.js/TypeScript/Supabase**
  (`lib/project-detect.ps1:445` "lintasAI v1.x cuma support Node"; Python/Go/PHP `Supported=$false`).
- DNA kit (`CLAUDE_universal_v1.md` §6.3): robot deterministik HANYA untuk fakta **sumber-tunggal +
  pola TAK-AMBIGU** (nomor versi, jumlah file tim). Fakta ambigu (jumlah jargon/prompt) **SENGAJA
  ditolak** karena alarm palsu (lihat `lib/consistency-check.ps1` + memory `fast-default-deterministic-robot`).
- Pola keputusan kit = **insiden-driven** (audit→fix, keluhan→aturan), bukan membangun infrastruktur
  proaktif tanpa pemicu nyata.

**Asumsi:** mesin modifikasi yang ADA sudah melayani sebagian besar kebutuhan "cepat + hemat":
penjaga bawaan Read-before-Edit Claude Code (`§7.3a:729`), checklist mikro §7.3a (`:731-736`),
doktrin §6.3, `docs/RESEP_PERUBAHAN.md` (peta blast-radius manual), `lib/consistency-check.ps1`
(auto-run di tes/CI/gerbang — `tests/consistency-check.Tests.ps1:38`), dan kartu identitas
`project.lintas.psd1` (peta modul→lokasi, lahir v1.45.0).

---

## Decision

**TIDAK membangun** symbol-index, caller-graph otomatis, test-map tool, maupun git-diff impact helper
— sekarang maupun (menurut bukti) dalam bentuk yang diusulkan. **Tetap mengandalkan mesin modifikasi
yang sudah ada.** Keputusan diambil AI atas delegasi owner; commit/rilis tetap keputusan owner.

**Jawaban tegas "kenapa belum dibuat dari dulu":** ke-5 ide BENAR-BENAR baru — tidak ada ADR, backlog,
maupun jejak di repo/memory (repo bahkan belum punya `docs/decisions/`). Jadi bukan "lupa", tapi
konsekuensi 3 hal yang **membenarkan** ketiadaannya:
1. **DNA insiden-driven** — belum ada insiden pemicu untuk infrastruktur graf.
2. **Keempat ide "indeks/graf" jatuh ke kategori AMBIGU** yang kit sengaja hindari: graf yang
   melewatkan 1 pemanggil (dynamic call / re-export / path alias / dynamic import / JSX) lalu tampak
   "lengkap" = **rasa-aman-palsu**, persis yang dilarang §8.2 + §7.3a — bahaya untuk staff
   non-programmer yang tak bisa mendeteksi daftar tak-lengkap.
3. **Fondasi baru lahir** — peta mesin-baca `project.lintas.psd1` baru ada v1.45.0 (kemarin); indeks/graf
   adalah lapisan DI ATAS-nya, jadi memang belum bisa lebih awal. Ditambah asimetri stack (kit=PS,
   klien=TS) membuat graf simbol andal butuh compiler per-bahasa (rapuh, melawan §6.3).

---

## Alternatif yang Ditolak (REJECT)

- **symbol-index (disimpan):** ditolak. `Grep` native sudah menjawab "fungsi di berkas:baris mana"
  ~0 token & **tak pernah basi**; indeks tersimpan = sumber-basi baru (nomor baris paling cepat basi);
  untuk klien TS = klaim-kelengkapan-palsu. (bukti: `lib/project-detect.ps1:471-477`;
  `lib/project-manifest.ps1:21` "tanpa robot anti-basi = catatan mati seperti portfolio.yml")
- **caller-graph otomatis (disimpan):** ditolak. Cacat **struktural**: melewatkan 1 pemanggil →
  tampak "lengkap" = rasa-aman-palsu (§7.3a/§8.2); manfaat cuma hemat ~1 grep; klien TS butuh compiler.
  (bukti: `CLAUDE_universal_v1.md:734` checklist "Grep pemanggil → 1 grep" sudah ada & jujur soal keterbatasannya)
- **test-map tool:** ditolak. Intinya **sudah jadi aturan** (§6.3 disiplin #2 `:595` "jalankan HANYA
  tesnya sebelum suite penuh") + sudah trivial (`Invoke-Pester -Path tests/<satu>.Tests.ps1`, tiap tes
  dot-source lib-nya); subset-only berisiko melanggar §4.6 "SELURUH tes dijalankan" (`:344`); klien TS
  non-deterministik (konvensi `__tests__/.test/.spec` beragam). (bukti: `validate.yml:24-48` CI sudah berjenjang)
- **git-diff impact helper:** ditolak. Manfaat sudah dicakup §4.6 (`:343,:355`) + §7.3a; daftar caller
  via grep = AMBIGU (over-match nama umum / under-match re-export) → rasa-aman-palsu; "~0 token" semu
  karena output tetap WAJIB dibaca AI (≠ `consistency-check` yang vonisnya final tanpa AI).

---

## Ditunda — build-later, DENGAN pemicu eksplisit (jangan bangun sekarang)

> Disimpan di sini supaya tak hilang + tak di-litigasi ulang. Bangun HANYA saat pemicunya muncul.

- **Robot ORPHAN / "berkas CRITICAL tanpa `.md`" (kit .ps1):** hanya sub-cek yang **benar-benar
  deterministik & tak-ambigu** (ada/tidak-ada murni), reuse `Get-LintasRegistryFinding`
  (`lib/project-manifest.ps1:449-489`). **JANGAN** bangun versi "*mtime staleness*" — itu mesin
  alarm-palsu karena tak bisa membedakan edit **substansial** vs typo (§7.1 `:625` definisikan basi
  atas dasar substansi). *Pemicu:* insiden nyata "dokumen nyangkut", atau saat digabung orchestrator.
- **Aktivasi `consistency-map` sisi-klien saat pasang:** auto-seed fakta **paling-aman saja** (versi
  `package.json`) + **verify-before-seed**; jalur AI-assisted (`templates/RESEP_PERUBAHAN.md:32-34`)
  sudah ada & lebih aman. *Pemicu:* bukti insiden klien kena drift karena peta kosong.
- **Pengecek-konsistensi antarmuka/briefing (.ps1-only):** sebagai **verifier AST sekali-jalan**
  (memastikan header "Fungsi yang di-export" cocok kode), **bukan** indeks tersimpan; jangan untuk klien.
  *Pemicu:* berkas kit besar (popup-helpers 885 baris dst) tanpa header export mulai basi.
- **Orchestrator "kit verify" 1-titik:** *Pemicu:* insiden "robot ada tapi lupa dijalankan". Saat ini
  robot terpenting (`consistency-check`) **sudah** auto-run via tes/CI/gerbang, jadi belum perlu;
  syarat kalau dibangun: output eksplisit "dicek vs dilewati", jangan klaim "lengkap/aman".

---

## Konsekuensi

### Pros
- Tak menambah sumber-basi baru / beban perawatan.
- Tak memasukkan rasa-aman-palsu — melindungi staff non-programmer (yang tak bisa mendeteksi peta tak-lengkap).
- Konsisten dengan DNA kit (§6.3, §8.2, insiden-driven).
- **Menghemat token masa depan**: keputusan + alasannya tercatat, tak perlu diselidiki ulang (analisa
  ini saja menghabiskan 3 putaran pemeriksaan besar).

### Cons
- "Fast modify" tetap bertumpu pada **disiplin AI** (grep manual untuk caller discovery) — tapi itu
  **jujur** (tak pernah mengklaim "lengkap"), bukan kelemahan tersembunyi.

### Risk
- Kalau kelak project klien jadi **sangat besar** sehingga grep manual terasa lambat → itu jadi
  **pemicu meninjau ulang ADR ini** (bukan sekarang). Mitigasi saat itu: arah DNA-fit = helper
  berbasis compiler resmi bahasa klien (proyek tersendiri), bukan grep-heuristik yang rapuh.

---

## Implementation Notes

- **File yang berubah:** `docs/decisions/` (folder baru, dogfood) + `README.md` + ADR ini. **Tidak ada
  perubahan kode/aturan always-load**, tidak menaikkan versi kit, tidak masuk paket npm (doc dev-repo).
- **Rollback plan:** hapus folder `docs/decisions/` — nol-risiko, sepenuhnya reversible.

---

## Riwayat

| Tanggal    | Status   | Oleh         | Catatan      |
|------------|----------|--------------|--------------|
| 2026-06-19 | Accepted | Tim lintasAI | Draft + keputusan awal (delegasi owner) |
