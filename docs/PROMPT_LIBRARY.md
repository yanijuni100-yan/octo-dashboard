# PROMPT_LIBRARY.md - Koleksi Prompt Siap-Pakai Tim AI-First

> Versi 1 · 2026-06-01
> 22 prompt pattern teruji untuk kasus umum sehari-hari (1-10 generic + 11-15 chat-driven workflow + 16-22 audit/update/split/onboarding/anti-halusinasi)
> Format: nama → kapan pakai → template → tips
>
> CATATAN: Staff non-programmer TIDAK perlu baca file ini langsung. AI auto-apply pattern dari natural language brief (lihat `CLAUDE_universal_v1.md` section 4.2 Pattern-Driven Workflow). File ini reference untuk AI + owner.

---

## Cara pakai file ini

1. Cari prompt yang paling dekat dengan kebutuhan kamu (lihat daftar di bawah).
2. **Copy template** ke sesi Claude Code baru.
3. **Isi placeholder** `<...>` dengan konteks spesifik kamu (jangan biarkan kosong).
4. **Sesuaikan** kalau perlu - ini template, bukan mantra suci.
5. Iterasi sampai output sesuai.

Placeholder format: `<NAMA_FIELD>` artinya wajib diisi. `[OPTIONAL]` artinya boleh dihapus kalau tidak relevan.

---

## Daftar prompt

1. Tambah fitur baru (user story)
2. Fix bug dari user report
3. SEO check sebelum deploy
4. Vercel deploy + preview test
5. Review PR teman
6. Refactor code (DRY, reuse)
7. Resolve merge conflict
8. Setup MCP server baru
9. Migrate Vercel → Railway/Render
10. Write ADR untuk decision teknis
11. Owner kirim task ke staff (chat-driven)
12. Staff brief Claude untuk mulai task
13. Lapor owner setelah PR siap review
14. Owner brief Claude untuk rollback cepat (emergency)
15. Activate Feature Flag Mode (post-launch per project)

---

## Prompt 1: Tambah fitur baru (user story format)

**Kapan pakai**: ada issue baru di GitHub board minta fitur tambahan. Kamu sudah paham scope-nya, tinggal eksekusi.

**Template**:

```
Konteks proyek: <NAMA_PROYEK>, stack <NEXTJS/EXPRESS/DLL>.
Baca dulu: docs/architecture.md, docs/glossary.md, docs/<MODUL_TERKAIT>.md.

User story:
> Sebagai <PERAN_USER>, saya ingin <APA_YANG_DILAKUKAN>, supaya <KENAPA/BENEFIT>.

Acceptance criteria:
- [ ] <KRITERIA_1>
- [ ] <KRITERIA_2>
- [ ] <KRITERIA_3>

Constraint:
- Stack: <SEBUTKAN, mis. "pakai shadcn/ui untuk UI, Prisma untuk DB">
- Tidak boleh: <SEBUTKAN, mis. "tambah dependency baru tanpa approval">

Langkah yang saya minta:
1. Baca file docs terkait, sebutkan apa yang akan kamu ubah/tambah (rencana dulu, jangan langsung code).
2. Tunggu saya approve rencananya.
3. Setelah approve: implement step-by-step, commit per logical chunk.
4. Update docs/<MODUL>.md sesuai pattern di _PATTERNS.md.
5. Kasih saya commands untuk test lokal.
```

**Tips**:
- **Paksa AI buat rencana dulu** sebelum code. Ini saring 80% kasus AI salah arah.
- Sebutkan `_PATTERNS.md` supaya AI tidak improvisasi format docs.
- Kalau fitur besar (>1 hari kerja), minta AI pecah jadi sub-task dan kerjakan satu-satu.

---

## Prompt 2: Fix bug dari user report

**Kapan pakai**: ada user lapor bug. Kamu sudah punya repro steps + error message.

**Template**:

```
Konteks: ada bug di proyek <NAMA_PROYEK>.

Laporan user:
> <COPY_PASTE_LAPORAN_USER>

Repro steps yang saya verifikasi:
1. <LANGKAH_1>
2. <LANGKAH_2>
3. Expected: <APA_HARUSNYA_TERJADI>
4. Actual: <APA_YANG_TERJADI>

Error message (kalau ada):
```
<PASTE_ERROR_LOG>
```

File yang saya curigai: <PATH_FILE> (kalau belum tahu, tulis "belum tahu").

Langkah:
1. Baca file terkait + docs/-nya.
2. Identifikasi root cause (jangan band-aid).
3. Jelaskan ke saya kenapa bug ini terjadi (bahasa awam).
4. Tawarkan fix - tunggu approval saya.
5. Implement fix + update docs kalau ada edge case baru yang ketemu.
6. Sarankan test case untuk prevent regresi.
```

**Tips**:
- **Jangan skip step 3** (jelaskan root cause). Kalau AI tidak bisa jelaskan kenapa bug terjadi, fix-nya cuma tebakan.
- Sertakan **error log lengkap**, jangan disingkat. Stack trace penting.
- Setelah fix, **tulis di `docs/<modul>.md` seksi "Catatan"** - supaya bug serupa tidak terulang.

---

## Prompt 3: SEO check sebelum deploy

**Kapan pakai**: sebelum push fitur baru ke production, mau pastikan SEO tidak rusak.

**Template**:

```
Konteks: saya mau deploy fitur baru ke production di proyek <NAMA_PROYEK> (Next.js).
Branch: <NAMA_BRANCH>.

File/route yang berubah:
- <PATH_1>
- <PATH_2>

Tolong cek SEO compliance:
1. Metadata: title, description, OG tags - ada & masuk akal?
2. Semantic HTML: h1 tunggal per page, hierarki heading benar?
3. Alt text di semua <img> / <Image>?
4. Internal linking: ada link ke page terkait?
5. robots.txt & sitemap.xml ke-update kalau ada route baru?
6. Lighthouse score estimasi (Performance, SEO, Accessibility) - prediksi kasar.
7. Core Web Vitals risk: ada gambar tanpa lazy load? Bundle size membengkak?

Kasih saya:
- Checklist hasil cek (centang/silang).
- Rekomendasi fix prioritas tinggi.
- File mana yang perlu di-edit (path + line number kalau bisa).
```

**Tips**:
- Jalankan ini **sebelum** PR merged, bukan setelah deploy.
- Kalau proyek belum punya `next-seo` atau sejenisnya, tanyakan AI apakah worth ditambah.
- Hasil ini bukan substitusi Lighthouse beneran - tetap jalankan tool real di staging.

---

## Prompt 4: Vercel deploy + preview test

**Kapan pakai**: PR sudah hijau, mau test di Vercel preview sebelum merge ke main.

**Template**:

