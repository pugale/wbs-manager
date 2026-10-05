const MESSAGGIO_SOLO_DESKTOP = "La generazione del report PDF è disponibile solo nell'app desktop.";

export async function generaReportPdf(nomeProgetto: string): Promise<string | null> {
  if (!window.electronAPI) throw new Error(MESSAGGIO_SOLO_DESKTOP);
  return window.electronAPI.generaReportPdf({ nomeSuggerito: `${nomeProgetto} - Report` });
}
