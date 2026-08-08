# Security Incident Playbook - Untuk Staff IT Non-Programmer

> Wajib baca **sebelum** mulai kerja task pertama.
> File ini cuma dipakai saat **ADA SIGNAL** keamanan. Tidak perlu di-eksekusi rutin.

---

## 🚨 Kapan Playbook Ini Dipakai?

Pakai langkah di bawah kalau kamu lihat **salah satu** signal berikut:

| Signal | Sumber | Contoh |
|---|---|---|
| 🚨 Email "Secret Detected" | GitHub | *"GitGuardian detected token in commit abc123 by @bagus"* |
| 🚨 AI Reviewer warning di PR | `.github/scripts/ai-review.cjs` | Comment: *"⚠️ Possible token leak at line 42: pattern matches `sk-ant-`"* |
| 🚨 Email anomaly | Vercel / Supabase / Anthropic | *"Unusual usage spike detected: 5000 requests in last hour from IP X"* |
| 🚨 File `.env.local` muncul di `git status` | Terminal lokal | `git status` show `.env.local: untracked` - tapi seharusnya di `.gitignore` |
| 🚨 Token ter-paste tidak sengaja | Channel chat tim, screenshot | Tanpa sengaja kamu/teman paste isi `.env.local` di Slack/Discord |
| 🚨 Akses tidak diakui | Email "New device login" | *"Login dari IP 1.2.3.4 di Russia"* - bukan kamu |

**TIDAK termasuk security incident**:
- Bug kode biasa (pakai workflow PR normal)
- Performance issue (DB slow, halaman lambat)
- UI typo

---

## 🛡️ Pencegahan (paling murah): pasang penjaga rahasia di laptop

Lebih baik **mencegah** rahasia bocor daripada membersihkannya setelah telat. Kit punya
**penjaga pre-commit** (opt-in) yang menolak commit kalau ada file `.env` asli / isi mirip
kunci API - **sebelum** terkirim ke server (saat itu rahasia belum bocor ke mana pun).

Pasang sekali per project: minta AI **"pasang penjaga rahasia pre-commit"**, atau jalankan:

```powershell
.\.claude-kit\templates\hooks\install-secret-hook.ps1
```

Setelah aktif: kalau kamu tak sengaja `git commit` file `.env`, commit **otomatis ditolak** +
diberi tahu cara perbaikinya (nilai rahasia TIDAK ditampilkan demi keamanan). Darurat / alarm
palsu: `git commit --no-verify`. Penjaga ini = lapis lokal; di server tetap ada `secret-guard.yml`.

---

## 📞 Step-by-Step (URUTAN WAJIB - Jangan Skip)

### Step 1 - STOP coding sekarang juga (10 detik)

Jangan commit, jangan push, jangan close terminal. Biarkan semua state apa adanya.

**Kenapa**: kalau token bocor, tiap detik = window untuk attacker pakai token. Tapi kamu juga jangan rush - tindakan salah bisa hapus jejak forensik.

### Step 2 - JANGAN buka channel chat publik (30 detik)

Token bocor itu **sensitive info**. Jangan:
- ❌ Post di `#tasks-akses` (semua staff lihat + screenshot bisa)
- ❌ Reply thread PR yang affected (token mungkin keulang di reply)
- ❌ Email "to all" - multiplier risk

### Step 3 - DM Owner LANGSUNG (1 menit)

Kirim **DM private** ke owner dengan template ini:

```
🚨 SECURITY ALERT

Signal: <tempel email/screenshot/copy text exact yang trigger>
Sumber: <GitHub Secret Scanning / AI Reviewer / email Vercel / dll>
PR/commit terkait: <link kalau ada>
Waktu deteksi: <jam>

Status: saya STOP coding, nunggu instruksi.
```

Contoh:
```
🚨 SECURITY ALERT

Signal: Email GitHub "GitGuardian detected token in commit 7f8a9d2"
Sumber: GitHub Secret Scanning
PR/commit terkait: https://github.com/ojokesusu/akses/pull/42
Waktu deteksi: 14:23 WIB

Status: saya STOP coding, nunggu instruksi.
```

### Step 4 - Tunggu instruksi owner (max 30 menit)

Owner akan eksekusi salah satu (kamu tidak perlu lakukan ini sendiri):
- **Rotate (ganti) token yang bocor** -- buat token baru, token lama langsung dimatikan supaya tak bisa dipakai lagi
- **Force-push history rewrite** kalau token sudah di-commit ke main (cuma owner punya akses)
- **Audit log** Vercel/Supabase - cek ada akses tidak sah selama window bocor?
- **Update env var** di semua environment (Production, Preview, Development)

### Step 5 - Setelah owner kasih sinyal AMAN

Owner DM kamu: *"Resolved. Token sudah di-rotate. Kamu boleh lanjut coding."*

