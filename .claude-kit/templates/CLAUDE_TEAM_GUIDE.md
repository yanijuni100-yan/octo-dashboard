# CLAUDE_TEAM_GUIDE.md - Panduan Kerja Tim AI-First

> Versi 1 · 2026-06-01
> Bahasa Indonesia · junior-friendly · untuk tim 5-15 dev AI-first
> File ini SISTEM (managed by kit). Jangan dihapus. Edit hati-hati - kalau mau ubah pattern tim, PR ke repo kit `lintasAI`.

---

## 1. Untuk siapa file ini?

File ini ditulis untuk **anggota tim yang baru bergabung** dan **anggota lama yang butuh refresh**. Targetnya: dev non-programmer (atau junior) yang coding 100% lewat Claude Code. Setelah baca file ini sampai habis, kamu paham *cara tim ini bekerja sehari-hari*: dari nyalakan laptop pagi sampai PR di-merge sore. Kalau ada istilah asing, cek `docs/glossary.md` atau tanya Claude langsung - jangan tebak.

---

## 2. Filosofi tim AI-first

Tim ini bukan tim "developer yang kebetulan pakai AI". Tim ini adalah **tim AI-first**: AI (Claude Code) jadi co-pilot utama, manusia jadi *decision maker* + *reviewer*. Konsekuensinya:

- **Setiap baris kode lahir dari dialog dengan AI**, bukan ketik manual. Kalau kamu ketik kode manual lebih dari 10 baris, berhenti - minta Claude generate dulu, baru kamu edit.
- **Konteks > skill teknis**. Yang dinilai bukan "bisa nulis React seberapa lancar", tapi "bisa kasih konteks ke AI seberapa lengkap". Prompt yang jelas = output yang benar.
- **Dokumen `docs/` adalah memory eksternal tim**. AI tidak ingat sesi kemarin. Tapi kalau semua keputusan ada di `docs/`, AI sesi besok bisa lanjut dari titik yang sama. Jangan males update `.md`.
- **Manusia tetap accountable**. AI bisa salah, hallucinate, atau ngasal. Kamu yang tanda-tangan PR - kamu yang tanggung jawab. Jangan auto-approve apa pun yang kamu tidak paham.
- **Slow is smooth, smooth is fast**. Lebih baik 1 task selesai bersih (kode + docs + test + review) daripada 5 task setengah jadi.

---

## 3. Setup awal dev baru hire (Day 0 - Day 14)

Dev baru hire wajib lewat onboarding 14 hari: Day 0 install tools + clone repo, Day 1 baca dokumentasi inti, Day 1-2 first PR (good first issue) pair dengan senior, Day 3-7 task mandiri S-M dengan review, Day 7-14 full ownership 1 modul kecil, lalu Day 15+ mode normal.

**Jangan loncat fase.** Kalau Day 1 belum baca `architecture.md`, jangan langsung pegang task. Pondasi konteks dulu, baru kerja.

📋 Detail Day 0-14 playbook lihat `templates/ONBOARDING.md`.

---

## 4. Workflow harian: 1 task = 1 sesi Claude Code

**Aturan emas**: satu task = satu sesi Claude Code yang fresh. Jangan campur 2 task dalam 1 sesi panjang - konteks bercampur, AI bingung, kamu bingung.

### Pola harian standar:

1. **Pagi (15 menit)**: Buka **channel chat `#tasks-<proyek>` (default)** ATAU GitHub Issues (opsional, dipakai kalau proyek butuh tracking formal). Ambil 1 task yang ditandai 🟦 TODO. Pastikan kamu paham *apa yang diminta* sebelum buka Claude. Kalau ragu, tanya di channel tim dulu. Detail format prompt task & emoji status: lihat section 5b.
2. **Buka sesi Claude Code baru** di folder proyek. Sesi baru = konteks bersih, tidak ada residu dari kemarin.
3. **Brief AI dengan konteks**:
 - Sebutkan issue/task number.
 - Tunjuk file `docs/` yang relevan (mis. "baca `docs/auth.md` dulu").
 - Jelaskan acceptance criteria dengan jelas.
