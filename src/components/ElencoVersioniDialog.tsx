import type { ArchivioProgetto } from "../models/ProgettoArchivio";

type Props = {
  archivio: ArchivioProgetto;
  onClose: () => void;
  onRipristina: (idVersione: string) => void;
};

export default function ElencoVersioniDialog({ archivio, onClose, onRipristina }: Props) {
  const versioni = archivio.indiceVersioni;

  return (
    <div
      className="version-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="version-dialog version-list-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-list-title"
      >
        <header className="version-dialog__header">
          <div>
            <h2 id="version-list-title">Elenco versioni</h2>
            <p>
              {versioni.length} version{versioni.length === 1 ? "e salvata" : "i salvate"}
            </p>
          </div>
          <button className="btn" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </header>

        {versioni.length === 0 ? (
          <p className="muted">Non sono ancora state salvate versioni.</p>
        ) : (
          <div className="version-dialog__list">
            {versioni.map((versione) => (
              <article className="version-card" key={versione.id}>
                <div>
                  <strong>
                    {versione.versione}
                    {versione.baseline ? " · Baseline" : ""}
                  </strong>
                  <time dateTime={versione.creataIl}>
                    {new Date(versione.creataIl).toLocaleString("it-IT")}
                  </time>
                  <p>{versione.nota || "Nessuna nota"}</p>
                </div>
                <button
                  className="btn"
                  onClick={() => {
                    onClose();
                    onRipristina(versione.id);
                  }}
                >
                  Ripristina come nuova versione
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
