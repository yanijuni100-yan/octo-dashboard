# ONBOARDING.md - Lini Masa (Timeline) Hari 0-14 untuk Staf Dev Baru

> Versi 3 · 2026-06-26
> File ini adalah **checklist linier 14 hari**. Detail workflow, branching, escalation ada di `CLAUDE_TEAM_GUIDE.md` - jangan duplikat di sini.

---

## Sebelum Mulai

Kamu baru bergabung dengan tim AI-first. Tim ini coding 100% lewat Claude Code - tidak masalah kalau kamu bukan programmer formal. Yang penting: **bisa kasih konteks ke AI dengan jelas** dan **bisa baca code untuk verifikasi**.

Centang `[x]` di file lokal kamu (jangan commit) sebagai progress tracker pribadi. Ikuti urutan, jangan loncat fase.

> **Pointer wajib**: detail workflow harian → `CLAUDE_TEAM_GUIDE.md` §4. Branching → §5. Escalation (kapan tanya siapa) → §13. Anti-pattern → §12 (yang me-link ke `docs/GLOSSARY_NON_PROGRAMMER.md` §8). Rollback playbook → §13b.

---

## BACA DULU (2 File Wajib, ~20 menit)

### 1. Glossary Istilah Teknis (~15 menit)
Buka **`docs/GLOSSARY_NON_PROGRAMMER.md`** - peta istilah teknis dengan analogi sehari-hari (mis. "PR = lapor ke atasan untuk review"). Scroll sampai habis, **tidak perlu hafal** - bookmark, balik baca tiap ketemu istilah asing.

### 2. Security Incident Playbook (~5 menit)
Buka **`docs/SECURITY_INCIDENT_PLAYBOOK.md`** - step-by-step kalau detect **token bocor**, **secret leak**, atau **security alert**. **Print checklist akhirnya, tempel di laptop.** Saat panik, baca checklist > improvise.

**Signal trigger playbook**: email "Secret detected" dari GitHub, AI Reviewer comment "Possible token leak", email usage spike, file `.env.local` muncul di `git status`.

---

## Day 0 - Setup tools & akses (3-5 jam, dipandu Owner/IT)

**Baseline**: Windows 10/11 / macOS 12+ / Ubuntu 22+, RAM ≥8GB (16GB disarankan), disk ≥10GB kosong. Spec di bawah ini → lapor owner dulu.

> **Penting**: kamu (staff baru) **tidak perlu menjalankan perintah terminal asing sendirian**. Semua langkah ber-tanda **🔧 (Owner/IT)** di bawah ini **dilakukan oleh Owner/IT** — entah di-setup-kan sebelum laptop diserahkan, atau dikerjakan **bareng kamu sambil dipandu** (screen-share / duduk berdua). Tugas kamu di Day 0: ikut perhatikan, pastikan tiap langkah sukses, dan **dapat akses** (poin "Dapat ...").

