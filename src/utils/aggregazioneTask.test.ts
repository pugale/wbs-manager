import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import type { TipoTask, WbsNode } from "../models/WbsTask";
import { ricalcolaPercentualiPrincipali, taskDiscendentiPrincipali } from "./aggregazioneTask";

function task(id: string, tipoTask: TipoTask, percentuale: number): WbsNode {
  return {
    id,
    type: "task",
    position: { x: 0, y: 0 },
    data: {
      titolo: id,
      tipoTask,
      descrizione: "",
      responsabile: "",
      dataInizio: null,
      dataFine: null,
      percentuale
    }
  };
}

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target };
}

describe("aggregazione task principali", () => {
  it("segue i collegamenti fra task principali, gestendo cicli e nodi non presenti", () => {
    const nodes = [
      task("root", "Principale", 0),
      task("sub", "Principale", 0),
      task("leaf", "Sviluppo", 60)
    ];
    const edges = [edge("root", "sub"), edge("sub", "leaf"), edge("leaf", "root"), edge("sub", "missing")];

    expect(taskDiscendentiPrincipali("root", nodes, edges).map((node) => node.id)).toEqual([
      "sub",
      "leaf"
    ]);
  });

  it("ricalcola la media delle percentuali dei task non principali", () => {
    const nodes = [
      task("root", "Principale", 0),
      task("sub", "Principale", 0),
      task("done", "Sviluppo", 100),
      task("in-progress", "Test", 40),
      task("other", "Rilascio", 0)
    ];
    const result = ricalcolaPercentualiPrincipali(nodes, [
      edge("root", "sub"),
      edge("sub", "done"),
      edge("root", "in-progress")
    ]);

    expect(result.map((node) => [node.id, node.data.percentuale])).toEqual([
      ["root", 70],
      ["sub", 70],
      ["done", 100],
      ["in-progress", 40],
      ["other", 0]
    ]);
  });

  it("non attraversa task foglia per unire componenti principali distinte", () => {
    const nodes = [
      task("primo", "Principale", 0),
      task("foglia", "Sviluppo", 40),
      task("secondo", "Principale", 0)
    ];
    const result = ricalcolaPercentualiPrincipali(nodes, [
      edge("primo", "foglia"),
      edge("foglia", "secondo")
    ]);

    expect(result.map((node) => node.data.percentuale)).toEqual([40, 40, 40]);
  });

  it("riutilizza i nodi che non richiedono aggiornamenti di percentuale", () => {
    const foglia = task("foglia", "Sviluppo", 40);
    const principale = task("principale", "Principale", 0);
    const risultato = ricalcolaPercentualiPrincipali([principale, foglia], [
      edge("principale", "foglia")
    ]);

    expect(risultato[1]).toBe(foglia);
    expect(risultato[0]).not.toBe(principale);
    expect(risultato[0].data.percentuale).toBe(40);
  });
});
