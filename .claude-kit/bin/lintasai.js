#!/usr/bin/env node
// lintasAI CLI launcher - spawns PowerShell scripts
// Usage: npx lintasai <command> [args]

const { spawn, spawnSync } = require("child_process");
const path = require("path");
const os = require("os");

const KIT_ROOT = path.resolve(__dirname, "..");

// ADR-003(e): deteksi PowerShell 7 (pwsh - lintas-OS + startup lebih cepat) DULU, fallback
// powershell.exe (Windows PowerShell 5.1, runtime teruji). KATUP PENGAMAN: LINTASAI_FORCE_WINPS=1
// -> paksa powershell.exe (kalau pwsh7 bermasalah di mesin staf, bisa balik tanpa ubah kode).
// Di mesin tanpa pwsh7, probe gagal cepat (ENOENT) -> perilaku = powershell.exe seperti sebelumnya.
function resolvePowerShellExe() {
  const force = process.env.LINTASAI_FORCE_WINPS;
  if (force && force !== "0" && force !== "false") return "powershell.exe";
  try {
    const probe = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", "exit 0"], { stdio: "ignore", timeout: 5000 });
    if (!probe.error && probe.status === 0) return "pwsh";
  } catch (e) { /* pwsh tak terpasang -> fallback ke Windows PowerShell */ }
  return "powershell.exe";
}

const COMMANDS = {
  // CATATAN cutover: "init" (-> setup-pola-b.mjs), "update" (-> update-kit.mjs), "uninstall"
  // (-> uninstall.mjs), "team-setup" (-> team-setup.mjs) + "install-windows" (-> install-windows.mjs)
  // SUDAH PINDAH ke COMMANDS_NODE. JANGAN daftarkan lagi di sini: dispatcher pilih
  // COMMANDS[cmd] || COMMANDS_NODE[cmd] (COMMANDS menang) -> kalau sebuah perintah ada di DUA tempat,
  // PowerShell lama yang jalan, bukan Node. Jalur cadangan PowerShell tetap terbit (setup-pola-b.ps1 /
  // update-kit.ps1 / uninstall.ps1 / team-setup.ps1 / install-windows.ps1) -> jalankan manual dari dalam
  // project (mis. .\.claude-kit\team-setup.ps1) kalau versi Node bermasalah (lihat docs/NPX_INSTALL.md).
  // kit.ps1 subcommand yang BELUM diport ke Node -> tetap PowerShell.
  // CUTOVER Gelombang 4: doctor/version/status/diff/check-update/setup SUDAH PINDAH ke COMMANDS_NODE
  // (-> kit.mjs). JANGAN daftarkan lagi di sini (COMMANDS menang -> PowerShell lama yang jalan).
  // CUTOVER Gelombang 6 (aksi MERUSAK, sesi-khusus owner 2026-06-23): "rollback" PINDAH ke COMMANDS_NODE
  // (-> lib/rollback.mjs). Cadangan PowerShell tetap terbit: lib/rollback.ps1 dipanggil manual via
  // `.\.claude-kit\kit.ps1 rollback` kalau versi Node bermasalah. JANGAN daftarkan lagi rollback di sini
  // (COMMANDS menang -> PowerShell lama yang jalan, bukan Node).
};

