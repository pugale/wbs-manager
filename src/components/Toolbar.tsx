import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWbsStore } from "../store/wbsStore";
import { apriProgetto, nuovoProgetto, salvaProgetto } from "../services/comandiProgetto";
import type { FiltroTask } from "../utils/filtroTask";
import type { TipoFreccia } from "../models/Progetto";
import { elencoResponsabili } from "../utils/personUtils";
import { serializzaProgetto } from "../services/projectService";

type ToolbarProps = {
  visualizzazione: "grafo" | "gantt" | "risorse";
  onVisualizzazioneChange: (visualizzazione: "grafo" | "gantt" | "risorse") => void;
  tipoFreccia: TipoFreccia;
  onTipoFrecciaChange: (tipo: TipoFreccia) => void;
  onEsportaJpg: () => void;
  onImportaCsv: () => void;
  onEsportaCsv: () => void;
  onGeneraReport: () => void;
  ricerca: string;
  onRicercaChange: (ricerca: string) => void;
  filtro: FiltroTask;
  onFiltroChange: (filtro: FiltroTask) => void;
  responsabile: string;
  onResponsabileChange: (responsabile: string) => void;
  onCreaBaseline: () => void;
  onCreaVersione: () => void;
  onGestisciVersioni: () => void;
  onMostraElencoVersioni: () => void;
};

