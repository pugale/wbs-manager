import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const FORMATO_WBSM = "wbsm";
const VERSIONE_WBSM = 1;
const LIMITE_ARCHIVIO = 256 * 1024 * 1024;
const LIMITE_ESPANSO = 512 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;

function validaManifest(manifest) {
  if (
    !manifest ||
    manifest.formato !== FORMATO_WBSM ||
    manifest.versioneFormato !== VERSIONE_WBSM ||
    typeof manifest.idProgetto !== "string" ||
    typeof manifest.nomeProgetto !== "string" ||
    (manifest.versioneCorrenteId !== null && typeof manifest.versioneCorrenteId !== "string") ||
    (manifest.baselineId !== null && typeof manifest.baselineId !== "string")
  ) {
    throw new Error("Il formato dell'archivio .wbsm non è supportato o il manifest non è valido.");
  }
}

function validaIndice(indiceVersioni, manifest) {
  if (!Array.isArray(indiceVersioni)) {
    throw new Error("L'indice delle versioni nell'archivio non è valido.");
  }
  const idVisti = new Set();
  const numeriVersioneVisti = new Set();
  let baselineTrovata = false;
  for (const versione of indiceVersioni) {
    if (
      !versione ||
      typeof versione.id !== "string" ||
      !UUID.test(versione.id) ||
      idVisti.has(versione.id) ||
      typeof versione.versione !== "string" ||
      !/^\d+\.\d+$/.test(versione.versione) ||
      numeriVersioneVisti.has(versione.versione) ||
      typeof versione.nota !== "string" ||
      typeof versione.creataIl !== "string" ||
      !Number.isFinite(Date.parse(versione.creataIl)) ||
      typeof versione.baseline !== "boolean" ||
      (versione.baseline && (baselineTrovata || versione.versione !== "1.0"))
    ) {
      throw new Error("L'elenco delle versioni nell'archivio non è valido.");
    }
    idVisti.add(versione.id);
    numeriVersioneVisti.add(versione.versione);
    baselineTrovata ||= versione.baseline;
  }
  if (
    (manifest.baselineId === null) !== !baselineTrovata ||
    (manifest.versioneCorrenteId !== null && !idVisti.has(manifest.versioneCorrenteId)) ||
    (manifest.baselineId !== null && !idVisti.has(manifest.baselineId)) ||
    (indiceVersioni.length > 0 &&
      (manifest.baselineId === null ||
        manifest.versioneCorrenteId !== indiceVersioni.at(-1).id))
  ) {
    throw new Error("I riferimenti alle versioni nel manifest non sono coerenti.");
  }
}

function nomeFileSnapshot(versione) {
  return `versioni/versione_${versione.replace(".", "_")}.json`;
}

export function creaManifest(contenuto) {
  const progetto = JSON.parse(contenuto);
  if (typeof progetto.id !== "string" || typeof progetto.nome !== "string") {
    throw new Error("Il progetto non contiene un ID o un nome valido.");
  }
  return {
    formato: FORMATO_WBSM,
    versioneFormato: VERSIONE_WBSM,
    idProgetto: progetto.id,
    nomeProgetto: progetto.nome,
    versioneCorrenteId: null,
    baselineId: null
  };
}