// Strangler Fig (migrasi bertahap PowerShell -> Node, ADR-003): registry perintah yang
// SUDAH punya implementasi Node + lulus uji-banding. Perintah yang TIDAK ada di sini tetap
// jatuh ke PowerShell (COMMANDS) -> perilaku lama. Saat sebuah robot/skrip diport ke Node,
// daftarkan di sini { "command": "lib/xxx.js" } -> dispatcher otomatis pilih versi Node,
// PowerShell tetap jadi cadangan sampai versi Node terbukti.
// Catatan: deteksi pwsh7-dulu (lintas-OS) = micro-step berikutnya, sengaja DITUNDA agar
// keputusan "ganti runtime staf pwsh7 vs PS5.1-teruji" disurahkan ke owner dulu.
const COMMANDS_NODE = {
  // Pemasang kit (orkestrator). CUTOVER Gelombang 4: "init" dipindah dari COMMANDS (PowerShell)
  // ke sini -> `npx lintasai init` menjalankan pemasang versi Node setup-pola-b.mjs. Dispatcher
  // menyuntik --project-root <cwd-user> (lihat cabang Node di bawah) supaya kit mendarat di project
  // user, bukan cache npm. Cadangan: setup-pola-b.ps1 tetap terbit untuk jalur manual.
  "init": "setup-pola-b.mjs",
  // Alat update kit (port Node update-kit.mjs, CUTOVER). "update" dipindah dari COMMANDS (PowerShell
  // update-kit.ps1) ke sini -> `npx lintasai update` menjalankan versi Node. Dispatcher menyuntik
  // --project-root <cwd-user> (update ada di daftar shouldPassProjectRoot) supaya alat update menyasar
  // .claude-kit di project user, BUKAN cache npm. Keputusan keamanan (repo di luar daftar-putih, GPG)
  // = default-AMAN-batal + butuh bendera eksplisit (--allow-untrusted-repo / --allow-unsigned-tag),
  // BUKAN popup (ADR-004). Cadangan: update-kit.ps1 tetap terbit untuk jalur manual.
  "update": "update-kit.mjs",
  // Penghapus kit (port Node uninstall.mjs, CUTOVER). "uninstall" dipindah dari COMMANDS (PowerShell
  // uninstall.ps1) ke sini. Dispatcher menyuntik --project-root <cwd-user> (uninstall ada di
  // shouldPassProjectRoot). AKSI MERUSAK: tanpa --yes hanya menampilkan rencana lalu BERHENTI AMAN
  // (default-batal); butuh --yes eksplisit untuk benar-benar menghapus (AI konfirmasi ke staff dulu).
  // Cadangan: uninstall.ps1 tetap terbit untuk jalur manual.
  "uninstall": "uninstall.mjs",
  // Penyala kerja-kelompok (port Node team-setup.mjs, CUTOVER Gelombang 6). "team-setup" dipindah dari
  // COMMANDS (PowerShell team-setup.ps1) ke sini. Dispatcher menyuntik --project-root <cwd-user>
  // (team-setup ada di shouldPassProjectRoot) supaya kit menyasar .claude-kit di project user, BUKAN
  // cache npm. Non-interaktif + idempoten (Skip kalau berkas sudah ada). Cadangan: team-setup.ps1.
  "team-setup": "team-setup.mjs",
  // Pemasang config global Windows (port Node install-windows.mjs, CUTOVER Gelombang 6). "install-windows"
  // dipindah dari COMMANDS (PowerShell install-windows.ps1) ke sini. SENGAJA TIDAK di shouldPassProjectRoot:
  // target = %USERPROFILE%\.claude (global), BUKAN project -> dispatcher tak menyuntik --project-root.
  // Non-interaktif: butuh --force untuk menimpa berkas yang sudah ada (backup otomatis). Cadangan:
  // install-windows.ps1.
  "install-windows": "install-windows.mjs",
  // Balikin-versi (port Node lib/rollback.mjs, CUTOVER Gelombang 6 - aksi MERUSAK, sesi-khusus owner
  // 2026-06-23). "rollback" dipindah dari COMMANDS (PowerShell, dulu -> kit.ps1) ke sini -> menjalankan
  // versi Node lib/rollback.mjs. Dispatcher menyuntik --project-root <cwd-user> (rollback ada di
  // shouldPassProjectRoot) supaya rollback menyasar .claude-kit + manifest di project user, BUKAN cache
  // npm. AKSI MERUSAK: tanpa --yes hanya menampilkan rencana lalu BERHENTI AMAN (default-batal); butuh
  // --yes eksplisit untuk benar-benar menimpa berkas dari backup (AI konfirmasi ke staff dulu). Cadangan:
  // kit.ps1 rollback -> lib/rollback.ps1 tetap terbit untuk jalur manual.
  "rollback": "lib/rollback.mjs",
  // Robot pindai huruf-tipuan Unicode (port grup [A], BERDAMPINGAN dgn lib/unicode-safety-check.ps1).
  "unicode-check": "lib/unicode-safety-check.mjs",
  // Robot pemeriksa kecocokan versi MODE PROJECT (Fase 3, baca peta .jsonc). BERDAMPINGAN dgn
  // lib/consistency-check.ps1 (yang baca .psd1 + MODE KIT). Pakai: --repo-root . --checks-file <peta.jsonc>.
  "consistency-check": "lib/consistency-check.mjs",
  // Robot pemeriksa "kartu identitas project" (Fase 3, baca project.lintas.jsonc). BERDAMPINGAN dgn
  // lib/project-manifest.ps1 (yang baca .psd1 + penulis bootstrap). Pakai: --repo-root . [--manifest-path <berkas>].
  "project-check": "lib/project-manifest.mjs",
  // Robot penjaga bahasa: pastikan tulisan kit ke staff tetap Bahasa Indonesia awam (ADR-004 #3 +
  // fondasi "Gate bahasa" sebelum orkestrator besar diport ke Node). Robot BARU (tak ada padanan PS).
  // Pakai: lang-check [berkas...] (tanpa argumen = pindai kode Node produksi kit).
  "lang-check": "lib/output-lang-check.mjs",
  // Gerbang Pra-Rilis 1-perintah (LAPIS 2 cetak-biru BUKU_PELAJARAN_DAN_PREFLIGHT, Tahap E). Klien
  // jalankan `npx lintasai preflight` (atau `... preflight --strict` saat mau rilis) untuk menjalankan
  // SEMUA pemeriksa + cek kelengkapan rilis sekaligus. Dispatcher menyuntik --project-root <cwd-user>
  // (preflight ada di shouldPassProjectRoot) supaya preflight memeriksa PROJECT KLIEN, bukan folder kit
  // di cache npm. preflight.mjs auto-deteksi "mode project" (pkg.name != lintasai) -> jalankan `npm test`
  // klien + cek kelengkapan klien yang lebih lunak. Tak ada padanan PowerShell (Node-only) -> tak
  // didaftar di PS_FALLBACK. Aman dipanggil dari mana saja (cuma-baca + jalankan tes).
  "preflight": "tests/preflight.mjs",
  // Alat banding Node vs PowerShell (detektor lapangan, migrasi PS->Node 2026-06-25). Menjalankan
  // logika Node DAN PowerShell pada input cuma-baca yang sama lalu membandingkan -> deteksi kalau Node
  // diam-diam memberi hasil beda di mesin client. BUTUH PowerShell hadir (sisi pembanding); kalau tak
  // ada -> lapor "tak bisa banding" (bukan kegagalan). Tak ada padanan PS murni (Node yang mengorkestrasi).
  "parity-check": "lib/parity-check.mjs",
  // Papan Status Lintas-Repo (robot cuma-baca, ~0 token): baca status git tiap sub-folder repo lalu beri
  // skor risiko (GENTING .env belum aman / PENTING belum dikirim / RAPIKAN ketinggalan / OK). Untuk tim
  // multi-repo: 1 perintah -> kondisi SEMUA repo dalam 1 layar. SENGAJA TIDAK di shouldPassProjectRoot:
  // lib/repo-board.mjs main() pakai CWD user (atau argumen <folder-induk> langsung), bukan .claude-kit.
  // Tak di PS_FALLBACK -> konsisten dgn robot lain (unicode/consistency/project/lang/preflight/parity).
  "board": "lib/repo-board.mjs",
  // Nyalakan "Palang Rem" risk-gate (hook PreToolUse minta konfirmasi aksi berbahaya) dengan 1 langkah.
  // OPT-IN: SENGAJA TIDAK dipanggil di setup-pola-b (default kit MATI, §4.12) - user/AI panggil eksplisit
  // saat minta "nyalakan Palang Rem risk-gate". Helper lib/ensure-risk-gate-hook.mjs deep-merge ke
  // .claude/settings.json klien (pertahankan setelan lain, idempoten, fail-safe). Di shouldPassProjectRoot
  // -> dispatcher suntik --project-root supaya target .claude project USER, bukan cache npm.
  "enable-risk-gate": "lib/ensure-risk-gate-hook.mjs",
  // Pasang "Gerbang mutu CI" (workflow .github/workflows/preflight.yml) ke project klien (OPT-IN, audit
  // 2026-06-28 PENTING #2). Menutup celah "robot mutu cuma jalan kalau AI ingat panggil preflight": tiap
  // push/PR ke GitHub -> robot mutu jalan OTOMATIS (backstop mesin). Helper lib/ensure-preflight-ci.mjs
  // menyalin template (idempoten, fail-safe, tak timpa editan klien tanpa --force). Di shouldPassProjectRoot
  // -> dispatcher suntik --project-root supaya target .github project USER, bukan cache npm.
  "enable-preflight-ci": "lib/ensure-preflight-ci.mjs",
  // Verifikator Akses (robot cuma-baca): banding "siapa tim yang bisa akses repo di GitHub-NYATA" vs
  // Buku Induk (lintasai-portfolio.yml), cetak SELISIH. TINDAKAN (cabut/undang) tetap MANUSIA - robot
  // tak punya fungsi mengubah izin. Butuh gh CLI + auth + organisasi GitHub; kalau gh gagal -> BERHENTI
  // + lapor (anti rasa-aman-palsu). Di shouldPassProjectRoot -> --project-root supaya baca Buku Induk
  // di project USER. Pakai: access-verify [--owner <org>] [--portfolio <path>].
  "access-verify": "lib/access-verify.mjs",
  // Penjaga Anggaran Ukuran Halaman (Next.js, robot cuma-baca): baca manifest build .next lalu hitung
  // perkiraan ukuran JS per route, banding anggaran (default 500 KB). AUTO-SKIP kalau belum build/bukan
  // Next. Pakai SETELAH `npm run build`. Di shouldPassProjectRoot -> --project-root supaya baca .next
  // project USER. Pakai: perf-budget [--budget-kb 500].
  "perf-budget": "lib/perf-budget.mjs",
  // Robot mutu kode per-bahasa (port Node lib/stack-check.mjs, BERDAMPINGAN dgn lib/stack-check.ps1).
  // Auto-deteksi bahasa gudang lalu jalankan alat-cek STATIS standar (tsc/eslint/npm-audit, ruff/mypy/bandit,
  // go vet/staticcheck, cargo clippy, phpstan) -> serahkan FAKTA ke AI. Cuma-periksa (tak auto-fix, tak
  // jalankan tes), config-gated. SENGAJA TIDAK di shouldPassProjectRoot: robot pakai flag --repo-root
  // (BUKAN --project-root) + butuh verb `run`. Pakai: `npx lintasai stack-check run --repo-root .`.
  // Tutup gap "review per-bahasa" tanpa bergantung pwsh (selaras migrasi tim ke Node). Cadangan: stack-check.ps1.
  "stack-check": "lib/stack-check.mjs",
  // Robot pemindai konfigurasi-AI (port Node lib/ai-config-check.mjs, BERDAMPINGAN dgn .ps1). Deteksi
  // kunci-API bocor / izin lebar / hook unduh-jalankan / frasa-tembus-pagar di .mcp.json / .claude/settings.json /
  // SKILLS_LOCAL.md (cuma-baca; tingkat GENTING/PENTING/RAPIKAN). SENGAJA TIDAK di shouldPassProjectRoot:
  // pakai flag --repo-root. Pakai: `npx lintasai ai-config-check --repo-root .`. Cadangan: ai-config-check.ps1.
  "ai-config-check": "lib/ai-config-check.mjs",
  // Router perintah kit versi Node (port kit.ps1 -> kit.mjs, CUTOVER Gelombang 4). Bentuk array
  // ["kit.mjs","<sub>"] = subperintah; cabang Node di bawah menyuntik --project-root supaya kit.mjs
  // menginspeksi kit di CWD USER (.claude-kit project), BUKAN cache npm. kit.ps1 tetap cadangan PowerShell.
  // kit.mjs men-delegasi setup/update/check-update/uninstall/rollback ke port Node (setup-pola-b.mjs/
  // update-kit.mjs/uninstall.mjs/lib/rollback.mjs; rollback CUTOVER Gelombang 6); hanya 'bump' -> shim kit.ps1.
  "doctor": ["kit.mjs", "doctor"],
  "version": ["kit.mjs", "version"],
  "status": ["kit.mjs", "status"],
  "diff": ["kit.mjs", "diff"],
  "check-update": ["kit.mjs", "check-update"],
  "setup": ["kit.mjs", "setup"],
};

