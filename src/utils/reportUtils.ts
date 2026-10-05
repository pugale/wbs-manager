import type { WbsNode } from "../models/WbsTask";

export function calcolaAvanzamentoMedio(nodes: WbsNode[]): number {
  if (nodes.length === 0) return 0;
  return Math.round(nodes.reduce((totale, node) => totale + node.data.percentuale, 0) / nodes.length);
}