4. **Iterasi**: AI generate → kamu baca → kamu kritik → AI revisi. Ulangi sampai puas.
5. **Verifikasi**: jalankan kode lokal (`npm run dev`), klik manual, atau minta Claude pakai skill `verify`.
6. **Update docs**: AI auto-generate/update `.md` pendamping. Kamu baca sekilas, pastikan tidak hallucinate.
7. **Commit + push + PR**: pakai pattern di `PROMPT_LIBRARY.md` no.5 (review PR teman) atau no.6 (refactor).
8. **Tutup sesi Claude**. Besok pagi, sesi baru lagi.

### Yang DILARANG:

- ❌ Sesi Claude jalan 8 jam non-stop tanpa restart - konteks penuh, AI mulai ngaco.
- ❌ Kerja 3 task sekaligus dalam 1 sesi - mixing context = bug.
- ❌ Skip step verifikasi karena "AI bilang udah jadi". Selalu jalankan & lihat sendiri.

---

## 5. Branching strategy untuk non-programmer

Git itu menakutkan, tapi tenang - **Claude bantu semua perintah git**. Kamu cukup paham *konsep*-nya, sintaks biar AI yang urus.

### Konsep dasar:

- **`main` = production**. Selalu hijau, selalu deployable. **PROTECTED** - tidak boleh push langsung. Wajib lewat PR.
- **Feature branch** = tempat kerja kamu. Format nama: `feat/<short-desc>` atau `fix/<short-desc>` atau `docs/<short-desc>`.
- **Branch max hidup 3 hari**. Lewat 3 hari = ada bau (mungkin task kebesaran, atau ada blocker). Stop, diskusi sama tim.

### Workflow per task:

```
1. git checkout main && git pull       → sinkron dulu dengan main terbaru
2. git checkout -b feat/add-search     → bikin branch baru
3. <kerja, commit, push>
4. Buka PR di GitHub                   → pakai gh CLI atau web UI
5. Tunggu review + CI hijau
6. Merge (squash merge biasanya)       → history main bersih
7. Hapus branch lokal & remote
```

### Kalau bingung tinggal minta Claude:

> "Saya baru selesai kerja task X, branch saat ini `feat/add-search`. Tolong bantu commit + push + buat PR. Pakai pattern Conventional Commits."

Claude akan jalankan git commands satu-satu. Kamu cuma approve.

---

## 5b. Workflow Tanpa GitHub Issue (Chat-Driven Task)

Tim ini **default tidak pakai GitHub Issues** untuk task harian. Alasannya: anggota tim mayoritas non-programmer, GitHub UI itu ekstra friction (harus buka tab, login, isi form, klik label, dst.). Selama tim kecil (5-15 orang) dan komunikasi rapat, **channel chat sudah cukup** jadi sumber kebenaran task.

> **Audit trail = chat history**. Jangan hapus pesan task. Kalau task selesai, biarkan pesan tetap ada (cuma update emoji status).

### Channel yang dipakai

Tim pakai 1 channel chat per proyek. Nama channel disepakati owner di awal proyek (`docs/architecture.md` section *Komunikasi*). Contoh:

- Slack: `#tasks-akses`, `#tasks-bayar`
- Discord: channel `tasks-akses` di server tim
- Telegram/WhatsApp: group `Tasks akses` (untuk tim super-kecil)

Satu channel = satu proyek. **Jangan campur task lintas proyek** - bikin susah cari riwayat.

### Format prompt task standar (owner kirim ke channel)

```
[TASK] <deskripsi singkat - 1 kalimat>
[Acceptance Criteria]
  1. <criteria 1>
  2. <criteria 2>
  3. <criteria 3>
[Prioritas] <Rendah/Sedang/Tinggi>, target <kapan>
[Catatan] <reuse helper apa / file mana - opsional tapi sangat membantu>
[Risk Level] <Low / Medium / High - lihat section 7b>
   * Low = UI minor, copy edit, refactor internal
   * Medium = fitur baru self-contained, tidak sentuh auth/billing/data sensitif
   * High = sentuh auth/billing/schema-user-visible/destruktif/eksperimental → owner WAJIB hold merge
```

**Contoh nyata** (owner kirim ke `#tasks-akses`):

