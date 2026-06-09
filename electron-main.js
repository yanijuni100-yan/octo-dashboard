const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

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
