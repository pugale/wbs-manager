export type VersioneProgetto = {
  id: string;
  versione: string;
  nota: string;
  creataIl: string;
  baseline: boolean;
};

export type ManifestProgetto = {
  formato: "wbsm";
  versioneFormato: 1;
  idProgetto: string;
  nomeProgetto: string;
  versioneCorrenteId: string | null;
  baselineId: string | null;
};

export type ArchivioProgetto = {
  manifest: ManifestProgetto;
  indiceVersioni: VersioneProgetto[];
  contenutoCorrente: string;
  versioni: Record<string, string>;
};

export type ModificaVersione = {
  idTask: string;
  titoloTask: string;
  campo: string;
  da: string;
  a: string;
  tipo: "aggiunto" | "rimosso" | "modificato";
};
