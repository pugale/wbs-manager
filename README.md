# WBS Manager

Applicazione desktop per gestire una WBS in modo grafico: task trascinabili,
collegati da frecce, salvati in un archivio ZIP `.wbsm` per progetto. I file JSON
creati dalle versioni precedenti restano apribili e modificabili.
All'avvio una schermata introduttiva mostra l'identità grafica dell'app mentre il grafo viene preparato.
Il menu **Aiuto** include il manuale operativo HTML e i contatti dell'autore.

Tecnologie: Electron · React · TypeScript · Vite · React Flow (@xyflow/react) · Zustand · date-fns

---

## 1. Prerequisiti

- **Node.js 22 LTS** (minimo 20.19) → https://nodejs.org
- **Visual Studio Code** → https://code.visualstudio.com
- Git (facoltativo)

Verifica da terminale:

```bash
node -v
npm -v
```

## 2. Primo avvio

1. Estrai lo zip in una cartella (es. `C:\Progetti\wbs-manager`).
   Evita cartelle sincronizzate con OneDrive: `node_modules` contiene migliaia di file.
2. In VS Code: **File → Apri cartella…** e scegli `wbs-manager`.
3. Accetta l'installazione delle estensioni consigliate (Prettier, Error Lens, GitLens).
4. Apri il terminale (**Terminale → Nuovo terminale**) ed esegui:

```bash
npm install
npm run dev
```

Si aprono il server Vite e la finestra dell'app. Le modifiche al codice React
si vedono subito, senza riavviare. Chiudendo la finestra si ferma anche Vite.

## 3. Comandi

| Comando             | Cosa fa                                                       |
| ------------------- | ------------------------------------------------------------- |
| `npm run dev`       | Avvia l'app in sviluppo (Vite + Electron con DevTools)         |
| `npm run typecheck` | Controlla gli errori TypeScript senza compilare               |
| `npm test`          | Esegue i test automatici                                     |
| `npm run build`     | Controllo TypeScript + build dell'interfaccia in `dist/`      |
| `npm start`         | Build e avvio dell'app come sarà installata (senza DevTools)  |
| `npm run dist`      | Crea installer e pacchetto portabile Windows in `release/` e `release-portable/` |

Debug del processo Electron: in VS Code premi **F5**
("Debug Electron (processo main)"). Vite parte in automatico.

## 4. Come si usa

- **+ Nuovo task**: aggiunge un task in alto a sinistra sulla lavagna.
- **Aiuto → Manuale operativo**: apre la guida completa all'utilizzo dell'applicazione.
- **Aiuto → Alessandro Puglisi**: apre il client di posta all'indirizzo alessandro.puglisi@eng.it.
- **Collegare due task**: trascina dal pallino destro di un task al pallino sinistro di un altro.
- **Stile delle frecce**: nella vista Grafo scegli **Curve**, **Rette** o **Angoli** dal menu
  **Frecce**. La scelta vale per tutti i collegamenti del progetto ed è salvata nel file JSON.
- **Eliminare** un task o una freccia: selezionalo e premi `Canc`.
- **Modificare un task**: cliccalo e usa il pannello a destra.
- **Salvataggio**: `Ctrl+S` salva, `Ctrl+Shift+S` salva con nome, `Ctrl+O` apre, `Ctrl+N` nuovo.
  La cartella predefinita è `Documenti\WBS Manager`.
- **Versioni**: nel menu **Versioni** definisci la baseline `1.0`, poi crea snapshot numerati
  (`1.1`, `1.2`...) solo quando richiesto. Puoi confrontare due snapshot e ripristinarne uno
  come nuova versione. Il file `.wbsm` contiene il progetto corrente, `manifest.json`,
  `versioni/indice.json` e tutti gli snapshot, nominati in base alla versione
  (per esempio `versioni/versione_1_1.json`); i file `.json` legacy si possono aprire e
  convertire con **Salva con nome**.
  La versione di lavoro o le modifiche successive all'ultimo snapshot sono indicate accanto
  al nome del progetto.
- I comandi sono raggruppati nei menu a tendina **Progetto**, **Modifica**, **Visualizza**,
  **Filtri** e **Report** a sinistra; **Versioni**, **Filtri**, **Report** e **Aiuto** sono
  a destra, dopo **+ Nuovo task**. I menu si chiudono
  automaticamente dopo 3 secondi quando il focus
  o il puntatore si spostano fuori dal menu.
- Se ci sono modifiche non salvate, prima di aprire o creare un progetto puoi salvarle,
  scartarle o annullare l'operazione. Una bozza viene salvata automaticamente e proposta
  al successivo avvio in caso di recupero; viene conservata localmente in IndexedDB.
