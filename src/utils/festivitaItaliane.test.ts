import { describe, expect, it } from "vitest";
import { nomeFestivitaItaliana } from "./festivitaItaliane";

describe("nomeFestivitaItaliana", () => {
  it("riconosce le festività nazionali a data fissa", () => {
    expect(nomeFestivitaItaliana(new Date(2026, 0, 1))).toBe("Capodanno");
    expect(nomeFestivitaItaliana(new Date(2026, 3, 25))).toBe("Festa della Liberazione");
    expect(nomeFestivitaItaliana(new Date(2026, 11, 26))).toBe("Santo Stefano");
  });

  it("calcola il Lunedì dell'Angelo per anni diversi", () => {
    expect(nomeFestivitaItaliana(new Date(2026, 3, 6))).toBe("Lunedì dell'Angelo");
    expect(nomeFestivitaItaliana(new Date(2027, 2, 29))).toBe("Lunedì dell'Angelo");
  });

  it("restituisce null nei giorni feriali non festivi", () => {
    expect(nomeFestivitaItaliana(new Date(2026, 9, 5))).toBeNull();
  });
});
