// Funzioni esposte da electron/preload.cjs
import type { ArchivioProgetto } from "../models/ProgettoArchivio";

export {};

declare global {
  interface ElectronAPI {
    apriManuale(): Promise<void>;
    apriEmailAutore(): Promise<void>;
    apriProgetto(): Promise<
      | { percorso: string; contenuto: string; archivio: null }
      | { percorso: string; archivio: ArchivioProgetto }
      | null
    >;
    apriCsv(): Promise<{ percorso: string; contenuto: string } | null>;
    salvaCsv(dati: { contenuto: string; nomeSuggerito: string }): Promise<string | null>;
    generaReportPdf(dati: { nomeSuggerito: string }): Promise<string | null>;
    confermaModificheNonSalvate(): Promise<"salva" | "scarta" | "annulla">;
    salvaProgetto(dati: {
      percorso: string | null;
      contenuto: string;
      nomeSuggerito: string;
      archivio: ArchivioProgetto | null;
    }): Promise<{ percorso: string; archivio: ArchivioProgetto | null } | null>;
    salvaImmagineJpg(dati: {
      immagine: string;
      nomeSuggerito: string;
    }): Promise<string | null>;
    impostaModificato(valore: boolean): void;
  }

  interface Window {
    // Assente se l'interfaccia viene aperta in un normale browser
    electronAPI?: ElectronAPI;
  }
}
