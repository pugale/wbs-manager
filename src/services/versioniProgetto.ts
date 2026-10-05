import type { Edge } from "@xyflow/react";
import type { ProgettoCaricato } from "./projectService";
import type {
  ArchivioProgetto,
  ManifestProgetto,
  ModificaVersione,
  VersioneProgetto
} from "../models/ProgettoArchivio";

export function creaArchivioProgetto(
  contenutoCorrente: string,
  idProgetto: string,
  nomeProgetto: string
): ArchivioProgetto {
  return {
    manifest: {
      formato: "wbsm",
      versioneFormato: 1,
      idProgetto,
      nomeProgetto,
      versioneCorrenteId: null,
      baselineId: null
    },
    indiceVersioni: [],
    contenutoCorrente,
    versioni: {}
  };
}

export function creaVersione(
  archivio: ArchivioProgetto,
  contenuto: string,
  nota: string,
  baseline = false
): ArchivioProgetto {
  if (baseline && archivio.manifest.baselineId) {
    throw new Error("La baseline è già stata definita.");
  }
  if (!baseline && !archivio.manifest.baselineId) {
    throw new Error("Definisci prima la baseline del progetto.");
  }
  const ultimaVersione = archivio.indiceVersioni.at(-1);
  const successiva = baseline
    ? "1.0"
    : `${ultimaVersione?.versione.split(".")[0] ?? "1"}.${Number(ultimaVersione?.versione.split(".")[1] ?? 0) + 1}`;
  const versione: VersioneProgetto = {
    id: crypto.randomUUID(),
    versione: successiva,
    nota: nota.trim(),
    creataIl: new Date().toISOString(),
    baseline
  };
  const manifest: ManifestProgetto = {
    ...archivio.manifest,
    versioneCorrenteId: versione.id,
    baselineId: baseline ? versione.id : archivio.manifest.baselineId
  };

  return {
    manifest,
    indiceVersioni: [...archivio.indiceVersioni, versione],
    contenutoCorrente: contenuto,
    versioni: { ...archivio.versioni, [versione.id]: contenuto }
  };
}

function valorePerConfronto(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const CAMPI_TASK: Array<[keyof ProgettoCaricato["nodes"][number]["data"], string]> = [
  ["titolo", "Titolo"],
  ["tipoTask", "Tipo"],
  ["descrizione", "Descrizione"],
  ["responsabile", "Responsabile"],
  ["dataInizio", "Data inizio"],
  ["dataFine", "Data fine"],
  ["percentuale", "Avanzamento"]
];

export function confrontaProgetti(
  precedente: ProgettoCaricato,
  successivo: ProgettoCaricato
): ModificaVersione[] {
  const modifiche: ModificaVersione[] = [];
  const nodiPrecedenti = new Map(precedente.nodes.map((node) => [node.id, node]));
  const nodiSuccessivi = new Map(successivo.nodes.map((node) => [node.id, node]));

  for (const node of successivo.nodes) {
    const vecchio = nodiPrecedenti.get(node.id);
    if (!vecchio) {
      modifiche.push({
        idTask: node.id,
        titoloTask: node.data.titolo,
        campo: "Task",
        da: "—",
        a: "Aggiunto",
        tipo: "aggiunto"
      });
      continue;
    }
    for (const [campo, etichetta] of CAMPI_TASK) {
      const da = valorePerConfronto(vecchio.data[campo]);
      const a = valorePerConfronto(node.data[campo]);
      if (da !== a) {
        modifiche.push({
          idTask: node.id,
          titoloTask: node.data.titolo,
          campo: etichetta,
          da,
          a,
          tipo: "modificato"
        });
      }
    }
    const posizioneDa = valorePerConfronto(vecchio.position);
    const posizioneA = valorePerConfronto(node.position);
    if (posizioneDa !== posizioneA) {
      modifiche.push({
        idTask: node.id,
        titoloTask: node.data.titolo,
        campo: "Posizione nel grafo",
        da: posizioneDa,
        a: posizioneA,
        tipo: "modificato"
      });
    }
  }

  if (precedente.tipoFreccia !== successivo.tipoFreccia) {
    modifiche.push({
      idTask: "",
      titoloTask: "Progetto",
      campo: "Stile delle frecce",
      da: precedente.tipoFreccia,
      a: successivo.tipoFreccia,
      tipo: "modificato"
    });
  }
  if (precedente.nome !== successivo.nome) {
    modifiche.push({
      idTask: "",
      titoloTask: "Progetto",
      campo: "Nome progetto",
      da: precedente.nome,
      a: successivo.nome,
      tipo: "modificato"
    });
  }

  for (const node of precedente.nodes) {
    if (nodiSuccessivi.has(node.id)) continue;
    modifiche.push({
      idTask: node.id,
      titoloTask: node.data.titolo,
      campo: "Task",
      da: "Presente",
      a: "Rimosso",
      tipo: "rimosso"
    });
  }

  const chiaveArco = (edge: Edge) => `${edge.source}\u0000${edge.target}`;
  const archiPrecedenti = new Map(precedente.edges.map((edge) => [chiaveArco(edge), edge]));
  const archiSuccessivi = new Map(successivo.edges.map((edge) => [chiaveArco(edge), edge]));

  for (const edge of successivo.edges) {
    if (archiPrecedenti.has(chiaveArco(edge))) continue;
    modifiche.push({
      idTask: edge.target,
      titoloTask: `Da ${nodiSuccessivi.get(edge.source)?.data.titolo ?? edge.source} a ${nodiSuccessivi.get(edge.target)?.data.titolo ?? edge.target}`,
      campo: "Dipendenza",
      da: "—",
      a: "Aggiunta",
      tipo: "aggiunto"
    });
  }
  for (const edge of precedente.edges) {
    if (archiSuccessivi.has(chiaveArco(edge))) continue;
    modifiche.push({
      idTask: edge.target,
      titoloTask: `Da ${nodiPrecedenti.get(edge.source)?.data.titolo ?? edge.source} a ${nodiPrecedenti.get(edge.target)?.data.titolo ?? edge.target}`,
      campo: "Dipendenza",
      da: "Presente",
      a: "Rimossa",
      tipo: "rimosso"
    });
  }

  return modifiche;
}
