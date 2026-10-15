import { getNodesBounds } from "@xyflow/react";
import type { WbsNode } from "../models/WbsTask";

const MESSAGGIO_SOLO_DESKTOP = "L'esportazione dell'immagine è disponibile solo nell'app desktop.";

function ottieniConfigurazioneVista(
  visualizzazione: "grafo" | "gantt" | "risorse",
  nodes: WbsNode[]
) {
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

  const style =
    visualizzazione === "grafo" && bounds
      ? {
          position: "relative" as const,
          width: `${larghezza}px`,
          height: `${altezza}px`,
          overflow: "visible" as const,
          transform: `translate(${margine - bounds.x}px, ${margine - bounds.y}px) scale(1)`,
          transformOrigin: "0 0"
        }
      : { width: `${larghezza}px`, height: `${altezza}px`, overflow: "visible" as const };

  return { elemento, larghezza, altezza, style };
}

function suffissoVista(visualizzazione: "grafo" | "gantt" | "risorse") {
  return visualizzazione === "gantt"
    ? "Gantt"
    : visualizzazione === "risorse"
      ? "Risorse"
      : "Grafo";
}

export async function esportaVistaJpg(
  visualizzazione: "grafo" | "gantt" | "risorse",
  nomeProgetto: string,
  nodes: WbsNode[]
): Promise<void> {
  if (!window.electronAPI) throw new Error(MESSAGGIO_SOLO_DESKTOP);

  const { elemento, larghezza, altezza, style } = ottieniConfigurazioneVista(visualizzazione, nodes);

  const { toJpeg } = await import("html-to-image");
  const immagine = await toJpeg(elemento, {
    backgroundColor: "#ffffff",
    quality: 0.95,
    width: larghezza,
    height: altezza,
    canvasWidth: larghezza,
    canvasHeight: altezza,
    style
  });
  const suffisso = suffissoVista(visualizzazione);
  await window.electronAPI.salvaImmagineJpg({
    immagine,
    nomeSuggerito: `${nomeProgetto} - ${suffisso}`
  });
}

export async function esportaVistaPng(
  visualizzazione: "grafo" | "gantt" | "risorse",
  nomeProgetto: string,
  nodes: WbsNode[]
): Promise<void> {
  if (!window.electronAPI) throw new Error(MESSAGGIO_SOLO_DESKTOP);

  const { elemento, larghezza, altezza, style } = ottieniConfigurazioneVista(visualizzazione, nodes);

  const { toPng } = await import("html-to-image");
  const immagine = await toPng(elemento, {
    backgroundColor: "#ffffff",
    width: larghezza,
    height: altezza,
    canvasWidth: larghezza,
    canvasHeight: altezza,
    style
  });
  const suffisso = suffissoVista(visualizzazione);
  const nomeSuggerito = `${nomeProgetto} - ${suffisso}`;

  if (window.electronAPI.salvaImmaginePng) {
    await window.electronAPI.salvaImmaginePng({
      immagine,
      nomeSuggerito
    });
  } else {
    const nome = `${nomeSuggerito.replace(/[\\/:*?"<>|]/g, "_")}.png`;
    const a = document.createElement("a");
    a.href = immagine;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