Lakukan:
1. Pull `main` terbaru (kalau history di-rewrite, force-pull diperlukan)
2. Update `.env.local` lokal dengan token baru (owner kirim via DM)
3. Lanjut task yang tadi di-pause

### Step 6 - Post-Mortem (dalam 24 jam)

Owner / kamu tulis post-mortem di `docs/incidents/<YYYY-MM-DD>-<slug>.md`:

```markdown
# Incident: Token Anthropic bocor di PR #42

## Tanggal
2026-06-15

## Durasi terpapar
14:23 - 14:38 WIB (15 menit dari commit sampai rotate)

## Apa yang terjadi
Saat copy `.env.example` jadi `.env.local`, tidak sengaja juga commit `.env.local` 
ke branch `feat/inbox-filter`. GitHub Secret Scanning detect token Anthropic 
`sk-ant-...` di file `.env.local` baris 12.

## Kenapa lolos review?
- `.gitignore` ada `.env.local`, tapi pre-commit hook tidak aktif.
- AI Reviewer tidak konfigurasi pattern Anthropic token.
- Staff (saya) tidak cek `git status` sebelum push.

## Action items
- [ ] (Owner) Setup pre-commit hook `.env*` block
- [ ] (Owner) Tambah pattern `sk-ant-` di AI Reviewer warning rules
- [ ] (Staff) Tambah ke onboarding: WAJIB `git status` cek sebelum push pertama kali
- [ ] (Owner) Audit Anthropic usage log selama 14:23-14:38 - ada akses tidak sah?

## Lesson learned
Staff baru hire WAJIB tau `.env.local` tidak boleh di-commit. 
Tambah micro-win Day 0 task: simulasi staging .env biar staff hands-on cek `git status`.
```

---

## 🚫 Yang TIDAK BOLEH Dilakukan

1. ❌ **Jangan rotate token sendiri** - owner only operation. Staff coba rotate bisa break production.
2. ❌ **Jangan delete commit dari history sendiri** (`git reset --hard`, `git push --force`) - bisa destructive, hilang work tim lain.
3. ❌ **Jangan post screenshot di channel chat** - token visible di screenshot = bocor lagi.
4. ❌ **Jangan diam tanpa lapor** - 30 menit silence = window besar buat attacker.
5. ❌ **Jangan panik continue coding** - tiap commit tambahan = makin susah forensik.

---

## 📋 Template Decision Matrix untuk Owner

Owner pakai matrix ini saat terima alert dari staff:

| Tipe Token | Severity | Action |
|---|---|---|
| Anthropic API key | 🔴 High | Rotate via console.anthropic.com → Settings → Keys → revoke + create new. Update Vercel env vars. |
| Supabase Service Role Key | 🔴 Critical | Rotate via Supabase Dashboard → Settings → API → Reset. Update Vercel + audit DB access log. |
| GitHub Personal Access Token | 🟠 Medium | Revoke di GitHub Settings → Developer settings → Personal access tokens. |
| Vercel deploy token | 🟠 Medium | Vercel Dashboard → Settings → Tokens → revoke + create new. |
| Database password (creative_<dev>) | 🔴 High | Supabase Dashboard → Database → Roles → reset password user affected. Update `.env.local` semua dev. |
| `.env.local` file ter-commit | 🔴 High | Rotate SEMUA token di file (asumsi semua bocor). Force-push history rewrite. |
| Sensitive PII di code/log | 🟠 Medium | Cek scope leak, notify legal kalau >1 user PII. GDPR/UU PDP compliance check. |

---

## 🔐 Preventive Measures (Owner Setup, Bukan Staff)

Setup ini sekali, otomatis protect kedepan:

| Layer | Tool | Setup |
|---|---|---|
| GitHub Secret Scanning | Settings → Code security & analysis | Enable "Secret scanning" + "Push protection" (block push kalau detect secret) |
| GitGuardian (alternatif) | gitguardian.com → connect GitHub | Auto-scan tiap commit, lebih banyak pattern |
| Pre-commit hook (cek otomatis Git sebelum commit) | `.husky/pre-commit` | Check `.env*` not staged: `git diff --cached --name-only \| grep -E '^\.env' && exit 1` |
| AI Reviewer custom rules | `.github/scripts/ai-review.cjs` | Tambah pattern: `sk-ant-`, `eyJ\\w+`, `xoxb-`, `ghp_`, `postgres://.*:.*@` |
| Vercel anomaly alert | Vercel Settings → Notifications | Enable usage spike notification |
| Supabase activity log | Supabase Dashboard → Logs | Review weekly untuk unusual queries |

---

## 📞 Eskalasi (Kalau Owner Tidak Reply >1 Jam)

Kalau alert serius (data breach, multiple token bocor) dan owner tidak reply >1 jam:

