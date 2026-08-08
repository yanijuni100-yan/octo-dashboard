const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openProfileWindow: (url, partition, title) =>
    ipcRenderer.send('open-profile-window', { url, partition, title }),
  // Penyimpanan data dashboard ke file di drive D (sinkron, agar load awal tetap sederhana)
  storage: {
    read:  ()        => ipcRenderer.sendSync('octo-data-read'),
    write: (content) => ipcRenderer.sendSync('octo-data-write', content),
    path:  ()        => ipcRenderer.sendSync('octo-data-path'),
  },
});
