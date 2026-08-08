#!/bin/bash
# lintasAI pre-commit secret guard (shift-left) - v1
#
# Tujuan: cegah rahasia (file .env asli, kunci/token API) ter-commit DI LAPTOP, SEBELUM
# terkirim ke server -- bukan baru ketahuan di CI setelah telat (saat itu rahasia sudah
# masuk riwayat remote -> wajib ganti-kunci + tulis-ulang riwayat, mahal & menakutkan).
# Ini pelengkap (lapis kedua) dari .github/workflows/secret-guard.yml (server-side); POLA
# deteksi SENGAJA disamakan supaya konsisten.
#
# Pasang (opt-in): salin berkas ini ke .git/hooks/pre-commit lalu beri izin jalan --
#   atau cukup minta AI: "pasang penjaga rahasia pre-commit" (AI jalankan install-secret-hook.ps1).
#
# Darurat / alarm-palsu: lewati 1x dengan  git commit --no-verify
#
# Privasi: hook ini HANYA mencetak NAMA berkas yang mencurigakan, TIDAK PERNAH mencetak
# nilai rahasianya ke layar/log (cegah bocor lewat terminal/CI).

set -uo pipefail
fail=0

# Hanya berkas yang DI-STAGE (Added/Copied/Modified) -- bukan seluruh repo.
staged=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$staged" ] && exit 0

# === 1) TOLAK-KERAS: file .env ASLI di-stage =====================================
# .env.example / .sample / .template / .dist / .demo = AMAN (cuma placeholder), dikecualikan.
envstaged=$(printf '%s\n' "$staged" | grep -E '(^|/)\.env(\.[A-Za-z0-9_-]+)?$' | grep -Ev '\.(examples?|samples?|templates?|dist|demo)$' || true)
if [ -n "$envstaged" ]; then
  echo "[penjaga-rahasia] TOLAK: file rahasia (.env asli) akan ter-commit:"
  while IFS= read -r f; do [ -n "$f" ] && echo "    - $f"; done <<< "$envstaged"
  echo "    Perbaiki: tambahkan ke .gitignore, lalu jalankan: git rm --cached \"<file>\""
  fail=1
fi

# === 2) TOLAK-KERAS: isi berkas MIRIP kunci/token asli ===========================
# Cuma cetak NAMA berkas (grep -l), TIDAK pernah nilai rahasianya. Pola disamakan dgn
# secret-guard.yml: kunci AI/AWS/GitHub/Slack/GitLab + token JWT + URL DB ber-password.
patterns='sk-ant-[A-Za-z0-9_-]{20}|AKIA[0-9A-Z]{16}|gh[posu]_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10}|glpat-[A-Za-z0-9_-]{20}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|(postgres|postgresql|mysql|mongodb(\+srv)?)://[^:@/ ]+:[^@/ ]+@'
scan=$(printf '%s\n' "$staged" | grep -vE '^\.github/' | grep -vE '\.env\.(examples?|samples?|templates?|dist|demo)$' | grep -vE '(^|/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$' || true)
keyfiles=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if [ -f "$f" ] && grep -lIE "$patterns" "$f" >/dev/null 2>&1; then
    keyfiles="${keyfiles}    - ${f}"$'\n'
  fi
done <<< "$scan"
if [ -n "$keyfiles" ]; then
  echo "[penjaga-rahasia] TOLAK: berkas berikut MUNGKIN berisi kunci/token asli (nilai TIDAK ditampilkan demi keamanan):"
  printf '%s' "$keyfiles"
  echo "    Kalau ASLI: jangan commit; ganti (rotate) kuncinya. Lihat docs/SECURITY_INCIDENT_PLAYBOOK.md."
  echo "    Kalau cuma CONTOH/placeholder (alarm palsu): commit ulang dengan  git commit --no-verify"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "[penjaga-rahasia] Commit DIBATALKAN demi keamanan. (Darurat/alarm-palsu: git commit --no-verify)"
  exit 1
fi
exit 0
