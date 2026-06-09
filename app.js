/* ====================================================================
   Octo Browser Dashboard — logika aplikasi
   Mode Dummy  : data contoh tersimpan di localStorage (default).
   Mode Live   : Local API (start/stop) + Cloud API (daftar profil).
   ==================================================================== */

const LS = {
  data: 'octo_dash_data',
  cfg : 'octo_dash_cfg',
};

// Bersihkan sisa master password lama dari versi sebelumnya
localStorage.removeItem('octo_master_hash');

/* Parse JSON dengan aman — data rusak tidak boleh mematikan aplikasi */
function safeParse(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback; }
  catch (e) { return fallback; }
}

/* Tampilkan error tak terduga alih-alih membiarkan halaman "mati" diam-diam */
window.addEventListener('error', e => {
  const n = document.getElementById('notice');
  if (n) { n.textContent = '⚠ Terjadi error: ' + e.message; n.classList.remove('hidden'); }
});

/* ---------- Konfigurasi ---------- */
let cfg = Object.assign(
  { localUrl: 'http://localhost:58888', token: '', live: false },
  safeParse(localStorage.getItem(LS.cfg), {})
);
const saveCfg = () => { try { localStorage.setItem(LS.cfg, JSON.stringify(cfg)); } catch (e) {} };

/* ---------- Data dummy ---------- */
function seedData() {
  return { profiles: [] };
}

let store = safeParse(localStorage.getItem(LS.data), null);
if (!store || !Array.isArray(store.profiles)) store = seedData();
const persist = () => {
  try { localStorage.setItem(LS.data, JSON.stringify(store)); }
  catch (e) { toast('Penyimpanan browser penuh — perubahan terakhir tidak tersimpan.'); }
};
// Bersihkan profil contoh bawaan (demo-001..demo-014); profil manual & Gmail tetap.
store.profiles = store.profiles.filter(p => !/^demo-\d{3}$/.test(p.uuid));
// Migrasi: pindahkan tag "gmail" → kolom Group (sekali jalan, idempoten)
store.profiles.forEach(p => {
  if (Array.isArray(p.tags) && p.tags.includes('gmail')) {
    if (!p.group) p.group = 'gmail';
    p.tags = p.tags.filter(t => t !== 'gmail');
  }
  // Bersihkan prefix "Gmail — " dari judul profil lama
  if (typeof p.title === 'string') {
    p.title = p.title.replace(/^Gmail\s*[—-]\s*/i, '').trim();
  }
  // Hapus URL inbox/mail Gmail lama dari profil (semua harus mendarat di GSC)
  if (typeof p.url === 'string' && /mail\.google\.com|gmail\.com\/?$|inbox/i.test(p.url)) {
    p.url = '';
  }
});
persist();

/* ---------- Util ---------- */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function timeAgo(ts) {
  const d = Date.now() - ts, h = Math.floor(d / 3600_000);
  if (h < 1) return 'baru saja';
  if (h < 24) return h + ' jam lalu';
  return Math.floor(h / 24) + ' hari lalu';
}
function fmtDateShort(ts) {
  try {
    const dt = new Date(ts);
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const dd = String(dt.getDate()).padStart(2,'0');
    const mo = months[dt.getMonth()];
    const yy = String(dt.getFullYear()).slice(2);
    const hh = String(dt.getHours()).padStart(2,'0');
    const mm = String(dt.getMinutes()).padStart(2,'0');
    return `${dd} ${mo} '${yy}, ${hh}:${mm}`;
  } catch (e) { return ''; }
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.add('hidden'), 2600);
}
function logLine(msg, cls = 'info') {
  const box = $('#autoLog');
  const time = new Date().toLocaleTimeString('id-ID');
  box.innerHTML += `<div class="${cls}">[${time}] ${esc(msg)}</div>`;
  box.scrollTop = box.scrollHeight;
}

/* ====================================================================
   LAPISAN API — mengembalikan profil & menjalankan aksi
   ==================================================================== */
const api = {
  /* Ambil daftar profil dari Cloud API Octo */
  async listProfiles() {
    if (!cfg.live) return store.profiles;
    if (!cfg.token) throw new Error('Token API kosong — isi di Pengaturan.');
    const res = await fetch('https://app.octobrowser.net/api/v2/automation/profiles?page_len=100', {
      headers: { 'X-Octo-Api-Token': cfg.token },
    });
    if (!res.ok) throw new Error('Cloud API HTTP ' + res.status);
    const json = await res.json();
    const active = await this.activeUuids().catch(() => []);
    return (json.data || []).map(p => ({
      uuid: p.uuid,
      title: p.title || '(tanpa nama)',
      os: p.fingerprint?.os || p.os || '—',
      status: active.includes(p.uuid) ? 'active' : 'stopped',
      tags: p.tags || [],
      proxy: p.proxy ? { type: p.proxy.type, host: p.proxy.host, port: p.proxy.port } : null,
      lastActive: p.updated_at ? Date.parse(p.updated_at) : Date.now(),
    }));
  },

  /* Daftar uuid profil yang sedang aktif (Local API) */
  async activeUuids() {
    const res = await fetch(cfg.localUrl + '/api/profiles/active');
    if (!res.ok) throw new Error('Local API HTTP ' + res.status);
    const j = await res.json();
    return (j.uuids || j.data || []).map(x => x.uuid || x);
  },

  async startProfile(uuid) {
    if (!cfg.live) { setStatus(uuid, 'active'); return; }
    const res = await fetch(cfg.localUrl + '/api/profiles/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid, headless: false }),
    });
    if (!res.ok) throw new Error('start gagal HTTP ' + res.status);
  },

  async stopProfile(uuid) {
    if (!cfg.live) { setStatus(uuid, 'stopped'); return; }
    const res = await fetch(cfg.localUrl + '/api/profiles/stop', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid }),
    });
    if (!res.ok) throw new Error('stop gagal HTTP ' + res.status);
  },

  async testConnection() {
    const res = await fetch(cfg.localUrl + '/api/connection');
    return res.ok;
  },
};

function setStatus(uuid, status) {
  const p = store.profiles.find(x => x.uuid === uuid);
  if (p) { p.status = status; p.lastActive = Date.now(); persist(); }
}

/* ====================================================================
   STATE TAMPILAN
   ==================================================================== */
let profiles = [];
let selected = new Set();
let editingUuid = null;

async function loadProfiles() {
  showNotice('');
  try {
    profiles = await api.listProfiles();
  } catch (e) {
    profiles = store.profiles;
    showNotice('⚠ Mode Live gagal: ' + e.message + ' — menampilkan data dummy. ' +
               'Catatan: panggilan langsung ke Cloud API dari browser sering diblokir CORS; ' +
               'gunakan Octo Browser yang berjalan + Local API, atau tetap di mode dummy.');
  }
  renderAll();
}

/* ---------- Notice ---------- */
function showNotice(msg) {
  const n = $('#notice');
  if (!msg) { n.classList.add('hidden'); return; }
  n.textContent = msg; n.classList.remove('hidden');
}

/* ---------- Render: semua ---------- */
function renderAll() {
  const sc = document.getElementById('sideCount');
  if (sc) sc.textContent = profiles.length;
  renderOverview();
  renderProfiles();
  renderProxies();
  renderTagSelects();
  updateConnBadge();
  renderSidebarExtras();
}