- [ ] 🔧 (Owner/IT) Install **Claude Code** (https://docs.claude.com)
- [ ] 🔧 (Owner/IT) Install **Git**, tes: `git --version`
- [ ] 🔧 (Owner/IT) Install **Node.js LTS** (20+), tes: `node --version`
- [ ] 🔧 (Owner/IT) Install **pnpm** (`npm install -g pnpm`)
- [ ] 🔧 (Owner/IT) Install **GitHub CLI** (`gh`), login: `gh auth login`
- [ ] 🔧 (Owner/IT) Install **VS Code** (optional: extension Claude Code)
- [ ] Dapat **akses repo proyek** dari owner (GitHub org invitation)
- [ ] Dapat **akses channel tim** (Slack/Discord/Telegram), perkenalan singkat
- [ ] Dapat **akses tools tim** sesuai role (Vercel, Supabase, dll)
- [ ] 🔧 (Owner/IT) **Clone repo**: `git clone <URL>` ke `~/projects/<nama>`
- [ ] Baca **`README.md`** proyek, cari section setup
- [ ] 🔧 (Owner/IT) **Install dependencies**: `pnpm install`
- [ ] 🔧 (Owner/IT) **Copy `.env.example` → `.env.local`**, isi nilai env dari owner/senior via **DM** (JANGAN channel publik)
- [ ] 🔧 (Owner/IT) **Generate Prisma client** (kalau proyek pakai Prisma): brief Claude `Tolong jalankan npx prisma generate`. Tanpa ini, dev server crash. Skip kalau tidak pakai Prisma (cek `package.json`)
- [ ] 🔧 (Owner/IT) **Jalankan dev server**: `pnpm dev`, buka `localhost:3000`, pastikan load
- [ ] Buka Claude Code: `claude` di terminal folder proyek
- [ ] Paste **`JALANKAN_KIT.md`** ke Claude (file di `./.claude-kit/JALANKAN_KIT.md`)
- [ ] **Verifikasi**: tanya Claude "baca `docs/architecture.md` dan jelaskan proyek ini dalam 5 kalimat". Jawaban masuk akal → setup OK

**Mentok (stuck)?** Langkah 🔧 (Owner/IT) macet → minta Owner/IT lanjutin (itu memang tugas mereka). Akses repo/dashboard → DM owner. Env vars → DM senior dev. Lihat `CLAUDE_TEAM_GUIDE.md` §13.

---

## Day 1 - Baca dokumentasi (30-60 menit, bisa 2 sesi)

**Urutan baca**:
- [ ] **`./.claude-kit/CLAUDE_universal_v1.md`** - aturan global tim (WAJIB)
- [ ] **`AGENTS.md`** proyek (root) - override khusus proyek
- [ ] **`docs/architecture.md`** - peta makro proyek (WAJIB)
- [ ] **`docs/glossary.md`** - kamus istilah khusus proyek
- [ ] **`docs/_PATTERNS.md`** - cara tim nulis docs
- [ ] **`docs/_EXAMPLE.md`** - contoh konkret `.md` siap-pakai
- [ ] **`docs/CLAUDE_TEAM_GUIDE.md`** - panduan kerja tim (WAJIB)
- [ ] **`docs/TEAM_FLOW_SKETCH_v1.md`** - flow kerja tim: siapa ngapain, serah-terima antar peran, staging→production (WAJIB)
- [ ] **`docs/PROMPT_LIBRARY.md`** - skim dulu, detail pas butuh
- [ ] **`docs/STACK_GUIDE.md`** (kalau ada)
- [ ] **`docs/MCP_SETUP.md`** (kalau ada)

**Cara baca yang benar**: jangan skim, tanya Claude kalau tidak paham ("jelaskan dengan analogi"), bikin mind map sendiri, verifikasi pemahaman (minta Claude quiz 5 pertanyaan).

**Output Day 1**:
- [ ] 1 halaman ringkasan proyek dengan kata-kata kamu sendiri
- [ ] List 5 istilah baru
- [ ] List 3 pertanyaan untuk teammate

---

## Day 1-2 - PR Pertama (good first issue = tugas mudah untuk pemula)

Tujuan: PR pertama digabung (merged). **Yang utama bukan hasilnya, tapi paham alur kerja dari awal sampai akhir (workflow end-to-end).**

- [ ] Owner/senior assign micro-task via channel chat (typo fix, copy update, dependency bump, styling minor)
- [ ] **Pair dengan senior** di Slack/Discord. Jangan sungkan tanya
- [ ] Baca task, pastikan paham acceptance criteria
- [ ] **Ikuti workflow standar**: lihat `CLAUDE_TEAM_GUIDE.md` §4 (1 task = 1 sesi) + §5 (branching: `git checkout -b fix/<desc>` → commit → PR)
- [ ] Pakai **Prompt 2** dari `PROMPT_LIBRARY.md` (Fix bug) atau **Prompt 1** (Tambah fitur)
- [ ] **JANGAN langsung setuju (auto-accept)** - baca tiap perubahan
- [ ] Update `docs/<modul>.md` kalau berubah perilaku publik
- [ ] Test lokal sebelum push
- [ ] Request review dari senior pair
- [ ] Terapkan revisi sampai disetujui (approve) + CI hijau → digabung (merged)
- [ ] **Refleksi**: tulis 3 hal yang dipelajari di catatan pribadi

**Gagal merge dalam 2 hari?** Tanya senior: "apakah task ini kebesaran?". Pecah sub-task atau ganti task.

---

## Day 3-7 - Tugas mandiri (independent) dengan pair review

Tujuan: kerja mandiri, tapi tiap PR tetap di-review senior.

- [ ] Ambil 2-4 task size **S-M** (1-2 hari per task). Hindari L/XL dulu
- [ ] Tiap task: **sesi Claude baru, fresh context** (aturan emas `CLAUDE_TEAM_GUIDE.md` §4)
- [ ] Pakai `PROMPT_LIBRARY.md` sesuai jenis task
- [ ] **Branch max 3 hari hidup** (§5). Lebih = diskusi dengan senior
- [ ] Tiap PR: senior review min 1 orang + kamu review min 1 PR teman (Prompt 5)
- [ ] Update `docs/` setiap PR yang ubah behavior publik
- [ ] **Lapor harian (daily check-in)** di channel tim: "kemarin X, hari ini Y, blocker Z"

**Kebiasaan yang dibangun**: test lokal sebelum push, cek Vercel preview sebelum request review, tulis PR description jelas (konteks, perubahan, screenshot, cara test), self-review diff sendiri sebelum minta orang lain.

**Tanda bahaya (red flags) wajib ditangkap**:
- AI import library baru tanpa kamu minta → stop, tanya senior
- PR diff > 500 baris → task kebesaran, pecah
- CI merah > 30 menit tidak fix → minta tolong

---

## Day 7-14 - Tanggung jawab penuh (full ownership) 1 modul

Tujuan: kamu jadi **DRI** (Directly Responsible Individual = penanggung jawab utama) untuk 1 modul kecil. Owner & senior mundur selangkah (step back).

- [ ] Owner assign **1 modul kecil** (mis. `features/notifications/`)
- [ ] Kamu jadi **penanggap pertama (first responder)** untuk bug modul itu
- [ ] Kamu yang **review PR teman** yang sentuh modul itu (Prompt 5)
- [ ] Kamu yang **update `docs/<modul>.md`** sesuai realita

**Tanggung jawab**:
- [ ] **Health check modul** - code & docs sinkron, fix kalau drift
- [ ] **Backlog kecil** - 3-5 improvement ide, share ke channel
- [ ] **Eksekusi 1-2 improvement** sebagai PR sendiri
- [ ] **Buat ADR** kalau ada keputusan desain non-trivial (Prompt 10)

**Mentok (blocker) > 1 hari?** Lapor naik (escalate) ke senior dengan konteks lengkap (yang sudah dicoba, output AI, error message). Detail kapan tanya siapa: `CLAUDE_TEAM_GUIDE.md` §13. Jangan diam karena malu - 1 hari stuck = 1 hari yang bisa di-unblock 15 menit.

**Output Day 14**:
- [ ] Modul **jalan + docs lengkap**
- [ ] Min. **5 PR merged** total selama 14 hari
- [ ] Min. **5 PR teman di-review**
- [ ] **Penilaian diri (self-assessment)**: 1 halaman "3 hal lancar, 3 hal sulit, 1 hal mau dipelajari bulan depan", bagikan ke owner

---

## Day 15+ - Mode normal + quarterly review

- **Harian (Daily)**: check-in tim, kerjain task, review PR teman
- **Mingguan (Weekly)**: 1-2 PR merged, 2-3 PR teman di-review
- **Bulanan (Monthly)**: cek `docs/architecture.md` modul kamu masih akurat? Update kalau drift
- **Per kuartal (Quarterly)**: ikut kit review session (`CLAUDE_TEAM_GUIDE.md` §14). PR ke kit `lintasAI` minimal 1x per kuartal

---

## Tips emas untuk dev baru hire AI-first

1. **Jangan malu tidak tahu**. Tim hire kamu tahu kamu bukan programmer berpengalaman. Bertanya = sehat.
2. **Jangan terlalu bergantung AI**. AI bisa salah. Kamu yang verifikasi, kamu yang bertanggung jawab (accountable).
3. **Baca diff sendiri sebelum push**. Wajib. Tidak ada alasan.
4. **Konteks > kecepatan**. PR lambat bersih > PR cepat kotor.
5. **Update docs itu hasil kerja wajib (deliverable)**. Bukan opsional.
6. **2 minggu pertama itu lambat - normal**. Jangan banding-bandingin sama senior 2 tahun.

> Anti-pattern detail (vibe code accept, mega prompt, skip docs, branch panjang umur, dll): `docs/GLOSSARY_NON_PROGRAMMER.md` §8.

---

## 🪄 Kalimat Ajaib untuk AI (frasa pemicu — fitur paling kuat, tinggal ketik)

Banyak kemampuan terkuat lintasAI terbuka cukup dengan **mengetik kalimat ke Claude** — tak perlu hafal perintah teknis. Simpan daftar ini, ketik apa adanya ke AI:

| Ketik ke AI | Yang terjadi |
|---|---|
| **`lintasAI skill`** | AI memindai proyek menyeluruh (keamanan, mutu, anti-ngarang) lalu lapor bertahap — seperti tombol "Cek Kesehatan Akun" di BCA mobile. |
| **`audit`** atau *"cek apa yang bisa diperbaiki"* | AI memeriksa cuma-baca + mengurutkan temuan dari risiko rendah ke tinggi (tak mengubah apa pun tanpa izinmu). |
| **`refactor bertingkat`** | AI merapikan kode **bertahap dari yang paling aman dulu**, minta izin tiap naik tingkat. |
| **`compaction`** | AI merapikan berkas catatan yang membengkak (aman: isi tak dibuang, dicadangkan dulu). |
| **`skill SEO`** (atau bidang lain) | AI fokus pakai keahlian itu; kamu juga bisa **bikin skill sendiri** cukup dengan menjelaskannya sekali. |
| **`cek SEO`** atau *"audit SEO halaman"* | AI mengaudit SEO dasar (title/meta/preview share/heading) sesuai framework-mu, lalu lapor + saran (cuma-baca). |
| **`cek ukuran halaman`** (sesudah `npm run build`) | AI hitung perkiraan berat JS tiap halaman vs anggaran (Next.js) + sarankan yang perlu diramping. |
| **`update kit`** atau *"ada versi lintasAI baru?"* | AI cek versi baru + jelaskan perubahannya sebelum memasang. |
| **`mode co-pilot`** | AI kerja lebih otomatis untuk hal aman, tapi tetap berhenti minta izin di langkah berbahaya (default mati). |
| **`lanjutkan setup lintasAI`** | Kalau popup pemandu setup tak muncul sendiri, kalimat ini memunculkannya. |
| **`cek lingkungan`** atau *"kenapa di komputerku beda/error padahal di tempat lain jalan"* | AI memotret versi Node/PowerShell/OS/Git (`npx lintasai doctor --env`) untuk cari sumber beda-antar-komputer (cuma-baca, tanpa data pribadi). |
| **`build error`** atau *"gagal build"* | AI menelusuri penyebab gagal-build bertahap, memperbaiki, lalu memverifikasi. |
| **`cek tes`** atau *"coverage"* | AI memetakan bagian yang belum teruji + membuatkan tes yang kurang + menjalankannya. |
| **`cek keamanan AI/MCP`** | AI memindai izin sambungan MCP + hook Claude Code (cuma-baca) — pastikan tak ada pintu berbahaya terbuka. |
| **`uji tampilan situs`** | AI membuka situs + mengklik seperti pengguna asli untuk cek tampilan/alur (mode aman). |

**Menyalakan penjaga yang masih "BELUM"** (lihat panel *STATUS PENJAGA* yang muncul saat pasang kit):
- *"aktifkan pencegah-drift"* — AI **memindai project + menuliskan sendiri** peta "angka mana yang harus selalu sama di banyak berkas", lalu robot menjaganya (tangkap "diubah di satu berkas, lupa di berkas lain"). Naskah AI: `.claude-kit/templates/WIZARD_PENCEGAH_DRIFT_v1.md`.
- *"nyalakan Palang Rem risk-gate"* — minta konfirmasi sebelum aksi berbahaya (hapus data, terobos pengaman).
- *"buatkan Buku Induk akses"* — AI **mewawancaraimu pakai bahasa biasa lalu menuliskan sendiri** catatan siapa boleh akses repo mana (kamu tak perlu menyentuh format teknisnya). Untuk tim pisah-repo. Naskah AI: `.claude-kit/templates/WIZARD_BUKU_INDUK_v1.md`.
- *"cek akses tim"* — AI membandingkan siapa yang **benar-benar** bisa membuka tiap repo di GitHub vs catatan Buku Induk, lalu menunjukkan selisihnya (cuma-baca; butuh `gh` + organisasi GitHub). Tindakan cabut/undang tetap kamu yang lakukan. Untuk tim pisah-repo.

> Tak yakin frasa mana? Cukup jelaskan maksudmu pakai bahasa biasa — AI akan menebak yang tepat.

---

## Penutup

Selamat datang di tim. 14 hari pertama adalah fondasi - kalau pondasi kuat, sisanya lancar. Kalau ada bagian playbook ini yang kamu rasa salah / kurang / usang (missing/outdated) - PR ke `lintasAI`.

Semoga lancar. Pelan itu mulus, mulus itu cepat (slow is smooth, smooth is fast).