- **Annulla/Ripeti**: `Ctrl+Z` e `Ctrl+Y` (oppure `Ctrl+Shift+Z`) conservano fino a 50
  operazioni recenti.
- Usa **Filtri** nella barra superiore per cercare titolo, descrizione o responsabile e filtrare
  per avanzamento o ritardo. Nel menu **Visualizza** trovi grafo, Gantt e vista Risorse. Nel Gantt
  puoi scegliere la scala giornaliera, settimanale o mensile; la linea rossa indica la data odierna.
  Se un task è selezionato, puoi modificare direttamente **data inizio, data fine e avanzamento (%)**
  dal pannello inline, aperto con la matita accanto al titolo e chiudibile con **×**. Puoi trascinare
  la barra per spostare il task o i bordi per modificarne inizio e fine. I controlli **+**, **−** e
  **Fit view** regolano lo zoom della timeline. Accanto al titolo sono mostrate le iniziali del
  responsabile; passandoci sopra compare il nome completo.
- **CSV**: Esporta CSV salva task e dipendenze in UTF-8 con separatore `;`, così il file è
  compatibile con Excel configurato in italiano. Importa CSV aggiunge i task al progetto aperto;
  non sostituisce quelli già presenti. Le dipendenze tra le righe importate vengono ricreate.
  Per l'importazione usa la stessa struttura del CSV esportato: tutte le intestazioni devono
  essere presenti nello stesso ordine e ogni riga deve avere tutte le colonne.
- **Preparare un CSV da importare**:
  1. Parti dal CSV esportato, oppure mantieni le stesse intestazioni e lo stesso ordine.
     Salva il file come testo **CSV UTF-8**; le intestazioni non distinguono maiuscole/minuscole.
  2. Usa `;` per separare le colonne. Racchiudi tra virgolette doppie i campi con `;`, virgolette
     o ritorni a capo; rappresenta una virgoletta interna raddoppiandola (`""`).
  3. Ogni riga deve contenere tutte le colonne. `Titolo` deve avere un valore non vuoto; i campi
     facoltativi possono restare vuoti. Se `Tipo` contiene un valore sconosciuto, viene usato
     `Sviluppo`. Le date vuote restano non impostate, mentre l'avanzamento vuoto vale `0`.
  4. Per impostare le dipendenze, compila `ID` e `Predecessori`: ogni ID deve essere univoco
     nel CSV; nella colonna `Predecessori` elenca gli ID dei predecessori separati da `|`.
     Ogni riferimento deve indicare un ID presente nello stesso file. Puoi lasciare vuoti questi
     campi se non devi importare dipendenze.

  Colonne riconosciute:

  | Intestazione | Valore obbligatorio | Valori e formato |
  | --- | --- | --- |
  | `ID` | No | Identificativo univoco nel file, per esempio `T1`. Se vuoto, viene generato automaticamente; è usato per risolvere i predecessori. |
  | `Titolo` | **Sì** | Testo non vuoto. |
  | `Tipo` | No | Uno dei valori esatti elencati sotto. Se vuoto o sconosciuto, viene impostato `Sviluppo`. |
  | `Descrizione` | No | Testo libero; può contenere separatori, virgolette e ritorni a capo se racchiuso tra virgolette doppie. |
  | `Responsabile` | No | Nome libero della persona assegnata. |
  | `Data inizio` | No | Data nel formato `yyyy-MM-dd`, per esempio `2026-10-05`. |
  | `Data fine` | No | Data nel formato `yyyy-MM-dd`, uguale o successiva alla data di inizio. |
  | `Giorni lavorativi` | No | Nell'esportazione è il totale calcolato da data inizio e data fine (lun-ven, estremi inclusi); nell'importazione viene ignorato e ricalcolato dalle date. |
  | `Avanzamento (%)` | No | Numero intero da `0` a `100`, senza `%`; se vuoto vale `0`. |
  | `Predecessori` | No | Uno o più ID definiti nella colonna `ID`, separati da `|`, per esempio `T1|T2`. |

  Valori ammessi per **Tipo** (scritti esattamente così):
  `Principale`, `Analisi`, `Progettazione`, `Sviluppo`, `Test`, `Collaudo`, `Rilascio`.

  Esempio completo:

  ```csv
  ID;Titolo;Tipo;Descrizione;Responsabile;Data inizio;Data fine;Giorni lavorativi;Avanzamento (%);Predecessori
  T1;Analisi requisiti;Analisi;Raccolta dei requisiti;Ada Lovelace;2026-10-05;2026-10-09;5;100;
  T2;Progettazione;Progettazione;Definizione della soluzione;Ada Lovelace;2026-10-12;2026-10-16;5;25;T1
  T3;Sviluppo;Sviluppo;Implementazione;Grace Hopper;2026-10-19;2026-10-30;10;0;T2
  T4;Verifica finale;Test;Test di accettazione;;;;;0;T3
  ```

  In `T4` le date sono vuote: i campi vuoti si rappresentano lasciando consecutivi i separatori.
  L'importazione rifiuta titoli vuoti, ID duplicati, date non valide o invertite, avanzamenti
  fuori intervallo e predecessori inesistenti, duplicati o che creano cicli. Tutte le righe sono
  controllate prima di aggiungere i task, così un CSV non valido non lascia un'importazione
  parziale.