export function leggiArchivio(contenuto) {
  if (contenuto.length > LIMITE_ARCHIVIO) {
    throw new Error("Il file .wbsm supera la dimensione massima consentita.");
  }
  let file;
  try {
    file = unzipSync(contenuto);
  } catch {
    throw new Error("Il file .wbsm non è un archivio ZIP valido o è danneggiato.");
  }

  const manifestBytes = file["manifest.json"];
  const progettoBytes = file["progetto.json"];
  const indiceBytes = file["versioni/indice.json"];
  if (!manifestBytes || !progettoBytes || !indiceBytes) {
    throw new Error("L'archivio .wbsm non contiene manifest, indice e progetto.");
  }

  let manifest;
  let indiceVersioni;
  const contenutoCorrente = strFromU8(progettoBytes);
  let progettoCorrente;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes));
    indiceVersioni = JSON.parse(strFromU8(indiceBytes));
    progettoCorrente = JSON.parse(contenutoCorrente);
  } catch {
    throw new Error("Il manifest, l'indice o il progetto nell'archivio non è un JSON valido.");
  }
  validaManifest(manifest);
  validaIndice(indiceVersioni, manifest);
  if (progettoCorrente.id !== manifest.idProgetto) {
    throw new Error("L'ID progetto del manifest non corrisponde al progetto contenuto.");
  }

  const versioni = {};
  const idVisti = new Set();
  let byteEspansi = manifestBytes.length + indiceBytes.length + progettoBytes.length;
  for (const versione of indiceVersioni) {
    if (
      !versione ||
      typeof versione.id !== "string" ||
      !UUID.test(versione.id) ||
      idVisti.has(versione.id) ||
      typeof versione.versione !== "string" ||
      typeof versione.nota !== "string" ||
      typeof versione.creataIl !== "string" ||
      !Number.isFinite(Date.parse(versione.creataIl)) ||
      typeof versione.baseline !== "boolean"
    ) {
      throw new Error("L'elenco delle versioni nell'archivio non è valido.");
    }
    const byteVersione =
      file[nomeFileSnapshot(versione.versione)] ?? file[`versioni/${versione.id}.json`];
    if (!byteVersione) throw new Error(`Manca lo snapshot ${versione.versione} nell'archivio.`);
    byteEspansi += byteVersione.length;
    if (byteEspansi > LIMITE_ESPANSO) {
      throw new Error("Il contenuto estratto dell'archivio .wbsm supera il limite consentito.");
    }
    const snapshot = strFromU8(byteVersione);
    try {
      const progettoSnapshot = JSON.parse(snapshot);
      if (progettoSnapshot.id !== manifest.idProgetto) {
        throw new Error("ID progetto non corrispondente");
      }
    } catch {
      throw new Error(`Lo snapshot ${versione.versione} non contiene un JSON valido.`);
    }
    idVisti.add(versione.id);
    versioni[versione.id] = snapshot;
  }

  if (
    (manifest.baselineId !== null && !idVisti.has(manifest.baselineId)) ||
    (manifest.versioneCorrenteId !== null && !idVisti.has(manifest.versioneCorrenteId)) ||
    (manifest.baselineId !== null &&
      !indiceVersioni.find((versione) => versione.id === manifest.baselineId)?.baseline) ||
    indiceVersioni.filter((versione) => versione.baseline).length > 1
  ) {
    throw new Error("Il manifest fa riferimento a una versione non valida.");
  }
  return { manifest, indiceVersioni, contenutoCorrente, versioni };
}

export function creaContenutoArchivio(archivio) {
  if (
    !archivio ||
    typeof archivio !== "object" ||
    typeof archivio.contenutoCorrente !== "string" ||
    !archivio.manifest ||
    !Array.isArray(archivio.indiceVersioni) ||
    !archivio.versioni ||
    typeof archivio.versioni !== "object"
  ) {
    throw new Error("Dati archivio .wbsm non validi.");
  }
  validaManifest(archivio.manifest);
  validaIndice(archivio.indiceVersioni, archivio.manifest);
  JSON.parse(archivio.contenutoCorrente);
  const file = {
    "manifest.json": strToU8(JSON.stringify(archivio.manifest, null, 2)),
    "versioni/indice.json": strToU8(JSON.stringify(archivio.indiceVersioni, null, 2)),
    "progetto.json": strToU8(archivio.contenutoCorrente)
  };
  const progettoCorrente = JSON.parse(archivio.contenutoCorrente);
  if (progettoCorrente.id !== archivio.manifest.idProgetto) {
    throw new Error("L'ID progetto del manifest non corrisponde al progetto corrente.");
  }
  let byteEspansi =
    file["manifest.json"].length +
    file["versioni/indice.json"].length +
    file["progetto.json"].length;
  const idVisti = new Set();
  for (const versione of archivio.indiceVersioni) {
    if (
      typeof versione.id !== "string" ||
      !UUID.test(versione.id) ||
      idVisti.has(versione.id) ||
      typeof archivio.versioni[versione.id] !== "string"
    ) {
      throw new Error("Uno snapshot versione manca o non è valido.");
    }
    const progettoSnapshot = JSON.parse(archivio.versioni[versione.id]);
    if (progettoSnapshot.id !== archivio.manifest.idProgetto) {
      throw new Error("Uno snapshot appartiene a un progetto differente.");
    }
    const bytes = strToU8(archivio.versioni[versione.id]);
    byteEspansi += bytes.length;
    if (byteEspansi > LIMITE_ESPANSO) {
      throw new Error("Il contenuto del progetto .wbsm supera il limite consentito.");
    }
    file[nomeFileSnapshot(versione.versione)] = bytes;
    idVisti.add(versione.id);
  }
  if (
    (archivio.manifest.baselineId !== null && !idVisti.has(archivio.manifest.baselineId)) ||
    (archivio.manifest.versioneCorrenteId !== null &&
      !idVisti.has(archivio.manifest.versioneCorrenteId))
  ) {
    throw new Error("Il manifest fa riferimento a una versione non presente nell'archivio.");
  }
  const risultato = zipSync(file, { level: 6 });
  if (risultato.length > LIMITE_ARCHIVIO) {
    throw new Error("Il file .wbsm supera la dimensione massima consentita.");
  }
  return risultato;
}
