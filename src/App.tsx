import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  ControlButton,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import TaskNode from "./components/TaskNode";
import Toolbar from "./components/Toolbar";
import { useWbsStore } from "./store/wbsStore";
import type { WbsNode } from "./models/WbsTask";
import type { TipoFreccia } from "./models/Progetto";
import { apriProgetto, nuovoProgetto, salvaProgetto } from "./services/comandiProgetto";
import { esportaVistaJpg, esportaVistaPng } from "./services/esportaImmagine";
import { coloreAvanzamento } from "./utils/avanzamentoUtils";
import { violaFineInizio } from "./utils/dateUtils";
import { corrispondeFiltroTask, type FiltroTask } from "./utils/filtroTask";
import {
  eliminaBozzaAutomatica,
  leggiBozzaAutomatica,
  salvaBozzaAutomatica
} from "./services/bozzaAutomatica";
import { deserializzaProgetto, serializzaProgetto } from "./services/projectService";
import { creaValidatoreDipendenze } from "./utils/dependencyUtils";
import { creaArchivioProgetto, creaVersione } from "./services/versioniProgetto";
import {
  A4_GAP_FOGLI,
  capacitaFoglioA4,
  DIMENSIONI_A4,
  type OrientamentoA4
} from "./utils/layoutA4";

// Fuori dal componente per evitare re-render inutili
const nodeTypes = { task: TaskNode };
const GanttView = lazy(() => import("./components/GanttView"));
const ResourceView = lazy(() => import("./components/ResourceView"));
const PrintReport = lazy(() => import("./components/PrintReport"));
const TaskPropertiesPanel = lazy(() => import("./components/TaskPropertiesPanel"));
const VersioniDialog = lazy(() => import("./components/VersioniDialog"));
const ElencoVersioniDialog = lazy(() => import("./components/ElencoVersioniDialog"));
const NotaVersioneDialog = lazy(() => import("./components/NotaVersioneDialog"));

type RichiestaNotaVersione = {
  titolo: string;
  notaIniziale: string;
  azione: "baseline" | "nuova" | "ripristino";
  idVersione?: string;
};

type MenuContestuale = {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  targetNodeId?: string;
};

