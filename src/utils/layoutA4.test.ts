import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import type { WbsNode } from "../models/WbsTask";
import {
  A4_GAP_FOGLI,
  DIMENSIONI_A4,
  organizzaNodiSuFogliA4
} from "./layoutA4";

function nodo(id: string, dataInizio: string | null): WbsNode {
  return {
    id,
    type: "task",
    position: { x: 0, y: 0 },
    data: {
      titolo: id,
      tipoTask: "Sviluppo",
      descrizione: "",
      responsabile: "",
      dataInizio,
      dataFine: null,
      percentuale: 0
    }
  };
}

function dataIndice(indice: number): string {
  return new Date(Date.UTC(2026, 0, indice + 1)).toISOString().slice(0, 10);
}

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target };
}

describe("organizzaNodiSuFogliA4", () => {
  it("mantiene il nodo principale in alto e raggruppa sullo stesso livello le date uguali", () => {
    const principale = nodo("principale", "2026-03-20");
    principale.data.tipoTask = "Principale";
    const nodes = [
      nodo("tardi", "2026-03-20"),
      nodo("presto-1", "2026-03-01"),
      principale,
      nodo("senza-data-1", null),
      nodo("presto-2", "2026-03-01"),
      nodo("senza-data-2", null)
    ];

    const organizzati = organizzaNodiSuFogliA4(nodes, "orizzontale");

    const posizione = (id: string) => organizzati.find((node) => node.id === id)?.position;
    expect(posizione("principale")?.y).toBe(48);
    expect(posizione("principale")?.x).toBe(173);
    expect(posizione("presto-1")?.y).toBe(posizione("presto-2")?.y);
    expect(posizione("tardi")?.y).toBeGreaterThan(posizione("presto-1")!.y);
    expect(posizione("senza-data-1")?.y).toBe(posizione("senza-data-2")?.y);
    expect(posizione("senza-data-1")?.y).toBeGreaterThan(posizione("tardi")!.y);
  });

  it("mantiene allo stesso livello un gruppo data che prosegue su più fogli", () => {
    const nodiPerLivello = DIMENSIONI_A4.orizzontale.colonne + 1;
    const nodes = Array.from({ length: nodiPerLivello }, (_, index) =>
      nodo(`task-${index}`, "2026-03-01")
    );

    const organizzati = organizzaNodiSuFogliA4(nodes, "orizzontale");

    expect(new Set(organizzati.map((node) => node.position.y)).size).toBe(1);
    expect(organizzati.find((node) => node.id === `task-${nodiPerLivello - 1}`)?.position.x).toBe(
      DIMENSIONI_A4.orizzontale.larghezza + A4_GAP_FOGLI + 48
    );
  });

  it("dispone verticalmente un albero con fratelli allineati e genitori centrati", () => {
    const nodes = [
      nodo("radice", dataIndice(0)),
      nodo("produzione", dataIndice(1)),
      nodo("collaudo", dataIndice(1)),
      nodo("sviluppi", dataIndice(1)),
      nodo("task-1", dataIndice(2)),
      nodo("task-2", dataIndice(2)),
      nodo("task-3", dataIndice(2))
    ];
    const edges = [
      edge("radice", "produzione"),
      edge("radice", "collaudo"),
      edge("radice", "sviluppi"),
      edge("sviluppi", "task-1"),
      edge("sviluppi", "task-2"),
      edge("sviluppi", "task-3")
    ];

    const organizzati = organizzaNodiSuFogliA4(nodes, "verticale", edges);
    const posizione = (id: string) => organizzati.find((node) => node.id === id)!.position;

    expect(posizione("radice")).toEqual({ x: 298, y: 48 });
    expect(posizione("produzione").x).toBe(48);
    expect(posizione("collaudo").x).toBe(298);
    expect(posizione("sviluppi").x).toBe(548);
    expect(posizione("produzione").y).toBe(posizione("collaudo").y);
    expect(posizione("collaudo").y).toBe(posizione("sviluppi").y);
    expect(posizione("task-1").y).toBe(posizione("task-2").y);
    expect(posizione("task-2").y).toBe(posizione("task-3").y);
    expect(posizione("task-1").y).toBeGreaterThan(posizione("sviluppi").y);
  });

  it("mette allo stesso livello le radici indipendenti", () => {
    const nodes = [nodo("radice-1", dataIndice(0)), nodo("radice-2", dataIndice(1))];

    const organizzati = organizzaNodiSuFogliA4(nodes, "verticale");

    expect(organizzati[0].position.y).toBe(organizzati[1].position.y);
    expect(organizzati[0].position.x).toBeLessThan(organizzati[1].position.x);
  });
});
