import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange
} from "@xyflow/react";
import type { WbsNode, WbsTaskData } from "../models/WbsTask";
import type { TipoFreccia } from "../models/Progetto";
import type { ArchivioProgetto } from "../models/ProgettoArchivio";
import type { ProgettoCaricato } from "../services/projectService";
import { oggiIso } from "../utils/dateUtils";
import { ricalcolaPercentualiPrincipali } from "../utils/aggregazioneTask";
import { erroreDipendenza } from "../utils/dependencyUtils";
import type { TaskImportatoCsv } from "../services/csvProgetto";

// Questi cambiamenti non modificano il progetto (selezione, misura dei nodi)
const CAMBI_NON_RILEVANTI = new Set(["select", "dimensions"]);

type DatiProgetto = {
  progettoId: string;
  nomeProgetto: string;
  percorsoFile: string | null;
  modificato: boolean;
  tipoFreccia: TipoFreccia;
  nodes: WbsNode[];
  edges: Edge[];
  selectedId: string | null;
  archivio: ArchivioProgetto | null;
};

type Snapshot = Pick<
  DatiProgetto,
  "nomeProgetto" | "tipoFreccia" | "nodes" | "edges" | "modificato" | "selectedId"
>;

export type WbsState = DatiProgetto & {
  // React Flow
  onNodesChange: (changes: NodeChange<WbsNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;
  onConnect: (conn: Connection) => void;
  erroreCollegamento: string | null;
  annulla: () => void;
  ripeti: () => void;
  puoAnnullare: boolean;
  puoRipetere: boolean;
  _passato: Snapshot[];
  _futuro: Snapshot[];
  _dragSnapshot: Snapshot | null;

  // Task
  selectNode: (id: string | null) => void;
  addTask: () => void;
  updateTask: (id: string, patch: Partial<WbsTaskData>) => void;
  removeTask: (id: string) => void;
  importaTask: (taskImportati: TaskImportatoCsv[]) => void;

  // Progetto
  setNomeProgetto: (nome: string) => void;
  setTipoFreccia: (tipo: TipoFreccia) => void;
  setArchivio: (archivio: ArchivioProgetto | null) => void;
  nuovoProgetto: () => void;
  caricaProgetto: (
    progetto: ProgettoCaricato,
    percorso: string | null,
    modificato?: boolean,
    archivio?: ArchivioProgetto | null
  ) => void;
  segnaSalvato: (percorso: string, archivio?: ArchivioProgetto | null) => void;
};

function progettoVuoto(): DatiProgetto {
  return {
    progettoId: crypto.randomUUID(),
    nomeProgetto: "Nuovo progetto",
    percorsoFile: null,
    modificato: false,
    tipoFreccia: "bezier",
    nodes: [],
    edges: [],
    selectedId: null,
    archivio: null
  };
}

const LIMITE_CRONOLOGIA = 50;

function creaGeneratoreIdTask(nodes: WbsNode[]): () => string {
  const idsUsati = new Set(nodes.map((node) => node.id));
  let prossimo = nodes.reduce((massimo, node) => {
    if (!/^\d+$/.test(node.id)) return massimo;
    const idNumerico = BigInt(node.id);
    return idNumerico > massimo ? idNumerico : massimo;
  }, 0n) + 1n;

  return () => {
    while (idsUsati.has(prossimo.toString())) prossimo += 1n;
    const id = prossimo.toString();
    idsUsati.add(id);
    prossimo += 1n;
    return id;
  };
}

function snapshot(s: WbsState): Snapshot {
  return {
    nomeProgetto: s.nomeProgetto,
    tipoFreccia: s.tipoFreccia,
    nodes: s.nodes,
    edges: s.edges,
    modificato: s.modificato,
    selectedId: s.selectedId
  };
}

export const useWbsStore = create<WbsState>()((set) => ({
  ...progettoVuoto(),
  puoAnnullare: false,
  puoRipetere: false,
  erroreCollegamento: null,
  _passato: [],
  _futuro: [],
  _dragSnapshot: null,

  onNodesChange: (changes) =>
    set((s) => {
      const nodes = applyNodeChanges(changes, s.nodes);
      const staTrascinando = changes.some((c) => c.type === "position" && c.dragging === true);
      const fineTrascinamento = changes.some((c) => c.type === "position" && c.dragging === false);
      const rilevante = changes.some(
        (c) => !CAMBI_NON_RILEVANTI.has(c.type) && !(c.type === "position" && c.dragging)
      );
      const richiedeRicalcolo = changes.some(
        (c) => c.type === "add" || c.type === "remove" || c.type === "replace"
      );
      const snapshotPrecedente = fineTrascinamento
        ? s._dragSnapshot ?? snapshot(s)
        : snapshot(s);
      return {
        nodes: richiedeRicalcolo ? ricalcolaPercentualiPrincipali(nodes, s.edges) : nodes,
        modificato: s.modificato || rilevante,
        _dragSnapshot: staTrascinando
          ? s._dragSnapshot ?? snapshot(s)
          : fineTrascinamento
            ? null
            : s._dragSnapshot,
        ...(rilevante && {
          _passato: [...s._passato.slice(-(LIMITE_CRONOLOGIA - 1)), snapshotPrecedente],
          _futuro: [],
          puoAnnullare: true,
          puoRipetere: false
        })
      };
    }),

  onEdgesChange: (changes) =>
    set((s) => {
      const edges = applyEdgeChanges(changes, s.edges);
      const rilevante = changes.some((c) => !CAMBI_NON_RILEVANTI.has(c.type));
      const richiedeRicalcolo = changes.some(
        (c) => c.type === "add" || c.type === "remove" || c.type === "replace"
      );
      return {
        edges,
        ...(richiedeRicalcolo && { nodes: ricalcolaPercentualiPrincipali(s.nodes, edges) }),
        modificato: s.modificato || rilevante,
        ...(rilevante && {
          _passato: [...s._passato.slice(-(LIMITE_CRONOLOGIA - 1)), snapshot(s)],
          _futuro: [],
          puoAnnullare: true,
          puoRipetere: false
        })
      };
    }),

  onConnect: (conn) =>
    set((s) => {
      const errore = erroreDipendenza(conn, s.edges);
      if (errore) return { erroreCollegamento: errore };
      const edges = addEdge(conn, s.edges);
      return {
        edges,
        nodes: ricalcolaPercentualiPrincipali(s.nodes, edges),
        modificato: true,
        erroreCollegamento: null,
        _passato: [...s._passato.slice(-(LIMITE_CRONOLOGIA - 1)), snapshot(s)],
        _futuro: [],
        puoAnnullare: true,
        puoRipetere: false
      };
    }),

  selectNode: (id) => set({ selectedId: id }),
  annulla: () =>
    set((s) => {
      const precedente = s._passato.at(-1);
      if (!precedente) return s;
      return {
        ...precedente,
        nodes: ricalcolaPercentualiPrincipali(precedente.nodes, precedente.edges),
        _passato: s._passato.slice(0, -1),
        _futuro: [...s._futuro, snapshot(s)],
        puoAnnullare: s._passato.length > 1,
        puoRipetere: true
      };
    }),
  ripeti: () =>
    set((s) => {
      const successivo = s._futuro.at(-1);
      if (!successivo) return s;
      return {
        ...successivo,
        nodes: ricalcolaPercentualiPrincipali(successivo.nodes, successivo.edges),
        _passato: [...s._passato, snapshot(s)],
        _futuro: s._futuro.slice(0, -1),
        puoAnnullare: true,
        puoRipetere: s._futuro.length > 1
      };
    }),

  addTask: () =>
    set((s) => {
      const id = creaGeneratoreIdTask(s.nodes)();
      const oggi = oggiIso();
      const nuovo: WbsNode = {
        id,
        type: "task",
        position: { x: 0, y: 0 },
        data: {
          titolo: "Nuovo task",
          tipoTask: "Sviluppo",
          descrizione: "",
          responsabile: "",
          dataInizio: oggi,
          dataFine: oggi,
          nodoFiglio: "",
          percentuale: 0
        }
      };
      return {
        nodes: [...s.nodes, nuovo],
        selectedId: id,
        modificato: true,
        _passato: [...s._passato.slice(-(LIMITE_CRONOLOGIA - 1)), snapshot(s)],
        _futuro: [],
        puoAnnullare: true,
        puoRipetere: false
      };
    }),

  updateTask: (id, patch) =>
    set((s) => {
      const corrente = s.nodes.find((node) => node.id === id);
      if (!corrente || Object.entries(patch).every(([chiave, valore]) =>
        corrente.data[chiave as keyof WbsTaskData] === valore
      )) return s;
      const nodes = s.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                ...patch,
                ...(n.data.tipoTask === "Principale" && { percentuale: n.data.percentuale })
              }
            }
          : n
      );
      const cambiaStrutturaPrincipale =
        patch.tipoTask !== undefined &&
        (corrente.data.tipoTask === "Principale") !== (patch.tipoTask === "Principale");
      const cambiaAvanzamentoFoglia =
        patch.percentuale !== undefined && corrente.data.tipoTask !== "Principale";
      return {
        nodes:
          cambiaStrutturaPrincipale || cambiaAvanzamentoFoglia
            ? ricalcolaPercentualiPrincipali(nodes, s.edges)
            : nodes,
        modificato: true,
        _passato: [...s._passato.slice(-(LIMITE_CRONOLOGIA - 1)), snapshot(s)],
        _futuro: [],
        puoAnnullare: true,
        puoRipetere: false
      };
    }),

  // Elimina il task e tutte le frecce collegate
  removeTask: (id) =>
    set((s) => {
      const edges = s.edges.filter((e) => e.source !== id && e.target !== id);
      const nodes = s.nodes.filter((n) => n.id !== id);
      return {
        nodes: ricalcolaPercentualiPrincipali(nodes, edges),
        edges,
        selectedId: s.selectedId === id ? null : s.selectedId,
        modificato: true,
        _passato: [...s._passato.slice(-(LIMITE_CRONOLOGIA - 1)), snapshot(s)],
        _futuro: [],
        puoAnnullare: true,
        puoRipetere: false
      };
    }),

  importaTask: (taskImportati) =>
    set((s) => {
      const generaIdTask = creaGeneratoreIdTask(s.nodes);
      const idPerOrigine = new Map(
        taskImportati.map((task) => [task.idOrigine, generaIdTask()])
      );
      const nodiImportati: WbsNode[] = taskImportati.map((task, indice) => {
        const offset = ((s.nodes.length + indice) % 10) * 40;
        return {
          id: idPerOrigine.get(task.idOrigine)!,
          type: "task",
          position: { x: 100 + offset, y: 100 + offset },
          data: task.data
        };
      });
      let edges = [...s.edges];
      for (const task of taskImportati) {
        const target = idPerOrigine.get(task.idOrigine);
        if (!target) continue;
        for (const predecessoreOrigine of task.predecessoriOrigine) {
          const source = idPerOrigine.get(predecessoreOrigine);
          if (!source) throw new Error(`Predecessore CSV non trovato: ${predecessoreOrigine}`);
          const errore = erroreDipendenza(
            { source, target, sourceHandle: null, targetHandle: null },
            edges
          );
          if (errore) throw new Error(errore);
          edges = [...edges, { id: crypto.randomUUID(), source, target }];
        }
      }
      const nodes = ricalcolaPercentualiPrincipali([...s.nodes, ...nodiImportati], edges);
      const selezionato = nodiImportati.at(-1);
      return {
        nodes,
        edges,
        selectedId: selezionato?.id ?? s.selectedId,
        modificato: true,
        _passato: [...s._passato.slice(-(LIMITE_CRONOLOGIA - 1)), snapshot(s)],
        _futuro: [],
        puoAnnullare: true,
        puoRipetere: false
      };
    }),

  setNomeProgetto: (nome) =>
    set((s) => {
      if (s.nomeProgetto === nome) return s;
      return {
        nomeProgetto: nome,
        modificato: true,
        _passato: [...s._passato.slice(-(LIMITE_CRONOLOGIA - 1)), snapshot(s)],
        _futuro: [],
        puoAnnullare: true,
        puoRipetere: false
      };
    }),

  setTipoFreccia: (tipoFreccia) =>
    set((s) => {
      if (s.tipoFreccia === tipoFreccia) return s;
      return {
        tipoFreccia,
        modificato: true,
        _passato: [...s._passato.slice(-(LIMITE_CRONOLOGIA - 1)), snapshot(s)],
        _futuro: [],
        puoAnnullare: true,
        puoRipetere: false
      };
    }),

  setArchivio: (archivio) => set({ archivio }),

  nuovoProgetto: () =>
    set({
      ...progettoVuoto(),
      _passato: [],
      _futuro: [],
      puoAnnullare: false,
      puoRipetere: false,
      erroreCollegamento: null,
      _dragSnapshot: null,
      archivio: null
    }),

  caricaProgetto: (progetto, percorso, modificato = false, archivio = null) =>
    set({
      progettoId: progetto.id,
      nomeProgetto: progetto.nome,
      tipoFreccia: progetto.tipoFreccia,
      nodes: ricalcolaPercentualiPrincipali(progetto.nodes, progetto.edges),
      edges: progetto.edges,
      percorsoFile: percorso,
      modificato,
      selectedId: null,
      archivio,
      _passato: [],
      _futuro: [],
      puoAnnullare: false,
      puoRipetere: false,
      erroreCollegamento: null,
      _dragSnapshot: null
    }),

  segnaSalvato: (percorso, archivio) =>
    set({
      percorsoFile: percorso,
      modificato: false,
      ...(archivio !== undefined && { archivio })
    })
}));
