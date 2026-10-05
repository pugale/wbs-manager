import { describe, expect, it } from "vitest";
import type { WbsNode } from "../models/WbsTask";
import { calcolaAvanzamentoMedio } from "./reportUtils";

describe("calcolaAvanzamentoMedio", () => {
  it("calcola e arrotonda la media di avanzamento di tutti i task", () => {
    const nodes = [20, 50, 100].map((percentuale, indice) => ({
      id: `task-${indice}`,
      type: "task" as const,
      position: { x: 0, y: 0 },
      data: {
        titolo: `Task ${indice}`,
        tipoTask: "Sviluppo" as const,
        descrizione: "",
        responsabile: "",
        dataInizio: null,
        dataFine: null,
        percentuale
      }
    })) satisfies WbsNode[];

    expect(calcolaAvanzamentoMedio(nodes)).toBe(57);
  });

  it("restituisce zero per un progetto senza task", () => {
    expect(calcolaAvanzamentoMedio([])).toBe(0);
  });
});
