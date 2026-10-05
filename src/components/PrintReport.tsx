import { useEffect, useRef } from "react";
import type { Edge } from "@xyflow/react";
import { isAfter, isBefore } from "date-fns";
import type { WbsNode } from "../models/WbsTask";
import { durataGiorniLavorativi, formatIt, isInRitardo } from "../utils/dateUtils";
import { calcolaCaricoRisorse } from "../utils/caricoRisorse";
import { calcolaAvanzamentoMedio } from "../utils/reportUtils";
import {
  calcolaProgressoNelPeriodo,
  calcolaTimelineReport,
  intervalloGanttTask
} from "../utils/ganttReportUtils";
import { coloreAvanzamento } from "../utils/avanzamentoUtils";

type PrintReportProps = {
  nomeProgetto: string;
  nodes: WbsNode[];
  edges: Edge[];
  onReady: () => void;
};

export default function PrintReport({ nomeProgetto, nodes, edges, onReady }: PrintReportProps) {
  const pronto = useRef(false);
  const carichi = calcolaCaricoRisorse(nodes);
  const taskInRitardo = nodes.filter((node) => isInRitardo(node.data)).length;
  const completati = nodes.filter((node) => node.data.percentuale === 100).length;
  const avanzamentoMedio = calcolaAvanzamentoMedio(nodes);
  const timeline = calcolaTimelineReport(nodes);

  useEffect(() => {
    if (pronto.current) return;
    pronto.current = true;
    onReady();
  }, [onReady]);

  return (
    <article className="print-report" aria-hidden="true">
      <h1>{nomeProgetto}</h1>
      <p>Report WBS — generato il {new Intl.DateTimeFormat("it-IT").format(new Date())}</p>
      <section>
        <h2>Riepilogo</h2>
        <p>
          Task: {nodes.length} · Completati: {completati} · In ritardo: {taskInRitardo} ·
          Responsabili: {carichi.length} · Dipendenze: {edges.length} · Avanzamento medio:{" "}
          {avanzamentoMedio}%
        </p>
      </section>
      <section>
        <h2>Diagramma Gantt</h2>
        {timeline.length === 0 ? (
          <p>Nessun task con date valide da rappresentare nella timeline.</p>
        ) : (
          <table className="print-gantt">
            <thead>
              <tr>
                <th scope="col">Task</th>
                {timeline.map((periodo) => (
                  <th scope="col" key={periodo.inizio.toISOString()}>
                    {periodo.etichetta}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => {
                const intervallo = intervalloGanttTask(node);
                return (
                  <tr key={node.id}>
                    <th scope="row" title={node.data.titolo}>
                      <span className="print-gantt__title">{node.data.titolo}</span>
                    </th>
                    {timeline.map((periodo) => {
                      const progresso = intervallo
                        ? calcolaProgressoNelPeriodo(intervallo, periodo)
                        : 0;
                      const periodoAttivo =
                        intervallo !== null &&
                        !(
                          isBefore(intervallo.fine, periodo.inizio) ||
                          isAfter(intervallo.inizio, periodo.fine)
                        );
                      return (
                        <td
                          className={
                            periodoAttivo
                              ? "print-gantt__period is-active"
                              : "print-gantt__period"
                          }
                          key={periodo.inizio.toISOString()}
                          aria-label={
                            periodoAttivo
                              ? `${node.data.titolo}, ${periodo.etichetta}, ${node.data.percentuale}% avanzamento`
                              : undefined
                          }
                        >
                          {periodoAttivo && (
                            <span
                              className="print-gantt__bar"
                              style={{
                                background: coloreAvanzamento(node.data.percentuale),
                                backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.7) ${progresso}%, transparent ${progresso}%)`
                              }}
                              aria-hidden="true"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2>Task</h2>
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Tipo</th>
              <th>Responsabile</th>
              <th>Inizio</th>
              <th>Fine</th>
              <th>Giorni lavorativi</th>
              <th>Avanzamento</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => (
              <tr key={node.id}>
                <td>{node.data.titolo}</td>
                <td>{node.data.tipoTask}</td>
                <td>{node.data.responsabile || "—"}</td>
                <td>{formatIt(node.data.dataInizio)}</td>
                <td>{formatIt(node.data.dataFine)}</td>
                <td>
                  {durataGiorniLavorativi(node.data.dataInizio, node.data.dataFine) ?? "—"}
                </td>
                <td>{node.data.percentuale}%</td>
                <td>
                  {isInRitardo(node.data)
                    ? "In ritardo"
                    : node.data.percentuale === 100
                      ? "Completato"
                      : "Pianificato"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>Carico risorse</h2>
        <table>
          <thead>
            <tr>
              <th>Responsabile</th>
              <th>Task assegnati</th>
              <th>Giorni lavorativi</th>
              <th>Picco task simultanei</th>
              <th>Coppie sovrapposte</th>
            </tr>
          </thead>
          <tbody>
            {carichi.map((carico) => (
              <tr key={carico.nome}>
                <td>{carico.nome}</td>
                <td>{carico.task.length}</td>
                <td>{carico.giorniLavorativi}</td>
                <td>{carico.piccoSimultanei}</td>
                <td>{carico.sovrapposizioni.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Le sovrapposizioni indicano intervalli di task in comune per responsabile, non una
          valutazione automatica di sovraccarico.
        </p>
      </section>
    </article>
  );
}
