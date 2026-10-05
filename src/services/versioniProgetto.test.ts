import { describe, expect, it } from "vitest";
import type { ProgettoCaricato } from "./projectService";
import { creaArchivioProgetto, creaVersione, confrontaProgetti } from "./versioniProgetto";

function progetto(overrides: Partial<ProgettoCaricato> = {}): ProgettoCaricato {
  return {
    id: "progetto-1",
    nome: "Piano",
    tipoFreccia: "bezier",
    nodes: [
      {
        id: "task-1",
        type: "task",
        position: { x: 0, y: 0 },
        data: {
          titolo: "Analisi",
          tipoTask: "Analisi",
          descrizione: "",
          responsabile: "Ada",
          dataInizio: "2026-01-01",
          dataFine: "2026-01-02",
          percentuale: 0
        }
      }
    ],
    edges: [],
    ...overrides
  };
}

describe("versioni progetto .wbsm", () => {
  it("crea una baseline immutabile 1.0 e versioni successive", () => {
    const vuoto = creaArchivioProgetto("{}", "progetto-1", "Piano");
    const baseline = creaVersione(vuoto, '{"versione":1}', "Piano approvato", true);
    const successiva = creaVersione(baseline, '{"versione":2}', "Date aggiornate");

    expect(baseline.indiceVersioni.map((versione) => versione.versione)).toEqual(["1.0"]);
    expect(baseline.versioni[baseline.manifest.baselineId!]).toBe('{"versione":1}');
    expect(successiva.indiceVersioni.map((versione) => versione.versione)).toEqual(["1.0", "1.1"]);
    expect(successiva.versioni[baseline.manifest.baselineId!]).toBe('{"versione":1}');
    expect(successiva.contenutoCorrente).toBe('{"versione":2}');
  });

  it("impedisce di creare versioni senza baseline o di sovrascrivere la baseline", () => {
    const archivio = creaArchivioProgetto("{}", "progetto-1", "Piano");
    expect(() => creaVersione(archivio, "{}", "Versione")).toThrow("baseline");
    const baseline = creaVersione(archivio, "{}", "Baseline", true);
    expect(() => creaVersione(baseline, "{}", "Nuova baseline", true)).toThrow(
      "già stata definita"
    );
  });

  it("crea, confronta e ripristina uno snapshot senza sovrascrivere le versioni esistenti", () => {
    const baselineProject = progetto();
    const project11 = progetto({
      nodes: [
        {
          ...progetto().nodes[0],
          data: { ...progetto().nodes[0].data, percentuale: 60 }
        }
      ]
    });
    const baselineContent = JSON.stringify(baselineProject);
    const content11 = JSON.stringify(project11);

    const baseline = creaVersione(
      creaArchivioProgetto(baselineContent, baselineProject.id, baselineProject.nome),
      baselineContent,
      "Piano iniziale",
      true
    );
    const versione11 = creaVersione(baseline, content11, "Avanzamento aggiornato");
    const ripristino12 = creaVersione(
      versione11,
      baseline.versioni[baseline.manifest.baselineId!],
      "Ripristino baseline"
    );

    expect(ripristino12.indiceVersioni.map((versione) => versione.versione)).toEqual([
      "1.0",
      "1.1",
      "1.2"
    ]);
    expect(ripristino12.versioni[baseline.manifest.baselineId!]).toBe(baselineContent);
    expect(ripristino12.versioni[versione11.manifest.versioneCorrenteId!]).toBe(content11);
    expect(ripristino12.contenutoCorrente).toBe(baselineContent);
    expect(
      confrontaProgetti(
        JSON.parse(baseline.versioni[baseline.manifest.baselineId!]),
        JSON.parse(versione11.versioni[versione11.manifest.versioneCorrenteId!])
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campo: "Avanzamento",
          da: "0",
          a: "60",
          tipo: "modificato"
        })
      ])
    );
  });

  it("rileva task aggiunti, rimossi, campi, posizioni, frecce e dipendenze", () => {
    const precedente = progetto({
      edges: [{ id: "edge-old", source: "task-1", target: "task-2" }],
      nodes: [
        ...progetto().nodes,
        {
          id: "task-2",
          type: "task",
          position: { x: 80, y: 20 },
          data: { ...progetto().nodes[0].data, titolo: "Sviluppo" }
        }
      ]
    });
    const successivo = progetto({
      tipoFreccia: "step",
      nodes: [
        {
          ...progetto().nodes[0],
          position: { x: 10, y: 10 },
          data: { ...progetto().nodes[0].data, percentuale: 40 }
        },
        {
          id: "task-3",
          type: "task",
          position: { x: 20, y: 20 },
          data: { ...progetto().nodes[0].data, titolo: "Test" }
        }
      ],
      edges: [{ id: "edge-new", source: "task-1", target: "task-3" }]
    });
    const risultati = confrontaProgetti(precedente, successivo);

    expect(risultati.map((modifica) => [modifica.campo, modifica.tipo])).toEqual(
      expect.arrayContaining([
        ["Avanzamento", "modificato"],
        ["Posizione nel grafo", "modificato"],
        ["Stile delle frecce", "modificato"],
        ["Task", "aggiunto"],
        ["Task", "rimosso"],
        ["Dipendenza", "aggiunto"],
        ["Dipendenza", "rimosso"]
      ])
    );
  });
});
