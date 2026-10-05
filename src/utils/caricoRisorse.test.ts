import { describe, expect, it } from "vitest";
import type { WbsNode } from "../models/WbsTask";
import { calcolaCaricoRisorse } from "./caricoRisorse";

function task(
  id: string,
  inizio: string | null,
  fine: string | null,
  responsabile = "Ada Lovelace"
): WbsNode {
  return {
    id,
    type: "task",
    position: { x: 0, y: 0 },
    data: {
      titolo: id,
      tipoTask: "Sviluppo",
      descrizione: "",
      responsabile,
      dataInizio: inizio,
      dataFine: fine,
      percentuale: 0
    }
  };
}

describe("calcolaCaricoRisorse", () => {
  it("calcola task assegnati, giorni pianificati, picco e sovrapposizioni inclusive", () => {
    const carichi = calcolaCaricoRisorse([
      task("A", "2026-10-05", "2026-10-07"),
      task("B", "2026-10-07", "2026-10-09"),
      task("C", "2026-10-10", "2026-10-10")
    ]);

    expect(carichi).toHaveLength(1);
    expect(carichi[0].task).toHaveLength(3);
    expect(carichi[0].giorniLavorativi).toBe(6);
    expect(carichi[0].piccoSimultanei).toBe(2);
    expect(carichi[0].sovrapposizioni).toHaveLength(1);
  });

  it("non calcola sovrapposizioni fra responsabili diversi né con date assenti", () => {
    const carichi = calcolaCaricoRisorse([
      task("A", "2026-10-05", "2026-10-08"),
      task("B", "2026-10-06", "2026-10-07", "Grace Hopper"),
      task("C", null, null)
    ]);

    expect(carichi).toHaveLength(2);
    expect(carichi[0].sovrapposizioni).toHaveLength(0);
    expect(carichi[0].piccoSimultanei).toBe(1);
  });

  it("ignora i task senza responsabile", () => {
    expect(calcolaCaricoRisorse([task("A", null, null, "  ")])).toHaveLength(0);
  });
});
