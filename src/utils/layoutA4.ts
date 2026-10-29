import type { Edge } from "@xyflow/react";
import type { WbsNode } from "../models/WbsTask";

export type OrientamentoA4 = "orizzontale" | "verticale";

export const DIMENSIONI_A4 = {
  orizzontale: { larghezza: 1123, altezza: 794, colonne: 4, righe: 6 },
  verticale: { larghezza: 794, altezza: 1123, colonne: 2, righe: 9 }
} as const;
export const A4_GAP_FOGLI = 40;

const MARGINE = 48;
const PASSO_COLONNA = 250;
const PASSO_RIGA = 110;
const PASSO_LIVELLO_ALBERO = 214;

export function capacitaFoglioA4(orientamento: OrientamentoA4): number {
  const dimensioni = DIMENSIONI_A4[orientamento];
  return dimensioni.colonne * dimensioni.righe;
}

function organizzaAlberoVerticale(nodes: WbsNode[], edges: Edge[]): WbsNode[] {
  const indici = new Map(nodes.map((node, indice) => [node.id, indice]));
  const figli = new Map<string, string[]>();
  const haPadre = new Set<string>();

  for (const edge of edges) {
    if (!indici.has(edge.source) || !indici.has(edge.target) || edge.source === edge.target) continue;
    const discendenti = figli.get(edge.source) ?? [];
    if (!discendenti.includes(edge.target)) discendenti.push(edge.target);
    figli.set(edge.source, discendenti);
    haPadre.add(edge.target);
  }
  for (const discendenti of figli.values()) {
    discendenti.sort((a, b) => indici.get(a)! - indici.get(b)!);
  }

  const profondita = new Map<string, number>();
  const coda: string[] = [];
  const aggiungiRadice = (id: string) => {
    if (profondita.has(id)) return;
    profondita.set(id, 0);
    coda.push(id);
  };
  for (const node of nodes) {
    if (!haPadre.has(node.id)) aggiungiRadice(node.id);
  }

  const elaboraCoda = () => {
    for (let indice = 0; indice < coda.length; indice += 1) {
      const id = coda[indice];
      const livelloFiglio = profondita.get(id)! + 1;
      for (const figlio of figli.get(id) ?? []) {
        if (profondita.has(figlio)) continue;
        profondita.set(figlio, livelloFiglio);
        coda.push(figlio);
      }
    }
  };
  elaboraCoda();
  for (const node of nodes) {
    if (profondita.has(node.id)) continue;
    aggiungiRadice(node.id);
    elaboraCoda();
  }

  const livelli = new Map<number, WbsNode[]>();
  for (const node of nodes) {
    const livello = profondita.get(node.id) ?? 0;
    const nodiLivello = livelli.get(livello) ?? [];
    nodiLivello.push(node);
    livelli.set(livello, nodiLivello);
  }
  const massimoPerLivello = Math.max(0, ...[...livelli.values()].map((gruppo) => gruppo.length));
  const posizioni = new Map<string, { x: number; y: number }>();

  for (const [livello, nodiLivello] of livelli) {
    const primaColonna = (massimoPerLivello - nodiLivello.length) / 2;
    nodiLivello.forEach((node, indice) => {
      posizioni.set(node.id, {
        x: MARGINE + (primaColonna + indice) * PASSO_COLONNA,
        y: MARGINE + livello * PASSO_LIVELLO_ALBERO
      });
    });
  }

  return nodes.map((node) => {
    const position = posizioni.get(node.id);
    if (!position || (node.position.x === position.x && node.position.y === position.y)) {
      return node;
    }
    return { ...node, position };
  });
}

export function organizzaNodiSuFogliA4(
  nodes: WbsNode[],
  orientamento: OrientamentoA4,
  edges: Edge[] = []
): WbsNode[] {
  if (orientamento === "verticale") return organizzaAlberoVerticale(nodes, edges);

  const dimensioni = DIMENSIONI_A4[orientamento];
  const principali = nodes.filter((node) => node.data.tipoTask === "Principale");
  const gruppiPerData = new Map<string, WbsNode[]>();
  for (const node of nodes) {
    if (node.data.tipoTask === "Principale") continue;
    const data = node.data.dataInizio ?? "9999-12-31";
    const gruppo = gruppiPerData.get(data) ?? [];
    gruppo.push(node);
    gruppiPerData.set(data, gruppo);
  }

  const gruppi = [
    ...(principali.length > 0 ? [principali] : []),
    ...[...gruppiPerData.entries()]
      .sort(([dataA], [dataB]) => dataA.localeCompare(dataB))
      .map(([, gruppo]) => gruppo)
  ];
  const massimoPerLivello = Math.max(0, ...gruppi.map((gruppo) => gruppo.length));
  const posizioni = new Map<string, { x: number; y: number }>();

  gruppi.forEach((gruppo, indiceLivello) => {
    const paginaVerticale = Math.floor(indiceLivello / dimensioni.righe);
    const riga = indiceLivello % dimensioni.righe;
    const primaColonna = (massimoPerLivello - gruppo.length) / 2;

    gruppo.forEach((node, indiceNelLivello) => {
      const colonna = primaColonna + indiceNelLivello;
      const paginaOrizzontale = Math.floor(colonna / dimensioni.colonne);
      const colonnaNellaPagina = colonna % dimensioni.colonne;
      posizioni.set(node.id, {
        x:
          (paginaVerticale + paginaOrizzontale) *
            (dimensioni.larghezza + A4_GAP_FOGLI) +
          MARGINE +
          colonnaNellaPagina * PASSO_COLONNA,
        y: MARGINE + riga * PASSO_RIGA
      });
    });
  });

  return nodes.map((node) => {
    const position = posizioni.get(node.id);
    if (!position || (node.position.x === position.x && node.position.y === position.y)) {
      return node;
    }
    return { ...node, position };
  });
}
