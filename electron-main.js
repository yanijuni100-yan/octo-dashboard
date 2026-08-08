const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

/* ====================================================================
   PENYIMPANAN DATA DASHBOARD KE DISK (drive D) — bukan lagi localStorage.
   Lokasi : <folder app>/data/octo-data.json
   - Tahan terhadap clear-cache / reinstall / korup.
   - Tulis ATOMIK (tmp → rename) supaya tidak korup kalau app mati di tengah.
   - octo-data.prev.json = salinan "terakhir baik" untuk rollback.
   - backups/octo-data-YYYY-MM-DD.json = snapshot harian (simpan 14 terakhir).
   ==================================================================== */
const DATA_DIR    = path.join(__dirname, 'data');
const DATA_FILE   = path.join(DATA_DIR, 'octo-data.json');
const PREV_FILE   = path.join(DATA_DIR, 'octo-data.prev.json');
const BACKUP_DIR  = path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = 14;

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { ok: true, content: null, path: DATA_FILE };
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    JSON.parse(content); // validasi: kalau korup, lempar → jatuh ke pemulihan
    return { ok: true, content, path: DATA_FILE };
  } catch (err) {
    // File utama tidak terbaca / korup → pulihkan dari salinan terakhir-baik
    try {
      if (fs.existsSync(PREV_FILE)) {
        const content = fs.readFileSync(PREV_FILE, 'utf8');
        JSON.parse(content);
        return { ok: true, content, path: PREV_FILE, recovered: true };
      }
    } catch (e) {}
    return { ok: false, error: String((err && err.message) || err), path: DATA_FILE };
  }
}

function dailySnapshot(content) {
  try {
    const d = new Date();
    const stamp = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    const snap = path.join(BACKUP_DIR, `octo-data-${stamp}.json`);
    if (!fs.existsSync(snap)) {
      fs.writeFileSync(snap, content, 'utf8');
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => /^octo-data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
      while (files.length > MAX_BACKUPS) {
        try { fs.unlinkSync(path.join(BACKUP_DIR, files.shift())); } catch (e) {}
      }
    }
  } catch (e) { /* snapshot best-effort, jangan ganggu penyimpanan utama */ }
}

function writeData(content) {
  try {
    ensureDirs();
    // Simpan salinan "terakhir baik" sebelum menimpa
    try { if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, PREV_FILE); } catch (e) {}
    // Tulis atomik
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, DATA_FILE);
    dailySnapshot(content);
    return { ok: true, path: DATA_FILE };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err), path: DATA_FILE };
  }
}

ipcMain.on('octo-data-read',  (e)          => { e.returnValue = readData(); });
ipcMain.on('octo-data-write', (e, content) => { e.returnValue = writeData(content); });
ipcMain.on('octo-data-path',  (e)          => { e.returnValue = DATA_FILE; });

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Octo Dashboard',
    backgroundColor: '#0e0f17',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile('index.html');
}

let openCount = 0;
ipcMain.on('open-profile-window', (_event, { url, partition, title }) => {
  const offset = (openCount % 8) * 36;
  openCount++;
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    x: 120 + offset,
    y: 90 + offset,
    title: title || 'Profil',
    backgroundColor: '#fff',
    autoHideMenuBar: true,
    webPreferences: {
      partition: partition || 'persist:default',
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(url);
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
