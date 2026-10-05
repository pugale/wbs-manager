import type { WbsNode } from "../models/WbsTask";
import { isInRitardo } from "./dateUtils";

export type FiltroTask = "tutti" | "non-iniziati" | "in-corso" | "completati" | "in-ritardo";

export function corrispondeFiltroTask(
  node: WbsNode,
  ricerca: string,
  filtro: FiltroTask,
  responsabile = ""
): boolean {
  const query = ricerca.trim().toLocaleLowerCase();
  const corrispondeTesto =
    !query ||
    [node.data.titolo, node.data.responsabile, node.data.descrizione]
      .some((valore) => valore?.toLocaleLowerCase().includes(query));
  if (!corrispondeTesto) return false;
  if (responsabile && node.data.responsabile !== responsabile) return false;

  switch (filtro) {
    case "non-iniziati":
      return node.data.percentuale === 0;
    case "in-corso":
      return node.data.percentuale > 0 && node.data.percentuale < 100;
    case "completati":
      return node.data.percentuale === 100;
    case "in-ritardo":
      return isInRitardo(node.data);
    default:
      return true;
  }
}
