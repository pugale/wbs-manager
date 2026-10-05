import { useWbsStore } from "../store/wbsStore";
import { deserializzaProgetto, serializzaProgetto } from "./projectService";

const MSG_SOLO_DESKTOP = "Questa funzione è disponibile solo nell'app desktop (npm run dev).";

function api(): ElectronAPI {
  if (!window.electronAPI) throw new Error(MSG_SOLO_DESKTOP);
  return window.electronAPI;
}

function mostraErrore(titolo: string, errore: unknown) {
  const dettaglio = errore instanceof Error ? errore.message : String(errore);
  window.alert(`${titolo}\n\n${dettaglio}`);
}

async function confermaPerditaModifiche(): Promise<boolean> {
  if (!useWbsStore.getState().modificato) return true;
  if (!window.electronAPI) {
    return window.confirm("Ci sono modifiche non salvate. Vuoi continuare senza salvare?");
  }
  try {
    const scelta = await api().confermaModificheNonSalvate();
    if (scelta === "salva") return salvaProgetto();
    return scelta === "scarta";
  } catch (errore) {
    mostraErrore("Impossibile confermare la gestione delle modifiche.", errore);
    return false;
  }
}

export async function nuovoProgetto() {
  if (!(await confermaPerditaModifiche())) return;
  useWbsStore.getState().nuovoProgetto();
}

export async function apriProgetto() {
  if (!(await confermaPerditaModifiche())) return;
  try {
    const risultato = await api().apriProgetto();
    if (!risultato) return; // l'utente ha annullato
    const contenuto = risultato.archivio
      ? risultato.archivio.contenutoCorrente
      : risultato.contenuto;
    const progetto = deserializzaProgetto(contenuto);
    useWbsStore.getState().caricaProgetto(progetto, risultato.percorso, false, risultato.archivio);
  } catch (errore) {
    mostraErrore("Impossibile aprire il progetto.", errore);
  }
}

export async function salvaProgetto(conNome = false): Promise<boolean> {
  const s = useWbsStore.getState();
  try {
    const contenuto = serializzaProgetto({
      id: s.progettoId,
      nome: s.nomeProgetto,
      tipoFreccia: s.tipoFreccia,
      nodes: s.nodes,
      edges: s.edges
    });
    const percorsoCorrente = conNome ? null : s.percorsoFile;
    const usaArchivio =
      !percorsoCorrente || percorsoCorrente.toLowerCase().endsWith(".wbsm");
    const risultato = await api().salvaProgetto({
      percorso: percorsoCorrente,
      contenuto,
      nomeSuggerito: s.nomeProgetto,
      archivio: usaArchivio ? s.archivio : null
    });
    if (!risultato) return false;
    useWbsStore.getState().segnaSalvato(risultato.percorso, risultato.archivio);
    return true;
  } catch (errore) {
    mostraErrore("Impossibile salvare il progetto.", errore);
    return false;
  }
}
