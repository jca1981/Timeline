# Timeline

Web-baseret tidslinje-app til bibel-research og slægtsforskning — inspireret af Aeon Timeline's datamodel (reverse-engineeret fra deres dokumentation, jf. REA-metoden). Klonen deler *konceptet*, ikke kode eller UI-grafik.

## Features

- **Dato-motor der duer til virkeligheden**: f.Kr./e.Kr. (astronomisk årstal + Julian Day Numbers), præcise datoer fra årtusinder til sekunder, *inklusive* fortolkning (4–2 f.Kr. = 3 år), usikre datoer med interval, fortsatte poster, relative date-stilarter
- **Fire views**: Ark (spreadsheet CRUD), Tidslinje (zoom ← 5000 år → timer, pan, usikkerheds-haloer), Matrix (typetyper relationer), Inspektør
- **Relationer** (mange-til-mange, navngivne i begge retninger): forælder/barn, profeti/opfyldelse, samtidig med — grundlaget for slægtstræ
- **Bibelvers-links** til jw.org dansk Studiebibel (66 bøger, deep links pr. kapitel + citat-felt)
- **Local-first**: gemmes i browseren (localStorage → IndexedDB senere), JSON eksport-planlagt; statisk webapp, ingen backend

## Kom i gang

```bash
cd app
npm install
npm run dev     # http://localhost:5173
npm test        # 52 tests (dato-motor, skala, bibel, relationer)
npm run build   # statsisk build til dist/
```

## Struktur

| Sti | Indhold |
|---|---|
| `app/src/core/` | Dato-motor (JDN, sync, formatering), tidsskala/zoom, bibel- og relations-hjælpere — test-first |
| `app/src/model/` | Dokumentmodel (poster, typer, relationer, vers-referencer), 66 bibelbøger |
| `app/src/ui/` | SpreadsheetView, TimelineView, MatrixView, Inspector, dato-editorer |
| `research/` | REA-analyse af Aeon Timeline (funktionskort, datamodel-digest, bibel-featurekatalog) |
| `DESIGN.md` | Datamodel + arkitekturbeslutninger |

Projektet er en personlig læringsting; "Aeon" er et varemærke tilhørende Aeon Timeline — kun ideer og datamodel er lånt, ikke kode/grafik.