```
Konteks: PR <URL_PR> sudah di-push, Vercel auto-generate preview deployment.
Branch: <NAMA_BRANCH>.
Preview URL: <URL_PREVIEW> (kalau sudah tahu, kalau belum: "belum dapat").

Tolong bantu:
1. Kalau preview URL belum ada, ajari saya cara cek di Vercel dashboard atau via gh CLI.
2. Generate test checklist berdasarkan diff PR ini:
 - User flow apa yang harus saya klik manual?
 - Edge case apa yang harus saya coba?
 - Form mana yang harus saya submit dengan input invalid?
3. Cek env vars: ada env baru yang belum di-set di Vercel preview?
4. Cek logs Vercel build - ada warning yang harus diperhatikan?
5. Setelah saya selesai test, bantu draft PR comment hasil test (pass/fail per item).
```

**Tips**:
- **Selalu test di preview** sebelum merge - main = production, tidak boleh broken.
- Kalau ada env var baru, **tulis di `docs/ENV_SETUP.md`** supaya teammate tahu.
- Untuk Railway/Render, prompt sama - ganti "Vercel" jadi platform-nya.

---

## Prompt 5: Review PR teman

**Kapan pakai**: kamu di-request review PR. Kamu butuh AI bantu nilai.

**Template**:

```
Tolong review PR ini: <URL_PR>

Konteks proyek: <NAMA_PROYEK>, stack <STACK>.
Baca dulu: docs/architecture.md, docs/_PATTERNS.md.

Fokus review:
1. Apakah acceptance criteria di issue (<URL_ISSUE> kalau ada) terpenuhi?
2. Bug obvious: null check, off-by-one, race condition, edge case input kosong/sangat besar?
3. Apakah docs/<modul>.md pendamping ter-update sesuai _PATTERNS.md?
4. Duplikasi kode: ada fungsi yang reinvent the wheel padahal sudah ada di utils?
5. Security: ada input user yang masuk ke DB tanpa validasi? SQL injection risk? XSS?
6. Performance: ada N+1 query? Loop di dalam loop yang bisa di-flatten?
7. Commit message: ikut Conventional Commits (feat:, fix:, docs:, refactor:, dll)?

Output:
- Verdict: APPROVE / REQUEST CHANGES / COMMENT.
- List concern dengan severity (HIGH / MED / LOW).
- Draft comment yang sopan untuk PR (kalau request changes).
```

**Tips**:
- **Verdict AI bukan final** - kamu yang submit review. Kalau ragu, baca sendiri + tanya teammate.
- Concern HIGH = wajib fix sebelum merge. MED/LOW = bisa follow-up PR.
- Selalu beri 1-2 positive note di comment - review yang sehat bukan cuma kritik.

---

## Prompt 6: Refactor code (DRY, reuse)

**Kapan pakai**: kamu nemu kode duplikasi atau fungsi yang terlalu panjang. Mau refactor tanpa break behavior.

**Template**:

```
Konteks: file <PATH_FILE> di proyek <NAMA_PROYEK>.
Masalah yang saya lihat: <DESKRIPSI, mis. "fungsi handleSubmit 200 baris, ada 3 blok validasi yang mirip">.

Goal refactor:
- Reduce duplication (DRY).
- Fungsi <100 baris idealnya.
- Behavior HARUS sama - tidak boleh ganti UX/output.
- Test (kalau ada) tetap hijau.

Langkah:
1. Baca file + docs terkait + file lain yang import dari file ini.
2. Identifikasi pola duplikasi.
3. Usulkan struktur refactor (extract function, custom hook, util, dll) - tunggu approve.
4. Setelah approve: refactor step-by-step, satu pattern per commit.
5. Update docs kalau API publik berubah.
6. Kasih saya cara verifikasi behavior tidak berubah (manual test steps atau diff snapshot).
```

**Tips**:
- **Refactor tanpa test = berbahaya**. Kalau belum ada test, minta AI bikin minimal smoke test dulu.
- **Satu refactor per PR**. Jangan campur refactor dengan fitur baru.
- Kalau setelah refactor file jadi lebih ribet, **revert**. Refactor tujuannya simplify.

---

## Prompt 7: Resolve merge conflict

**Kapan pakai**: `git merge` atau `git rebase` muncul conflict. Kamu tidak yakin cara resolve.

**Template**:

```
Konteks: saya ada merge conflict.
Branch saya: <NAMA_BRANCH> (mau merge ke <TARGET_BRANCH, biasanya main>).
Apa yang branch saya ubah: <DESKRIPSI, mis. "nambah field email ke form login">.
Apa yang main terbaru ubah: <DESKRIPSI, kalau tahu>.

File yang conflict:
- <PATH_1>
- <PATH_2>

Isi file 1 (dengan conflict markers):
```
<PASTE_FULL_FILE>
```

Isi file 2:
```
<PASTE_FULL_FILE>
```

Tolong:
1. Resolve tiap conflict, jelaskan kenapa kamu pilih versi tertentu (atau gabung keduanya).
2. Kasih saya file final tanpa markers.
3. Kalau ada conflict yang kamu tidak yakin - stop, tanya saya dulu, jangan tebak.
4. Setelah saya replace file, kasih commands git untuk finalize: add, commit, push.
```

**Tips**:
- **JANGAN auto-accept** tanpa baca penjelasan. Conflict = ada 2 perubahan yang sama-sama valid, kamu yang putuskan.
- **Verifikasi lokal** setelah resolve: `npm run dev`, klik flow yang kena. Jangan langsung push.
- File critical (auth, payment, DB schema) - minta senior review hasil sebelum push.

---

## Prompt 8: Setup MCP server baru

**Kapan pakai**: tim mau pakai layanan baru (mis. Sentry, Linear) dan ada MCP server-nya. Kamu mau setup di Claude Code lokal.

**Template**:

```
Konteks: saya mau setup MCP server untuk <NAMA_LAYANAN, mis. Sentry>.
OS saya: <Windows/Mac/Linux>.
Claude Code config file lokasi: <PATH, biasanya ~/.claude/config.json atau settings.json>.

Referensi resmi MCP server ini: <URL_DOKS_RESMI, kalau ada>.

Tolong:
1. Cari versi terbaru MCP server <LAYANAN> (npm package atau docker image).
2. Generate config JSON yang harus saya tambahkan ke Claude Code settings.
3. Sebutkan env vars yang saya butuhkan (token, URL endpoint, dll) + cara dapat token-nya.
4. Kasih perintah test untuk pastikan MCP terhubung (mis. tool call sederhana).
5. Update docs/MCP_SETUP.md proyek ini (kalau ada) supaya teammate lain tahu MCP ini standar tim.

Penting:
- Token JANGAN di-commit. Kasih saya cara simpan aman (env var lokal, password manager).
- Kalau ada langkah destruktif (override config existing), warn dulu.
```