// Peta cadangan PowerShell per-perintah. Dipakai HANYA saat versi Node GAGAL DI-SPAWN
// (mis. Node rusak / PATH kacau di mesin staff) -> handler "error" cabang Node di bawah.
// WHY: tanpa ini, staff NON-PROGRAMMER cuma lihat "[ERROR] ... exit 127" tanpa jalan keluar
// = layar buntu (mereka tak tahu nama skrip .ps1 cadangan). Sebelumnya hint cadangan HANYA
// untuk "init"; perintah CUTOVER lain (update/uninstall/team-setup/install-windows/rollback +
// router kit) tak punya. SENGAJA hanya dipakai di handler "error" (spawn gagal = Node tak bisa
// start sama sekali), BUKAN di handler "close" pada exit!=0 -- karena banyak perintah Node keluar
// non-nol sebagai HASIL SAH (robot: exit = jumlah temuan; doctor: exit!=0 = integritas gagal),
// jadi menempel pesan "pakai cadangan" di sana = alarm palsu yang menyesatkan.
// Hanya perintah yang punya padanan PowerShell hidup + bisa dijalankan standalone yang didaftar.
const PS_FALLBACK = {
  "init": ".\\.claude-kit\\setup-pola-b.ps1",
  "update": ".\\.claude-kit\\update-kit.ps1",
  "uninstall": ".\\.claude-kit\\uninstall.ps1",
  "team-setup": ".\\.claude-kit\\team-setup.ps1",
  "install-windows": ".\\.claude-kit\\install-windows.ps1",
  "rollback": ".\\.claude-kit\\kit.ps1 rollback",
  "doctor": ".\\.claude-kit\\kit.ps1 doctor",
  "version": ".\\.claude-kit\\kit.ps1 version",
  "status": ".\\.claude-kit\\kit.ps1 status",
  "diff": ".\\.claude-kit\\kit.ps1 diff",
  "check-update": ".\\.claude-kit\\kit.ps1 check-update",
  "setup": ".\\.claude-kit\\kit.ps1 setup",
};

