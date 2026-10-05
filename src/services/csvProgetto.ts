import type { Edge } from "@xyflow/react";
import { TIPI_TASK, type TipoTask, type WbsNode, type WbsTaskData } from "../models/WbsTask";
import { durataGiorniLavorativi, isDataIsoValida, toDate } from "../utils/dateUtils";
import { isBefore } from "date-fns";

export type TaskImportatoCsv = {
  idOrigine: string;
  predecessoriOrigine: string[];
  data: WbsTaskData;
};

const INTESTAZIONI = [
  "ID",
  "Titolo",
  "Tipo",
  "Descrizione",
  "Responsabile",
  "Data inizio",
  "Data fine",
  "Giorni lavorativi",
  "Avanzamento (%)",
  "Predecessori"
];

function proteggeFormula(valore: string): string {
  return /^[\t\r ]*[=+\-@]/.test(valore) ? `'${valore}` : valore;
}

function codificaCampo(valore: string): string {
  const sicuro = proteggeFormula(valore);
  return `"${sicuro.replaceAll('"', '""')}"`;
}

export function serializzaTaskCsv(nodes: WbsNode[], edges: Edge[]): string {
  const predecessori = new Map<string, string[]>();
  for (const edge of edges) {
    predecessori.set(edge.target, [...(predecessori.get(edge.target) ?? []), edge.source]);
  }
  const righe = [
    INTESTAZIONI,
    ...nodes.map((node) => [
      node.id,
      node.data.titolo,
      node.data.tipoTask,
      node.data.descrizione,
      node.data.responsabile,
      node.data.dataInizio ?? "",
      node.data.dataFine ?? "",
      String(durataGiorniLavorativi(node.data.dataInizio, node.data.dataFine) ?? ""),
      String(node.data.percentuale),
      (predecessori.get(node.id) ?? []).join("|")
    ])
  ];
  return `\uFEFF${righe.map((riga) => riga.map(codificaCampo).join(";")).join("\r\n")}\r\n`;
}

