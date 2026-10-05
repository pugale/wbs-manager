import { useWbsStore } from "../store/wbsStore";
import { deserializzaTaskCsv, serializzaTaskCsv } from "./csvProgetto";

function scaricaNelBrowser(nome: string, contenuto: string): void {
  const url = URL.createObjectURL(new Blob([contenuto], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function selezionaCsvNelBrowser(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        resolve(await file.text());
      } catch (errore) {
        reject(errore);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function esportaTaskCsv(): Promise<void> {
  const stato = useWbsStore.getState();
  const contenuto = serializzaTaskCsv(stato.nodes, stato.edges);
  const nomeSuggerito = `${stato.nomeProgetto} - Task`;
  if (window.electronAPI) {
    await window.electronAPI.salvaCsv({ contenuto, nomeSuggerito });
    return;
  }
  scaricaNelBrowser(`${nomeSuggerito.replace(/[\\/:*?"<>|]/g, "_")}.csv`, contenuto);
}

export async function importaTaskCsv(): Promise<number> {
  const risultato = window.electronAPI
    ? await window.electronAPI.apriCsv()
    : await selezionaCsvNelBrowser();
  if (!risultato) return 0;
  const contenuto = typeof risultato === "string" ? risultato : risultato.contenuto;
  const task = deserializzaTaskCsv(contenuto);
  useWbsStore.getState().importaTask(task);
  return task.length;
}
