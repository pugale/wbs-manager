import { useMemo } from "react";
import { useWbsStore } from "../store/wbsStore";
import { TIPI_TASK } from "../models/WbsTask";
import { durataGiorniLavorativi, validaDate } from "../utils/dateUtils";
import { elencoResponsabili } from "../utils/personUtils";
import { ICONA_TIPO_TASK } from "../utils/tipiTaskUtils";
import { taskDiscendentiPrincipali } from "../utils/aggregazioneTask";
import DatePicker from "./DatePicker";

export default function TaskPropertiesPanel() {
  const nodes = useWbsStore((s) => s.nodes);
  const edges = useWbsStore((s) => s.edges);
  const selectedId = useWbsStore((s) => s.selectedId);
  const updateTask = useWbsStore((s) => s.updateTask);
  const removeTask = useWbsStore((s) => s.removeTask);

  // Gli hook vanno chiamati prima di qualsiasi "return"
  const responsabili = useMemo(
    () => elencoResponsabili(nodes.map((n) => n.data.responsabile)),
    [nodes]
  );

  const node = nodes.find((n) => n.id === selectedId);
  if (!node) {
    return (
      <aside className="panel">
        <p className="muted">Seleziona un task per modificarlo.</p>
      </aside>
    );
  }

  const { id, data } = node;
  const errore = validaDate(data.dataInizio, data.dataFine);
  const durata = durataGiorniLavorativi(data.dataInizio, data.dataFine);
  const taskFoglia =
    data.tipoTask === "Principale"
      ? taskDiscendentiPrincipali(id, nodes, edges).filter((n) => n.data.tipoTask !== "Principale")
      : [];

  return (
    <aside className="panel">
      <h3>Proprietà task</h3>

      <label className="field">
        <span>
          <span aria-hidden="true">{ICONA_TIPO_TASK[data.tipoTask]}</span> Tipo task
        </span>
        <select
          value={data.tipoTask}
          onChange={(e) => {
            const tipoTask = TIPI_TASK.find((tipo) => tipo === e.target.value);
            if (tipoTask) updateTask(id, { tipoTask });
          }}
        >
          {TIPI_TASK.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ICONA_TIPO_TASK[tipo]} {tipo}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        Titolo
        <input value={data.titolo} onChange={(e) => updateTask(id, { titolo: e.target.value })} />
      </label>

      <label className="field">
        Descrizione
        <textarea
          rows={3}
          value={data.descrizione}
          onChange={(e) => updateTask(id, { descrizione: e.target.value })}
        />
      </label>

      <label className="field">
        Responsabile
        <input
          list="elenco-responsabili"
          placeholder="Nome e cognome"
          value={data.responsabile ?? ""}
          onChange={(e) => updateTask(id, { responsabile: e.target.value })}
          onBlur={(e) => updateTask(id, { responsabile: e.target.value.trim() })}
        />
        <datalist id="elenco-responsabili">
          {responsabili.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </label>

      <div className="field">
        Data inizio
        <DatePicker
          label="Data inizio"
          value={data.dataInizio ?? ""}
          onChange={(dataInizio) => updateTask(id, { dataInizio })}
        />
      </div>

      <div className="field">
        Data fine
        <DatePicker
          label="Data fine"
          value={data.dataFine ?? ""}
          min={data.dataInizio}
          onChange={(dataFine) => updateTask(id, { dataFine })}
        />
      </div>

      {errore && <p className="error">{errore}</p>}
      {durata !== null && <p className="muted">Durata: {durata} giorni lavorativi</p>}

      <label className="field">
        % avanzamento
        <input
          type="number"
          min={0}
          max={100}
          value={data.percentuale}
          disabled={data.tipoTask === "Principale"}
          onChange={(e) =>
            updateTask(id, {
              percentuale: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0)))
            })
          }
        />
      </label>
      {data.tipoTask === "Principale" && (
        <p className="muted">
          Media di {taskFoglia.length} task discendenti fino alle foglie.
        </p>
      )}

      <button
        className="btn btn--danger"
        onClick={() => {
          if (window.confirm(`Eliminare il task "${data.titolo}" e le sue frecce?`)) removeTask(id);
        }}
      >
        Elimina task
      </button>
    </aside>
  );
}
