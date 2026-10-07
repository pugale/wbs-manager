import type { Edge } from "@xyflow/react";
import {
  TIPI_FRECCIA,
  VERSIONE_FORMATO,
  type ProgettoFile,
  type TipoFreccia
} from "../models/Progetto";
import { TIPI_TASK, type WbsNode, type WbsTaskData } from "../models/WbsTask";
import { isDataIsoValida } from "../utils/dateUtils";

export type ProgettoCaricato = {
  id: string;
  nome: string;
  tipoFreccia: TipoFreccia;
  nodes: WbsNode[];
  edges: Edge[];
};

// ---------- Salvataggio ----------

// Salva solo i dati utili: niente stato temporaneo di React Flow (selezione, misure...)
export function serializzaProgetto(p: ProgettoCaricato): string {
  const file: ProgettoFile = {
    versione: VERSIONE_FORMATO,
    id: p.id,
    nome: p.nome,
    tipoFreccia: p.tipoFreccia,
    nodes: p.nodes.map((n) => ({
      id: n.id,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: n.data
    })),
    edges: p.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle
    }))
  };
  return JSON.stringify(file, null, 2);
}

// ---------- Caricamento ----------

function isOggetto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function testo(v: unknown, predefinito = ""): string {
  return typeof v === "string" ? v : predefinito;
}

function numero(v: unknown, predefinito: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : predefinito;
}

const HANDLE_IDS = new Set([
  "target-top",
  "source-top",
  "target-right",
  "source-right",
  "target-bottom",
  "source-bottom",
  "target-left",
  "source-left"
]);

function handleId(v: unknown): string | null | undefined {
  if (v === null) return null;
  return typeof v === "string" && HANDLE_IDS.has(v) ? v : undefined;
}

// Rende valido qualsiasi task letto da file: i campi mancanti o errati prendono un valore di default.
// Così i file creati con versioni precedenti dell'app si aprono senza errori.
export function normalizzaTask(grezzo: unknown): WbsTaskData {
  const d = isOggetto(grezzo) ? grezzo : {};
  const tipoTask = TIPI_TASK.find((tipo) => tipo === d.tipoTask) ?? "Sviluppo";
  const dataInizio = d.dataInizio;
  const dataFine = d.dataFine;
  const nodoFiglioGrezzo = (d.nodoFiglio ?? d.nodoFigli ?? "") as string;
  const nodoFiglio = nodoFiglioGrezzo === "F" ? "F" : "";

  return {
    titolo: testo(d.titolo, "Senza titolo"),
    tipoTask,
    descrizione: testo(d.descrizione),
    responsabile: testo(d.responsabile).trim(),
    dataInizio: isDataIsoValida(dataInizio) ? dataInizio : null,
    dataFine: isDataIsoValida(dataFine) ? dataFine : null,
    nodoFiglio,
    percentuale: Math.min(100, Math.max(0, Math.round(numero(d.percentuale, 0))))
  };
}

export function deserializzaProgetto(contenuto: string): ProgettoCaricato {
  let grezzo: unknown;
  try {
    grezzo = JSON.parse(contenuto);
  } catch {
    throw new Error("Il file non è un JSON valido.");
  }

  if (!isOggetto(grezzo) || !Array.isArray(grezzo.nodes)) {
    throw new Error("Il file non contiene un progetto WBS valido.");
  }

  const versione = numero(grezzo.versione, 1);
  if (versione > VERSIONE_FORMATO) {
    throw new Error("Il file è stato creato con una versione più recente di WBS Manager.");
  }

  // Nodi: scarta elementi senza id e id duplicati
  const nodes: WbsNode[] = [];
  const idVisti = new Set<string>();
  for (const n of grezzo.nodes) {
    if (!isOggetto(n) || typeof n.id !== "string" || idVisti.has(n.id)) continue;
    idVisti.add(n.id);
    const pos = isOggetto(n.position) ? n.position : {};
    nodes.push({
      id: n.id,
      type: "task",
      position: { x: numero(pos.x, 0), y: numero(pos.y, 0) },
      data: normalizzaTask(n.data)
    });
  }

  // Collegamenti: solo tra nodi esistenti, niente frecce di un task verso se stesso
  const tipoFreccia = TIPI_FRECCIA.find((tipo) => tipo === grezzo.tipoFreccia) ?? "bezier";
  const edges: Edge[] = [];
  const edgeViste = new Set<string>();
  const edgesGrezzi = Array.isArray(grezzo.edges) ? grezzo.edges : [];
  for (const e of edgesGrezzi) {
    if (!isOggetto(e)) continue;
    const source = testo(e.source);
    const target = testo(e.target);
    if (!idVisti.has(source) || !idVisti.has(target) || source === target) continue;
    const chiave = `${source}->${target}`;
    if (edgeViste.has(chiave)) continue;
    edgeViste.add(chiave);
    edges.push({
      id: testo(e.id) || `e-${source}-${target}`,
      source,
      target,
      ...(handleId(e.sourceHandle) !== undefined && { sourceHandle: handleId(e.sourceHandle) }),
      ...(handleId(e.targetHandle) !== undefined && { targetHandle: handleId(e.targetHandle) })
    });
  }

  return {
    id: testo(grezzo.id) || crypto.randomUUID(),
    nome: testo(grezzo.nome) || "Progetto senza nome",
    tipoFreccia,
    nodes,
    edges
  };
}