function renderSidebarExtras() {
  const elActive = document.getElementById('sideActiveNum');
  if (!elActive) return;
  const total = profiles.length;
  const active = activeOpen.size;
  elActive.textContent = active;
  document.getElementById('sideTotalNum').textContent = total;
  document.getElementById('sideActiveSub').textContent =
    active === 0 ? 'Tidak ada yang dibuka' :
    active === 1 ? '1 akun sedang dibuka' :
    active + ' akun sedang dibuka';

  const groupCount = {};
  const brandCount = {};
  profiles.forEach(p => {
    if (p.group) groupCount[p.group] = (groupCount[p.group] || 0) + 1;
    if (p.brand) brandCount[p.brand] = (brandCount[p.brand] || 0) + 1;
  });
  const miniBars = (counts) => {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (!entries.length) return '<div class="side-empty">— belum ada</div>';
    const max = Math.max(...entries.map(([, n]) => n));
    return entries.map(([k, n]) => `
      <div class="side-mini-row">
        <span class="side-mini-lbl" title="${esc(k)}">${esc(k)}</span>
        <span class="side-mini-bar"><span class="side-mini-fill" style="width:${n/max*100}%"></span></span>
        <span class="side-mini-n">${n}</span>
      </div>`).join('');
  };
  document.getElementById('sideDistGroup').innerHTML = miniBars(groupCount);
  document.getElementById('sideDistBrand').innerHTML = miniBars(brandCount);
}

/* ---------- Render: ringkasan ---------- */
function animateStats() {
  $$('.stat-num').forEach(el => {
    const target = parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
    if (target <= 0) return;
    const dur = 650, t0 = performance.now();
    el.textContent = '0';
    const frame = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

/* Sprinkle bintang di latar (statis, ringan) */
function makeStarfield() {
  const container = document.querySelector('.bg-orbs');
  if (!container || container.querySelector('.star')) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('span');
    s.className = 'star';
    const size = (Math.random() * 1.8 + 0.5).toFixed(2);
    s.style.cssText = `top:${(Math.random() * 100).toFixed(2)}vh;left:${(Math.random() * 100).toFixed(2)}vw;` +
      `width:${size}px;height:${size}px;opacity:${(Math.random() * 0.65 + 0.25).toFixed(2)}`;
    frag.appendChild(s);
  }
  container.appendChild(frag);
}

/* Konstelasi visual untuk Sebaran Tag (cached agar tidak shift saat re-render) */
let _constNodes = null;
function buildConstellationSVG(count) {
  const W = 540, H = 130;
  const n = Math.min(50, Math.max(10, count));
  if (!_constNodes || _constNodes.length !== n) {
    let seed = 7919;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    _constNodes = Array.from({ length: n }, () => ({ x: rand() * (W - 30) + 15, y: rand() * (H - 30) + 15, h: rand() * 360 }));
  }
  const nodes = _constNodes;
  const lines = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
      const d = Math.hypot(dx, dy);
      if (d < 85) lines.push({ a: i, b: j, d });
    }
  }
  return `<svg class="constellation" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">` +
    lines.map(l => `<line x1="${nodes[l.a].x.toFixed(1)}" y1="${nodes[l.a].y.toFixed(1)}" x2="${nodes[l.b].x.toFixed(1)}" y2="${nodes[l.b].y.toFixed(1)}" stroke="rgba(155,140,255,${(0.55 - l.d / 170).toFixed(2)})" stroke-width=".7"/>`).join('') +
    nodes.map(nn => `<circle cx="${nn.x.toFixed(1)}" cy="${nn.y.toFixed(1)}" r="2.1" fill="hsl(${Math.round(nn.h)},72%,68%)"/>`).join('') +
    '</svg>';
}

function renderOverview() {
  $('#stTotal').textContent  = profiles.length;
  $('#stTags').textContent   = profiles.filter(p => p.verified).length;
  $('#stWithPw').textContent = new Set(profiles.map(p => p.brand).filter(Boolean)).size;
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  $('#stToday').textContent  = profiles.filter(p => p.lastActive >= startOfDay).length;


  // Sebaran group (bar berwarna per group)
  const groupCount = {};
  profiles.forEach(p => { if (p.group) groupCount[p.group] = (groupCount[p.group] || 0) + 1; });
  const sortedGroups = Object.entries(groupCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...sortedGroups.map(([, n]) => n));
  const totalUses = sortedGroups.reduce((s, [, n]) => s + n, 0) || 1;
  const accountTotal = profiles.filter(p => p.gmail).length;
  const constellation = accountTotal > 0 ? buildConstellationSVG(accountTotal) : '';
  const bars = sortedGroups.map(([g, n]) => {
    // Group "gmail" pakai warna hijau (sesuai pill di tabel); group lain pakai warna hash
    const isGmail = g.toLowerCase() === 'gmail';
    const c = hueOf(g);
    const labelStyle = isGmail
      ? 'border-color:rgba(61,220,151,.5);background:rgba(61,220,151,.18);color:#9aeec6'
      : `border-color:hsla(${c},45%,55%,.5);background:hsla(${c},55%,45%,.18);color:hsl(${c},75%,75%)`;
    const fillStyle = isGmail
      ? `width:${n / max * 100}%;background:linear-gradient(90deg,#1fb87a,#3ddc97);box-shadow:0 0 14px rgba(61,220,151,.55)`
      : `width:${n / max * 100}%;background:linear-gradient(90deg,hsl(${c},60%,52%),hsl(${c},75%,64%));box-shadow:0 0 14px hsla(${c},70%,55%,.45)`;
    const pct = Math.round(n / totalUses * 100);
    return `<div class="bar-row">
      <span class="bl" style="${labelStyle}">${esc(g)}</span>
      <span class="bar-track"><span class="bar-fill" style="${fillStyle}"></span></span>
      <span class="bv">${n}<span class="pct">·${pct}%</span></span>
    </div>`;
  }).join('') || '<p class="muted">Belum ada group.</p>';
  $('#tagChart').innerHTML = constellation + bars;

  // Aktivitas dengan avatar berwarna
  const recent = [...profiles].sort((a, b) => b.lastActive - a.lastActive).slice(0, 6);
  $('#activity').innerHTML = recent.map(p => {
    const email = p.gmail ? p.gmail.email : p.title;
    const init = (email.match(/[a-zA-Z]/) || ['?'])[0].toUpperCase();
    let h = 0; for (let i = 0; i < email.length; i++) h = email.charCodeAt(i) + ((h << 5) - h);
    const hue = Math.abs(h) % 360;
    return `<li data-uuid="${p.uuid}">
      <span class="avatar" style="background:hsl(${hue},62%,52%)">${esc(init)}</span>
      <span class="a-mail">${esc(email)}</span>
      <span class="a-time">${timeAgo(p.lastActive)}</span>
      <span class="a-go">›</span>
    </li>`;
  }).join('') || '<li class="muted">Belum ada aktivitas.</li>';
}

/* ---------- Render: tabel profil ---------- */
let sortBy = { key: null, dir: 1 };
function getFiltered() {
  const q   = $('#search').value.toLowerCase().trim();
  const tag = $('#filterTag').value;
  const st  = $('#filterStatus').value;
  const list = profiles.filter(p =>
    (!q   || p.title.toLowerCase().includes(q)) &&
    (!tag || p.tags.includes(tag)) &&
    (!st  || p.status === st));
  if (sortBy.key) {
    const k = sortBy.key, dir = sortBy.dir;
    const val = p => {
      if (k === 'lastActive') return (p.usage || 0) > 0 ? (p.lastActive || 0) : 0;
      if (k === 'usage')      return p.usage || 0;
      if (k === 'title')      return (p.title || '').toLowerCase();
      if (k === 'group')      return (p.group || '').toLowerCase();
      if (k === 'brand')      return (p.brand || '').toLowerCase();
      return '';
    };
    list.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      return 0;
    });
  }
  return list;
}

function hueOf(s) {
  let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}

