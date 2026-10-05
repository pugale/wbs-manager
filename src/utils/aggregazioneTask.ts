import type { Edge } from "@xyflow/react";
import type { WbsNode } from "../models/WbsTask";

type NodiPerId = Map<string, WbsNode>;
type Adiacenze = Map<string, string[]>;

function creaAdiacenze(edges: Edge[]): Adiacenze {
  const adiacenze: Adiacenze = new Map();
  for (const edge of edges) {
    const daSource = adiacenze.get(edge.source) ?? [];
    daSource.push(edge.target);
    adiacenze.set(edge.source, daSource);

    const daTarget = adiacenze.get(edge.target) ?? [];
    daTarget.push(edge.source);
    adiacenze.set(edge.target, daTarget);
  }
  return adiacenze;
}

function visitaDiscendenti(
  principaleId: string,
  nodoPerId: NodiPerId,
  adiacenze: Adiacenze
): WbsNode[] {
  const discendenti = new Set<string>();
  const daVisitare = [principaleId];

  while (daVisitare.length > 0) {
    const corrente = daVisitare.pop();
    if (!corrente) continue;

    for (const collegato of adiacenze.get(corrente) ?? []) {
      if (discendenti.has(collegato) || collegato === principaleId) continue;

      discendenti.add(collegato);
      if (nodoPerId.get(collegato)?.data.tipoTask === "Principale") {
        daVisitare.push(collegato);
      }
    }
  }

  return [...discendenti].flatMap((id) => {
    const node = nodoPerId.get(id);
    return node ? [node] : [];
  });
}

export function taskDiscendentiPrincipali(
  principaleId: string,
  nodes: WbsNode[],
  edges: Edge[]
): WbsNode[] {
  const nodoPerId = new Map(nodes.map((node) => [node.id, node]));
  return visitaDiscendenti(principaleId, nodoPerId, creaAdiacenze(edges));
}

export function ricalcolaPercentualiPrincipali(nodes: WbsNode[], edges: Edge[]): WbsNode[] {
  const nodoPerId = new Map(nodes.map((node) => [node.id, node]));
  const adiacenze = creaAdiacenze(edges);
  const percentualiPerId = new Map<string, number>();
  const visitati = new Set<string>();

  for (const node of nodes) {
    if (node.data.tipoTask !== "Principale" || visitati.has(node.id)) continue;

    const principali = new Set<string>();
    const taskFoglia = new Set<string>();
    const daVisitare = [node.id];

    while (daVisitare.length > 0) {
      const corrente = daVisitare.pop();
      if (!corrente || visitati.has(corrente)) continue;
      visitati.add(corrente);
      principali.add(corrente);

      for (const collegato of adiacenze.get(corrente) ?? []) {
        const nodoCollegato = nodoPerId.get(collegato);
        if (!nodoCollegato) continue;
        if (nodoCollegato.data.tipoTask === "Principale") {
          if (!visitati.has(collegato)) daVisitare.push(collegato);
        } else {
          taskFoglia.add(collegato);
        }
      }
    }

    const percentuale =
      taskFoglia.size > 0
        ? Math.round(
            [...taskFoglia].reduce(
              (somma, id) => somma + (nodoPerId.get(id)?.data.percentuale ?? 0),
              0
            ) / taskFoglia.size
          )
        : 0;
    for (const principaleId of principali) percentualiPerId.set(principaleId, percentuale);
  }

  return nodes.map((node) => {
    const percentuale = percentualiPerId.get(node.id);
    if (percentuale === undefined || node.data.percentuale === percentuale) return node;
    return { ...node, data: { ...node.data, percentuale } };
  });
}