```
🟦 TODO

[TASK] Tambah tombol Export ke Excel di /admin/users
[Acceptance Criteria]
  1. Tombol muncul di kanan atas tabel users, label "Export Excel"
  2. Klik tombol → download .xlsx berisi user yang ter-filter
  3. Kolom: nama, email, role, last_login, created_at
  4. Loading state saat generate
[Prioritas] Sedang, target besok sore
[Catatan] Reuse helper exportToXlsx() di lib/excel.ts (sudah ada untuk invoices).
[Risk Level] Low - UI tambahan, tidak sentuh data sensitif
```

**Kenapa wajib template ini?**
- `[TASK]` - cepat di-scan saat scroll channel.
- `[Acceptance Criteria]` - AI butuh ini untuk tahu "selesai" itu apa.
- `[Prioritas]` + target - anggota tim tahu mana yang duluan.
- `[Catatan]` - kasih konteks reuse supaya AI tidak bikin helper duplikat.
- `[Risk Level]` - paksa owner klasifikasi risiko di awal (lihat section 7b). High Risk = owner hold merge sampai yakin.

### Convention emoji status

Status task ditandai emoji di **baris pertama pesan task**. Owner/PIC **edit pesan asli** saat status berubah - bukan kirim pesan baru.

| Emoji | Status | Artinya |
|---|---|---|
| 🟦 | **TODO** | Task baru, belum ada yang ambil |
| 🟧 | **WIP** | Sudah diambil. Tambah PIC: `🟧 WIP - @bagus` |
| 👁️ | **REVIEW** | PR sudah dibuka. Tambah link: `👁️ REVIEW - PR #42` |
| ✅ | **DONE** | Sudah merged & deployed |
| ⛔ | **BLOCKED** | Ada blocker. Tambah alasan |
| 🗑️ | **CANCELLED** | Dibatalkan |

**Aturan**: Hanya owner/PIC yang edit pesan. Jangan hapus pesan lama. Pin pesan WIP/BLOCKED.

### Cara ambil task

1. Scroll channel, cari 🟦 TODO prioritas tinggi.
2. Edit pesan → 🟧 WIP - @<nama>.
3. Buka sesi Claude Code baru, brief AI dengan paste seluruh pesan task.
4. Kerja sesuai workflow section 4.
5. PR dibuka → edit pesan jadi 👁️ REVIEW - PR #<nomor>.
6. Setelah merged → ✅ DONE.

### Klarifikasi soal task

**Reply thread** pesan task. Jangan kirim pesan baru di channel utama.

### Kapan TETAP pakai GitHub Issues?

- Proyek dengan klien eksternal (klien minta lihat status formal)
- Kontrak SLA tracking formal
- Audit kepatuhan/compliance
- Tim > 15 orang (chat mulai noisy)
- Task lintas-proyek besar (butuh Kanban view)

Kondisi di atas → diskusi sama owner, pindah ke GitHub Issues. Format prompt task tetap sama (copy ke body issue, emoji status diganti label).

---

## 6. Library prompt siap-pakai

Daripada nulis prompt dari nol tiap kali, **tim punya `PROMPT_LIBRARY.md`** - koleksi 10+ prompt yang sudah teruji untuk kasus umum (tambah fitur, fix bug, SEO check, deploy, dll). Baca file itu sekarang kalau belum.

Lokasi: `./.claude-kit/templates/PROMPT_LIBRARY.md` (versi master, tim) atau copy lokal di `docs/PROMPT_LIBRARY.md`.

Kalau ada pattern baru yang kamu temukan dan terbukti work → **PR ke kit** (lihat seksi 13).

---

## 7. MCP setup tim

**MCP** (Model Context Protocol) = cara Claude Code terhubung ke tool eksternal: GitHub, Supabase, Vercel, dll. Tanpa MCP, Claude buta ke layanan-layanan ini.

Tim ini pakai MCP servers berikut sebagai standar:
- **GitHub MCP** - buat PR, baca issue, comment.
- **Supabase MCP** - query DB, lihat schema, baca logs.
- **Vercel/Railway MCP** - cek deploy status, env vars.
- **Filesystem MCP** - baca/tulis file di luar repo (sparingly).

