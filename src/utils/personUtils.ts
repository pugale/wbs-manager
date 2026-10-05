// Iniziali: "Alessandro Puglisi" -> "AP", "Mario" -> "M"
export function iniziali(nome: string): string {
  const parti = nome.trim().split(/\s+/).filter(Boolean);
  if (parti.length === 0) return "?";
  const prima = parti[0][0];
  const ultima = parti.length > 1 ? parti[parti.length - 1][0] : "";
  return (prima + ultima).toUpperCase();
}

// Lo stesso nome produce sempre lo stesso colore
export function coloreDaNome(nome: string): string {
  let hash = 0;
  for (const c of nome.trim().toLowerCase()) {
    hash = (hash * 31 + c.charCodeAt(0)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 55%, 45%)`;
}

// Nomi già usati: senza doppioni, senza vuoti, in ordine alfabetico
export function elencoResponsabili(nomi: (string | undefined)[]): string[] {
  const puliti = nomi.map((n) => (n ?? "").trim()).filter(Boolean);
  return [...new Set(puliti)].sort((a, b) => a.localeCompare(b, "it"));
}