**Tips**:
- Setelah setup, **test di sesi Claude baru** (restart Claude Code).
- Tambah ke `docs/MCP_SETUP.md` proyek supaya jadi standar tim.
- Kalau MCP baru ini worth dipakai semua proyek → PR ke kit `lintasAI`.

---

## Prompt 9: Migrate Vercel → Railway/Render

**Kapan pakai**: aplikasi butuh long-running process (background worker, websocket, cron heavy) yang tidak cocok di Vercel serverless. Mau migrate.

**Template**:

```
Konteks: proyek <NAMA_PROYEK> saat ini di-host di Vercel.
Mau migrate ke: <Railway/Render/lainnya>.
Alasan: <SEBUTKAN, mis. "butuh cron job tiap menit, Vercel serverless mahal untuk ini">.

Stack:
- Framework: <Next.js/Express/dll>
- DB: <Supabase/Postgres/dll>
- Env vars di Vercel: <LIST atau bilang "saya share .env.example">

Langkah yang saya minta:
1. Audit kompatibilitas: feature mana di code yang Vercel-specific (Edge Runtime, ISR, Image Optimization) dan harus di-adjust?
2. Generate config file untuk platform target (railway.json, render.yaml, atau Dockerfile).
3. Mapping env vars: yang mana harus pindah, yang mana berubah nama/format?
4. DB connection: ada pool config yang beda?
5. Build command + start command yang benar.
6. Cara test paralel: deploy ke platform baru dulu (subdomain test), Vercel jangan dimatikan sampai yakin.
7. DNS switchover plan: low-risk cara.
8. Update docs/architecture.md + buat ADR di docs/decisions/ tentang keputusan migrate ini.

Warn saya kalau ada step yang berisiko downtime.
```

**Tips**:
- **Parallel deploy dulu**, baru switch DNS. Jangan matikan Vercel sebelum platform baru terbukti stabil min. 1 minggu.
- **Bikin ADR** (lihat Prompt 10) supaya alasan migrate terdokumentasi.
- Untuk migration besar, **freeze fitur baru** dulu - jangan migrate sambil tambah feature.

---

## Prompt 10: Write ADR untuk decision teknis

**Kapan pakai**: tim mau buat keputusan teknis penting (pilih library, ganti arsitektur, migrate platform). Wajib didokumentasikan.

**ADR** = Architecture Decision Record. File `.md` pendek yang catat: konteks, pilihan yang dipertimbangkan, keputusan, konsekuensi.

**Template**:

```
Tolong bantu draft ADR untuk keputusan ini:

Konteks: <CERITAKAN_SITUASI, mis. "tim debate pakai Prisma vs Drizzle ORM">
Masalah yang mau diselesaikan: <APA>
Opsi yang sudah dipertimbangkan:
1. <OPSI_A>: kelebihan <...>, kekurangan <...>
2. <OPSI_B>: kelebihan <...>, kekurangan <...>
3. [<OPSI_C>: ...]

Keputusan tim: <OPSI_YANG_DIPILIH>
Alasan utama: <KENAPA>

Tolong:
1. Format ADR dengan template standar (Status, Context, Decision, Consequences).
2. Simpan di docs/decisions/<YYYY-MM-DD>-<slug>.md.
3. Bahasa Indonesia, junior-friendly - tim besok yang baca harus paham tanpa tanya.
4. Tulis Consequences dengan jujur: positive + negative + neutral.
5. Kalau ada follow-up action items, list di akhir.
6. Update docs/architecture.md seksi "Decisions" supaya link ke ADR baru ini.
```

**Tips**:
- ADR = **dokumen sejarah**. Sekali ditulis, jangan diubah - kalau keputusan berubah, bikin ADR baru yang "supersedes" yang lama.
- ADR pendek aja (1-2 halaman). Bukan novel.
- Wajib untuk: pilih library besar, ganti arsitektur, migrate platform, ubah DB schema mayor, decoupling/coupling antar service.

---

## Prompts untuk Workflow Chat-Driven Task (Hybrid S+M)

Tim Hybrid S+M pakai **chat (Slack/Discord/Telegram)** untuk distribusi task - tanpa GitHub Issue. 5 template di bawah standardisasi komunikasi owner ↔ staff.

---

## Prompt 11: Owner kirim task ke staff (chat-driven)

### Kapan pakai
Owner punya task baru, mau kirim ke staff via chat tanpa GitHub Issue.

### Template (paste ke channel chat)

```
[TASK] <deskripsi 1 kalimat>
[Acceptance Criteria]
  1. <criteria spesifik 1>
  2. <criteria spesifik 2>
  3. <criteria spesifik 3>
[Prioritas] <Rendah/Sedang/Tinggi>, target <kapan>
[Catatan] <reuse helper apa / referensi file mana>
[Risk Level] <Low / Medium / High>
   * Low = UI minor, copy edit, refactor internal
   * Medium = fitur baru self-contained, tidak sentuh data sensitif
   * High = sentuh auth/billing/schema-user-visible/destruktif/eksperimental → owner WAJIB hold merge
```

### Contoh

```
[TASK] Tambah tombol Export Excel di /admin/users
[Acceptance Criteria]
  1. Tombol muncul cuma untuk role=admin
  2. Klik = download file .xlsx berisi nama + email user aktif
  3. Loading state saat generate
[Prioritas] Sedang
[Target] Minggu ini
[Catatan] Reuse helper exportToExcel() di lib/exports.ts kalau ada
[Risk Level] Low - UI tambahan, tidak sentuh data sensitif
```

### Tips
- **Selalu isi `[Risk Level]`**. Paksa owner mikir risiko sebelum kirim task.
- **Acceptance criteria HARUS testable**. Hindari "yang penting jalan".
- Kalau task besar (>1 hari), pecah jadi beberapa task chat.
- **High Risk task**: owner siapkan extra time untuk smoke test prod setelah deploy. Lihat CLAUDE_TEAM_GUIDE.md section 7b.

---

## Prompt 12: Staff brief Claude untuk mulai task

### Kapan pakai
Staff IT terima task dari chat, mau brief Claude Code untuk eksekusi.

### Template

```
Saya kerja task ini: <paste isi prompt task dari chat>

Tolong:
  1. Sync main lokal: git checkout main && git pull
  2. Baca docs/architecture_auto.md + docs relevan
  3. Cek docs/feature-flags-decision-tree.md - task ini perlu flag atau tidak?
  4. Buat branch: feat/<deskripsi-singkat>
  5. Implement task sesuai acceptance criteria
  6. Update docs/<basename>.md pendamping (rule 7.1 AUTO-SYNC)
  7. Commit pakai Conventional Commits format
  8. Push + buat PR: gh pr create --fill

Tunggu approval saya tiap step.
```

