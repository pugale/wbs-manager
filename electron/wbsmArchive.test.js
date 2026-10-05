import { describe, expect, it } from "vitest";
import { strToU8, unzipSync, zipSync } from "fflate";
import { creaContenutoArchivio, creaManifest, leggiArchivio } from "./wbsmArchive.js";

const idProgetto = "progetto-test";
const idVersione = "12345678-1234-4123-8123-123456789abc";

function archivioConVersione() {
  const progetto = JSON.stringify({ id: idProgetto, nome: "Piano", nodes: [], edges: [] });
  const manifest = creaManifest(progetto);
  const versione = {
    id: idVersione,
    versione: "1.0",
    nota: "Baseline iniziale",
    creataIl: "2026-10-05T10:00:00.000Z",
    baseline: true
  };
  manifest.versioneCorrenteId = idVersione;
  manifest.baselineId = idVersione;
  return {
    manifest,
    indiceVersioni: [versione],
    contenutoCorrente: progetto,
    versioni: { [idVersione]: progetto }
  };
}

describe("archivio ZIP .wbsm", () => {
  it("salva e riapre il progetto, il manifest e gli snapshot", () => {
    const origine = archivioConVersione();
    const zip = creaContenutoArchivio(origine);
    const fileZip = unzipSync(zip);
    const riletto = leggiArchivio(zip);

    expect(fileZip["versioni/versione_1_0.json"]).toBeDefined();
    expect(fileZip[`versioni/${idVersione}.json`]).toBeUndefined();
    expect(riletto.manifest).toEqual(origine.manifest);
    expect(riletto.contenutoCorrente).toBe(origine.contenutoCorrente);
    expect(riletto.versioni).toEqual(origine.versioni);
  });

  it("nomina ogni snapshot con il numero della versione", () => {
    const archivio = archivioConVersione();
    const id11 = "22345678-1234-4123-8123-123456789abc";
    const id12 = "32345678-1234-4123-8123-123456789abc";
    archivio.indiceVersioni.push(
      {
        id: id11,
        versione: "1.1",
        nota: "Aggiornamento",
        creataIl: "2026-10-05T11:00:00.000Z",
        baseline: false
      },
      {
        id: id12,
        versione: "1.2",
        nota: "Ripristino",
        creataIl: "2026-10-05T12:00:00.000Z",
        baseline: false
      }
    );
    archivio.manifest.versioneCorrenteId = id12;
    archivio.versioni[id11] = archivio.contenutoCorrente;
    archivio.versioni[id12] = archivio.contenutoCorrente;

    const fileZip = unzipSync(creaContenutoArchivio(archivio));

    expect(fileZip["versioni/versione_1_1.json"]).toBeDefined();
    expect(fileZip["versioni/versione_1_2.json"]).toBeDefined();
  });

  it("riapre gli archivi esistenti con nomi snapshot basati sugli ID", () => {
    const archivio = archivioConVersione();
    const zipLegacy = zipSync({
      "manifest.json": strToU8(JSON.stringify(archivio.manifest)),
      "progetto.json": strToU8(archivio.contenutoCorrente),
      "versioni/indice.json": strToU8(JSON.stringify(archivio.indiceVersioni)),
      [`versioni/${idVersione}.json`]: strToU8(archivio.versioni[idVersione])
    });

    expect(leggiArchivio(zipLegacy).versioni).toEqual(archivio.versioni);
  });

  it("rifiuta archivi mancanti o snapshot non validi", () => {
    expect(() => leggiArchivio(new Uint8Array([1, 2, 3]))).toThrow("ZIP valido");
    const archivio = archivioConVersione();
    delete archivio.versioni[idVersione];
    expect(() => creaContenutoArchivio(archivio)).toThrow("snapshot versione");
  });

  it("crea manifest vuoto con il formato supportato", () => {
    const manifest = creaManifest(
      JSON.stringify({ id: idProgetto, nome: "Piano", nodes: [], edges: [] })
    );
    expect(manifest).toMatchObject({
      formato: "wbsm",
      versioneFormato: 1,
      idProgetto,
      baselineId: null,
      versioneCorrenteId: null
    });
  });

  it("crea e riapre un archivio nuovo senza versioni", () => {
    const progetto = JSON.stringify({ id: idProgetto, nome: "Piano", nodes: [], edges: [] });
    const archivio = {
      manifest: creaManifest(progetto),
      indiceVersioni: [],
      contenutoCorrente: progetto,
      versioni: {}
    };

    const riletto = leggiArchivio(creaContenutoArchivio(archivio));
    expect(riletto.indiceVersioni).toEqual([]);
    expect(riletto.contenutoCorrente).toBe(progetto);
    expect(riletto.manifest.baselineId).toBeNull();
  });
});
