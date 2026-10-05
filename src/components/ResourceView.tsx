import { format } from "date-fns";
import type { WbsNode } from "../models/WbsTask";
import { durataGiorniLavorativi, formatIt } from "../utils/dateUtils";
import { calcolaCaricoRisorse } from "../utils/caricoRisorse";
import { corrispondeFiltroTask, type FiltroTask } from "../utils/filtroTask";

type ResourceViewProps = {
  nodes: WbsNode[];
  ricerca: string;
  filtro: FiltroTask;
  responsabile: string;
};

export default function ResourceView({
  nodes,
  ricerca,
  filtro,
  responsabile
}: ResourceViewProps) {
  const nodiFiltrati = nodes.filter((node) =>
    corrispondeFiltroTask(node, ricerca, filtro, responsabile)
  );
  const carichi = calcolaCaricoRisorse(nodiFiltrati);

  if (carichi.length === 0) {
    return (
      <section className="resource-view">
        <h2>Carico risorse</h2>
        <p className="muted">Nessun task assegnato corrisponde ai filtri selezionati.</p>
      </section>
    );
  }

  return (
    <section className="resource-view">
      <header className="resource-view__header">
        <div>
          <h2>Carico risorse</h2>
          <p>Task e sovrapposizioni di calendario per responsabile.</p>
        </div>
        <span className="muted">{nodiFiltrati.length} task considerati</span>
      </header>

      <div className="resource-list">
        {carichi.map((carico) => (
          <article className="resource-card" key={carico.nome}>
            <header className="resource-card__header">
              <h3>{carico.nome}</h3>
              <div className="resource-card__stats">
                <span>{carico.task.length} task</span>
                <span>{carico.giorniLavorativi} giorni lavorativi pianificati</span>
                <span>
                  Picco: {carico.piccoSimultanei} task simultanei
                </span>
                <span className={carico.sovrapposizioni.length ? "resource-card__warning" : ""}>
                  {carico.sovrapposizioni.length}{" "}
                  {carico.sovrapposizioni.length === 1 ? "sovrapposizione" : "sovrapposizioni"}
                </span>
              </div>
            </header>

            <div className="resource-card__table-wrap">
              <table className="resource-table">
                <thead>
                  <tr>
                    <th scope="col">Task</th>
                    <th scope="col">Inizio</th>
                    <th scope="col">Fine</th>
                    <th scope="col">Giorni lavorativi</th>
                    <th scope="col">Avanzamento</th>
                  </tr>
                </thead>
                <tbody>
                  {carico.task.map((node) => (
                    <tr key={node.id}>
                      <th scope="row">{node.data.titolo}</th>
                      <td>{formatIt(node.data.dataInizio)}</td>
                      <td>{formatIt(node.data.dataFine)}</td>
                      <td>
                        {durataGiorniLavorativi(node.data.dataInizio, node.data.dataFine) ?? "—"}
                      </td>
                      <td>{node.data.percentuale}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {carico.sovrapposizioni.length > 0 && (
              <details className="resource-overlaps">
                <summary>
                  Mostra {carico.sovrapposizioni.length} coppie di task con date sovrapposte
                </summary>
                <ul>
                  {carico.sovrapposizioni.map(({ primo, secondo, inizio, fine }) => (
                    <li key={`${primo.id}-${secondo.id}`}>
                      <strong>{primo.data.titolo}</strong> e <strong>{secondo.data.titolo}</strong>
                      {" — "}
                      {format(inizio, "dd/MM/yyyy")}–{format(fine, "dd/MM/yyyy")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
      </div>
      <p className="resource-view__note">
        Le sovrapposizioni indicano task assegnati allo stesso responsabile con date in comune;
        non rappresentano automaticamente un sovraccarico, perché non è definita una capacità
        giornaliera per risorsa.
      </p>
    </section>
  );
}
