// Ponte sicuro tra Electron e React: espone solo queste funzioni
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  apriManuale: () => ipcRenderer.invoke("aiuto:apri-manuale"),
  apriEmailAutore: () => ipcRenderer.invoke("aiuto:email-autore"),
  apriProgetto: () => ipcRenderer.invoke("progetto:apri"),
  apriCsv: () => ipcRenderer.invoke("csv:apri"),
  salvaCsv: (dati) => ipcRenderer.invoke("csv:salva", dati),
  generaReportPdf: (dati) => ipcRenderer.invoke("report:pdf", dati),
  confermaModificheNonSalvate: () => ipcRenderer.invoke("progetto:conferma-modifiche"),
  salvaProgetto: (dati) => ipcRenderer.invoke("progetto:salva", dati),
  salvaImmagineJpg: (dati) => ipcRenderer.invoke("immagine:salva-jpg", dati),
  impostaModificato: (valore) => ipcRenderer.send("progetto:modificato", Boolean(valore))
});
