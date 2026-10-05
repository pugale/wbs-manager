import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import TaskNode from "./components/TaskNode";
import TaskPropertiesPanel from "./components/TaskPropertiesPanel";
import Toolbar from "./components/Toolbar";
import VersioniDialog from "./components/VersioniDialog";
import ElencoVersioniDialog from "./components/ElencoVersioniDialog";
import NotaVersioneDialog from "./components/NotaVersioneDialog";
import { useWbsStore } from "./store/wbsStore";
import type { WbsNode } from "./models/WbsTask";
import type { TipoFreccia } from "./models/Progetto";
import { apriProgetto, nuovoProgetto, salvaProgetto } from "./services/comandiProgetto";
import { esportaVistaJpg } from "./services/esportaImmagine";
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

// Fuori dal componente per evitare re-render inutili
const nodeTypes = { task: TaskNode };
const GanttView = lazy(() => import("./components/GanttView"));
const ResourceView = lazy(() => import("./components/ResourceView"));
const PrintReport = lazy(() => import("./components/PrintReport"));

type RichiestaNotaVersione = {
  titolo: string;
  notaIniziale: string;
  azione: "baseline" | "nuova" | "ripristino";
  idVersione?: string;
};

export default function App() {
  const [visualizzazione, setVisualizzazione] = useState<"grafo" | "gantt" | "risorse">("grafo");
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
        if (node.style?.opacity === opacita) return node;
        return {
          ...node,
          style: { ...node.style, opacity: opacita }
        };
      }),
    [nodes, ricerca, filtro, responsabile]
  );

  return (
    <div className="app">
      <Toolbar
        visualizzazione={visualizzazione}
        onVisualizzazioneChange={setVisualizzazione}
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
            <>
              {/* key = id progetto: quando apri un altro progetto la vista si ricentra */}
              <ReactFlowProvider key={progettoId}>
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
                  onNodeClick={(_, n) => selectNode(n.id)}
                  onPaneClick={() => {
                    selectNode(null);
                    useWbsStore.setState({ erroreCollegamento: null });
                  }}
                  deleteKeyCode={["Delete", "Backspace"]}
                  minZoom={0.2}
                  fitView
                  fitViewOptions={{ maxZoom: 1 }}
                >
                  <Background gap={16} />
                  <Controls />
                  <MiniMap<WbsNode>
                    pannable
                    zoomable
                    nodeColor={(n) => coloreAvanzamento(n.data.percentuale)}
                  />
                </ReactFlow>
              </ReactFlowProvider>

              {nodes.length === 0 && (
                <div className="empty-hint">
                  Premi <strong>+ Nuovo task</strong> per iniziare.
                  <br />
                  Trascina da un punto di ancoraggio su un lato del task a un punto su un altro task
                  per collegarli.
                </div>
              )}
              {erroreCollegamento && (
                <p className="connection-error" role="alert">
                  {erroreCollegamento}
                </p>
              )}
            </>
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

        {visualizzazione !== "risorse" && <TaskPropertiesPanel />}
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
    </div>
  );
}