function showHelp() {
  console.log("");
  console.log("lintasAI CLI - AI workflow kit for Claude Code");
  console.log("");
  console.log("Usage:");
  console.log("  npx lintasai <command> [args]");
  console.log("");
  console.log("Commands:");
  console.log("  init           Setup kit di project (alias setup-pola-b)");
  console.log("  team-setup     Nyalakan kerja kelompok (CODEOWNERS+PR template+panduan kunci main)");
  console.log("  update         Update kit ke versi terbaru");
  console.log("  check-update   Cek apakah ada versi baru (read-only)");
  console.log("  doctor         Verify kit integrity");
  console.log("  status         Show kit status ringkas (1-layar)");
  console.log("  version        Show kit version");
  console.log("  rollback       Rollback ke versi sebelumnya");
  console.log("  uninstall      Remove kit dari project");
  console.log("  unicode-check  Pindai karakter Unicode tersembunyi/berbahaya (Node)");
  console.log("  consistency-check  Cek kecocokan versi lintas-berkas project (baca peta .jsonc, Node)");
  console.log("  project-check      Cek 'kartu identitas project' vs kenyataan (project.lintas.jsonc, Node)");
  console.log("  lang-check         Cek tulisan kit ke staff tetap Bahasa Indonesia awam (bukan prosa Inggris, Node)");
  console.log("  preflight          Gerbang pra-rilis: jalankan semua pemeriksa + cek kelengkapan (pakai --strict saat mau rilis)");
  console.log("  parity-check       Banding hasil Node vs PowerShell di mesin ini (deteksi kalau Node diam-diam beda; cuma-baca, butuh PowerShell)");
  console.log("  board              Papan status semua repo tim 1 layar (mana .env belum aman / belum dikirim ke server; cuma-baca)");
  console.log("  enable-risk-gate   Nyalakan Palang Rem (konfirmasi aksi berbahaya) 1-langkah - OPT-IN, pertahankan setelan lain");
  console.log("  enable-preflight-ci Pasang Gerbang mutu CI (robot mutu jalan otomatis tiap push/PR GitHub) - OPT-IN");
  console.log("  access-verify      Banding akses GitHub-nyata vs Buku Induk, cetak selisih (READ-ONLY; butuh gh + org)");
  console.log("  perf-budget        Cek perkiraan ukuran JS per halaman vs anggaran (Next.js; jalankan setelah build)");
  console.log("  stack-check        Jalankan alat-cek mutu STATIS per-bahasa (tsc/eslint/ruff/go vet...); cuma-periksa. Pakai: stack-check run --repo-root .");
  console.log("  ai-config-check    Pindai konfigurasi AI (.mcp.json/settings/skill) cari kunci bocor/izin lebar/frasa tembus-pagar (READ-ONLY). Pakai: ai-config-check --repo-root .");
  console.log("");
  console.log("Examples:");
  console.log("  npx lintasai init");
  console.log("  npx lintasai update");
  console.log("  npx lintasai doctor");
  console.log("");
  console.log("More info: https://github.com/ojokesusu/lintasAI");
}