### Tips
- **Step 1 (sync main) wajib** - jangan branch dari main stale.
- **Step 3 (cek decision tree) jangan di-skip** - verifikasi keputusan flag owner.
- **"Tunggu approval tiap step"** = penting untuk non-programmer.
- Kalau acceptance criteria ambigu → stop, balik chat ke owner.

---

## Prompt 13: Lapor owner setelah PR siap review

### Kapan pakai
Staff selesai push PR, Vercel preview hijau, semua AC ter-check.

### Template (paste ke chat)

```
PR siap review: <link PR>
Preview: <link Vercel>
Acceptance criteria sudah dicek:
  ✓ <criteria 1>
  ✓ <criteria 2>
  ✓ <criteria 3>
Catatan flag: <Tidak ada flag / Ada flag NEXT_PUBLIC_FF_NAMA, default false>
```

### Tips
- **Centang ✓ cuma yang sudah ditest beneran**.
- **Link preview Vercel WAJIB** - owner harus bisa klik & coba.
- Kalau ada criteria yang partially done: tulis "⚠ criteria 3 butuh konfirmasi: <pertanyaan>".

---

## Prompt 14: Owner brief Claude untuk rollback cepat (emergency)

### Kapan pakai
Bug parah ditemukan di prod sesaat setelah deploy. Mode emergency, no approval per step.

### Template

```
EMERGENCY: bug parah di prod commit terakhir.

Tolong:
  1. Konfirmasi commit terakhir di main: git log -1 main
  2. Revert: git revert HEAD --no-edit
  3. Push ke main: git push origin main
  4. Pantau Vercel deploy (2-5 menit), lapor saya kalau "Ready"
  5. Tulis post-mortem singkat: bug apa, kenapa lolos review, action item

Eksekusi langsung, no approval per step.
```

### Tips
- **Pakai HANYA dalam emergency beneran** (data corrupt, payment broken, auth bypass, prod down).
- **PRIMARY rollback**: `git revert HEAD && git push` → Vercel auto-deploy versi sebelumnya (~5 menit). Sesuai default workflow tim (staging-only, no feature flag - kit v1.0.0).
- **FALLBACK (kalau git revert gagal / butuh kecepatan ekstra)**: **Vercel Promote** - 1-click promote previous deployment dari Vercel Dashboard (~10 detik). Syarat: owner punya akses Vercel Dashboard. Langkah: buka project di Vercel → tab Deployments → cari deployment hijau terakhir sebelum bug → klik "⋯" → "Promote to Production". Tidak mengubah git history; commit buggy masih di main, jadi WAJIB follow-up dengan `git revert` setelahnya supaya next deploy tidak re-deploy bug-nya.
- **Post-mortem dalam 24 jam** - simpan di `docs/incidents/<YYYY-MM-DD>-<slug>.md`.
- Setelah revert sukses, **announce di channel** - staff harus tahu commit yang di-revert supaya tidak rebase ke commit yang sudah di-revert.

---

## Prompt 15: Activate Feature Flag Mode (Post-Launch Per Project)

### Kapan pakai

Project sudah launch resmi (post-MVP), mulai punya user aktif, butuh feature flag untuk fitur risiko tinggi (auth/billing/destruktif/eksperimental). Sebelum launch - pakai workflow staging-only default (Risk Level decision tree di CLAUDE_TEAM_GUIDE.md section 7b).

**JANGAN aktifkan flag mode di project early-stage (<50% progress)** - premature optimization, bikin maintenance overhead tanpa value.

### Template (paste ke Claude Code di project yang siap launch)

```
Aktifkan feature flag mode di proyek ini karena product sudah launch.

Tolong:
1. Read .claude-kit/templates/feature-flags-advanced.md untuk reference lengkap.
2. Generate docs/feature-flags-decision-tree.md di proyek ini - slim version (1 halaman) yang berisi:
   - 5 kriteria PAKAI FLAG (auth/billing/schema-user-visible/destruktif/eksperimental)
   - 5 kategori BRANCH ONLY cukup (copy edit/styling/bugfix kecil/refactor internal/dokumentasi)
   - Tabel contoh per project ini (cocokkan dengan domain proyek nyata)
3. Update docs/architecture.md project: tambah subsection "Feature Flag Strategy" di section "Deployment & Release Strategy". 
   Sebut flag wajib pakai prefix NEXT_PUBLIC_FF_<AREA>_<NAMA>.
4. Update AGENTS.md project: tambah link ke docs/feature-flags-decision-tree.md di section "Workflow & Komunikasi Task".
   Tambah baris baru: "Feature flag aktif sejak <tanggal>. Sebelum: staging-only via Vercel preview."
5. Generate .env.example.flags template (jangan replace .env.example yang ada):
   - Comment template untuk NEXT_PUBLIC_FF_BILLING_NEW_PRICING=false
   - Comment template untuk flag area lain yang relevan ke domain project
6. Update PROMPT_LIBRARY.md Prompt 11 (Owner kirim task) - tambah field [Flag?] kembali di template prompt task
   (sebelumnya di-strip karena pre-launch). Format:
   "[Flag?] <Tidak - branch only / Ya - sebut kriteria mana dari decision tree>"

Lapor ke saya:
- Tunjukkan diff yang akan apply (semua 6 step)
- Tunggu approval saya sebelum commit
- Setelah saya approve, lanjutkan dengan:
  a. Commit + push di branch chore/activate-feature-flags
  b. Buka PR untuk owner review
  c. Reminder di body PR: "Setelah merge, owner setup env var NEXT_PUBLIC_FF_* di Vercel dashboard"

Eksekusi step 1-6 dulu, jangan langsung commit. Tunggu approval saya.
```

### Tips

- **JANGAN aktifkan di multiple project sekaligus**. Per project basis - tiap project punya domain risiko beda.
- **Setelah aktif**, Risk Level decision tree (CLAUDE_TEAM_GUIDE.md 7b) tetap berlaku - flag = layer extra untuk High Risk task, bukan pengganti.
- **Cleanup ritual** wajib jalankan: flag yang sudah 2 minggu stabil di prod → bikin PR hapus (lihat feature-flags-advanced.md section "Cleanup Ritual").
- **Reminder owner**: setelah staff merge PR aktivasi flag mode, owner harus **manual setup env var** `NEXT_PUBLIC_FF_*` di Vercel dashboard (default `false`). Staff tidak punya akses Vercel = owner bottleneck di sini, tapi cuma sekali per flag.

### Cara Deaktivasi (Kalau Owner Mau Balik ke Staging-Only)

