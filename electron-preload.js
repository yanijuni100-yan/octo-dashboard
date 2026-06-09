const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openProfileWindow: (url, partition, title) =>
    ipcRenderer.send('open-profile-window', { url, partition, title }),
});
