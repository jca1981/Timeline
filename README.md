# Timeline

Web-baseret tidslinje-app til bibel-research og slægtsforskning — inspireret af Aeon Timeline's datamodel (reverse-engineeret fra deres dokumentation, jf. REA-metoden). Klonen deler *konceptet*, ikke kode eller UI-grafik.

## Features

- **Dato-motor der duer til virkeligheden**: f.Kr./e.Kr. (astronomisk årstal + Julian Day Numbers), præcise datoer fra årtusinder til sekunder, *inklusive* fortolkning (4–2 f.Kr. = 3 år), usikre datoer med interval, fortsatte poster, relative date-stilarter
- **Alle views**: Ark (spreadsheet CRUD), Tidslinje (zoom ← årtusinder → timer, pan, usikkerheds-haloer, æra-bånd, minimap), Subway (metro-linjer pr. forælder/tag/type), Fortælling (outline), Slægtstræ, Personer, Sammenlign, Matrix (relationer) + Inspektør
- **Relationer** (mange-til-mange, navngivne i begge retninger): forælder/barn, profeti/opfyldelse, samtidig med — grundlaget for slægtstræ
- **Bibelvers-links** til jw.org dansk Studiebibel (66 bøger, deep links pr. kapitel + citat-felt)
- **Import af .aeon-filer** (Aeon Timeline 3 / 3.5, filVersion 7 og 15): poster, datoer (også f.Kr.), hierarki, relationer, tags, kilder + citationer og billeder
- **Kilder som data**: kilde-bibliotek, typen primær/sekundær/tertiær, troværdighed 1–5, [n]-citater i eksport
- **Local-first**: gemmes i browseren (IndexedDB, flere dokumenter), JSON-import/eksport, backup/restore inkl. billeder, undo/redo, PWA offline — statisk webapp uden backend: https://jca1981.github.io/Timeline/

## Kom i gang

```bash
cd app
npm install
npm run dev     # http://localhost:5173
npm test        # 227 tests (pr. 2026-10-29 — dato-motor, tidsskala, relationer, personer, .aeon-import, farver)
npm run lint    # oxlint --deny-warnings (hard port: ingen advarsler kommer forbi)
npm run build   # statisk build til dist/ (tsc -b checker types som en del af build)
```

## Struktur

| Sti | Indhold |
|---|---|
| `app/src/core/` | Dato-motor (JDN, sync, formatering), tidsskala/zoom, bibel- og relations-hjælpere — test-first |
| `app/src/model/` | Dokumentmodel (poster, typer, relationer, vers-referencer), 66 bibelbøger |
| `app/src/ui/` | Alle views (Ark, Tidslinje, Matrix, Subway, Fortælling, Slægtstræ, Personer, Sammenlign, Inspektør, EditorBar, FilterBar) |
| `app/testdata/` | Committet fixture: JSON-blokken fra den virkelige .aeon-fil (så CI tester format-drift) |
| `app/tools/make-fixture.mjs` | Genskriver fixtureen fra en ægte .aeon-fil |
| `research/` | REA-analyse af Aeon Timeline (funktionskort, datamodel-digest, bibel-featurekatalog) |
| `DESIGN.md` | Datamodel + arkitekturbeslutninger |

Projektet er en personlig læringsting; "Aeon" er et varemærke tilhørende Aeon Timeline — kun ideer og datamodel er lånt, ikke kode/grafik.
