import { describe, expect, it } from "vitest";
import type { WbsNode } from "../models/WbsTask";
import {
  calcolaProgressoNelPeriodo,
  calcolaTimelineReport,
  intervalloGanttTask
} from "./ganttReportUtils";

function task(id: string, inizio: string | null, fine: string | null, percentuale = 0): WbsNode {
  return {
    id,
    type: "task",
    position: { x: 0, y: 0 },
    data: {
      titolo: id,
      tipoTask: "Sviluppo",
      descrizione: "",
      responsabile: "",
      dataInizio: inizio,
      dataFine: fine,
      percentuale
    }
  };
}

describe("timeline Gantt del report PDF", () => {
  it("usa una colonna per giorno sugli intervalli brevi", () => {
    const timeline = calcolaTimelineReport([task("A", "2026-10-05", "2026-10-07")]);
    expect(timeline.map((periodo) => periodo.etichetta)).toEqual(["05/10", "06/10", "07/10"]);
  });

  it("passa alla scala settimanale sugli intervalli medi", () => {
    const timeline = calcolaTimelineReport([task("A", "2026-10-01", "2026-11-30")]);
    expect(timeline.length).toBeLessThanOrEqual(10);
    expect(timeline[0].etichetta).toContain("–");
  });

  it("non crea una timeline se nessun task ha date valide", () => {
    expect(calcolaTimelineReport([task("A", null, null)])).toEqual([]);
  });

  it("colloca l'avanzamento lungo i giorni del task", () => {
    const nodo = task("A", "2026-10-05", "2026-10-14", 50);
    const intervallo = intervalloGanttTask(nodo);
    const timeline = calcolaTimelineReport([nodo]);
    expect(intervallo).not.toBeNull();
    expect(calcolaProgressoNelPeriodo(intervallo!, timeline[0])).toBe(100);
    expect(calcolaProgressoNelPeriodo(intervallo!, timeline[4])).toBe(100);
    expect(calcolaProgressoNelPeriodo(intervallo!, timeline[5])).toBe(0);
  });
});
