import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWbsStore } from "../store/wbsStore";
import { apriProgetto } from "./comandiProgetto";

const contenutoProgetto = JSON.stringify({
  versione: 1,
  id: "caricato",
  nome: "Progetto caricato",
  tipoFreccia: "bezier",
  nodes: [],
  edges: []
});

describe("apriProgetto", () => {
  beforeEach(() => {
    useWbsStore.getState().nuovoProgetto();
    useWbsStore.getState().addTask();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("apre il selettore file prima della conferma nel browser", async () => {
    const sequenza: string[] = [];
    const api: ElectronAPI = {
      ambiente: "web",
      apriManuale: async () => {},
      apriEmailAutore: async () => {},
      apriProgetto: async () => {
        sequenza.push("apri");
        return {
          percorso: "altro.json",
          contenuto: contenutoProgetto,
          archivio: null
        };
      },
      apriCsv: async () => null,
      salvaCsv: async () => null,
      generaReportPdf: async () => null,
      confermaModificheNonSalvate: async () => {
        sequenza.push("conferma");
        return "scarta";
      },
      salvaProgetto: async () => null,
      salvaImmagineJpg: async () => null,
      impostaModificato: () => {}
    };

    vi.stubGlobal("window", {
      electronAPI: api,
      alert: vi.fn()
    });

    await apriProgetto();

    expect(sequenza).toEqual(["apri", "conferma"]);
    expect(useWbsStore.getState().nodes).toHaveLength(0);
    expect(useWbsStore.getState().nomeProgetto).toBe("Progetto caricato");
  });
});
