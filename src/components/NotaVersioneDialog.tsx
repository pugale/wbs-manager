import { useState, type FormEvent } from "react";

type Props = {
  titolo: string;
  notaIniziale: string;
  onConferma: (nota: string) => void;
  onAnnulla: () => void;
};

export default function NotaVersioneDialog({
  titolo,
  notaIniziale,
  onConferma,
  onAnnulla
}: Props) {
  const [nota, setNota] = useState(notaIniziale);

  const invia = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onConferma(nota);
  };

  return (
    <div
      className="version-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onAnnulla();
      }}
    >
      <form
        className="version-dialog version-note-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-note-title"
        onSubmit={invia}
      >
        <h2 id="version-note-title">{titolo}</h2>
        <label className="field">
          Nota (facoltativa)
          <textarea
            autoFocus
            rows={3}
            value={nota}
            onChange={(event) => setNota(event.target.value)}
            placeholder="Descrivi questa versione"
          />
        </label>
        <div className="version-note-dialog__actions">
          <button type="button" className="btn" onClick={onAnnulla}>
            Annulla
          </button>
          <button type="submit" className="btn btn--primary">
            Salva versione
          </button>
        </div>
      </form>
    </div>
  );
}