- **Risorse**: la vista Risorse riepiloga task assegnati, giorni lavorativi pianificati,
  picco di task simultanei e intervalli sovrapposti per responsabile. Le sovrapposizioni sono
  informative e non indicano da sole un sovraccarico: l'app non definisce una capacità giornaliera.
- **Report → Genera report PDF** crea un PDF A4 orizzontale e chiede dove salvarlo. Include il
  riepilogo con percentuale media di avanzamento, il diagramma Gantt con scala temporale
  adattiva, task con durata in giorni lavorativi e carico delle risorse.
- **Report → Esporta vista JPG** salva come immagine la vista attualmente selezionata:
  grafo, Gantt o Risorse.
- Le dipendenze duplicate, circolari e verso sé stessi vengono rifiutate.
- Nella cartella `esempi` trovi un progetto di prova da aprire con **Apri**.

Segnali visivi:

- Bordo rosso + "In ritardo": data fine passata e task non completato.
- Freccia rossa animata: il task successivo inizia prima che finisca il precedente.

## 5. Struttura del progetto

```text
wbs-manager
├── .vscode/              Impostazioni, estensioni consigliate, debug (F5)
├── build/                Icona Windows per Electron e l'installer (icon.ico)
├── electron/
│   ├── main.js           Finestra, dialoghi Apri/Salva, scrittura file
│   └── preload.cjs       Ponte sicuro tra Electron e React
├── public/               Risorse dell'interfaccia e manuale operativo HTML
│   ├── icon.svg
│   └── manuale.html
├── esempi/               Progetto JSON di esempio
├── src/
│   ├── components/       Toolbar, GanttView, ResourceView, report, nodi e pannello proprietà
│   ├── models/           Tipi: task e formato del file progetto
│   ├── services/         Progetti, CSV, bozza automatica, esportazione e comandi
│   ├── store/            Stato dell'app (Zustand)
│   ├── types/            Tipi delle funzioni esposte da Electron
│   ├── utils/            Date, dipendenze, carico risorse, filtri e colori
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── electron-builder.json Configurazione installer Windows
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 6. Formato del file progetto

```json
{
  "versione": 5,
  "id": "…",
  "nome": "SARA - Evolutiva CUDE",
  "tipoFreccia": "bezier",
  "nodes": [
    {
      "id": "t1",
      "position": { "x": 0, "y": 120 },
      "data": {
        "titolo": "Analisi requisiti",
        "descrizione": "",
        "responsabile": "Alessandro Puglisi",
        "dataInizio": "2026-10-05",
        "dataFine": "2026-10-16",
        "percentuale": 60,
        "stato": "In corso"
      }
    }
  ],
  "edges": [{ "id": "e-t1-t2", "source": "t1", "target": "t2" }]
}
```

Le date sono salvate come `yyyy-MM-dd`, senza fuso orario.
All'apertura i campi mancanti o errati prendono un valore di default.
`tipoFreccia` può valere `bezier` (curve), `straight` (rette) o `step` (angoli).
Nei progetti precedenti il valore predefinito è `bezier`.

## 7. Problemi frequenti

- **`npm install` lento o bloccato su Electron**: Electron scarica circa 100 MB alla prima installazione.
  Dietro proxy aziendale imposta `npm config set proxy …` e `npm config set https-proxy …`.
- **Porta 5173 occupata**: chiudi l'altra istanza di `npm run dev`.
- **Windows SmartScreen blocca l'installer**: l'eseguibile non è firmato digitalmente.
  Scegli "Ulteriori informazioni → Esegui comunque" oppure firma l'app con un certificato aziendale.
- **Pagina bianca dopo `npm start`**: controlla che `base: "./"` sia presente in `vite.config.ts`.
