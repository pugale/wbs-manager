import { describe, expect, it } from "vitest";
import { deserializzaProgetto, serializzaProgetto } from "./projectService";

const progetto = {
  id: "progetto",
  nome: "Progetto",
  tipoFreccia: "step" as const,
  nodes: [],
  edges: []
};

describe("serializzazione del progetto", () => {
  it("salva e ricarica la tipologia delle frecce", () => {
    const contenuto = serializzaProgetto(progetto);

    expect(JSON.parse(contenuto).tipoFreccia).toBe("step");
    expect(deserializzaProgetto(contenuto).tipoFreccia).toBe("step");
  });

  it("usa le frecce curve per i progetti precedenti o con tipologia non valida", () => {
    const precedente = { ...progetto, tipoFreccia: undefined };
    const nonValido = { ...progetto, tipoFreccia: "zigzag" };

    expect(deserializzaProgetto(JSON.stringify(precedente)).tipoFreccia).toBe("bezier");
    expect(deserializzaProgetto(JSON.stringify(nonValido)).tipoFreccia).toBe("bezier");
  });
});
