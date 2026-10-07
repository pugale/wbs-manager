import type { Node } from "@xyflow/react";

export const TIPI_TASK = [
  "Principale",
  "Analisi",
  "Progettazione",
  "Sviluppo",
  "Test",
  "Collaudo",
  "Rilascio"
] as const;

export type TipoTask = (typeof TIPI_TASK)[number];

// "type" e non "interface": React Flow 12 richiede che i dati del nodo
// siano compatibili con Record<string, unknown>
export type WbsTaskData = {
  titolo: string;
  tipoTask: TipoTask;
  descrizione: string;
  responsabile: string;
  dataInizio: string | null; // formato "yyyy-MM-dd"
  dataFine: string | null; // formato "yyyy-MM-dd"
  nodoFiglio?: "" | "F"; // vuoto = indipendente; "F" = figlio del precedente
  percentuale: number; // 0-100
};

export type WbsNode = Node<WbsTaskData, "task">;
