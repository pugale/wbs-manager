import { useState } from "react";
import type { ArchivioProgetto, ModificaVersione } from "../models/ProgettoArchivio";
import { deserializzaProgetto } from "../services/projectService";
import { confrontaProgetti } from "../services/versioniProgetto";

type Props = {
  archivio: ArchivioProgetto;
  onClose: () => void;
  onRipristina: (idVersione: string) => void;
};

export default function VersioniDialog({ archivio, onClose, onRipristina }: Props) {
  const versioni = archivio.indiceVersioni;
  const [idDa, setIdDa] = useState(versioni[0]?.id ?? "");
  const [idA, setIdA] = useState(versioni.at(-1)?.id ?? "");
  const [modifiche, setModifiche] = useState<ModificaVersione[] | null>(null);
  const [errore, setErrore] = useState("");

  const confronta = () => {
    const contenutoDa = archivio.versioni[idDa];
    const contenutoA = archivio.versioni[idA];
    if (!contenutoDa || !contenutoA) {
      setErrore("Non è possibile leggere una delle versioni selezionate.");
      return;
    }
    try {
      setModifiche(
        confrontaProgetti(deserializzaProgetto(contenutoDa), deserializzaProgetto(contenutoA))
      );
      setErrore("");
    } catch (erroreConfronto) {
      setModifiche(null);
      setErrore(
        erroreConfronto instanceof Error ? erroreConfronto.message : String(erroreConfronto)
      );
    }
  };

  const etichetta = (id: string) => {
    const versione = versioni.find((item) => item.id === id);
    return versione ? `${versione.versione}${versione.baseline ? " — Baseline" : ""}` : "";
  };

  return (
    <div className="version-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="version-dialog" role="dialog" aria-modal="true" aria-labelledby="version-title">
        <header className="version-dialog__header">
          <div>
            <h2 id="version-title">Versioni del progetto</h2>
            <p>{versioni.length} version{versioni.length === 1 ? "e salvata" : "i salvate"}</p>
          </div>
          <button className="btn" onClick={onClose} aria-label="Chiudi">×</button>
        </header>

        {versioni.length === 0 ? (
          <p className="muted">Non sono ancora state salvate versioni.</p>
        ) : (
          <>
            <div className="version-dialog__list">
              {versioni.map((versione) => (
                <article className="version-card" key={versione.id}>
                  <div>
                    <strong>{versione.versione}{versione.baseline ? " · Baseline" : ""}</strong>
                    <time dateTime={versione.creataIl}>
                      {new Date(versione.creataIl).toLocaleString("it-IT")}
                    </time>
                    <p>{versione.nota || "Nessuna nota"}</p>
                  </div>
                  <button className="btn" onClick={() => onRipristina(versione.id)}>
                    Ripristina come nuova versione
                  </button>
                </article>
              ))}
            </div>
            {versioni.length > 1 && (
              <section className="version-compare">
                <h3>Confronta versioni</h3>
                <div className="version-compare__controls">
                  <label>
                    Da
                    <select value={idDa} onChange={(event) => setIdDa(event.target.value)}>
                      {versioni.map((versione) => (
                        <option key={versione.id} value={versione.id}>{etichetta(versione.id)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    A
                    <select value={idA} onChange={(event) => setIdA(event.target.value)}>
                      {versioni.map((versione) => (
                        <option key={versione.id} value={versione.id}>{etichetta(versione.id)}</option>
                      ))}
                    </select>
                  </label>
                  <button className="btn btn--primary" onClick={confronta}>Confronta</button>
                </div>
                {errore && <p className="error" role="alert">{errore}</p>}
                {modifiche && (
                  <>
                    <p className="muted">
                      {modifiche.length === 0
                        ? "Nessuna differenza tra le versioni."
                        : `${modifiche.length} differenz${modifiche.length === 1 ? "a" : "e"} trovata${modifiche.length === 1 ? "" : "e"}.`}
                    </p>
                    {modifiche.length > 0 && (
                      <div className="version-compare__table">
                        <table>
                          <thead><tr><th>Attività</th><th>Campo</th><th>Versione {etichetta(idDa)}</th><th>Versione {etichetta(idA)}</th></tr></thead>
                          <tbody>
                            {modifiche.map((modifica, indice) => (
                              <tr key={`${modifica.idTask}-${modifica.campo}-${indice}`}>
                                <td>{modifica.titoloTask}</td>
                                <td>{modifica.campo}</td>
                                <td>{modifica.da}</td>
                                <td>{modifica.a}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}
          </>
        )}
      </section>
    </div>
  );
}
