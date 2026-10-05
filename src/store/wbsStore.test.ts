import { beforeEach, describe, expect, it } from "vitest";
import { useWbsStore } from "./wbsStore";
import type { Connection } from "@xyflow/react";

describe("cronologia progetto", () => {
  beforeEach(() => {
    useWbsStore.getState().nuovoProgetto();
  });

  it("annulla e ripete la creazione di un task", () => {
    const store = useWbsStore.getState();
    store.addTask();
    expect(useWbsStore.getState().nodes).toHaveLength(1);
    expect(useWbsStore.getState().nodes[0].id).toBe("1");
    expect(useWbsStore.getState().nodes[0].position).toEqual({ x: 0, y: 0 });

    useWbsStore.getState().annulla();
    expect(useWbsStore.getState().nodes).toHaveLength(0);
    expect(useWbsStore.getState().modificato).toBe(false);

    useWbsStore.getState().ripeti();
    expect(useWbsStore.getState().nodes).toHaveLength(1);
    expect(useWbsStore.getState().modificato).toBe(true);
  });

  it("assegna ID numerici sequenziali ai nuovi task", () => {
    const store = useWbsStore.getState();
    store.addTask();
    store.addTask();
    store.addTask();

    expect(useWbsStore.getState().nodes.map((node) => node.id)).toEqual(["1", "2", "3"]);

    useWbsStore.getState().addTask();
    expect(useWbsStore.getState().nodes.map((node) => node.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("continua la sequenza dopo i task esistenti e conserva ID legacy non numerici", () => {
    useWbsStore.getState().caricaProgetto(
      {
        id: "progetto",
        nome: "Progetto",
        tipoFreccia: "bezier",
        nodes: [
          {
            id: "legacy-id",
            type: "task",
            position: { x: 0, y: 0 },
            data: {
              titolo: "Esistente",
              tipoTask: "Sviluppo",
              descrizione: "",
              responsabile: "",
              dataInizio: null,
              dataFine: null,
              percentuale: 0
            }
          },
          {
            id: "3",
            type: "task",
            position: { x: 0, y: 0 },
            data: {
              titolo: "Esistente numerico",
              tipoTask: "Sviluppo",
              descrizione: "",
              responsabile: "",
              dataInizio: null,
              dataFine: null,
              percentuale: 0
            }
          }
        ],
        edges: []
      },
      null
    );

    useWbsStore.getState().addTask();
    expect(useWbsStore.getState().nodes.at(-1)?.id).toBe("4");
  });

  it("annulla lo spostamento completo di un nodo in una sola operazione", () => {
    useWbsStore.getState().addTask();
    const id = useWbsStore.getState().nodes[0].id;
    useWbsStore.getState().segnaSalvato("progetto.json");
    useWbsStore.getState().onNodesChange([
      { type: "position", id, position: { x: 200, y: 200 }, dragging: true }
    ]);
    useWbsStore.getState().onNodesChange([
      { type: "position", id, position: { x: 240, y: 260 }, dragging: true }
    ]);
    useWbsStore.getState().onNodesChange([
      { type: "position", id, position: { x: 240, y: 260 }, dragging: false }
    ]);

    useWbsStore.getState().annulla();
    expect(useWbsStore.getState().nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it("scarta la cronologia quando viene caricato un altro progetto", () => {
    useWbsStore.getState().addTask();
    useWbsStore.getState().caricaProgetto(
      { id: "caricato", nome: "Caricato", tipoFreccia: "bezier", nodes: [], edges: [] },
      "progetto.json"
    );

    expect(useWbsStore.getState().nodes).toHaveLength(0);
    expect(useWbsStore.getState().puoAnnullare).toBe(false);
  });

  it("annulla e ripete la modifica della tipologia delle frecce", () => {
    useWbsStore.getState().setTipoFreccia("straight");
    expect(useWbsStore.getState().tipoFreccia).toBe("straight");
    expect(useWbsStore.getState().modificato).toBe(true);

    useWbsStore.getState().annulla();
    expect(useWbsStore.getState().tipoFreccia).toBe("bezier");

    useWbsStore.getState().ripeti();
    expect(useWbsStore.getState().tipoFreccia).toBe("straight");
  });

  it("registra una rinomina come una singola modifica annullabile", () => {
    useWbsStore.getState().setNomeProgetto("Piano aggiornato");
    expect(useWbsStore.getState().nomeProgetto).toBe("Piano aggiornato");

    useWbsStore.getState().annulla();
    expect(useWbsStore.getState().nomeProgetto).toBe("Nuovo progetto");

    useWbsStore.getState().ripeti();
    expect(useWbsStore.getState().nomeProgetto).toBe("Piano aggiornato");
  });

  it("non aggiunge dipendenze che creano cicli", () => {
    useWbsStore.getState().addTask();
    useWbsStore.getState().addTask();
    const [primo, secondo] = useWbsStore.getState().nodes;
    const connessione = (source: string, target: string): Connection => ({
      source,
      target,
      sourceHandle: null,
      targetHandle: null
    });

    useWbsStore.getState().onConnect(connessione(primo.id, secondo.id));
    useWbsStore.getState().onConnect(connessione(secondo.id, primo.id));

    expect(useWbsStore.getState().edges).toHaveLength(1);
    expect(useWbsStore.getState().erroreCollegamento).toContain("ciclo");
  });

  it("importa task e predecessori come un'unica operazione annullabile", () => {
    useWbsStore.getState().importaTask([
      {
        idOrigine: "a",
        predecessoriOrigine: [],
        data: {
          titolo: "Analisi",
          tipoTask: "Analisi",
          descrizione: "",
          responsabile: "Ada",
          dataInizio: null,
          dataFine: null,
          percentuale: 20
        }
      },
      {
        idOrigine: "b",
        predecessoriOrigine: ["a"],
        data: {
          titolo: "Sviluppo",
          tipoTask: "Sviluppo",
          descrizione: "",
          responsabile: "Ada",
          dataInizio: null,
          dataFine: null,
          percentuale: 0
        }
      }
    ]);

    expect(useWbsStore.getState().nodes).toHaveLength(2);
    expect(useWbsStore.getState().edges).toHaveLength(1);
    useWbsStore.getState().annulla();
    expect(useWbsStore.getState().nodes).toHaveLength(0);
    expect(useWbsStore.getState().edges).toHaveLength(0);
  });

  it("rifiuta l'importazione di un CSV con dipendenze cicliche senza modificare il progetto", () => {
    expect(() =>
      useWbsStore.getState().importaTask([
        {
          idOrigine: "a",
          predecessoriOrigine: ["b"],
          data: {
            titolo: "A",
            tipoTask: "Sviluppo",
            descrizione: "",
            responsabile: "",
            dataInizio: null,
            dataFine: null,
            percentuale: 0
          }
        },
        {
          idOrigine: "b",
          predecessoriOrigine: ["a"],
          data: {
            titolo: "B",
            tipoTask: "Sviluppo",
            descrizione: "",
            responsabile: "",
            dataInizio: null,
            dataFine: null,
            percentuale: 0
          }
        }
      ])
    ).toThrow("ciclo");

    expect(useWbsStore.getState().nodes).toHaveLength(0);
    expect(useWbsStore.getState().edges).toHaveLength(0);
  });
});
