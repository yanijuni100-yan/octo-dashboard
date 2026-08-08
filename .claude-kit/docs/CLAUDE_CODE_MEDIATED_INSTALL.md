# Claude Code-Mediated Install (Zero PowerShell)

> v1.3.1+ feature. Staff IT non-programmer install lintasAI 100% via Claude Code chat tanpa buka PowerShell/CMD.

## Untuk Owner: Persiapan 1x per Project (~5 menit)

### Step 1: Buat basic settings.local.json di project repo

Lokasi: <project>/.claude/settings.local.json

Minimum content (allow install + basic dev ops):

```json
{
  "permissions": {
    "allow": [
      "Bash(npm create lintasai:*)",
      "Bash(pnpm install:*)",
      "Bash(pnpm dev:*)",
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git config user.email:*)",
      "Bash(git config user.name:*)"
    ]
  }
}
```

### Step 2: Commit + push ke repo

```
git add .claude/settings.local.json
git commit -m "chore: claude code allow rules untuk lintasAI install"
git push
```

### Step 3: Verify .gitignore tidak exclude settings.local.json

WAJIB: settings.local.json HARUS ter-commit (shared dengan tim). Berbeda dengan ~/.claude/settings.json (user-global, JANGAN commit).

## Untuk Staff IT Non-Programmer: Install Day 0

### Step 1: Clone project (owner kirim link)

Owner DM Discord: "Clone link ini: https://github.com/owner/project"

Staff buka VS Code → Source Control → Clone Repository → paste URL.

### Step 2: Buka project + buka Claude Code

File → Open Folder → pilih folder project hasil clone.
Claude Code panel terbuka (kalau extension aktif).

> **Catatan tentang popup**: kalau **AI yang menjalankan** pemasangan (cara di dokumen ini), kamu menemui **Popup Tipe A** — kotak pilihan **DI DALAM chat** (#1/#2/#3 di `JALANKAN_KIT.md`; kalau fitur klik tak tersedia, tampil sebagai teks ketik-angka). **Popup Tipe B** (jendela Windows terpisah, klik tombol mouse) **hanya** muncul kalau kamu menjalankan perintah pasang **sendiri di terminal**. Definisi lengkap: `JALANKAN_KIT.md` > section "Klarifikasi Terminologi Popup".

### Step 3: Chat ke AI

Ketik di chat:

> halo aku staff baru, install lintasAI dong

AI akan respond:

1. Detect kamu staff baru → **AI yang menjalankan** `npm create lintasai` (izin OK karena settings.local.json).
2. Karena **AI yang menjalankan** (bukan kamu ketik manual di terminal), installer masuk **mode otomatis**: SEMUA popup jendela Windows (pilihan AGENTS.md, email, buka VS Code, tip) **dilewati otomatis pakai nilai aman** — kamu **tidak** perlu klik popup jendela Windows apa pun.
3. AI langsung lanjut ke **popup pemandu DI DALAM chat** (Fase B): #1 cara pasang → #2 audit menyeluruh (kalau project sudah ada kodenya) → #3 ukuran tim + bentuk kode (tetap 1 tempat & rapikan / pecah 3 repo / microservice shared-DB) → catatan kode 2-versi di akhir. Ini popup yang kamu KLIK di chat, bukan jendela Windows.
4. AI auto-trigger Guided onboarding 6-tahap (untuk staff baru).

### Yang Staff Lakukan:

- 1x ketik chat AI (1 kalimat)
- Beberapa kali KLIK popup **di dalam chat** (Fase B)
- 1x ketik email (kalau diminta saat pemanduan)
- **Tidak ada popup jendela Windows yang perlu di-klik** (karena AI yang menjalankan)
- Tidak buka PowerShell/CMD
- Tidak edit settings.json
- Tidak install Node.js manual (kalau Owner sudah pre-install di laptop staff)

## Apa yang Auto-Terjadi di Belakang Layar

- Kit ter-install di project/.claude-kit/
- AGENTS.md preserved (existing tidak ke-overwrite)
- Git identity ter-set (email + auto-derive nama)
- settings.local.json auto-merge tambahan allow rules (post-install ops)
- VS Code restart prompt untuk apply new settings
- AI Auto-Health-Check aktif (section 7.6 CLAUDE_universal_v1.md)

## Troubleshooting

### "AI minta izin / `npm create lintasai` diblokir auto-mode (popup 'Cara jalan')"

Ini **pengaman bawaan Claude Code** (penyaring otomatis untuk perintah `npm` — diperlakukan ekstra sensitif demi keamanan), **bukan** error lintasAI dan **bukan** bagian alur pemandu kit. NORMAL muncul saat pasang pertama atau pasang-ulang.

**Cara lanjut:** pilih **"Izinkan di repo ini"** → AI menjalankan pemasangan di project-mu lalu **langsung lanjut memandu** (Fase B). Hindari *"jalankan sendiri di terminal"* kalau ingin AI tetap auto-lanjut memandu di chat (lewat terminal, AI keluar dari loop → kamu harus balik ke chat + ketik *"lanjutkan setup lintasAI"* manual).

**Mengurangi prompt ini (owner, opsional):** commit `.claude/settings.local.json` dengan rule `Bash(npm create lintasai:*)` (lihat Step 1 owner). Catatan jujur: ini **mengurangi**, tapi Claude Code **bisa tetap** menanyakan untuk perintah `npm` walau sudah di daftar-izin — kalau muncul, cukup pilih "Izinkan di repo ini". Pasang **pertama** di project baru memang selalu ditanya (daftar-izin baru ada setelah kit terpasang).

### "Popup tidak muncul"

Staff laptop headless (Server Core / SSH). Kit auto-fallback ke -NoGui console mode. AI akan tampil prompt di chat sebagai opsi.

### "Reinstall di project sama"

Aman, kit detect existing → AGENTS.md skip default → settings.local.json idempotent (no duplicate allow rules).

## Komparasi Cara Install

| Cara | Friction Staff | Recommend? |
|------|----------------|------------|
| Claude-Code-mediated (AI yang jalankan) | 1 chat + beberapa klik popup **di chat** (tanpa popup jendela Windows) | 🟢 RECOMMENDED untuk non-programmer |
| PowerShell/terminal manual (jalankan sendiri) | 1 paste perintah (otomatis penuh, **tanpa popup jendela Windows**) — pilihan via chat sesudahnya | 🟡 OK kalau staff terbiasa terminal |
| Git clone | 5+ langkah + GitHub auth | 🔴 TIDAK - repo private |