1. **Cek channel emergency**: `#emergency` atau nomor HP owner
2. **Cek backup owner** (kalau ada deputi/co-founder)
3. **Untuk Anthropic API**: minimal kamu bisa email `support@anthropic.com` lapor token compromise (mereka revoke dari sisi mereka)
4. **Untuk Supabase**: email `support@supabase.io` dengan project ref + nature of leak
5. **Untuk GitHub**: report di Security tab repo

---

## ✅ Quick Checklist Kalau Kamu Encounter

```
[ ] Step 1: STOP coding
[ ] Step 2: TIDAK post di channel publik
[ ] Step 3: DM owner dengan template Security Alert
[ ] Step 4: Tunggu instruksi (max 30 menit)
[ ] Step 5: Lanjut coding setelah owner sinyal aman
[ ] Step 6: Post-mortem dalam 24 jam
```

Print checklist ini, tempel di laptop. Saat panik, baca checklist > improvise.

---

## 🧭 (OWNER) Forensik saat staf KELUAR tidak baik-baik — READ-ONLY

Ini **skenario berbeda** dari kunci-bocor: seorang staf resign/dipecat dan kamu ingin tahu **apa yang realistis bisa dia bawa**. Tujuan = **intel + tutup pintu ke depan**, BUKAN menghukum (tanpa jalur hukum, fokusnya membatasi kerugian, bukan balas dendam). Semua langkah PEMERIKSAAN di bawah **cuma membaca** — tidak mengubah apa pun. Cuma langkah terakhir (cabut akses + ganti kunci) yang berupa tindakan.

**Langkah (urut — catat DULU, baru cabut):**

1. **Daftar akses dia, SEBELUM dicabut** (5 menit, baca-saja). Buka tiap repo → Settings → Collaborators and teams; catat repo + tim apa saja yang dia punya. Atau minta AI baca Buku Induk (`lintasai-portfolio.yml`): *"grup si X boleh akses repo apa saja?"*. **Inilah daftar realistis yang bisa dia salin.** (Kalau langsung cabut tanpa catat, kamu kehilangan petanya.)
2. **Lihat jejak kontribusi dia** (baca-saja):
   - Di laptop: `git log --author="<nama-atau-email-dia>" --all --stat` → apa saja yang pernah dia ubah.
   - Di GitHub: repo → **Insights → Contributors**, atau tab **Pull requests** filter `author:<username>`.
3. **Cek riwayat robot/Actions** (baca-saja): repo → tab **Actions** → siapa memicu apa belakangan (deploy, terbit paket).
4. **Cek Audit Log organisasi** (baca-saja, kalau paketmu mendukung): `github.com/orgs/<owner>/settings/audit-log`, filter username dia. **Kejujuran:** event "clone/download" hanya tercatat lengkap di paket **GitHub Team/Enterprise**. Di paket gratis, yang PASTI kamu tahu = **repo apa yang dia punya akses** (langkah 1) = itulah batas yang bisa dia salin. Jangan berasumsi kamu bisa melihat tiap unduhan.
5. **BARU cabut akses + ganti kunci** (ini satu-satunya yang berupa TINDAKAN): GitHub → Settings → Collaborators and teams → **Remove**; hapus dari `members` di Buku Induk; **rotate** kunci yang dia mungkin tahu (DB password, token) lewat Decision Matrix di atas.
6. **Catat ringkas** di `docs/incidents/<tanggal>-staf-keluar-<nama>.md`: repo apa yang dia akses, kunci apa yang dirotate, tanggal akses dicabut. (Buat perbaiki proses onboarding + jaga-jaga.)

> 🏢 **Analogi:** kayak **karyawan toko resign** — kamu cek dulu dia pernah pegang kunci ruang mana (daftar), tarik kunci-nya, lalu **ganti gembok** ruang sensitif (rotate kredensial). Bukan curiga berlebihan — prosedur standar. Memeriksa CCTV = membaca (aman); ganti gembok = tindakan.

> ⚠️ **Jangan** hapus akun/commit dia atau rewrite history "biar jejaknya hilang" — itu malah **menghancurkan bukti** + bisa merusak kerja tim. Forensik = **baca dulu**, baru cabut akses + rotate kunci.

> 📚 Lihat juga `THREAT_MODEL_NON_LEGAL.md` (peta ancaman: kenapa staf-keluar = ancaman paling realistis untuk tim tanpa jalur hukum).

---

> **Filosofi**: security incident BUKAN ujian skill - semua orang bisa salah klik atau tidak sengaja commit file rahasia. Yang membedakan tim profesional vs amatir = **cara handle saat ada incident**. Playbook ini cuma tools - yang penting **kamu PERTAMA-TAMA lapor owner**, bukan sembunyiin atau coba fix sendiri tanpa expertise.
