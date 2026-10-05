import type { WbsState } from "../store/wbsStore";
import type { ProgettoCaricato } from "./projectService";
import type { ArchivioProgetto } from "../models/ProgettoArchivio";

const CHIAVE_BOZZA = "wbs-manager-bozza";
const NOME_DATABASE = "wbs-manager";
const NOME_STORE = "bozze";
const CHIAVE_DATABASE = "automatica";

export type BozzaSalvata = {
  percorso: string | null;
  contenuto: string;
  archivio?: ArchivioProgetto | null;
};

type RispostaWorker = {
  id: number;
  contenuto?: string;
  errore?: string;
};

type RichiestaWorker = {
  resolve: (contenuto: string) => void;
  reject: (errore: Error) => void;
};

let database: Promise<IDBDatabase> | undefined;
let worker: Worker | undefined;
let prossimoIdRichiesta = 0;
let versioneBozza = 0;
const richiesteWorker = new Map<number, RichiestaWorker>();

function apriDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(new Error("IndexedDB non è disponibile in questo ambiente."));
  }
  if (database) return database;

  const apertura = new Promise<IDBDatabase>((resolve, reject) => {
    const richiesta = indexedDB.open(NOME_DATABASE, 1);
    richiesta.onupgradeneeded = () => {
      if (!richiesta.result.objectStoreNames.contains(NOME_STORE)) {
        richiesta.result.createObjectStore(NOME_STORE);
      }
    };
    richiesta.onsuccess = () => {
      richiesta.result.onversionchange = () => richiesta.result.close();
      resolve(richiesta.result);
    };
    richiesta.onerror = () => reject(richiesta.error ?? new Error("Impossibile aprire IndexedDB."));
    richiesta.onblocked = () => reject(new Error("L'apertura di IndexedDB è bloccata da un'altra finestra."));
  }).catch((errore: unknown) => {
    database = undefined;
    throw errore;
  });
  database = apertura;
  return apertura;
}

async function leggiDalDatabase(): Promise<unknown> {
  const db = await apriDatabase();
  return new Promise((resolve, reject) => {
    const transazione = db.transaction(NOME_STORE, "readonly");
    const richiesta = transazione.objectStore(NOME_STORE).get(CHIAVE_DATABASE);
    richiesta.onsuccess = () => resolve(richiesta.result);
    richiesta.onerror = () => reject(richiesta.error ?? new Error("Impossibile leggere la bozza automatica."));
    transazione.onabort = () => reject(transazione.error ?? new Error("Lettura della bozza automatica annullata."));
  });
}

async function scriviNelDatabase(
  bozza: BozzaSalvata,
  versioneAttesa: number
): Promise<void> {
  const db = await apriDatabase();
  if (versioneAttesa !== versioneBozza) return;
  return new Promise((resolve, reject) => {
    const transazione = db.transaction(NOME_STORE, "readwrite");
    transazione.objectStore(NOME_STORE).put(bozza, CHIAVE_DATABASE);
    transazione.oncomplete = () => resolve();
    transazione.onerror = () => reject(transazione.error ?? new Error("Impossibile salvare la bozza automatica."));
    transazione.onabort = () => reject(transazione.error ?? new Error("Salvataggio della bozza automatica annullato."));
  });
}

async function eliminaDalDatabase(versioneAttesa: number): Promise<void> {
  const db = await apriDatabase();
  if (versioneAttesa !== versioneBozza) return;
  return new Promise((resolve, reject) => {
    const transazione = db.transaction(NOME_STORE, "readwrite");
    transazione.objectStore(NOME_STORE).delete(CHIAVE_DATABASE);
    transazione.oncomplete = () => resolve();
    transazione.onerror = () => reject(transazione.error ?? new Error("Impossibile eliminare la bozza automatica."));
    transazione.onabort = () => reject(transazione.error ?? new Error("Eliminazione della bozza automatica annullata."));
  });
}

function validaBozza(bozza: unknown): BozzaSalvata {
  if (
    typeof bozza !== "object" ||
    bozza === null ||
    !("contenuto" in bozza) ||
    typeof bozza.contenuto !== "string" ||
    !("percorso" in bozza) ||
    (bozza.percorso !== null && typeof bozza.percorso !== "string")
  ) {
    throw new Error("La bozza di recupero automatica non è valida.");
  }
  const archivio = "archivio" in bozza ? bozza.archivio : null;
  if (archivio !== null && !isArchivioProgetto(archivio)) {
    throw new Error("L'archivio delle versioni nella bozza automatica non è valido.");
  }
  return {
    percorso: bozza.percorso,
    contenuto: bozza.contenuto,
    archivio
  };
}