Setup detail (token, config JSON, troubleshooting): lihat `./.claude-kit/templates/MCP_SETUP.md`.

**Aturan**: token MCP **per-orang**, jangan share. Simpan di password manager pribadi (1Password, Bitwarden). Jangan commit ke repo.

---

## 7b. Risk Level Decision Tree (Kapan Owner Hati-Hati Approve Merge)

Tim default pakai workflow simple: **branch → PR → Vercel preview → owner review → squash merge → auto-deploy prod**. Tidak ada feature flag, tidak ada toggle env var, tidak ada gradual rollout.

> Filosofi: simpler = less mistake. Untuk team 5-15 staff IT non-programmer, kompleksitas extra (feature flag) jadi friction tanpa benefit jelas. Staff tidak akses Vercel dashboard, jadi flag toggle = owner-only operation = bottleneck.

### Tapi tidak semua task sama risiko-nya

Tiap task punya **Risk Level**. Owner WAJIB klasifikasi di awal supaya tim tahu cara handle:

| Risk Level | Kriteria | Cara Handle |
|---|---|---|
| 🟢 **Low** | Copy edit, styling, bugfix <50 baris, refactor internal, fitur baru self-contained (tombol Export, filter, tooltip) | Standar: review cepat, merge, deploy. |
| 🟡 **Medium** | Fitur baru yang sentuh business logic, API endpoint baru, change yang user lihat tapi tidak kritis | Standar + test manual di Vercel preview lebih teliti sebelum merge. |
| 🔴 **High** | Auth/login/permission, billing/pricing/payment, schema DB yang user lihat, destruktif (hapus data, migrasi besar), eksperimental | Owner HOLD MERGE - test extensive di preview, smoke test prod 5+ menit setelah deploy, siap rollback. Pertimbangkan deploy off-hours. |

### Format declare di prompt task

```
[Risk Level] <Low / Medium / High>
   * Low = UI minor, copy edit, refactor internal
   * Medium = fitur baru self-contained, tidak sentuh auth/billing/data sensitif
   * High = sentuh auth/billing/schema-user-visible/destruktif/eksperimental - owner WAJIB hold merge sampai yakin
```

### Contoh konkret

| Task | Risk Level | Alasan |
|---|---|---|
| Tambah tombol Export Excel di /admin/users | 🟢 Low | UI tambahan, tidak sentuh data sensitif |
| Fix typo di footer | 🟢 Low | Copy edit murni |
| Refactor `lib/utils.ts` (extract helper) | 🟢 Low | Internal, no API change |
| Tambah filter "Status" di tabel inbox | 🟢 Low | UI baru, tidak ubah data |
| Tambah endpoint API `/api/reports/export` | 🟡 Medium | API baru, tapi self-contained, read-only |
| Tambah field NPWP di form registrasi | 🟡 Medium | Schema change user-facing, tapi tidak destruktif |
| Ganti library auth (NextAuth → Clerk) | 🔴 High | Sentuh login = bisa lockout semua user |
| Implement diskon volume di checkout | 🔴 High | Sentuh billing = potensi over/under-charge |
| Migrasi avatar S3 lama → bucket baru | 🔴 High | Destruktif/irreversible kalau salah |
| A/B test redesign landing page | 🔴 High | Eksperimental, butuh monitoring |
| Bump Next.js 14.2.3 → 14.2.5 (patch) | 🟢 Low | Patch bump |
| Bump Next.js 14 → 15 (major) | 🔴 High | Potensi breaking change widespread |

### Aturan untuk Owner

- **Risk Level WAJIB di awal task**. Tidak boleh "lihat dulu nanti". Owner yang declare.
- **High Risk = hold merge sampai yakin**. Boleh nahan PR 1-3 hari untuk extensive review.
- **Off-hours deploy untuk High Risk**. Merge & deploy saat traffic rendah (mis. tengah malam) supaya kalau bug, dampak minimal.
- **Smoke test prod 5+ menit** setelah deploy High Risk. Buka URL prod, klik fitur, cek log Vercel + Supabase.
- **Siap rollback `git revert`** - kalau bug parah, langsung revert (lihat section 13b Rollback Playbook).