type GrafoWorkspaceProps = {
  nodiVisibili: WbsNode[];
  edgesVisuali: Edge[];
  onNodesChange: (changes: NodeChange<WbsNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;
  onConnect: (connection: Connection) => void;
  validaDipendenza: ReturnType<typeof creaValidatoreDipendenze>;
  selectNode: (id: string | null) => void;
  erroreCollegamento: string | null;
  nodesCount: number;
  mostraFogliA4: boolean;
  orientamentoGrigliaA4: OrientamentoA4;
  richiestaFitA4: number;
};

function GrafoWorkspace({
  nodiVisibili,
  edgesVisuali,
  onNodesChange,
  onEdgesChange,
  onConnect,
  validaDipendenza,
  selectNode,
  erroreCollegamento,
  nodesCount,
  mostraFogliA4,
  orientamentoGrigliaA4,
  richiestaFitA4
}: GrafoWorkspaceProps) {
  const { fitView, zoomTo, screenToFlowPosition } = useReactFlow();
  const addTask = useWbsStore((s) => s.addTask);
  const [menuContestuale, setMenuContestuale] = useState<MenuContestuale | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dimensioniA4 = DIMENSIONI_A4[orientamentoGrigliaA4];

  useEffect(() => {
    if (richiestaFitA4 === 0) return;
    void fitView({ padding: 0.1, maxZoom: 0.8, duration: 300 });
  }, [fitView, richiestaFitA4]);

  useEffect(() => {
    if (!menuContestuale) return;
    const chiudi = (e: MouseEvent | PointerEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      setMenuContestuale(null);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setMenuContestuale(null);
    };
    window.addEventListener("pointerdown", chiudi);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", chiudi);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuContestuale]);

  return (
    <>
      <ReactFlow
        onInit={() => {
          const schermata = document.getElementById("startup-screen");
          if (!schermata) return;
          schermata.setAttribute("aria-hidden", "true");
          schermata.classList.add("startup-screen--ready");
          window.setTimeout(() => schermata.remove(), 350);
        }}
        nodes={nodiVisibili}
        edges={edgesVisuali}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={(connessione) =>
          validaDipendenza({
            source: connessione.source,
            target: connessione.target,
            sourceHandle: connessione.sourceHandle ?? null,
            targetHandle: connessione.targetHandle ?? null
          }) === null
        }
        onConnectEnd={(_, statoConnessione) => {
          if (!statoConnessione.fromNode || !statoConnessione.toNode) return;
          const errore = validaDipendenza({
            source: statoConnessione.fromNode.id,
            target: statoConnessione.toNode.id,
            sourceHandle: statoConnessione.fromHandle.id ?? null,
            targetHandle: statoConnessione.toHandle?.id ?? null
          });
          if (errore) useWbsStore.setState({ erroreCollegamento: errore });
        }}
        onNodeClick={(_, n) => {
          selectNode(n.id);
          setMenuContestuale(null);
        }}
        onPaneClick={() => {
          selectNode(null);
          useWbsStore.setState({ erroreCollegamento: null });
          setMenuContestuale(null);
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          setMenuContestuale({
            x: event.clientX,
            y: event.clientY,
            flowX: Math.round(flowPos.x),
            flowY: Math.round(flowPos.y)
          });
        }}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          selectNode(node.id);
          const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          setMenuContestuale({
            x: event.clientX,
            y: event.clientY,
            flowX: Math.round(flowPos.x),
            flowY: Math.round(flowPos.y),
            targetNodeId: node.id
          });
        }}
        onMoveStart={() => setMenuContestuale(null)}
        deleteKeyCode={["Delete", "Backspace"]}
        minZoom={0.2}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
      >
        <Background gap={16} />
        {mostraFogliA4 && (
          <ViewportPortal>
            {Array.from(
              { length: Math.max(1, Math.ceil(nodesCount / capacitaFoglioA4(orientamentoGrigliaA4))) },
              (_, indice) => (
                <div
                  key={indice}
                  className="a4-sheet"
                  aria-hidden="true"
                  style={{
                    left: indice * (dimensioniA4.larghezza + A4_GAP_FOGLI),
                    width: dimensioniA4.larghezza,
                    height: dimensioniA4.altezza
                  }}
                />
              )
            )}
          </ViewportPortal>
        )}
        <Controls>
          <ControlButton
            className="react-flow__controls-zoom100"
            onClick={() => zoomTo(1)}
            title="Zoom 100%"
            aria-label="Zoom 100%"
          >
            100%
          </ControlButton>
        </Controls>
        <MiniMap<WbsNode>
          pannable
          zoomable
          nodeColor={(n) => coloreAvanzamento(n.data.percentuale)}
        />
      </ReactFlow>

      {menuContestuale && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{
            top: Math.min(menuContestuale.y, window.innerHeight - 90),
            left: Math.min(menuContestuale.x, window.innerWidth - 180)
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="context-menu__action"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const pos = { x: menuContestuale.flowX, y: menuContestuale.flowY };
              setMenuContestuale(null);
              addTask({ position: pos });
            }}
          >
            Nuovo task
          </button>
          <button
            type="button"
            className="context-menu__action"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const pos = { x: menuContestuale.flowX, y: menuContestuale.flowY };
              const targetNodeId = menuContestuale.targetNodeId;
              setMenuContestuale(null);
              addTask({
                position: pos,
                nodoFiglio: "F",
                parentId: targetNodeId
              });
            }}
          >
            Nuovo task figlio
          </button>
        </div>
      )}

      {nodesCount === 0 && (
        <div className="empty-hint">
          Premi <strong>+ Nuovo task</strong> o fai clic destro per iniziare.
          <br />
          Trascina da un punto di ancoraggio su un lato del task a un punto su un altro task per
          collegarli.
        </div>
      )}
      {erroreCollegamento && (
        <p className="connection-error" role="alert">
          {erroreCollegamento}
        </p>
      )}
    </>
  );
}