Kalau aktivasi flag mode ternyata terlalu kompleks untuk team, paste prompt deaktivasi:

```
Deaktivasi feature flag mode di proyek ini.

Tolong:
1. Buka PR baru chore/deactivate-feature-flags
2. Hapus docs/feature-flags-decision-tree.md
3. Revert update di docs/architecture.md (hapus subsection Feature Flag Strategy)
4. Revert AGENTS.md (hapus link feature-flags-decision-tree, tambah note: "Flag mode dideaktivasi <tanggal>. Balik ke staging-only.")
5. Hapus .env.example.flags
6. Cek kode: ada `process.env.NEXT_PUBLIC_FF_*` yang masih aktif? Lapor list, jangan langsung hapus (butuh diskusi owner per flag).
7. Owner manual hapus env var di Vercel dashboard setelah PR merged.

Lapor diff dulu, tunggu approval.
```

---

## Prompt 16: Audit Komprehensif Pasca-Setup (dengan Analogi Non-Programmer)

**Kapan pakai**:
- Setelah `JALANKAN_KIT.md` selesai (bulk-bootstrap docs sudah jadi, AI sudah load context lengkap → audit hasilnya akurat).
- Owner brief: "audit project", "review codebase", "scan menyeluruh", "cari bug + refactor opportunity", "ready hire staff?", "siap onboarding belum?"
- Setelah refactor besar - verify behavior unchanged + identify regression risk.
- Periodik tiap kuartal - track tech debt + improvement trend.

**Template (atau langsung paste isi `AUDIT_POST_SETUP_PROMPT_v1.md`)**:

```
Tolong jalankan AUDIT KOMPREHENSIF di proyek ini, READ-ONLY, dengan ANALOGI NON-PROGRAMMER di setiap finding.

Workflow:
1. Pre-audit verify: AGENTS.md ada, docs/architecture_auto.md ada, .claude-kit/ ada.
2. Read landscape: docs/architecture.md + docs/architecture_auto.md + memory project-*.
3. Workflow tool 8 paralel auditor (refactor / security / qa-test / database / devops / performance / docs-gap / onboarding).
4. Adversarial verify per finding (default is_real=false kalau tidak 100% yakin).
5. Synthesize ranked 3 tier (low → high risk_of_introducing_bug).
6. Translate tiap finding ke format dengan analogi non-programmer (CLAUDE_universal_v1.md section 4.4 style guide).
7. Tahap execution plan: Tahap 0 urgency → Tahap 1 quick wins → Tahap 2 test foundation → Tahap 3 medium → Tahap 4+ HIGH RISK.

Output WAJIB untuk tiap finding:
- 📖 Analogi (kantor / lemari arsip / ATM / tukang pos / brankas)
- 🎯 Kenapa penting (1-2 kalimat awam, no jargon)
- 🛠 Fix pointer (file/line + langkah kasar)
- ⏱ Effort · 🚦 Severity · ⚠ Risk merusak system

Status default: READONLY. Popup #1 di akhir scan: pilih tier mau ditampilkan (1/2/3/4 default). Popup #2 setelah display: lanjut Tahap 0 / write report ke docs/decisions/ / pick item / stop.

Detail lengkap workflow: .claude-kit/AUDIT_POST_SETUP_PROMPT_v1.md
```

