import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import type { WbsNode } from "../models/WbsTask";
import { deserializzaTaskCsv, serializzaTaskCsv } from "./csvProgetto";

const nodes: WbsNode[] = [
  {
    id: "task-a",
    type: "task",
    position: { x: 0, y: 0 },
    data: {
      titolo: "Analisi; requisiti",
      tipoTask: "Analisi",
      descrizione: 'Prima riga\nUna "nota"',
      responsabile: "Ada Lovelace",
      dataInizio: "2026-10-05",
      dataFine: "2026-10-09",
      percentuale: 50
    }
  },
  {
    id: "task-b",
    type: "task",
    position: { x: 0, y: 0 },
    data: {
      titolo: "Sviluppo",
      tipoTask: "Sviluppo",
      descrizione: "",
      responsabile: "Ada Lovelace",
      dataInizio: null,
      dataFine: null,
      percentuale: 0
    }
  }
];
const edges: Edge[] = [{ id: "a-b", source: "task-a", target: "task-b" }];

describe("trasferimento CSV", () => {
  it("esporta e reimporta valori, virgolette, righe e dipendenze", () => {
    const csv = serializzaTaskCsv(nodes, edges);
    expect(csv).toContain('"Giorni lavorativi"');
    expect(csv).toContain('"5"');
    expect(csv).toContain('"";"0"');
    const task = deserializzaTaskCsv(csv);
    expect(task).toHaveLength(2);
    expect(task[0].data).toEqual(nodes[0].data);
    expect(task[1].predecessoriOrigine).toEqual(["task-a"]);
  });

  it("protegge le celle da formule all'apertura in Excel", () => {
    const node = { ...nodes[0], data: { ...nodes[0].data, titolo: "=2+2" } };
    const csv = serializzaTaskCsv([node], []);
    expect(csv).toContain("'=2+2");
    expect(deserializzaTaskCsv(csv)[0].data.titolo).toBe("=2+2");
  });

  it("segnala campi obbligatori e date non valide", () => {
    expect(() =>
      deserializzaTaskCsv(
        "ID;Titolo;Tipo;Descrizione;Responsabile;Data inizio;Data fine;Giorni lavorativi;Avanzamento (%);Predecessori\n\n"
      )
    ).toThrow("non contiene task");
    expect(() =>
      deserializzaTaskCsv(
        "ID;Titolo;Tipo;Descrizione;Responsabile;Data inizio;Data fine;Giorni lavorativi;Avanzamento (%);Predecessori\n" +
          "T1;Task;Sviluppo;;;2026-02-31;;;;\n"
      )
    ).toThrow("data inizio non valida");
    expect(() =>
      deserializzaTaskCsv(
        "ID;Titolo;Tipo;Descrizione;Responsabile;Data inizio;Data fine;Giorni lavorativi;Avanzamento (%);Predecessori\n" +
          "T1;Task;Sviluppo;;;2026-10-10;2026-10-09;;0;\n"
      )
    ).toThrow("data fine precedente");
    expect(() =>
      deserializzaTaskCsv(
        "ID;Titolo;Tipo;Descrizione;Responsabile;Data inizio;Data fine;Giorni lavorativi;Avanzamento (%);Predecessori\n" +
          "T1;;Sviluppo;;;;;;0;\n"
      )
    ).toThrow("il titolo è obbligatorio");
  });

  it("richiede le intestazioni esportate nello stesso ordine e righe complete", () => {
    expect(() => deserializzaTaskCsv("Titolo;ID\nTask;T1\n")).toThrow(
      "Intestazioni non valide"
    );
    const intestazioni =
      "ID;Titolo;Tipo;Descrizione;Responsabile;Data inizio;Data fine;Giorni lavorativi;Avanzamento (%);Predecessori\n";
    expect(() => deserializzaTaskCsv(`${intestazioni}T1;Task;Sviluppo\n`)).toThrow(
      "attese 10 colonne, trovate 3"
    );
    expect(() =>
      deserializzaTaskCsv(`${intestazioni}T1;Task;Sviluppo;;;;;;;0;extra\n`)
    ).toThrow("attese 10 colonne, trovate 11");
  });

  it("rifiuta predecessori non presenti nel file", () => {
    expect(() =>
      deserializzaTaskCsv(
        "ID;Titolo;Tipo;Descrizione;Responsabile;Data inizio;Data fine;Giorni lavorativi;Avanzamento (%);Predecessori\n" +
          "T1;Task;Sviluppo;;;;;;0;missing\n"
      )
    ).toThrow('predecessore "missing" non trovato');
  });

  it("accetta intestazioni senza distinzione tra maiuscole e minuscole", () => {
    const csv =
      "id;titolo;tipo;descrizione;responsabile;data inizio;data fine;giorni lavorativi;avanzamento (%);predecessori\n" +
      "T1;Task;Sviluppo;;;;;;0;\n";
    expect(deserializzaTaskCsv(csv)).toHaveLength(1);
  });

  it("rifiuta intestazioni mancanti", () => {
    expect(() => deserializzaTaskCsv("ID;Titolo;Tipo\nT1;Task;Sviluppo\n")).toThrow(
      "Intestazioni non valide"
    );
  });
});