function renderProfiles() {
  const list = getFiltered();
  const body = $('#profileRows');
  $('#emptyProfiles').classList.toggle('hidden', list.length > 0);
  const total = profiles.length;
  $('#profileCount').textContent = list.length === total
    ? `${total} akun Gmail`
    : `${list.length} ditampilkan · dari ${total} akun`;
  body.innerHTML = list.map(p => {
    const proxy = p.proxy ? `${p.proxy.type} · ${esc(p.proxy.host)}:${esc(p.proxy.port)}` :
                            '<span class="muted">tanpa proxy</span>';
    const tags = p.tags.map(t => {
      const c = hueOf(t);
      return `<span class="tag" style="border-color:hsla(${c},45%,55%,.5);background:hsla(${c},55%,45%,.18);color:hsl(${c},75%,75%)">${esc(t)}</span>`;
    }).join('') || '<span class="muted">—</span>';
    const on = p.status === 'active';
    const ident = p.gmail ? p.gmail.email : p.title;
    const init = (ident.match(/[a-zA-Z]/) || ['?'])[0].toUpperCase();
    const hue = hueOf(ident);
    return `<tr>
      <td class="chk"><input type="checkbox" class="rowchk" data-uuid="${p.uuid}" ${selected.has(p.uuid)?'checked':''}></td>
      <td>
        <div class="p-row">
          <span class="avatar" style="background:hsl(${hue},62%,52%)">${esc(init)}</span>
          <div class="p-name"><strong>${esc(p.title)}</strong><span>${esc(p.gmail ? p.gmail.email : p.uuid)}</span></div>
        </div>
      </td>
      <td><span class="badge ${p.status}">${on?'Aktif':'Berhenti'}</span></td>
      <td>${esc(p.os)}</td>
      <td>${proxy}</td>
      <td>${p.group ? `<span class="group-pill">${esc(p.group)}</span>` : '<span class="muted">—</span>'}</td>
      <td>${p.brand ? `<span class="brand-pill">${esc(p.brand)}</span>` : '<span class="muted">—</span>'}</td>
      <td><span class="badge-conn">Connected</span></td>
      <td><div class="p-usage">
        ${activeOpen.has(p.uuid)
          ? `<span class="p-usage-on">● 1× Sedang aktif</span>
             <span class="p-usage-t">akun sedang dibuka</span>`
          : `<span class="p-usage-n">0× dipakai</span>
             <span class="p-usage-t">tidak aktif</span>`}
      </div></td>
      <td><div class="act-btns">
        <button class="btn-login" data-act="open" data-uuid="${p.uuid}">Login</button>
        <button class="iconbtn ed" data-act="edit" data-uuid="${p.uuid}" title="Edit">✎</button>
        <button class="iconbtn dl" data-act="del" data-uuid="${p.uuid}" title="Hapus">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
  updateBulkbar();
}

/* ---------- Render: proxy ---------- */
function renderProxies() {
  const map = new Map();
  profiles.forEach(p => {
    if (!p.proxy) return;
    const key = p.proxy.host + ':' + p.proxy.port;
    if (!map.has(key)) map.set(key, { ...p.proxy, used: 0 });
    map.get(key).used++;
  });
  const rows = [...map.values()];
  $('#emptyProxies').classList.toggle('hidden', rows.length > 0);
  $('#proxyRows').innerHTML = rows.map(px => `
    <tr>
      <td><strong>${esc(px.host)}</strong></td>
      <td>${esc(px.type)}</td>
      <td>${esc(px.host)}:${esc(px.port)}</td>
      <td>${px.used} profil</td>
      <td><span class="badge active">OK</span></td>
    </tr>`).join('');
}

/* ---------- Select tag ---------- */
function renderTagSelects() {
  const tags = [...new Set(profiles.flatMap(p => p.tags))].sort();
  const optTag  = '<option value="">Semua tag</option>' + tags.map(t=>`<option>${esc(t)}</option>`).join('');
  const optAuto = '<option value="">Semua tag</option>' + tags.map(t=>`<option>${esc(t)}</option>`).join('');
  const ft = $('#filterTag'), at = $('#autoTag');
  const fv = ft.value, av = at.value;
  ft.innerHTML = optTag;  ft.value = fv;
  at.innerHTML = optAuto; at.value = av;
}

/* ---------- Bulkbar ---------- */
function updateBulkbar() {
  const bar = $('#bulkbar');
  const gridActive = document.getElementById('iframeView')?.classList.contains('grid');
  bar.classList.toggle('hidden', selected.size === 0 || gridActive);
  $('#bulkCount').textContent = selected.size + ' dipilih';
  const all = getFiltered();
  $('#checkAll').checked = all.length > 0 && all.every(p => selected.has(p.uuid));
}

/* ---------- Conn badge ---------- */
function updateConnBadge() {
  const b = $('#connBadge'), t = $('#connText');
  b.classList.remove('live','err');
  if (cfg.live) { b.classList.add('live'); t.textContent = 'Mode Live'; }
  else          { t.textContent = 'Mode Dummy'; }
}

/* ====================================================================
   AKSI
   ==================================================================== */
/* Panel iframe: tampilkan situs di dalam area dashboard (bukan tab baru/jendela baru) */
const FRAME_SIBLINGS = '#bulkGmailCard, #view-profiles .toolbar, #view-profiles .list-info, #view-profiles .card.no-pad';
const IS_ELECTRON = !!window.electronAPI?.isElectron;
let currentOpenUuid = null;
let currentSideFilter = 'all';
let currentGridZoom = 1;
const activeOpen = new Set();
let currentSingleZoom = 1;

/* Tandai akun sudah berhasil login ketika webview mendarat di service Google
   (bukan halaman sign-in/account-chooser lagi). */
function markVerifiedIfLoggedIn(p, url) {
  if (!p || !url) return;
  const isSignIn = /accounts\.google\.com\/(signin|v3\/signin|ServiceLogin|AccountChooser)/i.test(url);
  const isGoogleService = /^https?:\/\/[^\/]*\.google\.com\//i.test(url) && !isSignIn;
  if (isGoogleService && !p.verified) {
    p.verified = true;
    const sp = store.profiles.find(x => x.uuid === p.uuid);
    if (sp) sp.verified = true;
    if (!cfg.live) persist();
    renderOverview();
    toast('✓ ' + (p.gmail?.email || p.title) + ' berhasil masuk');
  }
}

/* Di mode aplikasi (Electron), ganti <iframe> dengan <webview> — webview tidak
   terkena pemblokiran X-Frame-Options. Tiap profil pakai partition berbeda
   supaya cookies & login akun A tidak bocor ke akun B. */
function ensureFrameTarget(p) {
  if (!IS_ELECTRON) return;
  const want = 'persist:profile-' + p.uuid;
  const cur = document.getElementById('iframeBox');
  if (cur && cur.tagName.toLowerCase() === 'webview' && cur.getAttribute('partition') === want) return;
  const wv = document.createElement('webview');
  wv.id = 'iframeBox';
  wv.setAttribute('allowpopups', '');
  wv.setAttribute('partition', want);
  wv.style.cssText = 'width:100%;height:100%;display:flex';
  const updateUrl = ev => {
    const u = $('#iframeURL'); if (u && !u.matches(':focus') && ev.url) u.value = ev.url;
    markVerifiedIfLoggedIn(p, ev.url);
  };
  wv.addEventListener('did-navigate', updateUrl);
  wv.addEventListener('did-navigate-in-page', updateUrl);
  wv.addEventListener('dom-ready', () => { try { wv.setZoomFactor(currentSingleZoom); } catch (e) {} });
  cur.replaceWith(wv);
}

function openGridView(uuids) {
  const profs = uuids.map(u => profiles.find(p => p.uuid === u)).filter(p => p && p.gmail);
  if (!profs.length) return;
  activeOpen.clear();
  const n = profs.length;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const grid = $('#gridWrap');
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.innerHTML = profs.map(p => {
    const url = siteFor(p);
    const part = 'persist:profile-' + p.uuid;
    const inner = IS_ELECTRON
      ? `<webview src="${esc(url)}" partition="${esc(part)}" allowpopups></webview>`
      : `<iframe src="${esc(url)}" referrerpolicy="no-referrer"></iframe>`;
    p.lastActive = Date.now();
    activeOpen.add(p.uuid);
    return `<div class="grid-cell" data-uuid="${p.uuid}">
      <div class="grid-cell-bar">
        <span class="gc-email">${esc(p.gmail.email)}</span>
        <input type="text" class="gc-url" value="${esc(url)}" spellcheck="false" />
        <div class="gc-zoom">
          <button class="gc-mini gc-zout" title="Perkecil">−</button>
          <span class="gc-zlabel">100%</span>
          <button class="gc-mini gc-zin" title="Perbesar">+</button>
        </div>
        <button class="gc-mini gc-gmail" title="Buka Gmail di kotak ini">✉</button>
        <button class="gc-mini gc-gsc" title="Buka Search Console di kotak ini">GSC</button>
        <button class="gc-mini gc-disavow" title="Buka Disavow di kotak ini">DIS</button>
        <button class="gc-toggle" title="Ganti akun di kotak ini">▾</button>
      </div>
      ${inner}
      <div class="gc-dropdown hidden">
        <input class="gc-search" placeholder="Cari email / tag…">
        <div class="gc-list"></div>
      </div>
    </div>`;
  }).join('');
  // Perkecil tiap webview agar seluruh isi situs muat di sel grid (tidak terpotong)
  const zoom = cols >= 4 ? 0.45 : cols === 3 ? 0.55 : cols === 2 ? 0.72 : 1;
  currentGridZoom = zoom;
  grid.querySelectorAll('webview').forEach(wv => {
    const cell = wv.closest('.grid-cell');
    if (cell) cell.dataset.zoom = zoom;
    const label = cell?.querySelector('.gc-zlabel');
    if (label) label.textContent = Math.round(zoom * 100) + '%';
    wv.addEventListener('dom-ready', () => { try { wv.setZoomFactor(parseFloat(cell?.dataset.zoom) || zoom); } catch (e) {} });
    const upd = ev => {
      const inp = cell?.querySelector('.gc-url'); if (inp && !inp.matches(':focus') && ev.url) inp.value = ev.url;
      const cp = profiles.find(x => x.uuid === cell?.dataset.uuid);
      markVerifiedIfLoggedIn(cp, ev.url);
    };
    wv.addEventListener('did-navigate', upd);
    wv.addEventListener('did-navigate-in-page', upd);
  });
  $('#iframeBox').classList.add('hidden');
  $('#iframeBox').src = 'about:blank';
  grid.classList.remove('hidden');
  $('#iframeTitle').innerHTML = `<strong>${n} akun</strong> &nbsp;·&nbsp; <span class="muted">tampil berdampingan</span>`;
  $('#iframeOpenTab').style.display = 'none';
  $('#iframeView').classList.add('grid');
  document.body.classList.add('framing');
  document.querySelectorAll(FRAME_SIBLINGS).forEach(el => el.classList.add('hidden'));
  $('#iframeView').classList.remove('hidden');
  currentOpenUuid = null;
  if (!cfg.live) { store.profiles = profiles; persist(); }
  renderSidePanel();
  updateBulkbar();
  renderSidebarExtras();
}

function openInFrame(p) {
  activeOpen.clear();
  activeOpen.add(p.uuid);
  currentOpenUuid = p.uuid;
  $('#gridWrap').classList.add('hidden'); $('#gridWrap').innerHTML = '';
  $('#iframeBox').classList.remove('hidden');
  $('#iframeView').classList.remove('grid');
  $('#iframeOpenTab').style.display = '';
  const url = siteFor(p);
  const host = url.replace(/^https?:\/\//, '').split('/')[0];
  ensureFrameTarget(p);
  $('#iframeTitle').innerHTML = `<strong>${esc(p.title)}</strong> &nbsp;·&nbsp; <span class="muted">${esc(host)}</span>`;
  $('#iframeBox').src = url;
  $('#iframeOpenTab').href = url;
  $('#iframeURL').value = url;
  currentSingleZoom = 1;
  $('#zoomLabel').textContent = '100%';
  document.querySelectorAll(FRAME_SIBLINGS).forEach(el => el.classList.add('hidden'));
  $('#iframeView').classList.remove('hidden');
  document.body.classList.add('framing');
  renderSidePanel();
  updateBulkbar();
  renderSidebarExtras();
  p.lastActive = Date.now();
  p.usage = (p.usage || 0) + 1;
  if (!cfg.live) { store.profiles = profiles; persist(); }
}

/* Daftar akun di panel kiri saat iframe view aktif */
function renderSidePanel() {
  const gmails = profiles.filter(p => p.gmail);
  const tagCounts = {};
  gmails.forEach(p => p.tags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1));
  // Tag "gmail" otomatis muncul di semua → sama dengan "Semua", jadi disembunyikan
  const tags = Object.keys(tagCounts).filter(t => t !== 'gmail').sort();

  // Filter berdasarkan group
  const groupCounts = {};
  gmails.forEach(p => { if (p.group) groupCounts[p.group] = (groupCounts[p.group] || 0) + 1; });
  const groups = Object.keys(groupCounts).sort();

  // Filter berdasarkan brand
  const brandCounts = {};
  gmails.forEach(p => { if (p.brand) brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1; });
  const brands = Object.keys(brandCounts).sort();

  const filters = [{ key: 'all', label: 'SEMUA', count: gmails.length, kind: 'all' }]
    .concat(tags.map(t => ({ key: 'tag:' + t, label: 'GMAIL ' + t.toUpperCase(), count: tagCounts[t], kind: 'tag' })))
    .concat(groups.map(g => ({ key: 'group:' + g, label: 'GROUP ' + g.toUpperCase(), count: groupCounts[g], kind: 'group' })))
    .concat(brands.map(b => ({ key: 'brand:' + b, label: 'BRAND ' + b.toUpperCase(), count: brandCounts[b], kind: 'brand' })));

  // Dropdown gabungan untuk SEMUA / GROUP / BRAND / GMAIL (TAG)
  const groupOpts = ['all','tag:','group:','brand:'];
  const groupedByKind = {
    all:   filters.filter(f => f.kind === 'all'),
    group: filters.filter(f => f.kind === 'group'),
    brand: filters.filter(f => f.kind === 'brand'),
    tag:   filters.filter(f => f.kind === 'tag'),
  };
  const kindLabel = { group:'GROUP', brand:'BRAND', tag:'GMAIL TAG' };
  let opts = '';
  groupedByKind.all.forEach(f => {
    opts += `<option value="${esc(f.key)}" ${currentSideFilter===f.key?'selected':''}>★ ${esc(f.label)} · ${f.count}</option>`;
  });
  ['group','brand','tag'].forEach(kind => {
    if (groupedByKind[kind].length) {
      opts += `<optgroup label="${kindLabel[kind]}">`;
      groupedByKind[kind].forEach(f => {
        const shortLabel = f.label.replace(/^(GROUP |BRAND |GMAIL )/, '');
        opts += `<option value="${esc(f.key)}" ${currentSideFilter===f.key?'selected':''}>${esc(shortLabel)} · ${f.count}</option>`;
      });
      opts += `</optgroup>`;
    }
  });
  $('#ifFilters').innerHTML = `<select id="ifFilterSelect" class="if-filter-select">${opts}</select>`;

  const tag = currentSideFilter.startsWith('tag:') ? currentSideFilter.slice(4) : null;
  const brand = currentSideFilter.startsWith('brand:') ? currentSideFilter.slice(6) : null;
  const grp = currentSideFilter.startsWith('group:') ? currentSideFilter.slice(6) : null;
  const q = ($('#ifSearch')?.value || '').toLowerCase().trim();
  let list = tag ? gmails.filter(p => p.tags.includes(tag))
         : brand ? gmails.filter(p => p.brand === brand)
         : grp ? gmails.filter(p => p.group === grp)
         : gmails;
  if (q) list = list.filter(p =>
    p.gmail.email.toLowerCase().includes(q) ||
    p.tags.some(t => t.toLowerCase().includes(q)) ||
    (p.brand && p.brand.toLowerCase().includes(q)) ||
    (p.group && p.group.toLowerCase().includes(q)));

  $('#ifList').innerHTML = list.map(p => {
    const email = p.gmail.email;
    const name = email.split('@')[0] || email;
    const init = (email.match(/[a-zA-Z]/) || ['?'])[0].toUpperCase();
    const hue = hueOf(email);
    const active = p.uuid === currentOpenUuid;
    const inUse = activeOpen.has(p.uuid);
    const checked = selected.has(p.uuid);
    return `<div class="if-item ${active ? 'active' : ''} ${inUse ? 'in-use' : ''}" data-uuid="${p.uuid}">
      <label class="if-check-wrap" onclick="event.stopPropagation()">
        <input type="checkbox" class="if-check" data-uuid="${p.uuid}" ${checked?'checked':''}>
      </label>
      <span class="if-avatar" style="background:hsl(${hue},62%,52%)">${esc(init)}${inUse ? '<span class="if-avatar-dot" title="Sedang aktif"></span>' : ''}</span>
      <div class="if-info">
        <div class="if-item-name">${esc(name)}</div>
        <div class="if-item-email">${esc(email)}</div>
      </div>
    </div>`;
  }).join('') || '<div class="muted" style="padding:14px;text-align:center;font-size:11px">Tidak ada akun</div>';
}
function closeFrame() {
  const view = document.getElementById('iframeView');
  if (!view || view.classList.contains('hidden')) return;
  view.classList.add('hidden');
  view.classList.remove('grid');
  $('#iframeBox').src = 'about:blank';
  $('#iframeBox').classList.remove('hidden');
  $('#gridWrap').innerHTML = '';
  $('#gridWrap').classList.add('hidden');
  $('#iframeOpenTab').style.display = '';
  document.body.classList.remove('framing');
  document.querySelectorAll(FRAME_SIBLINGS).forEach(el => el.classList.remove('hidden'));
  // Reset pengguna aktif ke 0 saat keluar / tutup
  activeOpen.clear();
  if (!cfg.live) { store.profiles = profiles; persist(); }
  renderProfiles();
  renderSidebarExtras();
}

/* Tentukan situs yang dibuka saat tombol ▶ diklik */
function siteFor(p) {
  // Akun Gmail SELALU mendarat di Search Console — tidak pernah ke inbox/mail.
  if (p.gmail) {
    const e = encodeURIComponent(p.gmail.email);
    let gsc = 'https://search.google.com/search-console';
    if (p.gscProperty) gsc += '?resource_id=' + encodeURIComponent(p.gscProperty);
    const next = encodeURIComponent(gsc);
    return `https://accounts.google.com/AccountChooser?Email=${e}&continue=${next}`;
  }
  if (p.url) return /^https?:\/\//i.test(p.url) ? p.url : 'https://' + p.url;
  const t = (p.title || '').toLowerCase();
  const map = {
    facebook: 'https://facebook.com', tiktok: 'https://tiktok.com',
    instagram: 'https://instagram.com', youtube: 'https://youtube.com',
    twitter: 'https://twitter.com', amazon: 'https://amazon.com',
    shopee: 'https://shopee.co.id', tokopedia: 'https://tokopedia.com',
    google: 'https://google.com',
  };
  for (const k in map) if (t.includes(k)) return map[k];
  return 'https://www.google.com/';
}

async function doAction(act, uuid) {
  const p = profiles.find(x => x.uuid === uuid);
  try {
    if (act === 'open') { openInFrame(p); return; }
    if (act === 'start') { await api.startProfile(uuid); p.status='active'; toast('Profil dijalankan'); }
    if (act === 'stop')  { await api.stopProfile(uuid);  p.status='stopped'; toast('Profil dihentikan'); }
    if (act === 'edit')  { return openModal(uuid); }
    if (act === 'del') {
      if (!confirm('Hapus profil "' + p.title + '"?')) return;
      store.profiles = store.profiles.filter(x => x.uuid !== uuid);
      persist();
      if (!cfg.live) { profiles = store.profiles; }
      toast('Profil dihapus');
    }
    p && (p.lastActive = Date.now());
    if (!cfg.live && p) { const sp = store.profiles.find(x=>x.uuid===uuid); if (sp) sp.status = p.status; persist(); }
    renderAll();
  } catch (e) {
    toast('Gagal: ' + e.message);
  }
}

/* ---------- Modal ---------- */
function openModal(uuid) {
  editingUuid = uuid || null;
  const p = uuid ? profiles.find(x => x.uuid === uuid) : null;
  $('#modalTitle').textContent = p ? 'Edit Profil' : 'Profil Baru';
  $('#mTitle').value = p ? p.title : '';
  $('#mOs').value = p ? p.os : 'Windows';
  $('#mTags').value = p ? p.tags.join(', ') : '';
  $('#mProxyType').value = p && p.proxy ? p.proxy.type : '';
  $('#mProxyHost').value = p && p.proxy ? p.proxy.host : '';
  $('#mProxyPort').value = p && p.proxy ? p.proxy.port : '';
  $('#mEmail').value = p && p.gmail ? p.gmail.email : '';
  $('#mPass').value  = p && p.gmail ? p.gmail.password : '';
  $('#mUrl').value   = p && p.url ? p.url : '';
  $('#mGSC').value   = p && p.gscProperty ? p.gscProperty : '';
  $('#mGroup').value = p && p.group ? p.group : '';
  $('#mBrand').value = p && p.brand ? p.brand : '';
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); editingUuid = null; }