export default function Toolbar({
  visualizzazione,
  onVisualizzazioneChange,
  tipoFreccia,
  onTipoFrecciaChange,
  onEsportaJpg,
  onImportaCsv,
  onEsportaCsv,
  onGeneraReport,
  ricerca,
  onRicercaChange,
  filtro,
  onFiltroChange,
  responsabile,
  onResponsabileChange,
  onCreaBaseline,
  onCreaVersione,
  onGestisciVersioni,
  onMostraElencoVersioni
}: ToolbarProps) {
  const menusRef = useRef<HTMLElement>(null);
  const scartaNomeProgettoRef = useRef(false);
  const nomeProgetto = useWbsStore((s) => s.nomeProgetto);
  const progettoId = useWbsStore((s) => s.progettoId);
  const [nomeInModifica, setNomeInModifica] = useState(nomeProgetto);
  const percorsoFile = useWbsStore((s) => s.percorsoFile);
  const modificato = useWbsStore((s) => s.modificato);
  const archivio = useWbsStore((s) => s.archivio);
  const nodes = useWbsStore((s) => s.nodes);
  const edges = useWbsStore((s) => s.edges);
  const setNomeProgetto = useWbsStore((s) => s.setNomeProgetto);
  const addTask = useWbsStore((s) => s.addTask);
  const annulla = useWbsStore((s) => s.annulla);
  const ripeti = useWbsStore((s) => s.ripeti);
  const puoAnnullare = useWbsStore((s) => s.puoAnnullare);
  const puoRipetere = useWbsStore((s) => s.puoRipetere);
  const responsabili = useWbsStore(
    useShallow((s) => elencoResponsabili(s.nodes.map((node) => node.data.responsabile)))
  );
  const statoVersione = useMemo(() => {
    if (!archivio) {
      return {
        etichetta: percorsoFile ? "JSON legacy · non versionato" : "Non versionato",
        aggiornato: false,
        dettaglio: "Il progetto non ha ancora una baseline o versioni salvate."
      };
    }

    const versione = archivio.indiceVersioni.find(
      (item) => item.id === archivio.manifest.versioneCorrenteId
    );
    if (!versione) {
      return {
        etichetta: "Baseline non definita",
        aggiornato: false,
        dettaglio: "Salva una baseline dal menu Versioni per iniziare a numerare gli snapshot."
      };
    }

    const contenutoCorrente = serializzaProgetto({
      id: progettoId,
      nome: nomeProgetto,
      tipoFreccia,
      nodes,
      edges
    });
    const coincideConSnapshot = archivio.versioni[versione.id] === contenutoCorrente;
    const etichetta = `Versione di lavoro ${versione.versione}${versione.baseline ? " · Baseline" : ""}`;
    return {
      etichetta: coincideConSnapshot ? etichetta : `Lavoro dopo ${versione.versione}`,
      aggiornato: coincideConSnapshot,
      dettaglio: coincideConSnapshot
        ? `Il progetto corrisponde allo snapshot ${versione.versione}.`
        : `Il progetto contiene modifiche successive allo snapshot ${versione.versione}, non ancora salvate come nuova versione.`
    };
  }, [archivio, edges, nomeProgetto, nodes, percorsoFile, progettoId, tipoFreccia]);

  useEffect(() => setNomeInModifica(nomeProgetto), [nomeProgetto]);

  const confermaNomeProgetto = () => {
    if (nomeInModifica !== nomeProgetto) setNomeProgetto(nomeInModifica);
  };

  const onNomeProgettoKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      scartaNomeProgettoRef.current = true;
      setNomeInModifica(nomeProgetto);
      event.currentTarget.blur();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      confermaNomeProgetto();
    }
  };

  const onNomeProgettoBlur = () => {
    if (scartaNomeProgettoRef.current) {
      scartaNomeProgettoRef.current = false;
      return;
    }
    confermaNomeProgetto();
  };

  useEffect(() => {
    const menuContainer = menusRef.current;
    if (!menuContainer) return;

    const timers = new Map<HTMLDetailsElement, ReturnType<typeof setTimeout>>();
    const annullaTimer = (menu: HTMLDetailsElement) => {
      const timer = timers.get(menu);
      if (timer) clearTimeout(timer);
      timers.delete(menu);
    };
    const avviaTimer = (menu: HTMLDetailsElement) => {
      annullaTimer(menu);
      timers.set(
        menu,
        setTimeout(() => {
          const riepilogo = menu.querySelector("summary");
          const focusOperativoDentro =
            menu.matches(":focus-within") && document.activeElement !== riepilogo;
          if (!menu.matches(":hover") && !focusOperativoDentro) menu.open = false;
          timers.delete(menu);
        }, 3000)
      );
    };
    const onFocusOut = (event: FocusEvent) => {
      const menu = (event.target as HTMLElement).closest<HTMLDetailsElement>(".toolbar__menu");
      if (!menu) return;
      const destinazione = event.relatedTarget;
      if (!(destinazione instanceof Node) || !menu.contains(destinazione)) avviaTimer(menu);
    };
    const onFocusIn = (event: FocusEvent) => {
      const menu = (event.target as HTMLElement).closest<HTMLDetailsElement>(".toolbar__menu");
      if (menu) annullaTimer(menu);
    };
    const onPointerDown = (event: PointerEvent) => {
      const menu = (event.target as HTMLElement).closest<HTMLDetailsElement>(".toolbar__menu");
      if (menu) annullaTimer(menu);
      else {
        menuContainer.querySelectorAll<HTMLDetailsElement>(".toolbar__menu[open]").forEach(avviaTimer);
      }
    };
    const onPointerEnter = (event: PointerEvent) => {
      const menu = (event.target as HTMLElement).closest<HTMLDetailsElement>(".toolbar__menu");
      if (menu) annullaTimer(menu);
    };
    const onPointerLeave = (event: PointerEvent) => {
      const menu = (event.target as HTMLElement).closest<HTMLDetailsElement>(".toolbar__menu");
      if (menu) avviaTimer(menu);
    };
    const onToggle = (event: Event) => {
      const menu = event.target as HTMLDetailsElement;
      if (!menu.open) annullaTimer(menu);
    };

    menuContainer.addEventListener("focusout", onFocusOut);
    menuContainer.addEventListener("focusin", onFocusIn);
    menuContainer.addEventListener("pointerdown", onPointerDown);
    menuContainer.addEventListener("pointerover", onPointerEnter);
    menuContainer.addEventListener("pointerout", onPointerLeave);
    menuContainer.querySelectorAll<HTMLDetailsElement>(".toolbar__menu").forEach((menu) => {
      menu.addEventListener("toggle", onToggle);
    });

    return () => {
      menuContainer.removeEventListener("focusout", onFocusOut);
      menuContainer.removeEventListener("focusin", onFocusIn);
      menuContainer.removeEventListener("pointerdown", onPointerDown);
      menuContainer.removeEventListener("pointerover", onPointerEnter);
      menuContainer.removeEventListener("pointerout", onPointerLeave);
      menuContainer.querySelectorAll<HTMLDetailsElement>(".toolbar__menu").forEach((menu) => {
        menu.removeEventListener("toggle", onToggle);
      });
      timers.forEach(clearTimeout);
    };
  }, []);

  const chiudiMenu = (event: MouseEvent<HTMLElement>) => {
    event.currentTarget.closest("details")?.removeAttribute("open");
  };

  return (
    <header ref={menusRef} className="toolbar">
      <nav className="toolbar__menus" aria-label="Menu principali">
        <details className="toolbar__menu">
          <summary>Progetto</summary>
          <div className="toolbar__menu-panel">
            <button className="toolbar__menu-action" onClick={(event) => { chiudiMenu(event); void nuovoProgetto(); }}>
              Nuovo progetto <kbd>Ctrl+N</kbd>
            </button>
            <button className="toolbar__menu-action" onClick={(event) => { chiudiMenu(event); void apriProgetto(); }}>
              Apri progetto <kbd>Ctrl+O</kbd>
            </button>
            <button className="toolbar__menu-action" onClick={(event) => { chiudiMenu(event); void salvaProgetto(); }}>
              Salva progetto<kbd>Ctrl+S</kbd>
            </button>
            <button className="toolbar__menu-action" onClick={(event) => { chiudiMenu(event); void salvaProgetto(true); }}>
              Salva con nome <kbd>Ctrl+Shift+S</kbd>
            </button>
            <div className="toolbar__menu-separator" />
            <button className="toolbar__menu-action" onClick={(event) => { chiudiMenu(event); onImportaCsv(); }}>
              Importa CSV
            </button>
            <button className="toolbar__menu-action" onClick={(event) => { chiudiMenu(event); onEsportaCsv(); }}>
              Esporta CSV
            </button>
          </div>
        </details>

        <details className="toolbar__menu">
          <summary>Versioni</summary>
          <div className="toolbar__menu-panel">
            <button
              className="toolbar__menu-action"
              onClick={(event) => { chiudiMenu(event); onCreaBaseline(); }}
              disabled={Boolean(archivio?.manifest.baselineId)}
            >
              Imposta baseline 1.0
            </button>
            <button
              className="toolbar__menu-action"
              onClick={(event) => { chiudiMenu(event); onCreaVersione(); }}
              disabled={!archivio?.manifest.baselineId}
            >
              Crea nuova versione
            </button>
            <button
              className="toolbar__menu-action"
              onClick={(event) => { chiudiMenu(event); onMostraElencoVersioni(); }}
              disabled={!archivio?.indiceVersioni.length}
            >
              Elenco versioni
            </button>
            <button
              className="toolbar__menu-action"
              onClick={(event) => { chiudiMenu(event); onGestisciVersioni(); }}
              disabled={!archivio?.indiceVersioni.length}
            >
              Confronta o ripristina…
            </button>
            <div className="toolbar__menu-separator" />
            <span className="toolbar__menu-hint">
              {archivio?.manifest.versioneCorrenteId
                ? `Ultima versione: ${archivio.indiceVersioni.find((item) => item.id === archivio.manifest.versioneCorrenteId)?.versione ?? "—"}`
                : "Nessuna versione salvata"}
            </span>
          </div>
        </details>

        <details className="toolbar__menu">
          <summary>Modifica</summary>
          <div className="toolbar__menu-panel">
            <button
              className="toolbar__menu-action"
              onClick={(event) => { chiudiMenu(event); annulla(); }}
              disabled={!puoAnnullare}
            >
              Annulla <kbd>Ctrl+Z</kbd>
            </button>
            <button
              className="toolbar__menu-action"
              onClick={(event) => { chiudiMenu(event); ripeti(); }}
              disabled={!puoRipetere}
            >
              Ripeti <kbd>Ctrl+Y</kbd>
            </button>
          </div>
        </details>

        <details className="toolbar__menu">
          <summary>Visualizza</summary>
          <div className="toolbar__menu-panel">
            {([
              ["grafo", "Grafo"],
              ["gantt", "Gantt"],
              ["risorse", "Risorse"]
            ] as const).map(([valore, etichetta]) => (
              <button
                className={`toolbar__menu-action${visualizzazione === valore ? " is-active" : ""}`}
                key={valore}
                aria-pressed={visualizzazione === valore}
                onClick={(event) => { chiudiMenu(event); onVisualizzazioneChange(valore); }}
              >
                {etichetta}
              </button>
            ))}
          </div>
        </details>

        {visualizzazione === "grafo" && (
          <label className="toolbar__edge-style">
            Frecce
            <select
              aria-label="Tipologia delle frecce"
              value={tipoFreccia}
              onChange={(event) => {
                const tipo = event.target.value;
                if (tipo === "bezier" || tipo === "straight" || tipo === "step") {
                  onTipoFrecciaChange(tipo);
                }
              }}
            >
              <option value="bezier">Curve</option>
              <option value="straight">Rette</option>
              <option value="step">Angoli</option>
            </select>
          </label>
        )}

      </nav>

      <div className="toolbar__project">
        <button className="btn" onClick={() => void salvaProgetto()} title="Salva (Ctrl+S)">
          Salva
        </button>
        <input
          className="toolbar__name"
          value={nomeInModifica}
          onChange={(event) => setNomeInModifica(event.target.value)}
          onBlur={onNomeProgettoBlur}
          onKeyDown={onNomeProgettoKeyDown}
          aria-label="Nome progetto"
        />
        <span className="muted ellipsis" title={percorsoFile ?? ""}>
          {modificato ? "● Modifiche non salvate" : percorsoFile ? "Salvato" : "Mai salvato"}
        </span>
        <span
          className={`toolbar__version-badge${statoVersione.aggiornato ? " toolbar__version-badge--current" : ""}`}
          title={statoVersione.dettaglio}
          aria-label={`Stato versione: ${statoVersione.dettaglio}`}
        >
          {statoVersione.etichetta}
        </span>
      </div>

      <div className="toolbar__actions">
        <button
          className="btn btn--primary toolbar__new-task"
          onClick={addTask}
          aria-label="Aggiungi un nuovo task"
        >
          + Nuovo task
        </button>
        <details className="toolbar__menu">
          <summary className={ricerca || filtro !== "tutti" || responsabile ? "has-filters" : ""}>
            Filtri
          </summary>
          <div className="toolbar__menu-panel toolbar__menu-panel--filters">
            <label className="toolbar__menu-field">
              Cerca task
              <input
                type="search"
                value={ricerca}
                onChange={(event) => onRicercaChange(event.target.value)}
                placeholder="Titolo, descrizione..."
                aria-label="Cerca per titolo, responsabile o descrizione"
              />
            </label>
            <label className="toolbar__menu-field">
              Avanzamento
              <select
                value={filtro}
                onChange={(event) => onFiltroChange(event.target.value as FiltroTask)}
                aria-label="Filtra task per avanzamento"
              >
                <option value="tutti">Tutti gli stati</option>
                <option value="non-iniziati">Non iniziati</option>
                <option value="in-corso">In corso</option>
                <option value="completati">Completati</option>
                <option value="in-ritardo">In ritardo</option>
              </select>
            </label>
            <label className="toolbar__menu-field">
              Responsabile
              <select
                value={responsabile}
                onChange={(event) => onResponsabileChange(event.target.value)}
                aria-label="Filtra per responsabile"
              >
                <option value="">Tutti i responsabili</option>
                {responsabili.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
        <details className="toolbar__menu">
          <summary>Report</summary>
          <div className="toolbar__menu-panel">
            <button
              className="toolbar__menu-action toolbar__menu-action--primary"
              onClick={(event) => { chiudiMenu(event); onGeneraReport(); }}
            >
              Genera report PDF
            </button>
            <button
              className="toolbar__menu-action"
              onClick={(event) => { chiudiMenu(event); onEsportaJpg(); }}
            >
              Esporta vista JPG
            </button>
          </div>
        </details>
        <details className="toolbar__menu toolbar__menu--help">
          <summary>Aiuto</summary>
          <div className="toolbar__menu-panel">
            <button
              className="toolbar__menu-action"
              onClick={(event) => {
                chiudiMenu(event);
                if (window.electronAPI) {
                  void window.electronAPI.apriManuale().catch((errore: unknown) => {
                    const dettaglio = errore instanceof Error ? errore.message : String(errore);
                    window.alert(`Impossibile aprire il manuale operativo.\n\n${dettaglio}`);
                  });
                } else {
                  window.open("./manuale.html", "_blank", "noopener,noreferrer");
                }
              }}
            >
              Manuale operativo
            </button>
            <div className="toolbar__menu-separator" />
            <button
              className="toolbar__menu-action toolbar__menu-action--contact"
              onClick={(event) => {
                chiudiMenu(event);
                if (window.electronAPI) {
                  void window.electronAPI.apriEmailAutore().catch((errore: unknown) => {
                    const dettaglio = errore instanceof Error ? errore.message : String(errore);
                    window.alert(`Impossibile aprire il client di posta.\n\n${dettaglio}`);
                  });
                } else {
                  window.location.href = "mailto:alessandro.puglisi@eng.it";
                }
              }}
            >
              <span>Alessandro Puglisi</span>
              <small>alessandro.puglisi@eng.it</small>
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}
