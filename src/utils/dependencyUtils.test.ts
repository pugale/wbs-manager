import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import { erroreDipendenza } from "./dependencyUtils";

const edges: Edge[] = [
  { id: "a-b", source: "a", target: "b" },
  { id: "b-c", source: "b", target: "c" }
];

describe("erroreDipendenza", () => {
  it("accetta una dipendenza che non crea cicli", () => {
    expect(
      erroreDipendenza({ source: "c", target: "d", sourceHandle: null, targetHandle: null }, edges)
    ).toBeNull();
  });

  it("rifiuta il collegamento di un task a sé stesso", () => {
    expect(
      erroreDipendenza({ source: "a", target: "a", sourceHandle: null, targetHandle: null }, edges)
    ).toContain("sé stesso");
  });

  it("rifiuta i duplicati", () => {
    expect(
      erroreDipendenza({ source: "a", target: "b", sourceHandle: null, targetHandle: null }, edges)
    ).toContain("esiste già");
  });

  it("rifiuta un collegamento che chiude un ciclo", () => {
    expect(
      erroreDipendenza({ source: "c", target: "a", sourceHandle: null, targetHandle: null }, edges)
    ).toContain("ciclo");
  });
});
