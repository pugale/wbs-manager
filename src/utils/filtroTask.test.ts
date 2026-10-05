import { describe, expect, it } from "vitest";
import type { WbsNode } from "../models/WbsTask";
import { corrispondeFiltroTask } from "./filtroTask";

function task(
  percentuale: number,
  overrides: Partial<WbsNode["data"]> = {}
): WbsNode {
  return {
    id: "task-1",
    type: "task",
    position: { x: 0, y: 0 },
    data: {
      titolo: "Analisi requisiti",
      tipoTask: "Analisi",
      descrizione: "Interviste agli utenti",
      responsabile: "Ada Lovelace",
      dataInizio: "2020-01-01",
      dataFine: "2020-01-10",
      percentuale,
      ...overrides
    }
  };
}

describe("corrispondeFiltroTask", () => {
  it("cerca nel titolo, nella descrizione e nel responsabile", () => {
    const nodo = task(40);
    expect(corrispondeFiltroTask(nodo, "requisiti", "tutti")).toBe(true);
    expect(corrispondeFiltroTask(nodo, "utenti", "tutti")).toBe(true);
    expect(corrispondeFiltroTask(nodo, "ada", "tutti")).toBe(true);
  });

  it("seleziona lo stato di avanzamento richiesto", () => {
    expect(corrispondeFiltroTask(task(0), "", "non-iniziati")).toBe(true);
    expect(corrispondeFiltroTask(task(40), "", "in-corso")).toBe(true);
    expect(corrispondeFiltroTask(task(100), "", "completati")).toBe(true);
  });

  it("combina ricerca, responsabile e stato", () => {
    const nodo = task(40);
    expect(corrispondeFiltroTask(nodo, "analisi", "in-corso", "Ada Lovelace")).toBe(true);
    expect(corrispondeFiltroTask(nodo, "analisi", "completati", "Ada Lovelace")).toBe(false);
    expect(corrispondeFiltroTask(nodo, "analisi", "in-corso", "Grace Hopper")).toBe(false);
  });

  it("individua i task in ritardo", () => {
    expect(corrispondeFiltroTask(task(40), "", "in-ritardo")).toBe(true);
    expect(corrispondeFiltroTask(task(100), "", "in-ritardo")).toBe(false);
  });
});
