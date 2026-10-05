import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  endOfMonth,
  format,
  getDate,
  getDay,
  getMonth,
  getYear,
  isSameDay,
  isToday,
  parseISO,
  startOfMonth,
  subMonths
} from "date-fns";
import { it } from "date-fns/locale";
import { nomeFestivitaItaliana } from "../utils/festivitaItaliane";

type DatePickerProps = {
  label: string;
  value: string | null;
  min?: string | null;
  onChange: (value: string | null) => void;
};

const giorniSettimana = ["L", "M", "M", "G", "V", "S", "D"];

function dataIso(data: Date): string {
  return format(data, "yyyy-MM-dd");
}

export default function DatePicker({ label, value, min, onChange }: DatePickerProps) {
  const valoreData = value ? parseISO(value) : null;
  const dataMinima = min ? parseISO(min) : null;
  const [aperto, setAperto] = useState(false);
  const [meseVisibile, setMeseVisibile] = useState(() =>
    startOfMonth(valoreData && !Number.isNaN(valoreData.getTime()) ? valoreData : new Date())
  );
  const contenitoreRef = useRef<HTMLDivElement>(null);
  const giorni = useMemo(() => {
    const inizio = startOfMonth(meseVisibile);
    const offsetLunedi = (getDay(inizio) + 6) % 7;
    const numeroGiorni = getDate(endOfMonth(meseVisibile));
    return Array.from({ length: offsetLunedi + numeroGiorni }, (_, indice) =>
      indice < offsetLunedi ? null : new Date(getYear(meseVisibile), getMonth(meseVisibile), indice - offsetLunedi + 1)
    );
  }, [meseVisibile]);

  useEffect(() => {
    if (!aperto) return;
    const chiudiFuori = (event: PointerEvent) => {
      if (!contenitoreRef.current?.contains(event.target as Node)) setAperto(false);
    };
    const chiudiConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAperto(false);
    };
    document.addEventListener("pointerdown", chiudiFuori);
    document.addEventListener("keydown", chiudiConEscape);
    return () => {
      document.removeEventListener("pointerdown", chiudiFuori);
      document.removeEventListener("keydown", chiudiConEscape);
    };
  }, [aperto]);

  return (
    <div className="date-picker" ref={contenitoreRef}>
      <button
        className="date-picker__trigger"
        type="button"
        aria-label={`${label}: ${valoreData ? format(valoreData, "d MMMM yyyy", { locale: it }) : "nessuna data"}`}
        aria-haspopup="dialog"
        aria-expanded={aperto}
        onClick={() => {
          if (!aperto && valoreData && !Number.isNaN(valoreData.getTime())) {
            setMeseVisibile(startOfMonth(valoreData));
          }
          setAperto((attuale) => !attuale);
        }}
      >
        <span>{valoreData && !Number.isNaN(valoreData.getTime()) ? format(valoreData, "dd/MM/yyyy") : "Seleziona una data"}</span>
        <span aria-hidden="true">▦</span>
      </button>

      {aperto && (
        <div className="date-picker__calendar" role="dialog" aria-label={`Calendario ${label}`}>
          <div className="date-picker__navigation">
            <button type="button" aria-label="Mese precedente" onClick={() => setMeseVisibile((mese) => subMonths(mese, 1))}>
              ‹
            </button>
            <strong>{format(meseVisibile, "MMMM yyyy", { locale: it })}</strong>
            <button type="button" aria-label="Mese successivo" onClick={() => setMeseVisibile((mese) => addMonths(mese, 1))}>
              ›
            </button>
          </div>
          <div className="date-picker__grid">
            {giorniSettimana.map((giorno, indice) => (
              <span className="date-picker__weekday" key={`${giorno}-${indice}`}>
                {giorno}
              </span>
            ))}
            {giorni.map((giorno, indice) => {
              if (!giorno) return <span className="date-picker__empty" key={`vuoto-${indice}`} />;

              const festivita = nomeFestivitaItaliana(giorno);
              const fineSettimana = getDay(giorno) === 0 || getDay(giorno) === 6;
              const disabilitato =
                dataMinima !== null &&
                !Number.isNaN(dataMinima.getTime()) &&
                dataIso(giorno) < dataIso(dataMinima);
              const className = [
                "date-picker__day",
                (fineSettimana || festivita) && "date-picker__day--holiday",
                isToday(giorno) && "date-picker__day--today",
                valoreData && !Number.isNaN(valoreData.getTime()) && isSameDay(giorno, valoreData) && "is-selected"
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  className={className}
                  type="button"
                  key={dataIso(giorno)}
                  aria-label={`${format(giorno, "d MMMM yyyy", { locale: it })}${festivita ? `, ${festivita}` : fineSettimana ? ", fine settimana" : ""}`}
                  aria-pressed={Boolean(valoreData && !Number.isNaN(valoreData.getTime()) && isSameDay(giorno, valoreData))}
                  title={festivita ?? (fineSettimana ? "Fine settimana" : undefined)}
                  disabled={disabilitato}
                  onClick={() => {
                    onChange(dataIso(giorno));
                    setAperto(false);
                  }}
                >
                  {getDate(giorno)}
                </button>
              );
            })}
          </div>
          <div className="date-picker__actions">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setAperto(false);
              }}
            >
              Cancella
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(dataIso(new Date()));
                setMeseVisibile(startOfMonth(new Date()));
                setAperto(false);
              }}
            >
              Oggi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