if (os.platform() !== "win32") {
  console.error("");
  console.error("[ERROR] lintasAI saat ini Windows-only (v1.x).");
  console.error("");
  console.error("Platform terdeteksi: " + os.platform() + " (" + os.arch() + ")");
  console.error("Reason: kit bergantung ke PowerShell 5.1+ + WPF (popup GUI) +");
  console.error("        Windows path conventions (C:\\, %USERPROFILE%).");
  console.error("");
  console.error("Workaround sekarang:");
  console.error("  1. Pakai Windows VM (VirtualBox/VMware/Hyper-V) + Windows 10+");
  console.error("  2. Pakai WSL2 hanya untuk Claude Code, tapi project di /mnt/c/ Windows-side");
  console.error("  3. Tunggu v2.0+ (cross-platform via Node-native helpers, ETA 2026 Q4)");
  console.error("");
  console.error("Track progress: https://github.com/ojokesusu/lintasAI/issues?q=label%3Across-platform");
  process.exit(1);
}

// v1.5.6 Fix #4: Claude Code Desktop vs Web context detection.
// Web context (claude.ai chat) TIDAK punya filesystem access - `npx lintasai init`
// akan gagal silent / aneh. Detect lebih awal supaya user tahu pakai Desktop.
const isInteractiveTTY = process.stdin.isTTY === true || process.stdout.isTTY === true;
const hasClaudeCodeEnv = !!(
  process.env.CLAUDE_CODE_ENTRYPOINT ||
  process.env.CLAUDECODE ||
  process.env.CLAUDE_CODE === "desktop"
);
const looksLikeShell = !!(process.env.SHELL || process.env.ComSpec || process.env.PSModulePath);

