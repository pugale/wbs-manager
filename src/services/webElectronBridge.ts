import { creaContenutoArchivio, creaManifest, leggiArchivio } from "./wbsmArchive";
import type { ArchivioProgetto } from "../models/ProgettoArchivio";

function scaricaBlob(blob: Blob, nomeFile: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function selezionaFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      document.body.removeChild(input);
      resolve(file);
    };
    input.oncancel = () => {
      document.body.removeChild(input);
      resolve(null);
    };
    input.click();
  });
}

export function initWebElectronBridge(): void {
  if (typeof window === "undefined" || window.electronAPI) return;

  window.electronAPI = {
    ambiente: "web",
    async apriManuale(): Promise<void> {
      window.open("./manuale.html", "_blank", "noopener,noreferrer");
    },

    async apriEmailAutore(): Promise<void> {
      window.location.href = "mailto:alessandro.puglisi@eng.it";
    },

    async apriProgetto(): Promise<
      | { percorso: string; contenuto: string; archivio: null }
      | { percorso: string; archivio: ArchivioProgetto }
      | null
    > {
      const file = await selezionaFile(".wbsm,.json");
      if (!file) return null;
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".wbsm")) {
        const buffer = new Uint8Array(await file.arrayBuffer());
        const archivio = leggiArchivio(buffer);
        return { percorso: file.name, archivio };
      }
      if (lower.endsWith(".json")) {
        const text = await file.text();
        return { percorso: file.name, contenuto: text, archivio: null };
      }
      throw new Error("Estensione progetto non supportata. Seleziona un file .wbsm o .json.");
    },

    async apriCsv(): Promise<{ percorso: string; contenuto: string } | null> {
      const file = await selezionaFile(".csv,text/csv");
      if (!file) return null;
      const text = await file.text();
      return { percorso: file.name, contenuto: text };
    },

    async salvaCsv(dati: { contenuto: string; nomeSuggerito: string }): Promise<string | null> {
      const blob = new Blob([dati.contenuto], { type: "text/csv;charset=utf-8" });
      const nome = `${dati.nomeSuggerito.replace(/[\\/:*?"<>|]/g, "_")}.csv`;
      scaricaBlob(blob, nome);
      return nome;
    },

    async generaReportPdf(_dati: { nomeSuggerito: string }): Promise<string | null> {
      window.print();
      return "browser-print";
    },

    async confermaModificheNonSalvate(): Promise<"salva" | "scarta" | "annulla"> {
      const continua = window.confirm("Ci sono modifiche non salvate. Vuoi continuare senza salvare?");
      return continua ? "scarta" : "annulla";
    },

    async salvaProgetto(dati: {
      percorso: string | null;
      contenuto: string;
      nomeSuggerito: string;
      archivio: ArchivioProgetto | null;
    }): Promise<{ percorso: string; archivio: ArchivioProgetto | null } | null> {
      const nomeBase = dati.nomeSuggerito.replace(/[\\/:*?"<>|]/g, "_").trim() || "progetto";
      const percorso = dati.percorso;
      const usaArchivio = !percorso || percorso.toLowerCase().endsWith(".wbsm");

      if (usaArchivio) {
        const datiArchivio: ArchivioProgetto = dati.archivio ?? {
          manifest: creaManifest(dati.contenuto),
          indiceVersioni: [],
          contenutoCorrente: dati.contenuto,
          versioni: {}
        };
        const progetto = JSON.parse(dati.contenuto) as { id: string; nome: string };
        datiArchivio.manifest.nomeProgetto = progetto.nome;
        if (!datiArchivio.manifest.idProgetto) datiArchivio.manifest.idProgetto = progetto.id;
        datiArchivio.contenutoCorrente = dati.contenuto;

        const bytes = creaContenutoArchivio(datiArchivio);
        const blob = new Blob([bytes as unknown as BlobPart], { type: "application/octet-stream" });
        const nomeFile = `${nomeBase}.wbsm`;
        scaricaBlob(blob, nomeFile);
        return { percorso: nomeFile, archivio: datiArchivio };
      } else {
        const blob = new Blob([dati.contenuto], { type: "application/json;charset=utf-8" });
        const nomeFile = `${nomeBase}.json`;
        scaricaBlob(blob, nomeFile);
        return { percorso: nomeFile, archivio: null };
      }
    },

    async salvaImmagineJpg(dati: {
      immagine: string;
      nomeSuggerito: string;
    }): Promise<string | null> {
      const nome = `${dati.nomeSuggerito.replace(/[\\/:*?"<>|]/g, "_")}.jpg`;
      const a = document.createElement("a");
      a.href = dati.immagine;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return nome;
    },

    async salvaImmaginePng(dati: {
      immagine: string;
      nomeSuggerito: string;
    }): Promise<string | null> {
      const nome = `${dati.nomeSuggerito.replace(/[\\/:*?"<>|]/g, "_")}.png`;
      const a = document.createElement("a");
      a.href = dati.immagine;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return nome;
    },

    impostaModificato(_valore: boolean): void {
      // Titolo aggiornato da React useEffect in App.tsx
    }
  };
}
