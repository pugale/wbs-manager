export function coloreAvanzamento(percentuale: number): string {
  if (percentuale <= 0) return "#dc2626";
  if (percentuale < 50) return "#f97316";
  if (percentuale < 100) return "#eab308";
  return "#16a34a";
}
