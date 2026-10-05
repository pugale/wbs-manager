import { getNodesBounds } from "@xyflow/react";
import type { WbsNode } from "../models/WbsTask";

const MESSAGGIO_SOLO_DESKTOP = "L'esportazione JPG è disponibile solo nell'app desktop.";

export async function esportaVistaJpg(
  visualizzazione: "grafo" | "gantt" | "risorse",
  nomeProgetto: string,
  nodes: WbsNode[]
): Promise<void> {
  if (!window.electronAPI) throw new Error(MESSAGGIO_SOLO_DESKTOP);

  const selettori: Record<typeof visualizzazione, string> = {
    grafo: ".react-flow__viewport",
    gantt: ".gantt-view",
    risorse: ".resource-view"
  };
  const selettore = selettori[visualizzazione];
  const elemento = document.querySelector<HTMLElement>(selettore);
  if (!elemento) throw new Error("La vista selezionata non è disponibile per l'esportazione.");

  const margine = 40;
  const bounds = visualizzazione === "grafo" ? getNodesBounds(nodes) : null;
  if (visualizzazione === "grafo" && nodes.length === 0) {
    throw new Error("Aggiungi almeno un task prima di esportare il grafo.");
  }

  const larghezza =
    visualizzazione === "grafo" && bounds
      ? Math.ceil(bounds.width + margine * 2)
      : elemento.scrollWidth;
  const altezza =
    visualizzazione === "grafo" && bounds
      ? Math.ceil(bounds.height + margine * 2)
      : elemento.scrollHeight;
  if (larghezza === 0 || altezza === 0) {
    throw new Error("La vista selezionata non contiene un'immagine esportabile.");
  }

  const { toJpeg } = await import("html-to-image");
  const immagine = await toJpeg(elemento, {
    backgroundColor: "#ffffff",
    quality: 0.95,
    width: larghezza,
    height: altezza,
    canvasWidth: larghezza,
    canvasHeight: altezza,
    style: visualizzazione === "grafo" && bounds
      ? {
          position: "relative",
          width: `${larghezza}px`,
          height: `${altezza}px`,
          overflow: "visible",
          transform: `translate(${margine - bounds.x}px, ${margine - bounds.y}px) scale(1)`,
          transformOrigin: "0 0"
        }
      : { width: `${larghezza}px`, height: `${altezza}px`, overflow: "visible" }
  });
  const suffisso =
    visualizzazione === "gantt"
      ? "Gantt"
      : visualizzazione === "risorse"
        ? "Risorse"
        : "Grafo";
  await window.electronAPI.salvaImmagineJpg({
    immagine,
    nomeSuggerito: `${nomeProgetto} - ${suffisso}`
  });
}