function saveModal() {
  const title = $('#mTitle').value.trim();
  if (!title) { toast('Nama profil wajib diisi'); return; }
  const tags = $('#mTags').value.split(',').map(s=>s.trim()).filter(Boolean);
  const pType = $('#mProxyType').value;
  const proxy = pType ? { type:pType, host:$('#mProxyHost').value.trim(), port:$('#mProxyPort').value.trim() } : null;

  const email = $('#mEmail').value.trim();
  const gmail = email ? { email, password: $('#mPass').value.trim() } : null;
  const url = $('#mUrl').value.trim();
  const gscProperty = $('#mGSC').value.trim();
  const group = $('#mGroup').value.trim();
  const brand = $('#mBrand').value.trim();

  if (editingUuid) {
    const p = store.profiles.find(x => x.uuid === editingUuid);
    if (p) Object.assign(p, { title, os:$('#mOs').value, tags, proxy, gmail, url, gscProperty, group, brand });
  } else {
    store.profiles.unshift({
      uuid: (gmail ? 'gm-' : 'demo-') + Date.now().toString(36),
      title, os:$('#mOs').value, status:'stopped', tags, proxy, gmail, url, gscProperty, group, brand,
      lastActive: Date.now(),
    });
  }
  persist();
  closeModal();
  toast('Profil disimpan');
  if (cfg.live) showNotice('ℹ Profil disimpan ke data dummy. Pembuatan profil di akun Octo asli ' +
                            'perlu dilakukan lewat aplikasi Octo Browser.');
  loadProfiles();
}

