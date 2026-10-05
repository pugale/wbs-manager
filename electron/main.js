import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { creaContenutoArchivio, creaManifest, leggiArchivio } from "./wbsmArchive.js";

// In un modulo ES __dirname non esiste: lo ricostruiamo
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// "npm run dev" avvia Electron con l'argomento --dev
const isDev = process.argv.includes("--dev");
const DEV_URL = "http://127.0.0.1:5173";
const FILTRI = [
  { name: "Progetto WBS Manager", extensions: ["wbsm"] },
  { name: "Progetto WBS legacy", extensions: ["json"] }
];
const FILTRI_JPG = [{ name: "Immagine JPEG", extensions: ["jpg", "jpeg"] }];
const FILTRI_CSV = [{ name: "File CSV", extensions: ["csv"] }];
const FILTRI_PDF = [{ name: "Documento PDF", extensions: ["pdf"] }];

let win = null;
let manualWin = null;
let modificato = false;

function cartellaProgetti() {
  return path.join(app.getPath("documents"), "WBS Manager");
}

// Toglie i caratteri non ammessi nei nomi file di Windows
function nomeFile(nome) {
  const pulito = String(nome ?? "").replace(/[\\/:*?"<>|]/g, "_").trim();
  return pulito || "progetto";
}

function gestisciLinkEmail(webContents) {
  webContents.on("will-navigate", (event, url) => {
    if (url !== "mailto:alessandro.puglisi@eng.it") return;
    event.preventDefault();
    void shell.openExternal(url).catch((errore) => {
      const dettaglio = errore instanceof Error ? errore.message : String(errore);
      dialog.showErrorBox("Impossibile aprire il client di posta", dettaglio);
    });
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: "WBS Manager",
    icon: path.join(__dirname, "../build/icon.ico"),
    show: false,
    webPreferences: {
      // Il preload deve essere CommonJS (.cjs) perché gira in sandbox
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.once("ready-to-show", () => win.show());
  gestisciLinkEmail(win.webContents);

  // I link esterni si aprono nel browser, mai in una nuova finestra Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  // Avviso se si chiude con modifiche non salvate
  win.on("close", (event) => {
    if (!modificato) return;
    const scelta = dialog.showMessageBoxSync(win, {
      type: "warning",
      buttons: ["Esci senza salvare", "Annulla"],
      defaultId: 1,
      cancelId: 1,
      title: "Modifiche non salvate",
      message: "Ci sono modifiche non salvate.",
      detail: "Se esci ora, le modifiche andranno perse."
    });
    if (scelta === 1) event.preventDefault();
  });

  win.on("closed", () => {
    win = null;
  });

  if (isDev) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function apriFinestraManuale() {
  if (manualWin && !manualWin.isDestroyed()) {
    manualWin.focus();
    return Promise.resolve();
  }

  manualWin = new BrowserWindow({
    width: 1120,
    height: 850,
    minWidth: 680,
    minHeight: 560,
    parent: win ?? undefined,
    title: "Manuale operativo — WBS Manager",
    icon: path.join(__dirname, "../build/icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  manualWin.on("closed", () => {
    manualWin = null;
  });
  gestisciLinkEmail(manualWin.webContents);

  return isDev
    ? manualWin.loadURL(`${DEV_URL}/manuale.html`)
    : manualWin.loadFile(path.join(__dirname, "../dist/manuale.html"));
}

// ---------- Comunicazione con l'interfaccia (IPC) ----------

ipcMain.handle("aiuto:apri-manuale", () => apriFinestraManuale());

ipcMain.handle("aiuto:email-autore", () => shell.openExternal("mailto:alessandro.puglisi@eng.it"));

ipcMain.handle("progetto:apri", async () => {
  await mkdir(cartellaProgetti(), { recursive: true });
  const risultato = await dialog.showOpenDialog(win, {
    title: "Apri progetto",
    defaultPath: cartellaProgetti(),
    filters: FILTRI,
    properties: ["openFile"]
  });
  if (risultato.canceled || risultato.filePaths.length === 0) return null;

  const percorso = risultato.filePaths[0];
  const contenuto = await readFile(percorso);
  if (path.extname(percorso).toLowerCase() === ".wbsm") {
    return { percorso, archivio: leggiArchivio(contenuto) };
  }
  if (path.extname(percorso).toLowerCase() !== ".json") {
    throw new Error("Estensione progetto non supportata. Apri un file .wbsm o .json.");
  }
  return { percorso, contenuto: contenuto.toString("utf-8"), archivio: null };
});

ipcMain.handle("csv:apri", async () => {
  const risultato = await dialog.showOpenDialog(win, {
    title: "Importa task da CSV",
    defaultPath: cartellaProgetti(),
    filters: FILTRI_CSV,
    properties: ["openFile"]
  });
  if (risultato.canceled || risultato.filePaths.length === 0) return null;
  const percorso = risultato.filePaths[0];
  return { percorso, contenuto: await readFile(percorso, "utf-8") };
});

ipcMain.handle("csv:salva", async (_event, { contenuto, nomeSuggerito }) => {
  if (typeof contenuto !== "string") throw new Error("Contenuto CSV non valido.");
  await mkdir(cartellaProgetti(), { recursive: true });
  const risultato = await dialog.showSaveDialog(win, {
    title: "Esporta task in CSV",
    defaultPath: path.join(cartellaProgetti(), `${nomeFile(nomeSuggerito)}.csv`),
    filters: FILTRI_CSV
  });
  if (risultato.canceled || !risultato.filePath) return null;
  await writeFile(risultato.filePath, contenuto, "utf-8");
  return risultato.filePath;
});

ipcMain.handle("report:pdf", async (_event, { nomeSuggerito }) => {
  if (!win) throw new Error("La finestra dell'applicazione non è disponibile.");
  await mkdir(cartellaProgetti(), { recursive: true });
  const risultato = await dialog.showSaveDialog(win, {
    title: "Genera report PDF",
    defaultPath: path.join(cartellaProgetti(), `${nomeFile(nomeSuggerito)}.pdf`),
    filters: FILTRI_PDF
  });
  if (risultato.canceled || !risultato.filePath) return null;

  const pdf = await win.webContents.printToPDF({
    pageSize: "A4",
    landscape: true,
    printBackground: true,
    margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
  });
  await writeFile(risultato.filePath, pdf);
  return risultato.filePath;
});

ipcMain.handle("progetto:conferma-modifiche", async () => {
  const { response } = await dialog.showMessageBox(win, {
    type: "warning",
    buttons: ["Salva", "Scarta modifiche", "Annulla"],
    defaultId: 0,
    cancelId: 2,
    title: "Modifiche non salvate",
    message: "Ci sono modifiche non salvate.",
    detail: "Salva prima di continuare o scegli come gestire le modifiche."
  });
  return ["salva", "scarta", "annulla"][response];
});

ipcMain.handle("progetto:salva", async (_event, { percorso, contenuto, nomeSuggerito, archivio }) => {
  let destinazione = percorso;

  // Nessun percorso = "Salva con nome"
  if (!destinazione) {
    await mkdir(cartellaProgetti(), { recursive: true });
    const risultato = await dialog.showSaveDialog(win, {
      title: "Salva progetto",
      defaultPath: path.join(cartellaProgetti(), `${nomeFile(nomeSuggerito)}.wbsm`),
      filters: FILTRI
    });
    if (risultato.canceled || !risultato.filePath) return null;
    destinazione = risultato.filePath;
  }

  let archivioSalvato = null;
  let datiDaScrivere = Buffer.from(contenuto, "utf-8");
  if (path.extname(destinazione).toLowerCase() === ".wbsm") {
    const datiArchivio = archivio ?? {
      manifest: creaManifest(contenuto),
      indiceVersioni: [],
      contenutoCorrente: contenuto,
      versioni: {}
    };
    const progetto = JSON.parse(contenuto);
    datiArchivio.manifest.nomeProgetto = progetto.nome;
    if (!datiArchivio.manifest.idProgetto) datiArchivio.manifest.idProgetto = progetto.id;
    datiArchivio.contenutoCorrente = contenuto;
    datiDaScrivere = Buffer.from(creaContenutoArchivio(datiArchivio));
    archivioSalvato = datiArchivio;
  } else if (path.extname(destinazione).toLowerCase() !== ".json") {
    throw new Error("Il progetto deve avere estensione .wbsm o .json.");
  }

  // Scrittura sicura: prima un file temporaneo, poi la sostituzione.
  // Se qualcosa va storto a metà, il file originale resta integro.
  const temporaneo = `${destinazione}.tmp`;
  await writeFile(temporaneo, datiDaScrivere);
  await rename(temporaneo, destinazione);
  return { percorso: destinazione, archivio: archivioSalvato };
});

ipcMain.handle("immagine:salva-jpg", async (_event, { immagine, nomeSuggerito }) => {
  if (typeof immagine !== "string") throw new Error("Dati immagine non validi.");
  const corrispondenza = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(immagine);
  if (!corrispondenza) throw new Error("Il contenuto non è un'immagine JPEG valida.");

  const contenuto = Buffer.from(corrispondenza[1], "base64");
  if (contenuto.length === 0 || contenuto.length > 100 * 1024 * 1024) {
    throw new Error("La dimensione dell'immagine JPG non è valida.");
  }
  if (contenuto.length < 3 || contenuto[0] !== 0xff || contenuto[1] !== 0xd8 || contenuto[2] !== 0xff) {
    throw new Error("Il contenuto non è un'immagine JPEG valida.");
  }

  await mkdir(cartellaProgetti(), { recursive: true });
  const risultato = await dialog.showSaveDialog(win, {
    title: "Esporta immagine JPG",
    defaultPath: path.join(cartellaProgetti(), `${nomeFile(nomeSuggerito)}.jpg`),
    filters: FILTRI_JPG
  });
  if (risultato.canceled || !risultato.filePath) return null;

  await writeFile(risultato.filePath, contenuto);
  return risultato.filePath;
});

ipcMain.on("progetto:modificato", (_event, valore) => {
  modificato = Boolean(valore);
});

// ---------- Ciclo di vita dell'app ----------

app.whenReady().then(() => {
  // Nella versione installata niente menu: evita Ctrl+R che ricarica e perde i dati
  if (!isDev) Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