### Kalau Owner Butuh Lebih dari Branch+Revert: Feature Flag (Advanced)

Untuk kasus EKSTREM (mis. payment toggle saat Black Friday), feature flag tetap pilihan. Tapi itu **advanced operation** yang butuh owner familiar dengan Vercel env vars + redeploy cycle. Detail di `./.claude-kit/templates/feature-flags-advanced.md`. Default workflow: **tidak perlu flag**.

---

## 8. Code review AI-assisted

Review PR teman = wajib, tapi kamu bukan programmer berpengalaman - itu OK. AI bantu review. Workflow:

1. **Buka PR di GitHub**, copy URL.
2. **Buka sesi Claude Code baru** di repo, pastikan sudah pull main terbaru.
3. **Pakai prompt no.5 di `PROMPT_LIBRARY.md`** ("Review PR teman"). Intinya:
 ```
 Tolong review PR ini: <URL>. Fokus ke:
 - Apakah acceptance criteria di issue terpenuhi?
 - Ada bug obvious? (null check, edge case, typo)
 - Apakah docs `.md` pendamping ter-update?
 - Apakah ada code duplication yang bisa di-reuse?
 - Apakah commit message ikut Conventional Commits?
 ```
4. **Claude akan output report**. Baca pelan-pelan. Tandai poin yang kamu setuju.
5. **Putuskan**:
 - **Approve** kalau bersih.
 - **Request changes** kalau ada concern. Tulis comment di GitHub PR (Claude bisa bantu draft comment yang sopan).
 - **Comment only** kalau ragu, butuh diskusi.
6. **Submit review** lewat `gh pr review` atau web UI.

**Penting**: kamu tetap accountable. Kalau Claude bilang "LGTM" tapi kamu sebenarnya tidak ngerti kodenya - *jangan approve*. Tanya teammate dulu.

---

## 9. Stack convention

Tim ini default pakai stack:
- **Frontend**: Next.js (App Router) + Tailwind + shadcn/ui
- **Backend**: Next.js Route Handlers / Server Actions, atau Express terpisah
- **DB**: Supabase (Postgres) via Prisma
- **Hosting**: Vercel (default), Railway/Render kalau perlu long-running process
- **Auth**: NextAuth atau Supabase Auth (per proyek)
- **CI/CD**: GitHub Actions
- **Package manager**: pnpm (lebih cepat & disk-efficient)

Detail lengkap (env vars, struktur folder, naming convention, error handling pattern) ada di `./.claude-kit/templates/STACK_GUIDE.md`.

Kalau proyek butuh stack berbeda - **tulis alasan di `docs/architecture.md`** dan minta approval owner.

---

## 10. Conflict resolution untuk non-programmer

Merge conflict = saat git tidak bisa otomatis gabungin perubahan kamu dengan main. Kelihatannya menakutkan, tapi gampang dengan AI.

### Workflow:

1. **Tarik napas**. Conflict itu normal, bukan bencana.
2. `git status` - lihat file mana yang conflict.
3. **Buka file yang conflict**, lihat marker `<<<<<<<`, `=======`, `>>>>>>>`.
4. **Buka Claude**, paste isi file + konteks:
 ```
 Saya ada merge conflict di file <nama>. Branch saya `feat/X` di-merge ke `main` terbaru.
 Berikut isi file dengan conflict markers:
 <paste full file>
 
 Branch saya mau nambah fitur Y. Main terbaru sudah ada perubahan Z.
 Tolong resolve, jelaskan kenapa, dan kasih saya file final tanpa markers.
 ```
5. **Baca penjelasan AI**. Kalau masuk akal, replace file lokal dengan output AI.
6. **Verifikasi**: jalankan kode (`npm run dev`), pastikan tidak break.
7. **Commit resolution**: `git add <file> && git commit` (pakai message default "Merge branch ...").
8. **Push**, lanjutkan PR.

### Kapan minta tolong manusia:
- Conflict di file critical (auth, DB schema, payment) - minta senior review hasil AI sebelum commit.
- Lebih dari 3 file conflict - mungkin branch kamu terlalu lama, restart dari main.

---