**Tips**:
- **Auto-trigger setelah JALANKAN_KIT.md Step 17/18** (Popup #3 conditional). Kalau owner Enter / "y" → audit langsung jalan.
- **Analogi adalah bagian INTI**, bukan tambahan opsional. Tanpa analogi, audit ini = audit programming biasa (sudah banyak tools). Yang bikin lintasAI beda: staff IT non-programmer bisa BACA finding-nya dan PAHAM kenapa penting.
- **Adversarial verify** cegah halusinasi. Sesi sebelumnya pernah 95 confirmed / 103 raw (~8% false positive rate). Acceptable.
- **Tahap 0** = stop-bleeding priorities (mis. backup workflow target salah, pelanggaran isolation, secret leak risk). Fix dalam 30 menit, prevent bleeding pertama.
- **Tahap 1** = quick wins zero behavior change (~6-8 jam). Cocok 1-2 hari kerja.
- **Tahap 2 = TEST FOUNDATION WAJIB** sebelum Tier 2/3 refactor. Tanpa test, refactor brankas mata tertutup.
- **Tier 3** = HOLD MERGE. Paired review, smoke test prod 5+ menit, branch protection ON.
- Format output cocok untuk di-track di `docs/decisions/<YYYY-MM-DD>-audit-findings.md`.

### Mapping Intent Staff → Pattern Audit

Staff non-programmer chat natural language. AI auto-route ke audit dimensi fokus:

| Intent staff | Pattern audit |
|---|---|
| "audit project", "review codebase", "scan menyeluruh" | Audit penuh 11 dimensi |
| "ada bug?", "apa yang salah?", "cari masalah" | Audit fokus security + qa |
| "perbaiki performa", "apa yang lambat?", "lemot" | Audit fokus database + performance |
| "ready hire staff?", "siap onboarding?", "Day 0 prep" | Audit fokus onboarding + docs gap |
| "refactor codebase", "DRY", "extract helper", "code messy" | Audit fokus refactor |
| "compliance check", "audit log gap" | Audit fokus security (audit log dimension) |

---

## Prompt 17: Update Kit dengan Auto-Classify Tier (Pattern-Driven)

> Library reference untuk intent staff "update kit". AI baca pattern ini lalu jalanin workflow di `UPDATE_KIT_PROMPT_v1.md`. Bukan tutorial - kalau butuh panduan langkah demi langkah, lihat `docs/UPDATE_GUIDE.md`.

### Kapan dipakai

AI route ke pattern ini kalau staff chat dengan intent salah satu dari:

- "ada versi baru kit nggak?"
- "update kit dong"
- "lintasAI v1.2.0 udah rilis, update ke versi terbaru"
- "kit ku ketinggalan zaman, sync ke main"
- "update tapi jangan hapus customization gue"
- "tadi update keliatannya gagal, balikin"
- "cek changelog kit, ada apa aja yang baru"

Intent natural Bahasa Indonesia dari staff non-programmer = trigger. Staff TIDAK perlu hafal nama prompt atau path script - AI yang nge-detect intent → pilih pattern → eksekusi.

### Template prompt

Isi lengkap ada di `./.claude-kit/UPDATE_KIT_PROMPT_v1.md`. Singkatnya AI jalanin step:

1. **Fetch CHANGELOG remote** (git ls-remote / GitHub raw) → bandingin vs `./.claude-kit/CHANGELOG.md` lokal.
2. **Auto-classify tier** per entry baru:
   - Tidak ada label → **Tier 1** (silent) atau **Tier 2** (auto-sync), AI baca konteks deskripsi.
   - Label `[BREAKING]` → **Tier 3**.
   - Label `[SCAN-REQUIRED]` → **Tier 4**.
3. **Compose summary** ke staff: ringkasan + analogi tools populer + action item yang dibutuhin.
4. **Konfirmasi** (skip kalau user mode auto-confirm Y/N - lihat `feedback_auto_confirm.md`).
5. **Eksekusi** via `./.claude-kit/kit.ps1 update` (yang internal manggil `update-kit.ps1`).
6. **Post-update**: kalau Tier 4 → minta staff paste `JALANKAN_KIT.md` ulang. Kalau Tier 3 → AI baca section "Migration Steps" inline di CHANGELOG dan eksekusi. Kalau Tier 1/2 → done.

### Tips

- **Staff non-programmer**: chat natural cukup ("update kit dong"). AI auto-route ke pattern ini. Staff nggak perlu tau apa itu PowerShell, sha256, atau manifest.
- **Power user** (dev kit-aware): bisa skip AI orchestration, langsung `./.claude-kit/kit.ps1 update` di terminal. Output structured + tier label langsung muncul.
- **CI/automation**: `kit.ps1 update --json` (atau bash wrapper di repo) buat ngehasilin exit code + JSON report. Cocok buat GitHub Actions cek drift kit antar proyek tim.
- **Customization preservation**: staff sering takut "update bakal hapus AGENTS.md yang udah gue isi". Tenangin pakai analogi: "Kayak update WhatsApp - chat lo nggak ilang, cuma app-nya yang di-refresh." Mekanisme aslinya = manifest sha256 diff (file yang lo modif diketahuin AI lewat hash, otomatis di-skip dari overwrite).
- **Rollback ada safety net**: `update-kit.ps1` taro backup di `./.claude-kit.backup-<timestamp>/`. Auto-cleanup file `.bak` > 30 hari + simpan max 3 backup terakhir. Analogi: kayak Google Drive version history - bisa balik ke versi sebelumnya, tapi nggak nyimpen 100 versi (boros disk).

### Mapping intent → sub-pattern

| Intent staff (natural)                          | Pattern yang AI jalanin                                              |
|-------------------------------------------------|----------------------------------------------------------------------|
| "ada versi baru?" / "cek changelog"             | UPDATE_KIT_PROMPT step 1-3 doang (cek + summary, **stop sebelum eksekusi**). |
| "update kit" / "sync ke versi terbaru"          | Full workflow step 1-6.                                              |
| "rollback" / "update tadi gagal, balikin"       | Rollback flow: cari folder `.bak-<timestamp>` terbaru → restore → verify. |
| "update tanpa hapus customization gue"          | Full workflow + highlight manifest sha256 protection di summary (analogi: "kayak Notion sync - page yang lo edit lokal nggak ke-replace versi server"). |
| "kit ku versi berapa?"                          | Baca `./.claude-kit/CHANGELOG.md` line pertama → report ke staff.    |

### Contoh output AI (skenario Tier 2 update)

Staff: "lintasAI v1.0.1 udah rilis kayanya, update dong"

AI (setelah fetch CHANGELOG + classify):

> Update **v1.0.0 → v1.0.1**: 3 perbaikan ringan + 1 aturan AI baru.
>
> **Tier 2** (kayak iPhone iOS 17.3 → 17.4 minor - fitur baru aktif setelah restart, nggak butuh migration paksa).
>
> **File berubah**: `setup-pola-b.ps1`, `CLAUDE_universal_v1.md`, `ANALOGI_LIBRARY.md`
> **File preserved** (anti-overwrite via sha256 manifest): `AGENTS.md` + 77 docs companion lo.
>
> **Action setelah update**: TIDAK ADA. AI sesi berikutnya auto-pakai aturan baru (analogi: kayak Tokopedia ngubah algoritma pencarian - lo nggak perlu ngapa-ngapain, next time buka app udah pake versi baru).
>
> Lanjut update sekarang? (auto-yes karena mode auto-confirm aktif → eksekusi `kit.ps1 update`...)

### Cross-reference

- **Panduan lengkap update** (langkah, screenshot, troubleshooting): `docs/UPDATE_GUIDE.md`
- **Aturan AI route intent → pattern**: `./.claude-kit/CLAUDE_universal_v1.md` section 4.5
- **Audit post-setup pattern** (referensi tier classification origin): `./.claude-kit/CLAUDE_universal_v1.md` section 4.4
- **Analogi library** (kalau butuh nambah analogi tools populer di summary): `./.claude-kit/templates/ANALOGI_LIBRARY.md`
- **Backup retention policy detail**: `./.claude-kit/update-kit.ps1` (header comment)
- **Manifest sha256 logic** (preservation file user-modified): `./.claude-kit/uninstall.ps1` (shared dengan update flow)

---



---

## Customization: tambahkan prompt kamu

File ini **bukan list final**. Tim ini hidup dari iterasi pattern. Kalau kamu nemu prompt yang berulang kali work di proyek-proyek kamu - worth dishare.

### Cara contribute prompt baru:

1. **Validasi dulu**: prompt ini sudah kamu pakai min. 3 kali di kasus berbeda dan hasil konsisten bagus?
2. **Fork repo kit** `github.com/ojokesusu/lintasAI`.
3. **Tambah prompt** di file ini, ikuti format yang sama (nama → kapan pakai → template → tips).
4. **PR dengan judul** `prompt: <nama prompt baru>`.
5. **Body PR jelaskan**:
 - Kapan kamu temukan pattern ini?
 - Kasus apa saja yang sudah pakai?
 - Output sebelum vs sesudah pakai prompt ini.
6. Maintainer kit review, kalau approve → merged → tim semua proyek bisa pakai.

### Yang TIDAK boleh masuk PROMPT_LIBRARY:

- Prompt super spesifik proyek tertentu (mis. "prompt untuk feature X di proyek Y"). Itu simpan di `docs/` proyek masing-masing.
- Prompt yang cuma work di 1 model AI tertentu (tim ini default Claude Code, tapi prompt harus relatif portable).
- Prompt yang butuh secret/token hardcoded.

---

## Penutup

Ingat: **prompt yang baik = konteks yang lengkap + instruksi yang jelas + constraint yang eksplisit**. Template di sini sudah cover 3 elemen itu. Tugas kamu: isi placeholder dengan jujur, jangan skip detail karena buru-buru.

---

## Prompt 18: Split Repo Migration

Untuk owner yang mau migrate monorepo -> 3 repo split (default) atau 4 repo (opt-in untuk tools):

Trigger: paste isi SPLIT_REPO_MIGRATION_PROMPT_v1.md
Output: AI analyze + propose plan + execute step-by-step
Effort: 4-6 minggu owner-side

Lihat detail di `SPLIT_REPO_MIGRATION_PROMPT_v1.md` (di root kit / `.claude-kit/`).

## Prompt 19: AGENTS.md Deploy per Repo

Untuk owner: deploy AGENTS.md template ke 3 repo split (default) atau 4 repo (opt-in untuk tools).

Trigger: setelah split repo done, prompt AI: "deploy AGENTS.md template dari lintasAI/templates/SPLIT_REPO_AGENTS_TEMPLATES.md ke <project>-frontend, <project>-backend, <project>-shared (+ <project>-tools kalau opt-in tools repo)"

Output: AI customize template dengan project name, deploy ke masing-masing repo.

## Prompt 20: Non-Programmer Cheatsheet Print

Untuk staff non-programmer:

Trigger: Owner buka `templates/SPLIT_REPO_NON_PROGRAMMER_PROMPTS.md` (atau `docs/SPLIT_REPO_NON_PROGRAMMER_PROMPTS.md` setelah deploy)
Output: Print + tempel di monitor staff
Content: Format prompt yang baik vs buruk, FAQ non-programmer, cross-team coordination

---

## Prompt 21: Adversarial Verify Claim (Anti-Halusinasi untuk Klaim Kritis)

**Kapan pakai**:
- Klaim "security sudah benar", "config sudah aktif", "test coverage sudah cukup"
- Hasil audit (seksi 4.4) — verify per finding apakah real bug atau false positive
- Sebelum decision destruktif (mis. "tabel X bisa di-drop" → benarkah tidak ada code yang pakai?)
- Sebelum lapor stakeholder ("fitur X sudah secure" — verify dulu sebelum bilang)
- Saat staff non-programmer punya klaim yang dia tidak yakin (mis. "developer bilang ini sudah fix, tapi aku tidak yakin")

**Filosofi**: Biasanya AI cenderung **mengiyakan user** (bias suka-menolong). Mode kritis = **sengaja meragukan dulu** (bias skeptis). Untuk klaim penting, lebih baik skeptis daripada asal setuju.

**Template**:

```
Tolong adversarial verify klaim berikut:

KLAIM: <isi klaim yang mau di-verify, mis. "fitur tracking pesanan sudah secure dari IDOR">

KONTEKS:
- File terkait: <list file, mis. src/app/api/orders/[id]/route.ts>
- Sumber klaim: <siapa yang klaim — owner / developer / hasil scan / asumsi>
- Stakes: <berapa user / record kena dampak kalau klaim salah>

INSTRUKSI:
1. Default mode: SKEPTIC (anggap klaim BERPOTENSI SALAH sampai terbukti benar)
2. List 5-7 cara klaim ini bisa SALAH (failure modes / bypass / edge cases)
3. Untuk tiap failure mode, cek apakah project ini vulnerable:
   - Read file relevan
   - Grep keyword yang relevan
   - Run test kalau bisa — HANYA yang cuma-baca / di lingkungan uji (staging). DILARANG menjalankan apa pun yang mengubah data/sistem produksi (SQL ubah data, edit file live). Verifikasi = baca + nalar, bukan eksekusi ke data nyata.
4. Hasil cek tiap kemungkinan-salah: TERBANTAH / TERBUKTI-BENAR / BUTUH-INFO-LEBIH
5. Kesimpulan akhir: klaim ini BENAR-ADA atau CUMA-ALARM-PALSU?
   - Default anggap "belum terbukti" kalau ada 1+ poin BUTUH-INFO-LEBIH yang belum terjawab
   - Klaim TERBUKTI-BENAR kalau semua kemungkinan-salah berhasil TERBANTAH dengan bukti file:baris

OUTPUT FORMAT (ke user — pakai istilah Indonesia ini, BUKAN jargon "verdict/refuted/confidence"):
- 📋 Klaim
- 🎯 Kemungkinan-salah (5-7 cara klaim ini bisa keliru)
- 🔍 Hasil cek tiap kemungkinan (bukti file:baris)
- ⚖️ Kesimpulan akhir + seberapa yakin (tinggi/sedang/rendah)
- 📖 Analogi non-programmer untuk jelaskan ke owner/staff

JANGAN perhalus kesimpulan cuma biar AI terdengar membantu. Lebih baik jujur "belum yakin, perlu info X" daripada "kemungkinan aman".
```

**Workflow dengan Workflow tool** (untuk audit besar):

Untuk klaim besar (mis. seluruh fitur audit), pakai pattern multi-agent adversarial:

```javascript
// 3 skeptik dengan lens berbeda
const verdicts = await parallel([
  () => agent("Sangkal klaim via lens SECURITY: cari bypass auth, IDOR, race condition", {schema: VERDICT}),
  () => agent("Sangkal klaim via lens DATA INTEGRITY: cari kondisi yang corrupt data, partial write", {schema: VERDICT}),
  () => agent("Sangkal klaim via lens USER EXPERIENCE: cari edge case input yang break", {schema: VERDICT}),
])
// Klaim survive kalau >=2 dari 3 REFUTE attempt fail
const survives = verdicts.filter(v => !v.refuted).length >= 2
```

> Catatan: kode di atas cuma ilustrasi mekanisme **internal**. Ke user JANGAN sebut "verdict / agent / parallel / refuted / survive" — cukup bilang "aku cek klaim ini dari 3 sudut (keamanan, keutuhan data, pengalaman pakai) dan hasilnya ...".

**Tips**:
- **JANGAN skip adversarial untuk klaim kritis** walau klaim datang dari senior dev atau owner. Identitas sumber tidak override evidence.
- **NEED MORE INFO bukan kelemahan, itu fitur**. AI yang bilang "perlu info X" lebih trustworthy daripada AI yang force verdict tanpa bukti.
- **Output WAJIB ada analogi non-programmer** supaya owner/staff IT bisa baca verdict tanpa ngerti jargon security.
- **Cocok dipasangkan dengan Prompt 16 (Audit)** — audit menemukan finding, Prompt 21 verify tiap finding apakah real atau false positive.

### Mapping Intent Staff → Pattern Adversarial

| Intent staff | Pattern apply |
|---|---|
| "developer bilang X sudah fix tapi aku tidak yakin" | Prompt 21 verify klaim X |
| "scan ini bilang ada bug, beneran?" | Prompt 21 verify finding (adversarial agent challenge) |
| "yakin tidak ada yang pakai tabel ini? mau di-drop" | Prompt 21 verify "tidak ada yang pakai" claim |
| "owner bilang fitur ini sudah secure" | Prompt 21 verify security claim dengan lens IDOR + rate-limit + auth bypass |
| "aku takut salah klik, beneran aman?" | Prompt 21 verify rollback path + blast radius |

## Prompt 22 — Staff Onboarding Day 0 (PBN-style End-to-End)

> Pattern: paste prompt ini ke Claude Code Desktop saat staff baru pertama kali clone project lintasAI-equipped. AI auto-orchestrate dari clone -> setup -> first task -> first PR -> first preview. Berbasis lessons learned dari PBN-monitor staff onboarding (v1.5.6).

### Trigger (kapan pakai)

- Staff IT non-programmer baru join tim, baru clone repo, belum pernah pakai lintasAI.
- Owner brief: "ada staff baru besok, bantu onboarding day 0".
- Self-paste: staff baru paste prompt ini saat buka chat pertama kali.

### Prompt template (copy-paste ke Claude Code chat)

```
Halo, aku staff IT baru di project ini. Hari ini Day 0 onboarding.

Tolong pandu aku step-by-step pakai pattern "Guided Step-by-Step" dari
CLAUDE_universal_v1.md section 4.3 — dengan urutan ini:

PHASE 0 — Environment Sanity Check (v1.5.6 hardening)
  0.1  Verify Claude Code DESKTOP (bukan Web) — kalau Web, kasih link
       https://claude.ai/download dan STOP.
  0.2  Verify platform = Windows (lintasAI v1.x Windows-only).
  0.3  Verify stack project = Node.js via Get-StackType di
       .claude-kit/lib/project-detect.ps1. Kalau bukan Node (Python/Go/Rust/Ruby/PHP),
       STOP dengan pesan jelas + link issue cross-stack.
  0.4  Verify project sudah `git init` (cek .git/ folder). Kalau belum,
       tawarkan pre-flight Fix #1: [1] auto init / [2] skip + global identity /
       [3] cancel.
  0.5  Detect package manager via Get-PackageManager — tampilkan ke staff:
       "Install pakai: <pnpm install / yarn install / bun install / npm install>"
       supaya tidak salah ketik.
  0.6  Detect branch protection via Test-MainBranchProtected (setup-pola-b.ps1) — kalau main
       protected, surface "pakai pattern branch + PR" sejak awal.

PHASE 1 — Foundation Verification (auto, ~30 detik)
  Cek 36 file kit lengkap di .claude-kit/, AGENTS.md sudah ter-fill (bukan
  template placeholder), docs/ skeleton ada, .github/workflows/ai-review.yml ada.

PHASE 2 — Pre-Work Reading (Day 0, sekali pakai)
  2.1  Baca docs/GLOSSARY_NON_PROGRAMMER.md (15 menit).
  2.2  Baca docs/SECURITY_INCIDENT_PLAYBOOK.md focus "6-Step Procedure" (5 menit).
  2.3  Baca KLARIFIKASI TERMINOLOGI POPUP di JALANKAN_KIT.md (Tipe A = popup
       dalam chat: kotak klik kalau tersedia, teks ketik-angka kalau tidak;
       Tipe B = jendela Windows terpisah) — supaya tidak salah expect window
       Windows muncul terpisah saat Popup #1/#2/#3 di chat.
  2.4  Quiz 3 pertanyaan:
       (a) Apa beda Popup Tipe A vs Tipe B?
       (b) Kalau token DB bocor, langkah pertama apa?
       (c) Apa itu Risk Level Low/Medium/High dari section 7b CLAUDE_TEAM_GUIDE?

PHASE 3 — Project Context Loading (auto, ~30 detik)
  Baca AGENTS.md + docs/architecture.md + docs/architecture_auto.md +
  docs/glossary.md. Briefing 3-5 kalimat ke staff: stack, domain, status
  progress, focus minggu ini, package manager terdeteksi, branch protection
  status.

PHASE 4 — Environment Setup (stack-aware)
  4.1  Konfirmasi owner sudah DM password DB + .env values.
  4.2  Run install pakai package manager DETECTED (BUKAN hardcode `npm install` —
       pakai output Get-PackageManager.InstallCmd).
  4.3  Setup .env.local dari .env.example (WAJIB cek extension bukan .env.local.txt).
  4.4  npx prisma generate (skip kalau bukan Prisma project — detect via
       prisma/schema.prisma exists).
  4.5  Run dev server pakai DETECTED RunCmd. Verify localhost:3000 load di
       browser.

PHASE 5 — First Task (test workflow end-to-end)
  Tanya staff: [A] Latihan micro-task dari owner / [B] Langsung real task.
  - Variant A: minta owner kirim micro-task (fix typo / ganti tahun copyright).
  - Variant B: staff brief task dari owner.

  Eksekusi pattern adaptive (berdasarkan Phase 0.6):
  - main TIDAK protected:
      git add ... && git commit ... && git push
  - main PROTECTED:
      git checkout -b chore/<slug>
      git add ... && git commit ...
      git push -u origin chore/<slug>
      gh pr create --fill
  - Verify Vercel preview URL muncul di komentar PR (tunggu 2-3 menit).
  - Lapor owner di channel chat: "PR siap review: <link>, preview: <link>".

PHASE 6 — Closing
  Daily work rules summary (5 aturan harian + standby message).

Tone: friendly mentor senior dev. Bahasa Indonesia ramah, tidak formal kaku.
Tiap step substantive tutup dengan Tinjauan lintasAI Divisi (banyak lensa
divisi, 2 sudut pandang: programmer + non-programmer) kalau relevant (section 4.1 CLAUDE_universal_v1.md).

Auto-confirm mode AKTIF untuk Y/N (assume YES). Untuk destructive ops
(rm -rf, DROP TABLE, git push --force) TETAP wajib konfirmasi (section 14
exception).

Mulai dari Phase 0.1 sekarang.
```

### Output yang diharapkan

- AI auto-detect Desktop/Web, platform, stack, git init, package manager, branch protection.
- AI guide staff lewat Phase 0-6 dengan wait-for-confirm pattern.
- Staff selesai Day 0 dengan: env setup OK + 1 PR merged + 1 preview verified + paham 2 sistem popup.

### Cross-reference

- `CLAUDE_universal_v1.md` section 4.3 (Guided Step-by-Step Pattern)
- `JALANKAN_KIT.md` Klarifikasi Terminologi Popup (Fix #6 v1.5.6)
- `lib/project-detect.ps1` Get-StackType + Get-PackageManager
- `setup-pola-b.ps1` Test-MainBranchProtected (branch protection check)
- `setup-pola-b.ps1` pre-flight .git check (Fix #1 v1.5.6)
- `bin/lintasai.js` Desktop/Web detection (Fix #4 v1.5.6)

### Risk Level

Low — read-only orchestration. AI cuma read file + spawn user-approved commands. Tidak modify project state tanpa per-step confirm.

---

Selamat prompting.