/* ====================================================================
   NAVIGASI
   ==================================================================== */
const titles = {
  overview:  ['Ringkasan',    'Pantauan cepat seluruh profil Anda'],
  profiles:  ['Profil',       'Kelola, jalankan, dan edit profil browser'],
  proxies:   ['Proxy',        'Daftar proxy yang dipakai profil'],
  automation:['Otomatisasi',  'Jalankan aksi massal pada banyak profil'],
  settings:  ['Pengaturan',   'Koneksi Octo Browser dan data'],
};
function switchView(name) {
  closeFrame();
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $$('.view').forEach(v => v.classList.add('hidden'));
  $('#view-' + name).classList.remove('hidden');
  $('#viewTitle').textContent = titles[name][0];
  $('#viewSub').textContent   = titles[name][1];
  if (name === 'overview') animateStats();
}

/* ====================================================================
   EVENT BINDING
   ==================================================================== */
$$('.nav-item').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
$('#iframeClose')?.addEventListener('click', closeFrame);

/* Tombol Gmail & GSC di header webview: pindahkan situs sesuai akun yg sedang dibuka */
function gotoService(targetUrl, hostLabel) {
  if (!currentOpenUuid) return;
  const p = profiles.find(x => x.uuid === currentOpenUuid);
  if (!p || !p.gmail) return;
  const url = 'https://accounts.google.com/AccountChooser?Email=' +
    encodeURIComponent(p.gmail.email) + '&continue=' + encodeURIComponent(targetUrl);
  document.getElementById('iframeBox').src = url;
  $('#iframeOpenTab').href = url;
  $('#iframeTitle').innerHTML = `<strong>${esc(p.title)}</strong> &nbsp;·&nbsp; <span class="muted">${esc(hostLabel)}</span>`;
  $('#iframeURL').value = targetUrl;
}