## 11. Memory & plans hygiene

Claude punya 2 jenis "ingatan":

1. **Memory file** (`~/.claude/projects/<proyek>/memory/MEMORY.md`) - **per-user, private**. Otomatis ke-load tiap sesi. Isi: preferensi user, snapshot status proyek dari sudut pandang user.
2. **Plans / TodoWrite** - internal AI dalam 1 sesi. Hilang saat sesi tutup.

### Aturan:

- **JANGAN share memory file** ke teman. Itu personal, isinya kebiasaan kamu.
- **Pattern tim** (cara nulis docs, cara naming branch, cara review) **HARUS** lewat `_PATTERNS.md` di kit - bukan memory pribadi. Kalau memang pattern tim, PR ke kit.
- **Update memory** kalau kamu temukan workflow baru yang berulang. Mis: "setiap aku minta deploy, AI selalu cek `.env.local` dulu" - tulis di memory.
- **Jangan simpan secrets** di memory. Token, password, API key - simpan di password manager.

Detail teknis memory: `docs/CLAUDE_PERSISTENCE_MAP.md` (kalau ada di proyek) atau tanya owner.

---

## 12. Anti-pattern + FAQ

Anti-pattern lengkap dengan analogi: lihat `docs/GLOSSARY_NON_PROGRAMMER.md` §8 Anti-Pattern.

---

## 13. Escalation path

Kapan tanya siapa:

| Situasi | Tanya |
|---|---|
| Stuck kode/prompt < 30 menit | Claude (iterasi prompt) |
| Stuck > 30 menit, ada teammate online | Channel tim (Slack/Discord) - tag `@team` |
| Konflik desain (arsitektur, DB schema, dependency baru) | Senior dev / tech lead |
| Keputusan bisnis / scope / deadline | Owner / PM |
| Pattern baru yang kamu yakin worth dipakai semua tim | PR ke repo kit `lintasAI` |
| Bug di kit itu sendiri (instruksi salah, broken template) | Issue di repo kit `lintasAI` |
| Security incident (token bocor, data leak) | Owner langsung, JANGAN di channel publik |

### Cara PR ke kit `lintasAI`:

1. Fork `github.com/ojokesusu/lintasAI`.
2. Edit file template di branch baru.
3. PR dengan judul `pattern: <deskripsi singkat>` dan body yang jelaskan: kapan pakai, contoh kasus, kenapa worth jadi standar tim.
4. Tag maintainer kit. Tunggu review.
5. Setelah merged, kit auto-update di proyek-proyek tim saat mereka pull versi baru.

---

## 13b. Hotfix & Rollback Playbook

Bug serius di production = mimpi buruk. Tapi tim ini punya **2 jalur rollback** yang sudah teruji. Target tim: **time-to-rollback < 5 menit**.

> **Aturan pertama saat ada bug serius**: jangan panik, jangan langsung patch. **Rollback dulu**, baru investigasi dengan tenang.

### Kapan playbook ini dipakai?

Gunakan kalau ada **salah satu**:
- 🚨 User melaporkan fitur error massal (bukan cuma 1 user)
- 🚨 Halaman crash / blank screen di prod
- 🚨 Data salah ditampilkan (mis. invoice 0 padahal ada tagihan)
- 🚨 Login total tidak bisa
- 🚨 Pembayaran failed massal
- 🚨 Vercel deploy terbaru di-trigger commit terakhir, masalah mulai setelah deploy itu

Kalau cuma 1 user complain minor → debug normal, jangan rollback.

### Default Workflow: Rollback via Git Revert

Tim default TIDAK pakai feature flag (section 7b). Jadi rollback selalu lewat `git revert`. Target waktu: **<5 menit** dari deteksi sampai prod normal.

**Eksekusi**: owner / senior dev.

1. Buka **sesi Claude Code BARU** (konteks bersih).
2. Pull main terbaru: `git pull origin main`.
3. Brief Claude (copy-paste utuh):

   ```
   🚨 EMERGENCY ROLLBACK

   Ada bug parah di prod yang muncul setelah commit terakhir di main.
   Tolong:
   1. Cek log commit terakhir: git log -1 --oneline
   2. Konfirmasi commit yang akan di-revert
   3. git revert HEAD --no-edit
   4. git push origin main
   5. Konfirmasi commit revert sudah ke-push

   Setelah push, Vercel akan auto-deploy versi sebelum bug (~5 menit).
   ```

