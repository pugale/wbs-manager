import {
  addDays,
  addMonths,
  addQuarters,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  isBefore,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear
} from "date-fns";
import type { WbsNode } from "../models/WbsTask";
import { toDate } from "./dateUtils";

export type PeriodoGanttReport = {
  inizio: Date;
  fine: Date;
  etichetta: string;
};

export type IntervalloGanttTask = {
  inizio: Date;
  fine: Date;
  progresso: number;
};

export function calcolaTimelineReport(nodes: WbsNode[]): PeriodoGanttReport[] {
  const intervalli = nodes.flatMap((node) => {
    const inizio = toDate(node.data.dataInizio);
    const fine = toDate(node.data.dataFine);
    return inizio && fine && !isBefore(fine, inizio) ? [{ inizio, fine }] : [];
  });
  if (intervalli.length === 0) return [];

  const minimo = new Date(Math.min(...intervalli.map((intervallo) => intervallo.inizio.getTime())));
  const massimo = new Date(Math.max(...intervalli.map((intervallo) => intervallo.fine.getTime())));
  const giorni = differenceInCalendarDays(massimo, minimo) + 1;
  const mesi = differenceInCalendarMonths(startOfMonth(massimo), startOfMonth(minimo)) + 1;
  const anni = differenceInCalendarYears(startOfYear(massimo), startOfYear(minimo)) + 1;

  if (giorni <= 31) {
    return Array.from({ length: giorni }, (_, indice) => {
      const giorno = addDays(minimo, indice);
      return { inizio: giorno, fine: giorno, etichetta: format(giorno, "dd/MM") };
    });
  }

  if (giorni <= 140) {
    const primoLunedi = startOfWeek(minimo, { weekStartsOn: 1 });
    const periodi: PeriodoGanttReport[] = [];
    for (let inizio = primoLunedi; !isBefore(massimo, inizio); inizio = addDays(inizio, 7)) {
      const fine = endOfWeek(inizio, { weekStartsOn: 1 });
      periodi.push({
        inizio,
        fine,
        etichetta: `${format(inizio, "dd/MM")}–${format(fine, "dd/MM")}`
      });
    }
    return periodi;
  }

  if (mesi <= 18) {
    const periodi: PeriodoGanttReport[] = [];
    for (let inizio = startOfMonth(minimo); !isBefore(massimo, inizio); inizio = addMonths(inizio, 1)) {
      periodi.push({
        inizio,
        fine: endOfMonth(inizio),
        etichetta: format(inizio, "MMM yy")
      });
    }
    return periodi;
  }

  if (anni <= 8) {
    const primoTrimestre = startOfQuarter(minimo);
    const periodi: PeriodoGanttReport[] = [];
    for (let inizio = primoTrimestre; !isBefore(massimo, inizio); inizio = addQuarters(inizio, 1)) {
      periodi.push({
        inizio,
        fine: endOfQuarter(inizio),
        etichetta: `T${format(inizio, "Q")} ${format(inizio, "yyyy")}`
      });
    }
    return periodi;
  }

  const periodi: PeriodoGanttReport[] = [];
  for (let inizio = startOfYear(minimo); !isBefore(massimo, inizio); inizio = addYears(inizio, 1)) {
    periodi.push({
      inizio,
      fine: endOfYear(inizio),
      etichetta: format(inizio, "yyyy")
    });
  }
  return periodi;
}

export function intervalloGanttTask(node: WbsNode): IntervalloGanttTask | null {
  const inizio = toDate(node.data.dataInizio);
  const fine = toDate(node.data.dataFine);
  if (!inizio || !fine || isBefore(fine, inizio)) return null;
  return { inizio, fine, progresso: node.data.percentuale };
}

export function calcolaProgressoNelPeriodo(
  intervallo: IntervalloGanttTask,
  periodo: PeriodoGanttReport
): number {
  const inizioIntersezione = isBefore(intervallo.inizio, periodo.inizio)
    ? periodo.inizio
    : intervallo.inizio;
  const fineIntersezione = isBefore(periodo.fine, intervallo.fine)
    ? periodo.fine
    : intervallo.fine;
  if (isBefore(fineIntersezione, inizioIntersezione)) return 0;

  const giorniTask = differenceInCalendarDays(intervallo.fine, intervallo.inizio) + 1;
  const giorniPrimaIntersezione = differenceInCalendarDays(
    inizioIntersezione,
    intervallo.inizio
  );
  const giorniIntersezione = differenceInCalendarDays(fineIntersezione, inizioIntersezione) + 1;
  const giorniCompletati = (giorniTask * intervallo.progresso) / 100;
  const completatiNelPeriodo = Math.min(
    giorniIntersezione,
    Math.max(0, giorniCompletati - giorniPrimaIntersezione)
  );
  return (completatiNelPeriodo / giorniIntersezione) * 100;
}
