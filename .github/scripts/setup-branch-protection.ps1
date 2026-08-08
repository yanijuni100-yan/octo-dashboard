#requires -Version 5.1
<#
.SYNOPSIS
  Nyalakan "kunci pengaman gabung" (branch protection) di 1 repo GitHub - sekali jalan.

.DESCRIPTION
  RAMBU "KUNCI PENGAMAN GABUNG" untuk tim skala besar (20-30 orang non-programmer).

  Apa gunanya (bahasa non-programmer):
    Tanpa rambu ini, siapa pun bisa langsung menimpa versi utama tim - berbahaya
    kalau staff non-programmer tidak sengaja. Rambu ini memasang 4 syarat sebelum
    boleh menggabung ke jalur utama (main):
      1. WAJIB lewat permintaan-gabung (tidak boleh tulis langsung ke main).
      2. WAJIB lulus cek otomatis (tes) dulu - kalau merah, tombol gabung terkunci.
      3. WAJIB disetujui penanggung jawab (CODEOWNERS) - minimal 1 review.
      4. DILARANG menimpa paksa (force-push) jalur utama.

    Analogi: kayak pintu brankas bank dengan 2 kunci + alarm. Bukan 1 orang bisa
    buka sembarangan - harus ada syarat lengkap dulu. Staff non-programmer jadi
    TIDAK BISA "tidak sengaja" merusak versi utama tim.

  AMAN secara default: skrip ini jalan mode SIMULASI (cuma menampilkan apa yang
  AKAN dilakukan, TIDAK mengubah apa pun). Untuk benar-benar menyalakan, tambah
  parameter  -Apply .

.PARAMETER Repo
  Nama repo GitHub format "owner/nama-repo" (mis. "perusahaan/project-frontend").
  Kalau dikosongkan, skrip coba deteksi dari git remote folder saat ini.

.PARAMETER Branch
  Nama branch utama yang dilindungi. Default: "main".

.PARAMETER RequiredCheck
  Nama cek otomatis yang WAJIB hijau sebelum gabung (mis. "build", "test", "ci").
  Default: "ci". Sesuaikan dengan nama job di workflow CI kamu.

.PARAMETER Apply
  Tanpa ini = SIMULASI (cuma lihat). Dengan ini = benar-benar menyalakan kunci.

.EXAMPLE
  # Lihat dulu (SIMULASI, tidak mengubah apa-apa):
  .\setup-branch-protection.ps1 -Repo "perusahaan/project-frontend"

.EXAMPLE
  # Benar-benar nyalakan:
  .\setup-branch-protection.ps1 -Repo "perusahaan/project-frontend" -RequiredCheck "ci" -Apply

.NOTES
  Prasyarat: GitHub CLI ("gh") terpasang + sudah login (gh auth login).
  Butuh hak admin di repo target.
  Dokumentasi resmi branch protection:
  https://docs.github.com/en/rest/branches/branch-protection
#>
[CmdletBinding()]
param(
    [string]$Repo = '',
    [string]$Branch = 'main',
    [string]$RequiredCheck = 'ci',
    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Plain {
    param([string]$Msg, [string]$Color = 'Gray')
    Write-Host $Msg -ForegroundColor $Color
}

Write-Plain ""
Write-Plain "=== RAMBU: Kunci Pengaman Gabung (branch protection) ===" 'Cyan'
Write-Plain ""

# 1. Cek GitHub CLI ada + login -------------------------------------------------
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    Write-Plain "GAGAL: GitHub CLI ('gh') belum terpasang." 'Red'
    Write-Plain "  Apa ini: alat resmi GitHub untuk atur repo dari komputer." 'DarkGray'
    Write-Plain "  Pasang dulu dari: https://cli.github.com/  lalu jalankan: gh auth login" 'DarkGray'
    exit 1
}

# Cek sudah login (gh auth status keluar non-zero kalau belum login).
& gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Plain "GAGAL: Belum login ke GitHub." 'Red'
    Write-Plain "  Jalankan dulu:  gh auth login  (sekali saja)." 'DarkGray'
    exit 1
}