4. AI tunjukkan commit yang akan di-revert - **kamu baca DULU**, pastikan benar.
5. Approve. AI eksekusi `git revert` + `git push`.
6. Buka Vercel Dashboard → tab Deployments → lihat deploy baru jalan.
7. Tunggu 3-5 menit sampai status "Ready".
8. Verifikasi prod normal.
9. Announce: `"🟢 Rollback via git revert (commit <hash>). Bug investigasi di branch fix/<nama>."`

**Catatan jalur B**:
- `git revert` = commit baru yang membatalkan commit sebelumnya (bukan menghapus history). Aman.
- **Jangan pakai `git reset --hard`** - destructive, history hilang.
- Kalau bug bukan di commit terakhir → revert commit spesifik: `git revert <hash> --no-edit`.

### Yang TIDAK BOLEH saat panik

- ❌ `git push --force` ke main - destructive
- ❌ Edit langsung di GitHub web UI di main - bypass PR + review
- ❌ Hot-patch tanpa branch - `git commit -am "fix" && git push origin main` langsung
- ❌ Hapus deployment di Vercel - bikin URL prod down
- ❌ Diam tanpa announce - tim lain harus tahu

### Post-mortem ringan (wajib)

Dalam **24 jam setelah rollback**, owner/PIC bug bikin post-mortem di channel chat atau `docs/incidents/<tanggal>-<nama-bug>.md`:

```
📋 POST-MORTEM - <judul singkat>

Tanggal: <YYYY-MM-DD>
Durasi impact: <berapa menit bug ada di prod>
Cara rollback: git revert (atau flag toggle kalau pakai advanced)

1. Bug apa? <gejala yang user lihat, dampak>
2. Root cause? <kenapa terjadi, asumsi yang salah>
3. Kenapa lolos review? <test miss / preview deploy tidak di-test manual / reviewer skim>
4. Action items berikutnya:
   - [ ] <mis. tambah test edge case X>
   - [ ] <mis. update review checklist>
   - [ ] <mis. fitur sejenis WAJIB pakai flag>
```

**Aturan**: blameless (fokus proses, bukan menyalahkan orang). Action items konkret, bisa di-track. Jangan skip - bug serupa pasti terulang.

### Latihan fire drill

Sekali per kuartal, tim adakan fire drill di staging:
1. Deploy commit "buggy" sengaja
2. Anggota tim eksekusi rollback via git revert
3. Hitung waktu deteksi → rollback. Target < 5 menit.
4. Diskusi: langkah yang bingung? Update playbook.

Tanpa latihan, saat bug beneran datang, kamu pasti panik.

---

## 14. Quarterly ritual

Tiap 3 bulan, tim adakan **kit review session** (1-2 jam, optional tapi recommended):

1. **Survey blocker** - tiap anggota share: pattern apa yang sering bikin stuck? Anti-pattern apa yang baru ketemu?
2. **Review `PROMPT_LIBRARY.md`** - prompt mana yang masih relevan, mana yang outdated. Tambah/hapus sesuai realita.
3. **Review `_PATTERNS.md`** - apakah konvensi docs masih masuk akal? Ada pattern baru yang muncul organik?
4. **Cek `architecture.md`** semua proyek aktif - apakah masih akurat? Update kalau drift dari realita.
5. **Bump kit version** kalau ada perubahan signifikan, update `CHANGELOG.md`.
6. **Action items** - tiap orang ambil 1 PR ke kit (boleh kecil: typo fix, contoh tambahan).

Ritual ini penting karena kit yang stagnan = tim yang stagnan. Tim AI-first hidup dari iterasi pattern.

---

## Penutup

File ini adalah **kontrak kerja tim**. Bukan dokumen mati - dia hidup, di-update tiap kuartal. Kalau ada bagian yang kamu rasa salah/missing/outdated, jangan diam - PR ke kit.

Selamat bekerja. Slow is smooth, smooth is fast.
