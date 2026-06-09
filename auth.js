/* ====================================================================
   Gerbang login Supabase Auth
   --------------------------------------------------------------------
   - Hanya LOGIN (email + password). Tidak ada pendaftaran di app —
     user dibuat manual oleh admin di dashboard Supabase.
   - Selama belum login, <body> punya class "auth-locked" sehingga
     #app disembunyikan dan #auth-overlay tampil (lihat auth.css).
   - Sesi disimpan otomatis (localStorage), jadi tidak perlu login
     ulang tiap buka app sampai user klik Logout.
   ==================================================================== */
(function () {
  'use strict';

  const cfg = window.SUPABASE_CONFIG || {};
  const lib = window.supabase; // global dari vendor/supabase.js (UMD)

  const $ = (id) => document.getElementById(id);
  const setMsg = (text, kind) => {
    const el = $('authMsg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'auth-msg' + (kind ? ' ' + kind : '');
  };
  const lock = () => document.body.classList.add('auth-locked');
  const unlock = () => document.body.classList.remove('auth-locked');

  // --- Validasi konfigurasi sebelum apa pun ---
  const configMissing =
    !lib ||
    !cfg.url ||
    !cfg.anonKey ||
    cfg.url.includes('GANTI_') ||
    cfg.anonKey.includes('GANTI_');

  let sb = null;
  if (!configMissing) {
    sb = lib.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }

  // Tambah tombol Logout ke topbar setelah login berhasil
  function ensureLogoutButton(email) {
    const actions = document.querySelector('.topbar-actions');
    if (!actions || $('logoutBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'logoutBtn';
    btn.type = 'button';
    btn.title = email ? ('Masuk sebagai ' + email) : 'Keluar';
    btn.textContent = '⎋ Logout';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { if (sb) await sb.auth.signOut(); } catch (e) {}
      // Kunci ulang & reset form
      lock();
      const pw = $('authPassword');
      if (pw) pw.value = '';
      setMsg('Kamu sudah keluar.', 'info');
      btn.remove();
    });
    actions.appendChild(btn);
  }

  function showApp(session) {
    unlock();
    setMsg('', '');
    ensureLogoutButton(session && session.user && session.user.email);
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!sb) {
      setMsg('Konfigurasi Supabase belum diisi (lihat supabase-config.js).', 'err');
      return;
    }
    const email = ($('authEmail').value || '').trim();
    const password = $('authPassword').value || '';
    const btn = $('authSubmit');

    if (!email || !password) {
      setMsg('Email dan password wajib diisi.', 'err');
      return;
    }

    btn.disabled = true;
    setMsg('Memeriksa…', 'info');
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(translateError(error.message), 'err');
        return;
      }
      setMsg('Berhasil masuk ✓', 'ok');
      showApp(data.session);
    } catch (err) {
      setMsg('Gagal terhubung ke server. Cek koneksi internet.', 'err');
    } finally {
      btn.disabled = false;
    }
  }

  // Terjemahkan pesan error umum Supabase ke Indonesia
  function translateError(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('invalid login')) return 'Email atau password salah.';
    if (m.includes('email not confirmed')) return 'Email belum dikonfirmasi.';
    if (m.includes('rate limit')) return 'Terlalu banyak percobaan. Tunggu sebentar.';
    return msg || 'Login gagal.';
  }

  // --- Inisialisasi saat halaman siap ---
  document.addEventListener('DOMContentLoaded', async () => {
    lock(); // mulai dalam keadaan terkunci

    const form = $('authForm');
    if (form) form.addEventListener('submit', handleLogin);

    if (configMissing) {
      setMsg(
        'Konfigurasi Supabase belum diisi. Buka file supabase-config.js dan isi URL + anon key.',
        'err'
      );
      const btn = $('authSubmit');
      if (btn) btn.disabled = true;
      return;
    }

    // Cek sesi yang tersimpan → auto-masuk kalau masih valid
    try {
      const { data } = await sb.auth.getSession();
      if (data && data.session) {
        showApp(data.session);
      }
    } catch (e) {
      // biarkan terkunci, user login manual
    }

    // Jaga sinkron kalau token kedaluwarsa di tengah jalan
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) lock();
    });
  });
})();