function leggiRigheCsv(contenuto: string): string[][] {
  const righe: string[][] = [];
  let riga: string[] = [];
  let campo = "";
  let traVirgolette = false;

  for (let i = 0; i < contenuto.length; i += 1) {
    const carattere = contenuto[i];
    if (traVirgolette) {
      if (carattere === '"' && contenuto[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else if (carattere === '"') {
        traVirgolette = false;
      } else {
        campo += carattere;
      }
    } else if (carattere === '"' && campo.length === 0) {
      traVirgolette = true;
    } else if (carattere === ";") {
      riga.push(campo);
      campo = "";
    } else if (carattere === "\n" || carattere === "\r") {
      if (carattere === "\r" && contenuto[i + 1] === "\n") i += 1;
      riga.push(campo);
      if (riga.some((valore) => valore.trim() !== "")) righe.push(riga);
      riga = [];
      campo = "";
    } else {
      campo += carattere;
    }
  }
  if (traVirgolette) throw new Error("Il CSV contiene un campo tra virgolette non chiuso.");
  if (campo !== "" || riga.length > 0) {
    riga.push(campo);
    if (riga.some((valore) => valore.trim() !== "")) righe.push(riga);
  }
  return righe;
}

function senzaProtezioneFormula(valore: string): string {
  return valore.replace(/^'(?=[\t\r ]*[=+\-@])/, "");
}

function campo(
  riga: string[],
  colonne: Map<string, number>,
  intestazione: string,
  rimuoviSpazi = true
): string {
  const indice = colonne.get(intestazione.toLocaleLowerCase("it"));
  if (indice === undefined) return "";
  const valore = senzaProtezioneFormula(riga[indice] ?? "");
  return rimuoviSpazi ? valore.trim() : valore;
}

export function deserializzaTaskCsv(contenuto: string): TaskImportatoCsv[] {
  const righe = leggiRigheCsv(contenuto.replace(/^\uFEFF/, ""));
  if (righe.length < 2) throw new Error("Il CSV non contiene task da importare.");
  const intestazioni = righe[0].map((nome) => nome.trim().toLocaleLowerCase("it"));
  const intestazioniAttese = INTESTAZIONI.map((nome) => nome.toLocaleLowerCase("it"));
  if (
    intestazioni.length !== intestazioniAttese.length ||
    intestazioni.some((nome, indice) => nome !== intestazioniAttese[indice])
  ) {
    throw new Error(
      `Intestazioni non valide: usare le colonne esportate nell'ordine previsto (${INTESTAZIONI.join("; ")}).`
    );
  }
  const colonne = new Map(intestazioni.map((nome, indice) => [nome, indice]));

  const idVisti = new Set<string>();
  const task = righe.slice(1).map((riga, indice): TaskImportatoCsv => {
    const numeroRiga = indice + 2;
    if (riga.length !== INTESTAZIONI.length) {
      throw new Error(
        `Riga ${numeroRiga}: attese ${INTESTAZIONI.length} colonne, trovate ${riga.length}.`
      );
    }
    const titolo = campo(riga, colonne, "titolo");
    if (!titolo) throw new Error(`Riga ${numeroRiga}: il titolo è obbligatorio.`);

    const idOrigine = campo(riga, colonne, "id") || `riga-${numeroRiga}`;
    if (idVisti.has(idOrigine)) throw new Error(`Riga ${numeroRiga}: ID duplicato "${idOrigine}".`);
    idVisti.add(idOrigine);

    const tipoCsv = campo(riga, colonne, "tipo");
    const tipoTask: TipoTask = TIPI_TASK.find((tipo) => tipo === tipoCsv) ?? "Sviluppo";
    const dataInizioCsv = campo(riga, colonne, "data inizio");
    const dataFineCsv = campo(riga, colonne, "data fine");
    if (dataInizioCsv && !isDataIsoValida(dataInizioCsv)) {
      throw new Error(`Riga ${numeroRiga}: data inizio non valida (atteso yyyy-MM-dd).`);
    }
    if (dataFineCsv && !isDataIsoValida(dataFineCsv)) {
      throw new Error(`Riga ${numeroRiga}: data fine non valida (atteso yyyy-MM-dd).`);
    }
    const dataInizio = toDate(dataInizioCsv);
    const dataFine = toDate(dataFineCsv);
    if (dataInizio && dataFine && isBefore(dataFine, dataInizio)) {
      throw new Error(`Riga ${numeroRiga}: data fine precedente alla data inizio.`);
    }

    const avanzamentoCsv = campo(riga, colonne, "avanzamento (%)");
    const percentuale = avanzamentoCsv === "" ? 0 : Number(avanzamentoCsv);
    if (!Number.isInteger(percentuale) || percentuale < 0 || percentuale > 100) {
      throw new Error(`Riga ${numeroRiga}: avanzamento deve essere un intero tra 0 e 100.`);
    }

    return {
      idOrigine,
      predecessoriOrigine: campo(riga, colonne, "predecessori")
        .split("|")
        .map((id) => id.trim())
        .filter(Boolean),
      data: {
        titolo,
        tipoTask,
        descrizione: campo(riga, colonne, "descrizione", false),
        responsabile: campo(riga, colonne, "responsabile"),
        dataInizio: dataInizioCsv || null,
        dataFine: dataFineCsv || null,
        percentuale
      }
    };
  });

  const ids = new Set(task.map((elemento) => elemento.idOrigine));
  for (const [indice, elemento] of task.entries()) {
    const dipendenze = new Set<string>();
    for (const predecessore of elemento.predecessoriOrigine) {
      if (!ids.has(predecessore)) {
        throw new Error(`Riga ${indice + 2}: predecessore "${predecessore}" non trovato nel CSV.`);
      }
      if (predecessore === elemento.idOrigine) {
        throw new Error(`Riga ${indice + 2}: un task non può dipendere da sé stesso.`);
      }
      if (dipendenze.has(predecessore)) {
        throw new Error(`Riga ${indice + 2}: predecessore "${predecessore}" duplicato.`);
      }
      dipendenze.add(predecessore);
    }
  }
  return task;
}