/* Zoom & URL bar untuk single-view */
function applySingleZoom() {
  const wv = document.getElementById('iframeBox');
  if (wv && wv.tagName.toLowerCase() === 'webview') {
    try { wv.setZoomFactor(currentSingleZoom); } catch (e) {}
  }
  $('#zoomLabel').textContent = Math.round(currentSingleZoom * 100) + '%';
}
$('#zoomOut')?.addEventListener('click', () => {
  currentSingleZoom = Math.max(0.3, Math.round((currentSingleZoom - 0.1) * 10) / 10);
  applySingleZoom();
});
$('#zoomIn')?.addEventListener('click', () => {
  currentSingleZoom = Math.min(2, Math.round((currentSingleZoom + 0.1) * 10) / 10);
  applySingleZoom();
});
$('#iframeURL')?.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  let u = e.target.value.trim();
  if (!u) return;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  document.getElementById('iframeBox').src = u;
  $('#iframeOpenTab').href = u;
});
$('#iframeGmail')?.addEventListener('click', () =>
  gotoService('https://mail.google.com/mail/u/0/', 'mail.google.com'));
$('#iframeGSC')?.addEventListener('click', () => {
  const p = currentOpenUuid && profiles.find(x => x.uuid === currentOpenUuid);
  let target = 'https://search.google.com/search-console';
  if (p && p.gscProperty) target += '?resource_id=' + encodeURIComponent(p.gscProperty);
  gotoService(target, 'search.google.com');
});
$('#iframeDisavow')?.addEventListener('click', () =>
  gotoService('https://search.google.com/search-console/disavow-links', 'search.google.com/disavow'));
$('#ifList')?.addEventListener('click', e => {
  if (e.target.closest('.if-check-wrap')) return;
  const item = e.target.closest('.if-item');
  if (!item) return;
  const p = profiles.find(x => x.uuid === item.dataset.uuid);
  if (p) openInFrame(p);
});
$('#ifList')?.addEventListener('change', e => {
  if (!e.target.classList.contains('if-check')) return;
  const u = e.target.dataset.uuid;
  e.target.checked ? selected.add(u) : selected.delete(u);
  updateBulkbar();
});
$('#ifFilters')?.addEventListener('change', e => {
  if (e.target.id !== 'ifFilterSelect') return;
  currentSideFilter = e.target.value;
  renderSidePanel();
});
$('#ifFilters')?.addEventListener('click', e => {
  const btn = e.target.closest('.if-filter');
  if (!btn) return;
  currentSideFilter = btn.dataset.filter;
  renderSidePanel();
});
$('#ifSearch')?.addEventListener('input', renderSidePanel);

/* Pencarian per kotak grid: tiap kotak bisa ganti akun lewat cari email/tag */
function gcFillList(cell, q) {
  const query = (q || '').toLowerCase().trim();
  const items = profiles.filter(p => p.gmail &&
    (!query || p.gmail.email.toLowerCase().includes(query) || p.tags.some(t => t.toLowerCase().includes(query))));
  cell.querySelector('.gc-list').innerHTML = items.map(p =>
    `<div class="gc-item" data-uuid="${p.uuid}">${esc(p.gmail.email)}</div>`).join('')
    || '<div class="gc-empty">tidak ada akun</div>';
}
function gcSwap(cell, p) {
  const url = siteFor(p);
  const old = cell.querySelector('webview, iframe');
  const el = document.createElement(IS_ELECTRON ? 'webview' : 'iframe');
  el.setAttribute('src', url);
  if (IS_ELECTRON) {
    el.setAttribute('partition', 'persist:profile-' + p.uuid);
    el.setAttribute('allowpopups', '');
    const z = parseFloat(cell.dataset.zoom) || currentGridZoom;
    el.addEventListener('dom-ready', () => { try { el.setZoomFactor(z); } catch (e) {} });
    const upd = ev => {
      const inp = cell.querySelector('.gc-url'); if (inp && !inp.matches(':focus') && ev.url) inp.value = ev.url;
      markVerifiedIfLoggedIn(p, ev.url);
    };
    el.addEventListener('did-navigate', upd);
    el.addEventListener('did-navigate-in-page', upd);
  }
  if (old) old.replaceWith(el);
  const oldUuid = cell.dataset.uuid;
  if (oldUuid && oldUuid !== p.uuid) activeOpen.delete(oldUuid);
  cell.dataset.uuid = p.uuid;
  cell.querySelector('.gc-email').textContent = p.gmail.email;
  const urlIn = cell.querySelector('.gc-url'); if (urlIn) urlIn.value = url;
  p.lastActive = Date.now();
  activeOpen.add(p.uuid);
  renderSidePanel();
}
function gcGotoService(cell, targetUrl) {
  const p = profiles.find(x => x.uuid === cell.dataset.uuid);
  if (!p || !p.gmail) return;
  const url = 'https://accounts.google.com/AccountChooser?Email=' +
    encodeURIComponent(p.gmail.email) + '&continue=' + encodeURIComponent(targetUrl);
  const wv = cell.querySelector('webview, iframe');
  if (wv) wv.src = url;
  const inp = cell.querySelector('.gc-url'); if (inp) inp.value = targetUrl;
}
function gcApplyZoom(cell, z) {
  z = Math.max(0.3, Math.min(2, Math.round(z * 10) / 10));
  cell.dataset.zoom = z;
  const lbl = cell.querySelector('.gc-zlabel'); if (lbl) lbl.textContent = Math.round(z * 100) + '%';
  const wv = cell.querySelector('webview');
  if (wv) { try { wv.setZoomFactor(z); } catch (e) {} }
}
$('#gridWrap')?.addEventListener('click', e => {
  const zo = e.target.closest('.gc-zout');
  if (zo) { const cell = zo.closest('.grid-cell'); gcApplyZoom(cell, (parseFloat(cell.dataset.zoom) || 1) - 0.1); return; }
  const zi = e.target.closest('.gc-zin');
  if (zi) { const cell = zi.closest('.grid-cell'); gcApplyZoom(cell, (parseFloat(cell.dataset.zoom) || 1) + 0.1); return; }
  const gm = e.target.closest('.gc-gmail');
  if (gm) { gcGotoService(gm.closest('.grid-cell'), 'https://mail.google.com/mail/u/0/'); return; }
  const gsc = e.target.closest('.gc-gsc');
  if (gsc) {
    const cell = gsc.closest('.grid-cell');
    const p = profiles.find(x => x.uuid === cell.dataset.uuid);
    let target = 'https://search.google.com/search-console';
    if (p && p.gscProperty) target += '?resource_id=' + encodeURIComponent(p.gscProperty);
    gcGotoService(cell, target);
    return;
  }
  const dis = e.target.closest('.gc-disavow');
  if (dis) { gcGotoService(dis.closest('.grid-cell'), 'https://search.google.com/search-console/disavow-links'); return; }
  const tog = e.target.closest('.gc-toggle');
  if (tog) {
    const cell = tog.closest('.grid-cell');
    const dd = cell.querySelector('.gc-dropdown');
    const opening = dd.classList.contains('hidden');
    $$('#gridWrap .gc-dropdown').forEach(d => { d.classList.add('hidden'); d.style.cssText = ''; });
    if (opening) {
      // Tempatkan sebagai overlay fixed di atas webview (webview Electron menutupi HTML biasa)
      const r = tog.getBoundingClientRect();
      const W = 340;
      const left = Math.max(8, Math.min(window.innerWidth - W - 8, r.right - W));
      const maxH = Math.min(420, window.innerHeight - r.bottom - 20);
      dd.style.cssText = `position:fixed;top:${r.bottom + 4}px;left:${left}px;width:${W}px;` +
        `max-height:${maxH}px;z-index:99999;background:#16172e;border:1px solid var(--line);` +
        `border-radius:10px;padding:8px;box-shadow:0 12px 32px rgba(0,0,0,.7);` +
        `display:flex;flex-direction:column;gap:6px`;
      dd.classList.remove('hidden');
      const s = cell.querySelector('.gc-search'); s.value = '';
      gcFillList(cell, '');
      s.focus();
    }
    return;
  }
  const item = e.target.closest('.gc-item');
  if (item) {
    const cell = item.closest('.grid-cell');
    const p = profiles.find(x => x.uuid === item.dataset.uuid);
    if (p) gcSwap(cell, p);
    cell.querySelector('.gc-dropdown').classList.add('hidden');
  }
});
$('#gridWrap')?.addEventListener('input', e => {
  const s = e.target.closest('.gc-search');
  if (s) gcFillList(s.closest('.grid-cell'), s.value);
});
$('#gridWrap')?.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const inp = e.target.closest('.gc-url');
  if (!inp) return;
  let u = inp.value.trim();
  if (!u) return;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  const wv = inp.closest('.grid-cell').querySelector('webview, iframe');
  if (wv) wv.src = u;
});