if (!isInteractiveTTY && !hasClaudeCodeEnv && !looksLikeShell) {
  console.error("");
  console.error("[ERROR] lintasAI tampaknya dijalankan dari Claude.ai Web (browser).");
  console.error("");
  console.error("Web Claude TIDAK SUPPORT filesystem operations (mkdir, write file, spawn process).");
  console.error("Kit ini butuh shell access untuk: clone repo, write .claude-kit/, run setup-pola-b.ps1.");
  console.error("");
  console.error("Solusi: pakai Claude Code DESKTOP (bukan Web):");
  console.error("  1. Download Desktop: https://claude.ai/download");
  console.error("  2. Install + sign in pakai akun Anthropic kamu");
  console.error("  3. Buka project folder di Desktop, paste prompt JALANKAN_KIT.md");
  console.error("");
  console.error("Kalau kamu YAKIN ini Desktop (false positive detection), set env:");
  console.error("  Windows PowerShell: $env:CLAUDECODE='1'; npx lintasai init");
  console.error("");
  process.exit(1);
}

const command = process.argv[2];
const args = process.argv.slice(3);

if (!command || command === "help" || command === "--help" || command === "-h") {
  showHelp();
  process.exit(0);
}

const target = COMMANDS[command] || COMMANDS_NODE[command];
if (!target) {
  console.error("[ERROR] Unknown command: " + command);
  console.error("Run: npx lintasai help");
  process.exit(1);
}

