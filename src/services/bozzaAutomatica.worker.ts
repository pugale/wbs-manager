import { serializzaProgetto, type ProgettoCaricato } from "./projectService";

type Richiesta = {
  id: number;
  progetto: ProgettoCaricato;
};

type Risposta = {
  id: number;
  contenuto?: string;
  errore?: string;
};

const scope = globalThis as typeof globalThis & {
  onmessage: ((evento: MessageEvent<Richiesta>) => void) | null;
  postMessage: (messaggio: Risposta) => void;
};

scope.onmessage = (evento) => {
  try {
    scope.postMessage({
      id: evento.data.id,
      contenuto: serializzaProgetto(evento.data.progetto)
    });
  } catch (errore) {
    scope.postMessage({
      id: evento.data.id,
      errore: errore instanceof Error ? errore.message : String(errore)
    });
  }
};
