import type { Connection, Edge } from "@xyflow/react";

export function creaValidatoreDipendenze(edges: Edge[]) {
  const successori = new Map<string, string[]>();
  const collegamenti = new Map<string, Set<string>>();
  for (const edge of edges) {
    const lista = successori.get(edge.source) ?? [];
    lista.push(edge.target);
    successori.set(edge.source, lista);
    const destinazioni = collegamenti.get(edge.source) ?? new Set<string>();
    destinazioni.add(edge.target);
    collegamenti.set(edge.source, destinazioni);
  }

  return (connessione: Connection): string | null => {
    const { source, target } = connessione;
    if (!source || !target) return "Seleziona entrambi i task da collegare.";
    if (source === target) return "Un task non può dipendere da sé stesso.";
    if (collegamenti.get(source)?.has(target)) return "Questa dipendenza esiste già.";

    const visitati = new Set<string>();
    const daVisitare = [target];
    while (daVisitare.length > 0) {
      const corrente = daVisitare.pop();
      if (!corrente || visitati.has(corrente)) continue;
      if (corrente === source) return "La dipendenza creerebbe un ciclo.";
      visitati.add(corrente);
      daVisitare.push(...(successori.get(corrente) ?? []));
    }
    return null;
  };
}

export function erroreDipendenza(connessione: Connection, edges: Edge[]): string | null {
  return creaValidatoreDipendenze(edges)(connessione);
}