# 2. Tentukan repo target -------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($Repo)) {
    # Coba deteksi dari folder git saat ini.
    $detected = & gh repo view --json nameWithOwner -q '.nameWithOwner' 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($detected)) {
        $Repo = $detected.Trim()
        Write-Plain ("Repo terdeteksi otomatis: {0}" -f $Repo) 'Green'
    } else {
        Write-Plain "GAGAL: Repo tidak disebut + tidak bisa deteksi dari folder ini." 'Red'
        Write-Plain "  Sebut manual:  -Repo 'owner/nama-repo'" 'DarkGray'
        exit 1
    }
}

Write-Plain ""
Write-Plain "Yang AKAN dipasang di repo ini:" 'White'
Write-Plain ("  Repo   : {0}" -f $Repo)
Write-Plain ("  Branch : {0}  (jalur utama yang dilindungi)" -f $Branch)
Write-Plain ("  Syarat cek otomatis wajib hijau : {0}" -f $RequiredCheck)
Write-Plain ""
Write-Plain "4 syarat sebelum boleh gabung ke jalur utama:" 'White'
Write-Plain "  [1] WAJIB lewat permintaan-gabung (tidak boleh tulis langsung)."
Write-Plain ("  [2] WAJIB lulus cek otomatis '{0}' (kalau merah, gabung terkunci)." -f $RequiredCheck)
Write-Plain "  [3] WAJIB disetujui penanggung jawab (CODEOWNERS) - minimal 1 review."
Write-Plain "  [4] DILARANG menimpa paksa (force-push) jalur utama."
Write-Plain ""

# 3. Susun payload aturan (REST API GitHub) ------------------------------------
# Catatan: struktur ini mengikuti dokumentasi resmi "Update branch protection".
$payload = @{
    required_status_checks        = @{
        strict   = $true
        contexts = @($RequiredCheck)
    }
    enforce_admins                = $true
    required_pull_request_reviews = @{
        required_approving_review_count = 1
        require_code_owner_reviews      = $true
    }
    restrictions                  = $null
    allow_force_pushes            = $false
    allow_deletions               = $false
}
$payloadJson = $payload | ConvertTo-Json -Depth 6 -Compress

# 4. SIMULASI vs APPLY ----------------------------------------------------------
if (-not $Apply) {
    Write-Plain "MODE: SIMULASI (tidak ada yang diubah)." 'Yellow'
    Write-Plain "  Ini cuma menampilkan rencana. Repo BELUM diubah." 'Yellow'
    Write-Plain ""
    Write-Plain "Aturan (JSON) yang akan dikirim ke GitHub:" 'DarkGray'
    Write-Plain $payloadJson 'DarkGray'
    Write-Plain ""
    Write-Plain "Untuk benar-benar menyalakan, ulangi dengan tambah  -Apply  di akhir." 'Cyan'
    Write-Plain ("  Contoh:  .\setup-branch-protection.ps1 -Repo '{0}' -RequiredCheck '{1}' -Apply" -f $Repo, $RequiredCheck) 'Cyan'
    exit 0
}

Write-Plain "MODE: APPLY - benar-benar menyalakan kunci pengaman gabung..." 'Magenta'
Write-Plain ""

$apiPath = "repos/$Repo/branches/$Branch/protection"
try {
    # Kirim payload via stdin ke gh api (PUT). -F method=PUT + --input -.
    $payloadJson | & gh api --method PUT $apiPath --input - | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "gh api keluar dengan kode $LASTEXITCODE" }
    Write-Plain "BERHASIL: Kunci pengaman gabung sudah aktif." 'Green'
    Write-Plain ("  Mulai sekarang, gabung ke '{0}' WAJIB lewat permintaan-gabung + cek hijau + 1 persetujuan." -f $Branch) 'Green'
    Write-Plain ""
    Write-Plain "Langkah lanjut: pastikan .github/CODEOWNERS sudah diisi username asli (bukan placeholder)" 'Cyan'
    Write-Plain "supaya GitHub tahu siapa penanggung jawab yang diminta review." 'Cyan'
}
catch {
    Write-Plain ("GAGAL menyalakan: {0}" -f $_.Exception.Message) 'Red'
    Write-Plain "  Penyebab umum:" 'DarkGray'
    Write-Plain "  - Kamu bukan admin repo ini (minta owner jalankan)." 'DarkGray'
    Write-Plain ("  - Nama cek '{0}' belum pernah jalan (jalankan CI sekali dulu, baru pasang)." -f $RequiredCheck) 'DarkGray'
    Write-Plain "  - Repo private di paket GitHub gratis (branch protection butuh repo public atau paket berbayar)." 'DarkGray'
    exit 1
}
