import type { TipoTask } from "../models/WbsTask";

export const ICONA_TIPO_TASK: Record<TipoTask, string> = {
  Principale: "📁",
  Analisi: "🔍",
  Progettazione: "📐",
  Sviluppo: "💻",
  Test: "🧪",
  Collaudo: "✅",
  Rilascio: "🚀"
};
