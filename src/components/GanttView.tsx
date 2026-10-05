import { useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  eachDayOfInterval,
  eachMonthOfInterval,
  format,
  getDaysInMonth,
  isBefore,
  isWeekend,
  startOfMonth,
  startOfWeek
} from "date-fns";
import type { WbsNode } from "../models/WbsTask";
import { useWbsStore } from "../store/wbsStore";
import { formatIt, toDate } from "../utils/dateUtils";
import { coloreAvanzamento } from "../utils/avanzamentoUtils";
import { ICONA_TIPO_TASK } from "../utils/tipiTaskUtils";
import { corrispondeFiltroTask, type FiltroTask } from "../utils/filtroTask";
import { coloreDaNome, iniziali } from "../utils/personUtils";

type Scala = "giorni" | "settimane" | "mesi";
type Colonna = { chiave: string; etichetta: string; data: Date; larghezza: number };

const LARGHEZZA_GIORNO = 34;
const LARGHEZZA_SETTIMANA = 90;
const LARGHEZZA_MESE = 76;

type GanttViewProps = {
  ricerca: string;
  filtro: FiltroTask;
  responsabile: string;
};

export default function GanttView({ ricerca, filtro, responsabile }: GanttViewProps) {
  const nodes = useWbsStore((s) => s.nodes);
  const selectedId = useWbsStore((s) => s.selectedId);
  const selectNode = useWbsStore((s) => s.selectNode);
  const updateTask = useWbsStore((s) => s.updateTask);
  const [scala, setScala] = useState<Scala>("giorni");
  const [zoom, setZoom] = useState(1);
  const [editorId, setEditorId] = useState<string | null>(null);

  const datiTimeline = useMemo(() => {
    const intervalli = nodes.flatMap((node) => {
      const inizio = toDate(node.data.dataInizio);
      const fine = toDate(node.data.dataFine);
      return inizio && fine && !isBefore(fine, inizio) ? [{ inizio, fine }] : [];
    });
    if (intervalli.length === 0) return null;

    const inizio = new Date(Math.min(...intervalli.map((intervallo) => intervallo.inizio.getTime())));
    const fine = new Date(Math.max(...intervalli.map((intervallo) => intervallo.fine.getTime())));
    let colonne: Colonna[];
    let origine: Date;
    let larghezzaColonna: number;

    if (scala === "giorni") {
      origine = inizio;
      larghezzaColonna = LARGHEZZA_GIORNO * zoom;
      colonne = eachDayOfInterval({ start: inizio, end: fine }).map((giorno) => ({
        chiave: giorno.toISOString(),
        etichetta: format(giorno, "d"),
        data: giorno,
        larghezza: LARGHEZZA_GIORNO
      }));
    } else if (scala === "settimane") {
      origine = startOfWeek(inizio, { weekStartsOn: 1 });
      larghezzaColonna = LARGHEZZA_SETTIMANA * zoom;
      colonne = [];
      for (let settimana = origine; !isBefore(fine, settimana); settimana = addDays(settimana, 7)) {
        colonne.push({
          chiave: settimana.toISOString(),
          etichetta: format(settimana, "dd/MM"),
          data: settimana,
          larghezza: LARGHEZZA_SETTIMANA
        });
      }
    } else {
      origine = startOfMonth(inizio);
      larghezzaColonna = LARGHEZZA_MESE * zoom;
      colonne = eachMonthOfInterval({ start: inizio, end: fine }).map((mese) => ({
        chiave: mese.toISOString(),
        etichetta: format(mese, "MMM yy"),
        data: mese,
        larghezza: LARGHEZZA_MESE
      }));
    }

    const posizioneData = (data: Date) => {
      if (scala === "giorni") return differenceInCalendarDays(data, origine) * larghezzaColonna;
      if (scala === "settimane") {
        return (differenceInCalendarDays(data, origine) / 7) * larghezzaColonna;
      }
      const inizioMese = startOfMonth(data);
      const mese = differenceInCalendarMonths(inizioMese, origine);
      const frazione = (data.getDate() - 1) / getDaysInMonth(data);
      return (mese + frazione) * larghezzaColonna;
    };

    return {
      colonne,
      origine,
      larghezzaTimeline: colonne.length * larghezzaColonna,
      posizioneData
    };
  }, [nodes, scala, zoom]);

  const nodiFiltrati = nodes.filter((node) =>
    corrispondeFiltroTask(node, ricerca, filtro, responsabile)
  );
  const oggi = new Date();

  const modificaZoom = (fattore: number) => {
    setZoom((valore) => Math.min(3, Math.max(0.25, valore * fattore)));
  };

  const adattaVista = (event: React.MouseEvent<HTMLButtonElement>) => {
    const larghezzaDisponibile = event.currentTarget.closest(".canvas")?.clientWidth ?? 0;
    const larghezzaIntestazione = 260;
    if (!datiTimeline || larghezzaDisponibile <= larghezzaIntestazione) return;
    setZoom((valore) =>
      Math.min(
        3,
        Math.max(
          0.25,
          valore * ((larghezzaDisponibile - larghezzaIntestazione - 24) / datiTimeline.larghezzaTimeline)
        )
      )
    );
  };

  if (nodes.length === 0) {
    return <div className="gantt-empty">Aggiungi un task per visualizzare il diagramma Gantt.</div>;
  }

  return (
    <div className="gantt">
      <div className="gantt__controls" aria-label="Scala temporale Gantt">
        <button className="btn gantt__zoom-button" type="button" aria-label="Zoom avanti" title="Zoom avanti" onClick={() => modificaZoom(1.25)}>
          +
        </button>
        <button className="btn gantt__zoom-button" type="button" aria-label="Zoom indietro" title="Zoom indietro" onClick={() => modificaZoom(0.8)}>
          −
        </button>
        <button
          className="btn"
          type="button"
          title="Adatta la timeline alla vista"
          disabled={!datiTimeline}
          onClick={adattaVista}
        >
          Fit view
        </button>
        <span>Scala:</span>
        {(["giorni", "settimane", "mesi"] as const).map((opzione) => (
          <button
            className={`btn${scala === opzione ? " btn--active" : ""}`}
            key={opzione}
            aria-pressed={scala === opzione}
            onClick={() => setScala(opzione)}
          >
            {opzione[0].toLocaleUpperCase() + opzione.slice(1)}
          </button>
        ))}
        <span className="gantt__count" aria-live="polite">
          {nodiFiltrati.length} task
        </span>
      </div>

      {nodiFiltrati.length === 0 ? (
        <div className="gantt-empty">Nessun task corrisponde ai filtri selezionati.</div>
      ) : (
        <div className="gantt-view">
          <div className="gantt-header">
            <div className="gantt-header__name">Task</div>
            {datiTimeline ? (
              <div className="gantt-header__timeline" style={{ width: datiTimeline.larghezzaTimeline }}>
                <div className="gantt-days">
                  {datiTimeline.colonne.map((colonna) => (
                    <div
                      className={`gantt-day${scala === "giorni" && isWeekend(colonna.data) ? " is-weekend" : ""}`}
                      key={colonna.chiave}
                      style={{ width: colonna.larghezza }}
                      title={format(colonna.data, "dd/MM/yyyy")}
                    >
                      {colonna.etichetta}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="gantt-header__no-dates">Date non impostate</div>
            )}
          </div>

          <div className="gantt-rows">
            {nodiFiltrati.map((node) => (
              <GanttRow
                key={node.id}
                node={node}
                selected={selectedId === node.id}
                editorOpen={editorId === node.id}
                onSelect={() => selectNode(node.id)}
                onToggleEditor={() => setEditorId((id) => id === node.id ? null : node.id)}
                onUpdateTask={updateTask}
                colonne={datiTimeline?.colonne ?? []}
                larghezzaTimeline={datiTimeline?.larghezzaTimeline ?? 0}
                posizioneData={datiTimeline?.posizioneData}
                inizioTimeline={datiTimeline?.origine ?? null}
                scala={scala}
                oggi={oggi}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type GanttRowProps = {
  node: WbsNode;
  selected: boolean;
  editorOpen: boolean;
  onSelect: () => void;
  onToggleEditor: () => void;
  onUpdateTask: (id: string, patch: Partial<WbsNode["data"]>) => void;
  colonne: Colonna[];
  inizioTimeline: Date | null;
  larghezzaTimeline: number;
  posizioneData?: (data: Date) => number;
  scala: Scala;
  oggi: Date;
};

function GanttRow({
  node,
  selected,
  editorOpen,
  onSelect,
  onToggleEditor,
  onUpdateTask,
  colonne,
  inizioTimeline,
  larghezzaTimeline,
  posizioneData,
  scala,
  oggi
}: GanttRowProps) {
  const dragRef = useRef<{
    mode: "move" | "resize-start" | "resize-end";
    startX: number;
    startInizio: Date;
    startFine: Date;
  } | null>(null);
  const inizio = toDate(node.data.dataInizio);
  const fine = toDate(node.data.dataFine);
  const valido = Boolean(inizio && fine && !isBefore(fine, inizio) && inizioTimeline);
  const posizioneInizio = valido && inizio && posizioneData ? posizioneData(inizio) : 0;
  const posizioneFine =
    valido && fine && posizioneData ? posizioneData(addDays(fine, 1)) : posizioneInizio;
  const posizioneOggi =
    inizioTimeline && posizioneData && !isBefore(oggi, inizioTimeline)
      ? posizioneData(oggi)
      : null;

  const passoPixel =
    scala === "giorni" ? LARGHEZZA_GIORNO : scala === "settimane" ? LARGHEZZA_SETTIMANA / 7 : LARGHEZZA_MESE / 30;

  const aggiornaDateDrag = (event: React.PointerEvent<HTMLElement>, mode: "move" | "resize-start" | "resize-end") => {
    if (!inizio || !fine || !valido) return;
    if (!dragRef.current || dragRef.current.mode !== mode) {
      dragRef.current = {
        mode,
        startX: event.clientX,
        startInizio: new Date(inizio),
        startFine: new Date(fine)
      };
    }
    const deltaPx = event.clientX - dragRef.current.startX;
    const deltaGiorni = Math.round(deltaPx / passoPixel);

    if (mode === "move") {
      const durata = differenceInCalendarDays(dragRef.current.startFine, dragRef.current.startInizio);
      const nuovoInizio = addDays(dragRef.current.startInizio, deltaGiorni);
      const nuovoFine = addDays(nuovoInizio, durata);
      onUpdateTask(node.id, {
        dataInizio: format(nuovoInizio, "yyyy-MM-dd"),
        dataFine: format(nuovoFine, "yyyy-MM-dd")
      });
      return;
    }

    if (mode === "resize-start") {
      const nuovoInizio = addDays(dragRef.current.startInizio, deltaGiorni);
      const nuovoFine = new Date(dragRef.current.startFine);
      if (nuovoInizio <= nuovoFine) {
        onUpdateTask(node.id, {
          dataInizio: format(nuovoInizio, "yyyy-MM-dd"),
          dataFine: format(nuovoFine, "yyyy-MM-dd")
        });
      }
      return;
    }

    const nuovoFine = addDays(dragRef.current.startFine, deltaGiorni);
    const nuovoInizio = new Date(dragRef.current.startInizio);
    if (nuovoFine >= nuovoInizio) {
      onUpdateTask(node.id, {
        dataInizio: format(nuovoInizio, "yyyy-MM-dd"),
        dataFine: format(nuovoFine, "yyyy-MM-dd")
      });
    }
  };

  const onPointerDownBar = (event: React.PointerEvent<HTMLElement>) => {
    if (!inizio || !fine || !valido) return;
    event.stopPropagation();
    dragRef.current = {
      mode: "move",
      startX: event.clientX,
      startInizio: new Date(inizio),
      startFine: new Date(fine)
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMoveBar = (event: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current?.mode === "move") {
      aggiornaDateDrag(event, "move");
    }
  };

  const onPointerDownResize = (event: React.PointerEvent<HTMLElement>, mode: "resize-start" | "resize-end") => {
    if (!inizio || !fine || !valido) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode,
      startX: event.clientX,
      startInizio: new Date(inizio),
      startFine: new Date(fine)
    };
  };

  const onPointerMoveResize = (event: React.PointerEvent<HTMLElement>, mode: "resize-start" | "resize-end") => {
    if (dragRef.current?.mode === mode) {
      aggiornaDateDrag(event, mode);
    }
  };

  const clearDrag = () => {
    dragRef.current = null;
  };

  return (
    <div
      className={`gantt-row${selected ? " is-selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="gantt-row__name" title={node.data.titolo}>
        <span aria-hidden="true">{ICONA_TIPO_TASK[node.data.tipoTask]}</span>
        <span className="ellipsis">{node.data.titolo}</span>
        {node.data.responsabile.trim() && (
          <span
            className="avatar gantt-row__avatar"
            title={node.data.responsabile}
            aria-label={`Responsabile: ${node.data.responsabile}`}
            style={{ background: coloreDaNome(node.data.responsabile) }}
          >
            {iniziali(node.data.responsabile)}
          </span>
        )}
        <button
          className="gantt-row__edit-button"
          type="button"
          aria-label={`Modifica date e avanzamento di ${node.data.titolo}`}
          title="Modifica date e avanzamento"
          aria-expanded={editorOpen}
          onClick={(event) => {
            event.stopPropagation();
            onToggleEditor();
          }}
        >
          ✎
        </button>
      </div>
      {inizioTimeline ? (
        <div className="gantt-row__timeline" style={{ width: larghezzaTimeline }}>
          <div className="gantt-grid">
            {colonne.map((colonna) => (
              <div
                className={`gantt-grid__day${scala === "giorni" && isWeekend(colonna.data) ? " is-weekend" : ""}`}
                key={colonna.chiave}
                style={{ width: colonna.larghezza }}
              />
            ))}
          </div>
          {posizioneOggi !== null && posizioneOggi <= larghezzaTimeline && (
            <div
              className="gantt-today"
              style={{ left: posizioneOggi }}
              aria-label="Oggi"
              title={`Oggi, ${format(oggi, "dd/MM/yyyy")}`}
            />
          )}
          {valido && inizio && fine && (
            <div
              className="gantt-bar"
              style={{
                left: posizioneInizio,
                width: Math.max(4, posizioneFine - posizioneInizio)
              }}
              title={`${node.data.titolo}: ${formatIt(node.data.dataInizio)} – ${formatIt(node.data.dataFine)} (${node.data.percentuale}%)`}
              onPointerDown={onPointerDownBar}
              onPointerMove={onPointerMoveBar}
              onPointerUp={clearDrag}
              onPointerLeave={clearDrag}
            >
              <div
                className="gantt-bar__progress"
                style={{
                  width: `${node.data.percentuale}%`,
                  background: coloreAvanzamento(node.data.percentuale)
                }}
              />
              <button
                type="button"
                className="gantt-bar__handle gantt-bar__handle--start"
                aria-label={`Ridimensiona inizio task ${node.data.titolo}`}
                onPointerDown={(event) => onPointerDownResize(event, "resize-start")}
                onPointerMove={(event) => onPointerMoveResize(event, "resize-start")}
                onPointerUp={clearDrag}
                onPointerLeave={clearDrag}
              />
              <button
                type="button"
                className="gantt-bar__handle gantt-bar__handle--end"
                aria-label={`Ridimensiona fine task ${node.data.titolo}`}
                onPointerDown={(event) => onPointerDownResize(event, "resize-end")}
                onPointerMove={(event) => onPointerMoveResize(event, "resize-end")}
                onPointerUp={clearDrag}
                onPointerLeave={clearDrag}
              />
            </div>
          )}

        </div>
      ) : (
        <div className="gantt-row__no-dates">—</div>
      )}
      {editorOpen && (
        <div className="gantt-row__editor" onClick={(event) => event.stopPropagation()}>
          <button
            className="gantt-row__editor-close"
            type="button"
            aria-label="Chiudi modifica"
            title="Chiudi"
            onClick={onToggleEditor}
          >
            ×
          </button>
          <label className="gantt-row__field">
            <span>Da</span>
            <input
              type="date"
              value={node.data.dataInizio ?? ""}
              max={node.data.dataFine ?? undefined}
              onChange={(event) => onUpdateTask(node.id, { dataInizio: event.target.value || null })}
            />
          </label>
          <label className="gantt-row__field">
            <span>A</span>
            <input
              type="date"
              value={node.data.dataFine ?? ""}
              min={node.data.dataInizio ?? undefined}
              onChange={(event) => onUpdateTask(node.id, { dataFine: event.target.value || null })}
            />
          </label>
          <label className="gantt-row__field gantt-row__field--progress">
            <span>Av.</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={node.data.percentuale}
              onChange={(event) =>
                onUpdateTask(node.id, {
                  percentuale: Math.min(100, Math.max(0, Number(event.target.value) || 0))
                })
              }
            />
            <strong>{node.data.percentuale}%</strong>
          </label>
        </div>
      )}
    </div>
  );
}
