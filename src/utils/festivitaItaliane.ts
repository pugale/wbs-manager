import { format } from "date-fns";

function pasqua(anno: number): Date {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anno, mese - 1, giorno);
}

export function nomeFestivitaItaliana(data: Date): string | null {
  const festivitaFisse: Record<string, string> = {
    "01-01": "Capodanno",
    "01-06": "Epifania",
    "04-25": "Festa della Liberazione",
    "05-01": "Festa dei Lavoratori",
    "06-02": "Festa della Repubblica",
    "08-15": "Ferragosto",
    "11-01": "Ognissanti",
    "12-08": "Immacolata Concezione",
    "12-25": "Natale",
    "12-26": "Santo Stefano"
  };
  const festaFissa = festivitaFisse[format(data, "MM-dd")];
  if (festaFissa) return festaFissa;

  const lunediPasquetta = pasqua(data.getFullYear());
  lunediPasquetta.setDate(lunediPasquetta.getDate() + 1);
  return format(data, "yyyy-MM-dd") === format(lunediPasquetta, "yyyy-MM-dd")
    ? "Lunedì dell'Angelo"
    : null;
}
