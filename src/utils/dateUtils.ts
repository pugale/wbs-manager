import {
  differenceInCalendarDays,
  format,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  startOfDay
} from "date-fns";
import type { WbsTaskData } from "../models/WbsTask";

export function oggiIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

// parseISO("2026-10-05") restituisce la mezzanotte locale: nessuno slittamento UTC
export function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = parseISO(iso);
  return isValid(d) ? d : null;
}

export function isDataIsoValida(valore: unknown): valore is string {
  return (
    typeof valore === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valore) && toDate(valore) !== null
  );
}

export function formatIt(iso: string | null): string {
  const d = toDate(iso);
  return d ? format(d, "dd/MM/yyyy") : "—";
}

export function validaDate(inizio: string | null, fine: string | null): string | null {
  const di = toDate(inizio);
  const df = toDate(fine);
  if (di && df && isBefore(df, di)) {
    return "La data fine non può precedere la data inizio";
  }
  return null;
}

// Giorni lavorativi (lun-ven), estremi inclusi, calcolati senza iterare sull'intero intervallo.
export function durataGiorniLavorativi(inizio: string | null, fine: string | null): number | null {
  const di = toDate(inizio);
  const df = toDate(fine);
  if (!di || !df || isBefore(df, di)) return null;

  const giorniTotali = differenceInCalendarDays(df, di) + 1;
  const settimaneComplete = Math.floor(giorniTotali / 7);
  const giorniResidui = giorniTotali % 7;
  let lavorativi = settimaneComplete * 5;
  for (let offset = 0; offset < giorniResidui; offset += 1) {
    const giornoSettimana = (di.getDay() + offset) % 7;
    if (giornoSettimana !== 0 && giornoSettimana !== 6) lavorativi += 1;
  }
  return lavorativi;
}

export function isInRitardo(task: WbsTaskData): boolean {
  const df = toDate(task.dataFine);
  if (!df || task.percentuale >= 100) return false;
  return isBefore(df, startOfDay(new Date()));
}

// Collegamento Fine-Inizio: il successore deve iniziare dopo la fine del predecessore
export function violaFineInizio(predecessore?: WbsTaskData, successore?: WbsTaskData): boolean {
  const fine = toDate(predecessore?.dataFine);
  const inizio = toDate(successore?.dataInizio);
  if (!fine || !inizio) return false;
  return !isAfter(inizio, fine);
}