$('#refreshBtn').addEventListener('click', () => { loadProfiles(); toast('Disegarkan'); });
$$('.stat').forEach(s => s.addEventListener('click', () => switchView('profiles')));
$('#activity')?.addEventListener('click', e => {
  const li = e.target.closest('li[data-uuid]');
  if (!li) return;
  const p = profiles.find(x => x.uuid === li.dataset.uuid);
  if (p && p.gmail) { switchView('profiles'); openInFrame(p); }
});

$('#liveToggle').addEventListener('change', e => {
  cfg.live = e.target.checked; saveCfg(); updateConnBadge(); loadProfiles();
});

['#search','#filterTag','#filterStatus'].forEach(s =>
  $(s).addEventListener('input', renderProfiles));

$('#newProfileBtn').addEventListener('click', () => openModal(null));

/* tabel: delegasi klik */
$('#profileRows').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (btn) return doAction(btn.dataset.act, btn.dataset.uuid);
});
$('#profileRows').addEventListener('change', e => {
  if (!e.target.classList.contains('rowchk')) return;
  const u = e.target.dataset.uuid;
  e.target.checked ? selected.add(u) : selected.delete(u);
  updateBulkbar();
});
document.querySelector('#view-profiles .table thead')?.addEventListener('click', e => {
  const th = e.target.closest('th.sortable');
  if (!th) return;
  const key = th.dataset.sort;
  if (sortBy.key === key) sortBy.dir = -sortBy.dir;
  else { sortBy.key = key; sortBy.dir = (key === 'lastActive' || key === 'usage') ? -1 : 1; }
  document.querySelectorAll('#view-profiles .table thead th.sortable').forEach(h => {
    const ind = h.querySelector('.sort-ind');
    if (!ind) return;
    if (h.dataset.sort === sortBy.key) ind.textContent = sortBy.dir === 1 ? ' ▲' : ' ▼';
    else ind.textContent = '';
  });
  renderProfiles();
});
$('#checkAll').addEventListener('change', e => {
  getFiltered().forEach(p => e.target.checked ? selected.add(p.uuid) : selected.delete(p.uuid));
  renderProfiles();
});

/* bulk actions */
function bulkOpenAll() {
  const sel = [...selected];
  if (!sel.length) return;
  if (sel.length > 6 && !confirm(
    `Buka ${sel.length} akun berdampingan sekaligus?\n\nMembuka banyak Gmail bersamaan bisa berat untuk komputer ini & berisiko terdeteksi Google. Lanjut?`
  )) return;
  openGridView(sel);
  toast(sel.length + ' akun dibuka berdampingan');
}

$('#bulkOpenAll').addEventListener('click', bulkOpenAll);
function bulkSetField(field, fieldLabel) {
  const sel = [...selected];
  if (!sel.length) return;
  const current = profiles.find(p => p.uuid === sel[0])?.[field] || '';
  const val = prompt(`Set ${fieldLabel} untuk ${sel.length} akun terpilih.\n\n` +
    `Ketik nilai baru (kosongkan untuk hapus ${fieldLabel}):`, current);
  if (val === null) return; // user cancel
  const trimmed = val.trim();
  let count = 0;
  sel.forEach(uuid => {
    const p = profiles.find(x => x.uuid === uuid);
    if (p) { p[field] = trimmed; count++; }
    const sp = store.profiles.find(x => x.uuid === uuid);
    if (sp) sp[field] = trimmed;
  });
  if (!cfg.live) persist();
  renderAll();
  toast(`${fieldLabel} di-set ke "${trimmed || '(kosong)'}" untuk ${count} akun`);
}
$('#bulkSetGroup').addEventListener('click', () => bulkSetField('group', 'Group'));
$('#bulkSetBrand').addEventListener('click', () => bulkSetField('brand', 'Brand'));
$('#bulkClear').addEventListener('click', () => {
  selected.clear();
  updateBulkbar();
  renderProfiles();
  if (!document.getElementById('iframeView').classList.contains('hidden')) renderSidePanel();
  toast('Semua ceklis dibatalkan');
});
$('#bulkDelete').addEventListener('click', () => {
  if (!confirm('Hapus ' + selected.size + ' profil terpilih?')) return;
  store.profiles = store.profiles.filter(p => !selected.has(p.uuid));
  persist(); selected.clear(); loadProfiles(); toast('Profil dihapus');
});
async function bulkRun(act) {
  for (const u of [...selected]) {
    try {
      act === 'start' ? await api.startProfile(u) : await api.stopProfile(u);
      const p = profiles.find(x=>x.uuid===u);
      if (p) { p.status = act==='start'?'active':'stopped'; p.lastActive = Date.now(); }
    } catch(e) { toast('Gagal: '+e.message); }
  }
  if (!cfg.live) { store.profiles = profiles; persist(); }
  selected.clear();
  renderAll();
  toast('Aksi massal selesai');
}

/* modal */
$('#modalSave').addEventListener('click', saveModal);
$('#modalCancel').addEventListener('click', closeModal);
$('#modalClose').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

/* ---------- Bulk Add Gmail ---------- */
function parseGmailList(text) {
  // Pemisah email & password fleksibel: ":"  "/"  "|"  ","  spasi / tab
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
    const m = line.match(/([^\s:/|,]+@[^\s:/|,]+)[\s:/|,]+(.*)/);
    if (m) return { email: m[1], password: m[2].trim() };
    const only = line.match(/[^\s:/|,]+@[^\s:/|,]+/);
    return { email: only ? only[0] : line, password: '' };
  }).filter(a => a.email.includes('@'));
}
function openGmailModal() {
  $('#gmailList').value = '';
  $('#gmailTags').value = '';
  $('#gmailPreview').textContent = '';
  $('#gmailModal').classList.remove('hidden');
}
function closeGmailModal() { $('#gmailModal').classList.add('hidden'); }
function gmailPreview() {
  const n = parseGmailList($('#gmailList').value).length;
  $('#gmailPreview').textContent = n ? `${n} akun valid akan dibuatkan profil.`
                                     : 'Belum ada akun valid (harus mengandung "@").';
}
function saveGmail() {
  const accts = parseGmailList($('#gmailList').value);
  if (!accts.length) { toast('Tidak ada akun Gmail yang valid'); return; }
  const os = $('#gmailOs').value;
  const extra = $('#gmailTags').value.split(',').map(s => s.trim()).filter(Boolean);
  accts.forEach((a, i) => {
    store.profiles.unshift({
      uuid: 'gm-' + Date.now().toString(36) + i,
      title: a.email,
      os, status: 'stopped',
      tags: ['gmail', ...extra],
      proxy: null,
      gmail: a,
      lastActive: Date.now(),
    });
  });
  persist();
  closeGmailModal();
  toast(accts.length + ' profil Gmail dibuat');
  if (cfg.live) showNotice('ℹ Profil Gmail disimpan ke data dummy. Sinkronisasi ke akun Octo ' +
                           'asli dilakukan lewat aplikasi Octo Browser.');
  loadProfiles();
}
$('#bulkGmailCard').addEventListener('click', openGmailModal);
$('#gmailList').addEventListener('input', gmailPreview);
$('#gmailSave').addEventListener('click', saveGmail);
$('#gmailCancel').addEventListener('click', closeGmailModal);
$('#gmailClose').addEventListener('click', closeGmailModal);
$('#gmailModal').addEventListener('click', e => { if (e.target.id === 'gmailModal') closeGmailModal(); });

