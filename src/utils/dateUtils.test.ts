import { describe, expect, it } from "vitest";
import { durataGiorniLavorativi } from "./dateUtils";

describe("durataGiorniLavorativi", () => {
  it("conta gli estremi inclusi e ignora i fine settimana", () => {
    expect(durataGiorniLavorativi("2026-10-05", "2026-10-05")).toBe(1);
    expect(durataGiorniLavorativi("2026-10-09", "2026-10-12")).toBe(2);
    expect(durataGiorniLavorativi("2026-10-10", "2026-10-11")).toBe(0);
  });

  it("calcola gli intervalli lunghi in settimane complete e giorni residui", () => {
    expect(durataGiorniLavorativi("2026-10-05", "2026-10-18")).toBe(10);
    expect(durataGiorniLavorativi("2026-10-09", "2026-10-18")).toBe(6);
  });

  it("restituisce null se le date mancano, non sono valide o sono invertite", () => {
    expect(durataGiorniLavorativi(null, "2026-10-05")).toBeNull();
    expect(durataGiorniLavorativi("data", "2026-10-05")).toBeNull();
    expect(durataGiorniLavorativi("2026-10-06", "2026-10-05")).toBeNull();
  });
});