function isArchivioProgetto(value: unknown): value is ArchivioProgetto {
  if (typeof value !== "object" || value === null) return false;
  if (!("manifest" in value) || typeof value.manifest !== "object" || value.manifest === null) {
    return false;
  }
  if (!("versioni" in value) || typeof value.versioni !== "object" || value.versioni === null) {
    return false;
  }
  const manifest = value.manifest;
  return (
    "contenutoCorrente" in value &&
    typeof value.contenutoCorrente === "string" &&
    "formato" in manifest &&
    manifest.formato === "wbsm" &&
    "versioneFormato" in manifest &&
    manifest.versioneFormato === 1 &&
    "idProgetto" in manifest &&
    typeof manifest.idProgetto === "string" &&
    "nomeProgetto" in manifest &&
    typeof manifest.nomeProgetto === "string" &&
    "versioneCorrenteId" in manifest &&
    (manifest.versioneCorrenteId === null || typeof manifest.versioneCorrenteId === "string") &&
    "baselineId" in manifest &&
    (manifest.baselineId === null || typeof manifest.baselineId === "string") &&
    "indiceVersioni" in value &&
    Array.isArray(value.indiceVersioni) &&
    Object.values(value.versioni).every((contenuto) => typeof contenuto === "string")
  );
}

function serializzaInWorker(progetto: ProgettoCaricato): Promise<string> {
  if (!worker) {
    worker = new Worker(new URL("./bozzaAutomatica.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (evento: MessageEvent<RispostaWorker>) => {
      const richiesta = richiesteWorker.get(evento.data.id);
      if (!richiesta) return;
      richiesteWorker.delete(evento.data.id);
      if (evento.data.errore) richiesta.reject(new Error(evento.data.errore));
      else if (typeof evento.data.contenuto === "string") richiesta.resolve(evento.data.contenuto);
      else richiesta.reject(new Error("Il worker ha restituito una bozza non valida."));
    };
    worker.onerror = (evento) => {
      const errore = new Error(evento.message || "Errore durante la serializzazione della bozza.");
      richiesteWorker.forEach((richiesta) => richiesta.reject(errore));
      richiesteWorker.clear();
      worker?.terminate();
      worker = undefined;
    };
  }

  const id = ++prossimoIdRichiesta;
  return new Promise((resolve, reject) => {
    richiesteWorker.set(id, { resolve, reject });
    try {
      worker?.postMessage({ id, progetto });
    } catch (errore) {
      richiesteWorker.delete(id);
      reject(errore instanceof Error ? errore : new Error(String(errore)));
    }
  });
}

export async function leggiBozzaAutomatica(): Promise<BozzaSalvata | null> {
  const versioneIniziale = versioneBozza;
  const salvata = await leggiDalDatabase();
  if (salvata !== undefined) return validaBozza(salvata);

  const legacy = localStorage.getItem(CHIAVE_BOZZA);
  if (!legacy) return null;
  const bozza = validaBozza(JSON.parse(legacy) as unknown);
  if (versioneIniziale !== versioneBozza) return null;
  await scriviNelDatabase(bozza, versioneIniziale);
  localStorage.removeItem(CHIAVE_BOZZA);
  return bozza;
}

export async function salvaBozzaAutomatica(stato: WbsState): Promise<void> {
  const versioneCorrente = ++versioneBozza;
  const progetto: ProgettoCaricato = {
    id: stato.progettoId,
    nome: stato.nomeProgetto,
    tipoFreccia: stato.tipoFreccia,
    nodes: stato.nodes,
    edges: stato.edges
  };
  const bozza: BozzaSalvata = {
    percorso: stato.percorsoFile,
    contenuto: await serializzaInWorker(progetto),
    archivio: stato.archivio
  };
  if (versioneCorrente !== versioneBozza) return;
  await scriviNelDatabase(bozza, versioneCorrente);
}

export async function eliminaBozzaAutomatica(): Promise<void> {
  const versioneCorrente = ++versioneBozza;
  await eliminaDalDatabase(versioneCorrente);
  localStorage.removeItem(CHIAVE_BOZZA);
}