// Build powershell command
const userCwd = process.cwd();
// For init/update/uninstall: pass user CWD explicitly so script knows real project root
const shouldPassProjectRoot = ["init", "update", "uninstall", "team-setup", "rollback", "preflight", "parity-check", "enable-risk-gate", "enable-preflight-ci", "access-verify", "perf-budget"].includes(command);
let psArgs;
if (Array.isArray(target)) {
  // kit.ps1 subcommand. Inject -ProjectRoot so kit.ps1 inspects the kit di USER CWD
  // (.claude-kit di project), bukan di npm cache ($PSScriptRoot). L1-RUN-003.
  psArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(KIT_ROOT, target[0]),
    target[1],
    "-ProjectRoot",
    userCwd,
    ...args,
  ];
} else if (shouldPassProjectRoot) {
  // Direct script call with -ProjectRoot
  psArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(KIT_ROOT, target), "-ProjectRoot", userCwd, ...args];
} else {
  // Direct script call
  psArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(KIT_ROOT, target), ...args];
}

// v1.26.1 fix: detect non-interactive execution (AI tool / CI) and signal it to the
// PowerShell scripts. WHY: with { stdio: "inherit" } the child PowerShell inherits an
// OPEN STDIN PIPE. If that pipe has no human typing, Read-Host BLOCKS FOREVER (it does
// not throw, so the scripts' try/catch fallbacks never fire) -> `npx ... init` hangs.
// "No human keyboard" == stdin is not a TTY (open pipe/redirect) OR an explicit env
// signal is set. In that case we: (a) set LINTASAI_NONINTERACTIVE=1 so the PS helper
// Test-LintasInteractiveInput forces console mode + skips every prompt with a safe
// default (and never opens a blocking GUI popup); (b) add -NonInteractive so even an
// ungated Read-Host THROWS instead of blocking (caught by the existing safe fallbacks).
// A real human in a terminal keeps stdin.isTTY === true -> prompts behave as before.
// ESCAPE HATCH (v1.27.0): a human in Git Bash / mintty has stdin backed by a pipe
// (process.stdin.isTTY is undefined), so they would WRONGLY be treated as
// non-interactive and silently get safe defaults instead of prompts. Setting
// LINTASAI_INTERACTIVE=1 forces interactive mode and wins over all auto-detection
// (also honored by the PS helper Test-LintasInteractiveInput, so both layers agree).
// We deliberately do NOT auto-treat Git Bash (MSYSTEM/TERM) as interactive, because
// the AI Bash tool runs there too and MUST stay non-interactive to avoid the hang.
const forceInteractiveVal = process.env.LINTASAI_INTERACTIVE;
const forceInteractive = !!(forceInteractiveVal && forceInteractiveVal !== "0" && forceInteractiveVal !== "false");
const stdinIsInteractive = process.stdin.isTTY === true;
const envNonInteractive = !!(
  process.env.LINTASAI_NONINTERACTIVE ||
  process.env.CLAUDECODE ||
  process.env.CI
);
const nonInteractive = forceInteractive ? false : (!stdinIsInteractive || envNonInteractive);

const childEnv = Object.assign({}, process.env);
if (nonInteractive) {
  childEnv.LINTASAI_NONINTERACTIVE = "1";
  // Insert -NonInteractive right after -NoProfile (index 0) so it precedes -File.
  psArgs.splice(1, 0, "-NonInteractive");
}