export default function App() {
  const [visualizzazione, setVisualizzazione] = useState<"grafo" | "gantt" | "risorse">("grafo");
  const [mostraFogliA4, setMostraFogliA4] = useState(false);
  const [orientamentoGrigliaA4, setOrientamentoGrigliaA4] =
    useState<OrientamentoA4>("orizzontale");
  const [richiestaFitA4, setRichiestaFitA4] = useState(0);
  const [ricerca, setRicerca] = useState("");
  const [filtro, setFiltro] = useState<FiltroTask>("tutti");
  const [responsabile, setResponsabile] = useState("");
  const [richiestaReport, setRichiestaReport] = useState(false);
  const [mostraVersioni, setMostraVersioni] = useState(false);
  const [mostraElencoVersioni, setMostraElencoVersioni] = useState(false);
  const [richiestaNotaVersione, setRichiestaNotaVersione] =
    useState<RichiestaNotaVersione | null>(null);
  const recuperoBozza = useRef<ReturnType<typeof leggiBozzaAutomatica> | null>(null);
  const progettoId = useWbsStore((s) => s.progettoId);
  const nomeProgetto = useWbsStore((s) => s.nomeProgetto);
  const modificato = useWbsStore((s) => s.modificato);
  const nodes = useWbsStore((s) => s.nodes);
  const selectedId = useWbsStore((s) => s.selectedId);
  const edges = useWbsStore((s) => s.edges);
  const archivio = useWbsStore((s) => s.archivio);
  const tipoFreccia = useWbsStore((s) => s.tipoFreccia);
  const onNodesChange = useWbsStore((s) => s.onNodesChange);
  const onEdgesChange = useWbsStore((s) => s.onEdgesChange);
  const onConnect = useWbsStore((s) => s.onConnect);
  const selectNode = useWbsStore((s) => s.selectNode);
  const erroreCollegamento = useWbsStore((s) => s.erroreCollegamento);
  const annulla = useWbsStore((s) => s.annulla);
  const ripeti = useWbsStore((s) => s.ripeti);

  const salvaSnapshotVersione = useCallback(
    async (nota: string, baseline: boolean): Promise<boolean> => {
      if (!window.electronAPI) {
        window.alert("La gestione versioni è disponibile solo nell'app desktop.");
        return false;
      }
      try {
        let stato = useWbsStore.getState();
        if (!stato.percorsoFile?.toLowerCase().endsWith(".wbsm")) {
          if (!(await salvaProgetto(true))) return false;
          stato = useWbsStore.getState();
        }
        const contenuto = serializzaProgetto({
          id: stato.progettoId,
          nome: stato.nomeProgetto,
          tipoFreccia: stato.tipoFreccia,
          nodes: stato.nodes,
          edges: stato.edges
        });
        const archivioBase =
          stato.archivio ??
          creaArchivioProgetto(contenuto, stato.progettoId, stato.nomeProgetto);
        const nuovoArchivio = creaVersione(archivioBase, contenuto, nota, baseline);
        const risultato = await window.electronAPI.salvaProgetto({
          percorso: stato.percorsoFile,
          contenuto,
          nomeSuggerito: stato.nomeProgetto,
          archivio: nuovoArchivio
        });
        if (!risultato) return false;
        useWbsStore.getState().segnaSalvato(risultato.percorso, risultato.archivio);
        return true;
      } catch (errore) {
        const dettaglio = errore instanceof Error ? errore.message : String(errore);
        window.alert(`Impossibile salvare la versione del progetto.\n\n${dettaglio}`);
        return false;
      }
    },
    []
  );

  const chiediBaseline = useCallback(() => {
    if (archivio?.manifest.baselineId) {
      window.alert("La baseline è già stata definita e non può essere sostituita.");
      return;
    }
    setRichiestaNotaVersione({
      titolo: "Imposta baseline 1.0",
      notaIniziale: "Baseline iniziale",
      azione: "baseline"
    });
  }, [archivio]);

  const chiediNuovaVersione = useCallback(() => {
    if (!archivio?.manifest.baselineId) {
      window.alert("Definisci prima la baseline del progetto.");
      return;
    }
    setRichiestaNotaVersione({
      titolo: "Crea nuova versione",
      notaIniziale: "",
      azione: "nuova"
    });
  }, [archivio]);

  const ripristinaVersione = useCallback(
    (idVersione: string) => {
      const stato = useWbsStore.getState();
      const contenuto = stato.archivio?.versioni[idVersione];
      const versione = stato.archivio?.indiceVersioni.find((item) => item.id === idVersione);
      if (!contenuto || !versione) {
        window.alert("La versione selezionata non è disponibile nell'archivio.");
        return;
      }
      setRichiestaNotaVersione({
        titolo: `Ripristina ${versione.versione} come nuova versione`,
        notaIniziale: `Ripristino di ${versione.versione}`,
        azione: "ripristino",
        idVersione
      });
    },
    []
  );

  const confermaNotaVersione = useCallback(
    async (nota: string) => {
      const richiesta = richiestaNotaVersione;
      if (!richiesta) return;
      if (richiesta.azione === "baseline" || richiesta.azione === "nuova") {
        const salvata = await salvaSnapshotVersione(nota, richiesta.azione === "baseline");
        if (salvata) setRichiestaNotaVersione(null);
        return;
      }

      const stato = useWbsStore.getState();
      const contenuto = richiesta.idVersione
        ? stato.archivio?.versioni[richiesta.idVersione]
        : undefined;
      if (!contenuto || !stato.archivio) {
        window.alert("La versione selezionata non è disponibile nell'archivio.");
        setRichiestaNotaVersione(null);
        return;
      }
      if (!window.electronAPI) {
        window.alert("Il ripristino delle versioni è disponibile solo nell'app desktop.");
        return;
      }
      try {
        const progetto = deserializzaProgetto(contenuto);
        const archivioAggiornato = creaVersione(stato.archivio, contenuto, nota);
        const risultato = await window.electronAPI.salvaProgetto({
          percorso: stato.percorsoFile,
          contenuto,
          nomeSuggerito: progetto.nome,
          archivio: archivioAggiornato
        });
        if (!risultato) return;
        useWbsStore
          .getState()
          .caricaProgetto(progetto, risultato.percorso, false, risultato.archivio);
        setMostraVersioni(false);
        setRichiestaNotaVersione(null);
      } catch (errore) {
        const dettaglio = errore instanceof Error ? errore.message : String(errore);
        window.alert(`Impossibile ripristinare la versione.\n\n${dettaglio}`);
      }
    },
    [richiestaNotaVersione, salvaSnapshotVersione]
  );

  const generaReport = useCallback(() => {
    void import("./services/generaReport")
      .then(({ generaReportPdf }) => generaReportPdf(nomeProgetto))
      .then((percorso) => {
        if (percorso) window.alert(`Report PDF generato:\n${percorso}`);
      })
      .catch((errore: unknown) => {
        const dettaglio = errore instanceof Error ? errore.message : String(errore);
        window.alert(`Impossibile generare il report PDF.\n\n${dettaglio}`);
      })
      .finally(() => setRichiestaReport(false));
  }, [nomeProgetto]);

  // Gli archi dipendono da tipo e date; posizione e avanzamento non ne cambiano lo stile.
  const firmaDatiArchi = useMemo(
    () =>
      JSON.stringify(
        nodes.map((node) => [
          node.id,
          node.data.tipoTask,
          node.data.dataInizio,
          node.data.dataFine
        ])
      ),
    [nodes]
  );

  // Frecce: grigie se tutto ok, rosse e animate se le date non rispettano la dipendenza Fine-Inizio
  const edgesVisuali = useMemo<Edge[]>(() => {
    const datiPerId = new Map(nodes.map((n) => [n.id, n.data]));
    return edges.map((e) => {
      const predecessore = datiPerId.get(e.source);
      const successore = datiPerId.get(e.target);
      const collegamentoPrincipale =
        predecessore?.tipoTask === "Principale" || successore?.tipoTask === "Principale";
      const conflitto =
        !collegamentoPrincipale && violaFineInizio(predecessore, successore);
      const colore = conflitto ? "#dc2626" : "#64748b";
      return {
        ...e,
        type: tipoFreccia,
        animated: conflitto,
        label: conflitto ? "Conflitto date" : undefined,
        style: { stroke: colore, strokeWidth: conflitto ? 2 : 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: colore }
      };
    });
  }, [firmaDatiArchi, edges, tipoFreccia]);
  const validaDipendenza = useMemo(() => creaValidatoreDipendenze(edges), [edges]);

  // Titolo finestra e avviso di chiusura con modifiche non salvate
  useEffect(() => {
    document.title = `${modificato ? "● " : ""}${nomeProgetto} – WBS Manager`;
    window.electronAPI?.impostaModificato(modificato);
  }, [modificato, nomeProgetto]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attivo = true;

    recuperoBozza.current ??= leggiBozzaAutomatica();
    void recuperoBozza.current
      .then((bozza) => {
        if (!attivo || !bozza || useWbsStore.getState().modificato) return;
        if (window.confirm("È disponibile una bozza non salvata. Vuoi recuperarla?")) {
          const progetto = deserializzaProgetto(bozza.contenuto);
          useWbsStore.getState().caricaProgetto(progetto, bozza.percorso, true, bozza.archivio);
        } else {
          return eliminaBozzaAutomatica();
        }
      })
      .catch((errore: unknown) => {
        if (!attivo) return;
        const dettaglio = errore instanceof Error ? errore.message : String(errore);
        window.alert(`Impossibile recuperare la bozza automatica.\n\n${dettaglio}`);
      });

    const unsubscribe = useWbsStore.subscribe((stato, precedente) => {
      if (timer) clearTimeout(timer);
      if (!stato.modificato && !precedente.modificato) return;
      if (!stato.modificato) {
        void eliminaBozzaAutomatica().catch((errore: unknown) => {
          const dettaglio = errore instanceof Error ? errore.message : String(errore);
          window.alert(`Impossibile eliminare la bozza automatica.\n\n${dettaglio}`);
        });
        return;
      }
      timer = setTimeout(() => {
        void salvaBozzaAutomatica(useWbsStore.getState()).catch((errore: unknown) => {
          const dettaglio = errore instanceof Error ? errore.message : String(errore);
          window.alert(`Impossibile salvare la bozza automatica.\n\n${dettaglio}`);
        });
      }, 700);
    });
    if (useWbsStore.getState().modificato) {
      timer = setTimeout(() => {
        void salvaBozzaAutomatica(useWbsStore.getState()).catch((errore: unknown) => {
          const dettaglio = errore instanceof Error ? errore.message : String(errore);
          window.alert(`Impossibile salvare la bozza automatica.\n\n${dettaglio}`);
        });
      }, 700);
    }
    return () => {
      attivo = false;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // Scorciatoie da tastiera
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tasto = e.key.toLowerCase();
      const elemento = e.target;
      const staModificandoTesto =
        elemento instanceof HTMLElement &&
        Boolean(elemento.closest("input, textarea, select, [contenteditable='true']"));
      if ((tasto === "z" || tasto === "y") && !staModificandoTesto) {
        e.preventDefault();
        if (tasto === "z" && e.shiftKey) ripeti();
        else if (tasto === "z") annulla();
        else ripeti();
      } else if (tasto === "s") {
        e.preventDefault();
        void salvaProgetto(e.shiftKey);
      } else if (tasto === "o") {
        e.preventDefault();
        void apriProgetto();
      } else if (tasto === "n") {
        e.preventDefault();
        nuovoProgetto();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [annulla, ripeti]);

  const nodiVisibili = useMemo(
    () =>
      nodes.map((node) => {
        const corrisponde = corrispondeFiltroTask(node, ricerca, filtro, responsabile);
        const opacita = corrisponde ? 1 : 0.18;
        const selected = node.id === selectedId;
        if (node.style?.opacity === opacita && Boolean(node.selected) === selected) return node;
        return {
          ...node,
          selected,
          style: { ...node.style, opacity: opacita }
        };
      }),
    [nodes, ricerca, filtro, responsabile, selectedId]
  );

  return (
    <div className="app">
      <Toolbar
        visualizzazione={visualizzazione}
        onVisualizzazioneChange={setVisualizzazione}
        mostraFogliA4={mostraFogliA4}
        onMostraFogliA4Change={setMostraFogliA4}
        orientamentoGrigliaA4={orientamentoGrigliaA4}
        onOrientamentoGrigliaA4Change={setOrientamentoGrigliaA4}
        onOrganizza={() => {
          useWbsStore.getState().organizzaNodi("verticale");
          setMostraFogliA4(true);
          setRichiestaFitA4((richiesta) => richiesta + 1);
        }}
        tipoFreccia={tipoFreccia}
        onTipoFrecciaChange={(tipo: TipoFreccia) => useWbsStore.getState().setTipoFreccia(tipo)}
        ricerca={ricerca}
        onRicercaChange={setRicerca}
        filtro={filtro}
        onFiltroChange={setFiltro}
        responsabile={responsabile}
        onResponsabileChange={setResponsabile}
        onCreaBaseline={chiediBaseline}
        onCreaVersione={chiediNuovaVersione}
        onGestisciVersioni={() => setMostraVersioni(true)}
        onMostraElencoVersioni={() => setMostraElencoVersioni(true)}
        onImportaCsv={() => {
          void import("./services/trasferimentoCsv")
            .then(({ importaTaskCsv }) => importaTaskCsv())
            .then((quantita) => {
              if (quantita > 0) window.alert(`Importati ${quantita} task nel progetto corrente.`);
            })
            .catch((errore: unknown) => {
              const dettaglio = errore instanceof Error ? errore.message : String(errore);
              window.alert(`Impossibile importare il CSV.\n\n${dettaglio}`);
            });
        }}
        onEsportaCsv={() => {
          void import("./services/trasferimentoCsv")
            .then(({ esportaTaskCsv }) => esportaTaskCsv())
            .catch((errore: unknown) => {
              const dettaglio = errore instanceof Error ? errore.message : String(errore);
              window.alert(`Impossibile esportare il CSV.\n\n${dettaglio}`);
            });
        }}
        onGeneraReport={() => setRichiestaReport(true)}
        onEsportaPng={() =>
          void esportaVistaPng(visualizzazione, nomeProgetto, nodes).catch((errore: unknown) => {
            const dettaglio = errore instanceof Error ? errore.message : String(errore);
            window.alert(`Impossibile esportare l'immagine PNG.\n\n${dettaglio}`);
          })
        }
        onEsportaJpg={() =>
          void esportaVistaJpg(visualizzazione, nomeProgetto, nodes).catch((errore: unknown) => {
            const dettaglio = errore instanceof Error ? errore.message : String(errore);
            window.alert(`Impossibile esportare l'immagine JPG.\n\n${dettaglio}`);
          })
        }
      />

      <div className="workspace">
        <main className={`canvas${visualizzazione === "gantt" ? " canvas--gantt" : ""}`}>
          {visualizzazione === "grafo" ? (
            <ReactFlowProvider key={progettoId}>
              <GrafoWorkspace
                nodiVisibili={nodiVisibili}
                edgesVisuali={edgesVisuali}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                validaDipendenza={validaDipendenza}
                selectNode={selectNode}
                erroreCollegamento={erroreCollegamento}
                nodesCount={nodes.length}
                mostraFogliA4={mostraFogliA4}
                orientamentoGrigliaA4={orientamentoGrigliaA4}
                richiestaFitA4={richiestaFitA4}
              />
            </ReactFlowProvider>
          ) : (
            <Suspense fallback={<p className="view-loading" role="status">Caricamento vista…</p>}>
              {visualizzazione === "gantt" ? (
                <GanttView ricerca={ricerca} filtro={filtro} responsabile={responsabile} />
              ) : (
                <ResourceView
                  nodes={nodes}
                  ricerca={ricerca}
                  filtro={filtro}
                  responsabile={responsabile}
                />
              )}
            </Suspense>
          )}
        </main>

        {visualizzazione !== "risorse" && selectedId && (
          <Suspense fallback={null}>
            <TaskPropertiesPanel />
          </Suspense>
        )}
      </div>
      {richiestaReport && (
        <Suspense fallback={null}>
          <PrintReport
            nomeProgetto={nomeProgetto}
            nodes={nodes}
            edges={edges}
            onReady={generaReport}
          />
        </Suspense>
      )}
      <Suspense fallback={null}>
        {mostraVersioni && archivio && (
          <VersioniDialog
            archivio={archivio}
            onClose={() => setMostraVersioni(false)}
            onRipristina={ripristinaVersione}
          />
        )}
        {mostraElencoVersioni && archivio && (
          <ElencoVersioniDialog
            archivio={archivio}
            onClose={() => setMostraElencoVersioni(false)}
            onRipristina={ripristinaVersione}
          />
        )}
        {richiestaNotaVersione && (
          <NotaVersioneDialog
            titolo={richiestaNotaVersione.titolo}
            notaIniziale={richiestaNotaVersione.notaIniziale}
            onConferma={(nota) => void confermaNotaVersione(nota)}
            onAnnulla={() => setRichiestaNotaVersione(null)}
          />
        )}
      </Suspense>
    </div>
  );
}
