import { addDays, isBefore } from "date-fns";
import type { WbsNode } from "../models/WbsTask";
import { durataGiorniLavorativi, toDate } from "./dateUtils";

export type SovrapposizioneTask = {
  primo: WbsNode;
  secondo: WbsNode;
  inizio: Date;
  fine: Date;
};

export type CaricoRisorsa = {
  nome: string;
  task: WbsNode[];
  giorniLavorativi: number;
  piccoSimultanei: number;
  sovrapposizioni: SovrapposizioneTask[];
};

export function calcolaCaricoRisorse(nodes: WbsNode[]): CaricoRisorsa[] {
  const gruppi = new Map<string, WbsNode[]>();
  for (const node of nodes) {
    const nome = node.data.responsabile.trim();
    if (!nome) continue;
    gruppi.set(nome, [...(gruppi.get(nome) ?? []), node]);
  }

  return [...gruppi.entries()]
    .map(([nome, task]) => {
      const ordinati = [...task].sort((a, b) => {
        const dataA = toDate(a.data.dataInizio)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const dataB = toDate(b.data.dataInizio)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return dataA - dataB || a.data.titolo.localeCompare(b.data.titolo, "it");
      });
      const intervalli = ordinati.flatMap((node) => {
        const inizio = toDate(node.data.dataInizio);
        const fine = toDate(node.data.dataFine);
        return inizio && fine && !isBefore(fine, inizio) ? [{ node, inizio, fine }] : [];
      });
      const eventi = intervalli.flatMap(({ inizio, fine }) => [
        { data: inizio, delta: 1 },
        { data: addDays(fine, 1), delta: -1 }
      ]);
      eventi.sort((a, b) => a.data.getTime() - b.data.getTime() || a.delta - b.delta);
      let attivi = 0;
      let piccoSimultanei = 0;
      for (const evento of eventi) {
        attivi += evento.delta;
        piccoSimultanei = Math.max(piccoSimultanei, attivi);
      }

      const sovrapposizioni: SovrapposizioneTask[] = [];
      for (let i = 0; i < intervalli.length; i += 1) {
        for (let j = i + 1; j < intervalli.length; j += 1) {
          const primo = intervalli[i];
          const secondo = intervalli[j];
          if (isBefore(primo.fine, secondo.inizio)) break;
          const inizio = isBefore(primo.inizio, secondo.inizio) ? secondo.inizio : primo.inizio;
          const fine = isBefore(primo.fine, secondo.fine) ? primo.fine : secondo.fine;
          if (!isBefore(fine, inizio)) {
            sovrapposizioni.push({ primo: primo.node, secondo: secondo.node, inizio, fine });
          }
        }
      }

      return {
        nome,
        task: ordinati,
        giorniLavorativi: ordinati.reduce(
          (totale, node) => totale + (durataGiorniLavorativi(node.data.dataInizio, node.data.dataFine) ?? 0),
          0
        ),
        piccoSimultanei,
        sovrapposizioni
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}
