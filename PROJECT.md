# Aeon Clone

**Status:** I gang | **Startet:** 2026-10-23 | **Sidst rørt:** 2026-07-10

## Hvorfor
Aeon Timeline (https://www.aeontimeline.com/) er en flot, men dyr/lukket desktop-app til visuelle tidslinjer — forfattere, jurister, projektledere. Jeg vil eje min egen version: web-baseret, local-first, uden licens.projekt. Kan potentielt fuse med life-org (min personlige livs-tidslinje).

## Ide / scope
Web-app (ikke desktop-app!) med visuelle tidslinjer til alle formål — men min primære use-case er **bibel-research** (begivenheder, personer, profetier→opfyldelser, parallelle kongerækker) og **slægtstræer** (fx Jesus' slægtslinje fra Matt 1 / Luk 3, automatisk afledt af person-items). Local-first i browseren, ingen konto/backend i v1.

## Nøglefeatures (ønsket)
- [x] Item-model med konfigurerbare typer (events + entiteter), farver, noter, tags
- [x] Dato-motor: start/duration/end always-in-sync, præcision (år→sekund), ongoing, usikre datoer (tidligste/seneste-start/slut), **f.Kr./e.Kr. + årtusinder (JDN-internt)**
- [x] Timeline-view med zoom (sekunder ↔ årtusinder)
- [x] Spreadsheet-view (hurtig entry, drag-reorder)
- [x] Entiteter + typebare relationer (Relationship Matrix-view)
- [x] `parentOf` relationstype → alder ved begivenheder automatisk; slægtstræ-view (v2)
- [x] Vers-referencer pr. item + deep links til **jw.org dansk Studiebibel** (NYE VERDEN) — Åbn-i-ny-fane pr. kapitel, valgfrit citat-felt
- [x] Parent/child-hierarki (parent-range advarsler)
- [x] Dependencies (Blocks/Blocked by, FS/FF/SS/SF) + brud-varsel
- [x] Filtre (global + per view), gemte filtre
- [x] Skabeloner: **Bibel-kronologi**, **Bibelske personer**, Historisk, Projekt
- [x] Lokal persistence (JSON i IndexedDB, import/export), statisk webapp (GitHub Pages/Vercel)

v2+: narrativ/outline-view, mindmap, split-views, constraints med operatorer+offset, auto-resolution af dependency-brud.

## Teknologi / platform
Web-first: Vite + React + TypeScript + Zustand. Local-first: IndexedDB + JSON-fil, deployes som statisk webapp. Timeline-rendering: SVG/DOM først (viewport-culling), canvas hvis det kniber. Datoer: eget date-lag (astronomisk årstal, JDN til sammenligning/zoom) — JS Date duer ikke til f.Kr.

## Næste skridt
- [x] Research: funktionskort + datamodel kortlagt (se `research/FUNKTIONSKORT.md`)
- [x] Bibel-/slægt-featurekatalog (se `research/BIBEL-FEATURES.md`)
- [x] Skriv `DESIGN.md`: TypeScript-datamodel (Item, ItemType, BibleDate, Relationship inkl. parentOf, Dependency) + MVP-views
- [x] Scaffold Vite+React+TS i `aeon-clone/app/`
- [x] Milestone 0: dato-motor inkl. f.Kr. + tests — 27/27 grønne (JDN, præcision, usikre, f.Kr., sync, relativ-stilarter)
- [x] Milestone 1: spreadsheet-view CRUD (CRUD + dato-editorer m. f.Kr.-knap, demo-indhold, localStorage)
- [x] Milestone 2: timeline-view med zoom (årtusinder ↔ tid; trin-stige-ticks, gradient-usrikkerhed, fortsat-pil, culling — 40/40 tests grønne)
- [x] Milestone 3: entiteter/relationer (parentOf, vers-ref) + matrix — 52/52 tests grønne (relationer, slægtskæder, jw.org-links, inspektør, matrix)
- [x] Import af .aeon-filer (Aeon Timeline 3): format reverse-engineeret (se `research/AEON-FORMAT.md`), "Importer .aeon"-knap — 59/59 tests grønne inkl. den virkelige fil (361 poster, 77 forælder-relationer)
- [x] Milestone 4: dependencies + filtre + bibel-skabeloner – 80/80 tests grønne (deps-konflikt, type/tag/dato/tekst-filtre, gemte filtre, skabelon-dropdown, SVG-pile i timeline)
- [x] Milestone 5: hierarki + persistence + tags – 89/89 tests grønne (parent-range advarsler, træ-sortering, IndexedDB, JSON import/export, tags-editor, forælder-vælger i inspektør)
- [x] Milestone 6: subway-view + drag-reorder – 89/89 tests grønne (metro-linjer pr. forælder/tag/type, zoom/pan, stationer som cirkler, træk-og-slip i spreadsheet "Manuel"-tilstand)
- [x] Milestone 7: profeti→opfyldelse-buer – 91/91 tests grønne (gyldne SVG-buer i timeline, tværspor-buer i subway, `fulfillmentArcs()`-helper, berigede skabeloner med tags+parentId+fulfillment-relationer)
- [x] Milestone 8: matrix drill-down + tag-filtre + GitHub Pages deploy – 91/91 tests grønne
- [x] Milestone 9: Narrativ/outline-visning + multi-doc profiler – 91/91 tests grønne
- [x] Milestone 10: Undo/Redo + PWA offline – 97/97 tests grønne
- [ ] Milestone 11 (v2): collab editing (CRDT/WebSocket), preset-profiler, version snapshots

## Noter & beslutninger
- 2026-07-10: **M11 færdig**: Billeder fra .aeon (binær image-index parser: [idLen|fnameLen|id|filename|offset|size]), IndexedDB billedbutik (DB v3), upload/fjern i Inspector, 🖼-indikatorer i timeline/ark/fortælling. Bedre tidslinje-count (daterede vs. dato-løse). Nye filer: `core/images.ts`, `ui/ItemImage.tsx`.
- 2026-07-10: **M10 færdig**: Undo/Redo (snapshot-stack, max 50, Ctrl+Z/Shift+Z). PWA: manifest.json + service worker (cache-first). 97 tests. Nye filer: `core/history.ts`, `public/sw.js`, `public/manifest.json`, `public/icon.svg`.
- 2026-07-10: **M9 færdig**: NarrativView (læsevenlig outline med erasektioner, opfyldelses-annotater, tags, vers-referencer, noter). Multi-doc: DocumentBar (Gem som / Nyt / Skift / Slet) via IndexedDB multi-store. Nye filer: `NarrativeView.tsx`, `DocumentBar.tsx`.
- 2026-07-10: **M8 færdig**: MatrixView drill-down (klik på ● → detaljekort med note, “fjern relation”, alle rel. for paret). FilterBar tag-chips. Deploy: GitHub Actions → Pages (`base: '/Timeline/'`). URL: https://jca1981.github.io/Timeline/. `npm run deploy` bygger + pusher.
- 2026-07-10: **M7 færdig**: Profeti→Opfyldelse-buer (gyldne buer i timeline SVG, tværspor-buer i subway). `fulfillmentArcs()`-core-helper. Berigede skabeloner: tags, parentId-hierarki, `rt-fulfillment`-relationer i begge skabeloner.
- 2026-07-10: **M6 færdig**: SubwayView (metro-kort: X=tid, Y=spor, gruppering pr. forælder/tag/type, farvet palet, zoom/pan). Drag-reorder i spreadsheet (sortMode "Manuel", HTML5 drag/drop, ≡-håndtag). Nye filer: `ui/SubwayView.tsx`.
- 2026-07-10: **M5 færdig**: Parent/child-hierarki med range-advarsler (barn starter/slutter før/efter forælder), træ-sortering i spreadsheet (🌲-knap), IndexedDB-persistence (med localStorage fallback), JSON import/export-knap, tags-editor i inspektør, forælder-dropdown. Nye filer: `core/hierarchy.ts`, `core/persist.ts`.
- 2026-07-10: **M4 færdig**: Dependencies (FS/FF/SS/SF) med brud-varsel i inspektør + SVG-pile i timeline; filter-bar (type, tag, dato-ramge, tekst, gemte filtre); skabelon-dropdown ("Bibel-kronologi" + "Bibelske personer"). Nye filer: `core/dependencies.ts`, `core/filters.ts`, `ui/FilterBar.tsx`, `model/templates.ts`.
- 2026-10-23: **.aeon-format (filVersion 7)** = billeder + rå JSON (`{"definitions":...}`) + binær footer-index. era: 0=f.Kr., 1=e.Kr.; precision: -1=ingen, 2=dag. Relationer: `{subject, reference, object}` = "subjects X er object" (parentRef vendes om i import). Import: `src/core/aeonImport.ts`. Store filer holdes ude af git (`Import/*.aeon`).
- 2026-10-23: **GitHub: https://github.com/jca1981/Timeline** (deploy key `~/.ssh/github_timeline_deploy`).
- 2026-10-23: **Bibelkilde = jw.org dansk Studiebibel (NYE VERDEN)** i stedet for bible-api.com (jensa's valg). Tekst kan ikke hentes automatisk (SPA + AWS WAF) → deep links pr. kapitel + manuelt citat-felt. Slug-mapping: `research/jw-books.json`.
- 2026-10-23: **Web-app i stedet for desktop** (jensa's valg). Primært use-case = **bibel-research** + **slægtstræ** (Jesus' slægtslinje) → featurekatalog i `research/BIBEL-FEATURES.md`.
- 2026-10-23: REA-metoden (eigent.ai blog) = decompose→understand→recreate med bevis for hver konklusion. Aeon er native app; vi reverse-engineerer via deres egen veldokumenterede datamodel (help.timeline.app) — lovligt og mere præcist end binær-analysis her.
- 2026-10-23: Aeon's "secret sauce" er dato-motoren (præcision, inklusiv-fortolkning, usikre datoer, relative date-styles) og de TO ORDRER (kronologisk vs narrativ). Det skal designes ordentligt FØR UI.
- 2026-10-23: Overvej fusion med life-org — livsområde som "Historical/Genealogy"-skabelon i samme app.
- 2026-10-23: Undgå at klone UI-grafik/kode direkte — kun koncept + datamodel (ophavsret på kode/UI, ikke ideer).

## Links / inspiration
- https://www.aeontimeline.com/ (produkt)
- https://help.timeline.app/ (datamodel-dokumentation — guldgrube)
- https://www.eigent.ai/blog/rea-reverse-engineer-anything (metode)
- `research/FUNKTIONSKORT.md` (kompledt funktionskort med beviser)
- `research/BIBEL-FEATURES.md` (bibel-research + slægtstræ-ideer)
- https://www.jw.org/da/bibliotek/bibelen/studiebibel/b%C3%B8ger/ (bibelkilde — dansk, Nye Verden)
- `research/jw-books.json` (alle 66 bøger: jw.org-slugs + forkortelser)
- https://bible-api.com (bruges IKKE — kun som evt. senere ekstra oversættelse)
- `research/*.html` (rå cachede kilder: forside, feature sider, 12 help-artikler i help-digest.md)
