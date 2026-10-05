import type { WbsTaskData } from "./WbsTask";

export const TIPI_FRECCIA = ["bezier", "straight", "step"] as const;
export type TipoFreccia = (typeof TIPI_FRECCIA)[number];

// Da aumentare quando cambia la struttura del file
export const VERSIONE_FORMATO = 1;

// Struttura JSON usata come file di progetto e come contenuto degli archivi .wbsm
export type ProgettoFile = {
  versione: number;
  id: string;
  nome: string;
  tipoFreccia: TipoFreccia;
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: WbsTaskData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>;
};