// PENJAGA PRESEDENS (perbaikan parity): `&& !COMMANDS[command]` memastikan kalau suatu perintah
// TERLANJUR terdaftar di DUA peta (mis. migrasi setengah jalan / salin-tempel), versi PowerShell
// LAMA-yang-teruji (COMMANDS) yang jalan -- cermin pemilihan `target` di atas (COMMANDS[cmd] ||
// COMMANDS_NODE[cmd]) + jaring pengaman di komentar COMMANDS. Tanpa penjaga ini, runtime diam-diam
// menjalankan versi Node yang belum tentu teruji (kebalikan dari yang dijanjikan komentar + tes).
if (COMMANDS_NODE[command] && !COMMANDS[command]) {
  // Versi Node (Strangler Fig). Robot yang sudah diport + lulus uji-banding dijalankan via cabang ini
  // (lihat COMMANDS_NODE di atas); PowerShell tetap jadi cadangan untuk perintah yang belum diport.
  const nodeTarget = COMMANDS_NODE[command];
  let nodeScript;
  let leadingArgs; // subperintah untuk router kit.mjs (mis. ["doctor"]); kosong untuk skrip langsung
  let injectProjectRoot;
  if (Array.isArray(nodeTarget)) {
    // Subperintah router Node (kit.mjs <sub>). SELALU suntik --project-root supaya kit.mjs
    // menginspeksi kit di CWD USER (.claude-kit project), bukan cache npm -- cermin cabang
    // kit.ps1 (bentuk array) yang selalu menyuntik -ProjectRoot.
    nodeScript = path.join(KIT_ROOT, nodeTarget[0]);
    leadingArgs = nodeTarget.slice(1);
    injectProjectRoot = true;
  } else {
    nodeScript = path.join(KIT_ROOT, nodeTarget);
    leadingArgs = [];
    // Sama seperti cabang PowerShell menyuntik -ProjectRoot: untuk init/update/uninstall/team-setup,
    // teruskan akar project user lewat --project-root (DOUBLE-dash, gaya argumen Node). TANPA ini,
    // pemasang Node jatuh ke path.dirname(KitDir) = cache npm -> memasang ke LOKASI SALAH
    // (lihat setup-pola-b.mjs penentuan projectRoot). shouldPassProjectRoot sudah dihitung di atas
    // (dipakai bersama cabang PowerShell), jadi keputusan "perintah mana yang butuh akar project" tunggal.
    injectProjectRoot = shouldPassProjectRoot;
  }
  const nodeArgs = injectProjectRoot
    ? [...leadingArgs, "--project-root", userCwd, ...args]
    : [...leadingArgs, ...args];
  const nodeChild = spawn(process.execPath, [nodeScript, ...nodeArgs], { stdio: "inherit", cwd: userCwd, env: childEnv });
  nodeChild.on("error", (err) => {
    console.error("[ERROR] Versi cepat (Node) untuk '" + command + "' tidak bisa dijalankan: " + err.message);
    const fallback = PS_FALLBACK[command];
    if (fallback) {
      // Jalan keluar yang bisa di-COPY untuk staff non-programmer (bukan layar buntu).
      console.error("");
      console.error("Coba jalan cadangan (versi PowerShell) dari DALAM folder project kamu:");
      console.error("  powershell -ExecutionPolicy Bypass -File " + fallback);
      console.error("");
      console.error("Kalau masih gagal, kirim pesan error di atas ke tim teknis kamu.");
    } else {
      console.error("Perintah ini belum punya jalan cadangan PowerShell. Kirim pesan error di atas ke tim teknis kamu.");
    }
    process.exit(127);
  });
  nodeChild.on("close", (code) => {
    // Anak mati oleh SIGNAL (taskkill/timeout/OOM/Ctrl+C) -> code=null. `code || 0` dulu memetakannya
    // ke 0 (SUKSES PALSU) -> CI/skrip pembungkus kira pemasangan berhasil padahal dibatalkan setengah
    // jadi. `code == null ? 1 : code` melaporkan terminasi-sinyal sebagai GAGAL (cermin konvensi Node
    // kit lain: kit.mjs/run-node-tests status==null -> 1).
    process.exit(code == null ? 1 : code);
  });
} else {
  const psExe = resolvePowerShellExe();
  const child = spawn(psExe, psArgs, { stdio: "inherit", cwd: userCwd, env: childEnv });
  child.on("error", (err) => {
    console.error("[ERROR] Gagal spawn " + psExe + ": " + err.message);
    console.error("Pastikan PowerShell ada di PATH (pwsh7: https://aka.ms/powershell), atau set LINTASAI_FORCE_WINPS=1 untuk paksa powershell.exe (5.1).");
    process.exit(127);
  });
  child.on("close", (code) => {
    // Lihat catatan cabang Node di atas: anak mati oleh signal (code=null) = GAGAL (1), bukan sukses
    // palsu (0).
    process.exit(code == null ? 1 : code);
  });
}