/* otomatisasi */
$('#autoStart').addEventListener('click', async () => {
  const tag = $('#autoTag').value;
  const n = Math.max(1, parseInt($('#autoCount').value) || 1);
  const pool = profiles.filter(p => p.status === 'stopped' && (!tag || p.tags.includes(tag)));
  if (!pool.length) { logLine('Tidak ada profil berhenti yang cocok.', 'err'); return; }
  const targets = pool.slice(0, n);
  logLine(`Memulai ${targets.length} profil${tag?` (tag: ${tag})`:''}…`, 'info');
  for (const p of targets) {
    try { await api.startProfile(p.uuid); p.status='active'; p.lastActive=Date.now();
          logLine('✓ ' + p.title, 'ok'); }
    catch(e){ logLine('✗ ' + p.title + ' — ' + e.message, 'err'); }
  }
  if (!cfg.live) { store.profiles = profiles; persist(); }
  renderAll();
});
$('#autoStopAll').addEventListener('click', async () => {
  const act = profiles.filter(p => p.status === 'active');
  if (!act.length) { logLine('Tidak ada profil aktif.', 'info'); return; }
  logLine(`Menghentikan ${act.length} profil…`, 'info');
  for (const p of act) {
    try { await api.stopProfile(p.uuid); p.status='stopped'; logLine('✓ stop ' + p.title, 'ok'); }
    catch(e){ logLine('✗ ' + p.title + ' — ' + e.message, 'err'); }
  }
  if (!cfg.live) { store.profiles = profiles; persist(); }
  renderAll();
});
$('#clearLog').addEventListener('click', () => $('#autoLog').innerHTML = '');

/* pengaturan */
$('#saveSettings').addEventListener('click', () => {
  cfg.localUrl = $('#setLocalUrl').value.trim() || 'http://localhost:58888';
  cfg.token = $('#setToken').value.trim();
  saveCfg(); toast('Pengaturan disimpan');
});
$('#testConn').addEventListener('click', async () => {
  cfg.localUrl = $('#setLocalUrl').value.trim() || cfg.localUrl;
  const r = $('#connResult');
  r.textContent = 'Menguji…';
  try {
    const ok = await api.testConnection();
    r.textContent = ok ? '✓ Local API merespons di ' + cfg.localUrl
                       : '✗ Local API tidak merespons.';
  } catch (e) {
    r.textContent = '✗ Gagal menghubungi Local API: ' + e.message +
                    ' — pastikan aplikasi Octo Browser sedang berjalan.';
  }
});
$('#sideOpen5')?.addEventListener('click', () => {
  const top4 = profiles.filter(p => p.gmail).slice(0, 4).map(p => p.uuid);
  if (!top4.length) { toast('Tidak ada akun Gmail'); return; }
  // Pindah ke tab Profil dulu agar iframe view tampil dengan benar
  switchView('profiles');
  // Beri 1 frame agar DOM tab Profil di-render sebelum grid dibuka
  requestAnimationFrame(() => openGridView(top4));
});
$('#resetData').addEventListener('click', () => {
  if (!confirm('Reset semua data dummy ke contoh awal?')) return;
  store = seedData(); persist(); loadProfiles(); toast('Data dummy direset');
});

/* ---------- Ekspor & Impor data ---------- */
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
$('#exportAdsPower').addEventListener('click', () => {
  const gmails = (profiles.length ? profiles : store.profiles).filter(p => p.gmail && p.gmail.email);
  if (!gmails.length) { $('#exportResult').textContent = 'Tidak ada akun Gmail yang bisa diekspor.'; return; }
  const cols = ['name','group_name','domain_name','open_urls','username','password','remark'];
  const rows = [cols.join(',')];
  gmails.forEach(p => {
    rows.push([
      csvCell(p.gmail.email),
      csvCell(p.group || 'gmail'),
      csvCell('google.com'),
      csvCell('https://mail.google.com/'),
      csvCell(p.gmail.email),
      csvCell(p.gmail.password || ''),
      csvCell(p.brand || ''),
    ].join(','));
  });
  const today = new Date().toISOString().slice(0,10);
  downloadFile(`adspower-import-${today}.csv`, '﻿' + rows.join('\r\n'), 'text/csv;charset=utf-8');
  $('#exportResult').textContent = `✓ Berhasil ekspor ${gmails.length} akun ke CSV — siap diimpor di AdsPower (menu Browser Profile → Import).`;
});
$('#exportBackup').addEventListener('click', () => {
  const today = new Date().toISOString().slice(0,10);
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles: store.profiles,
    proxies: store.proxies || [],
  };
  downloadFile(`octo-backup-${today}.json`,
    JSON.stringify(backup, null, 2),
    'application/json');
  $('#exportResult').textContent = `✓ Backup ${backup.profiles.length} profil tersimpan. Simpan file ini, lalu impor di laptop baru.`;
});
$('#importBackup').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.profiles)) throw new Error('Format file tidak dikenali');
    const mode = confirm(`File berisi ${data.profiles.length} profil.\n\n` +
      `OK = Gabung dengan data sekarang (tanpa duplikasi email)\n` +
      `Cancel = Ganti total semua data sekarang dengan file ini`);
    if (mode) {
      const existing = new Set(store.profiles.filter(p => p.gmail).map(p => p.gmail.email));
      let added = 0;
      data.profiles.forEach(p => {
        if (p.gmail && existing.has(p.gmail.email)) return;
        store.profiles.unshift(p);
        added++;
      });
      $('#exportResult').textContent = `✓ Impor selesai: ${added} profil baru ditambahkan (sisanya duplikat dilewati).`;
    } else {
      store.profiles = data.profiles;
      if (Array.isArray(data.proxies)) store.proxies = data.proxies;
      $('#exportResult').textContent = `✓ Impor selesai: ${data.profiles.length} profil menggantikan data lama.`;
    }
    persist();
    loadProfiles();
    toast('Impor backup berhasil');
  } catch (err) {
    $('#exportResult').textContent = '✗ Gagal impor: ' + err.message;
  } finally {
    e.target.value = '';
  }
});

/* ====================================================================
   INISIALISASI
   ==================================================================== */
$('#liveToggle').checked = cfg.live;
$('#setLocalUrl').value  = cfg.localUrl;
$('#setToken').value     = cfg.token;
if (IS_ELECTRON) {
  const note = document.querySelector('.iframe-note');
  if (note) note.textContent = '✓ Mode aplikasi — situs apa pun bisa tampil di sini, tanpa kena pemblokiran iframe.';
  document.title = 'Octo Dashboard (Aplikasi)';
}

/* Pemilih tema warna */
function applyTheme(name) {
  if (name && name !== 'ungu') document.documentElement.setAttribute('data-theme', name);
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('octo_theme', name || 'ungu');
  $$('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === (name || 'ungu')));
}
$('#themeGrid')?.addEventListener('click', e => {
  const btn = e.target.closest('.theme-opt');
  if (btn) { applyTheme(btn.dataset.theme); toast('Tema: ' + btn.textContent.trim()); }
});
applyTheme(localStorage.getItem('octo_theme') || 'ungu');
makeStarfield();

loadProfiles().then(() => animateStats());
