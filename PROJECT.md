# Aeon Clone

**Status:** Planlagt | **Startet:** 2026-10-23 | **Sidst rørt:** 2026-10-23

## Hvorfor
Aeon Timeline (https://www.aeontimeline.com/) er en flot, men dyr/lukket desktop-app til visuelle tidslinjer — forfattere, jurister, projektledere. Jeg vil eje min egen version: web-baseret, local-first, uden licens.projekt. Kan potentielt fuse med life-org (min personlige livs-tidslinje).

## Ide / scope
Web-app (ikke desktop-app!) med visuelle tidslinjer til alle formål — men min primære use-case er **bibel-research** (begivenheder, personer, profetier→opfyldelser, parallelle kongerækker) og **slægtstræer** (fx Jesus' slægtslinje fra Matt 1 / Luk 3, automatisk afledt af person-items). Local-first i browseren, ingen konto/backend i v1.

## Nøglefeatures (ønsket)
- [ ] Item-model med konfigurerbare typer (events + entiteter), farver, noter, tags
- [ ] Dato-motor: start/duration/end always-in-sync, præcision (år→sekund), ongoing, usikre datoer (tidligste/seneste-start/slut), **f.Kr./e.Kr. + årtusinder (JDN-internt)**
- [ ] Timeline-view med zoom (sekunder ↔ årtusinder)
- [ ] Spreadsheet-view (hurtig entry, drag-reorder)
- [ ] Entiteter + typebare relationer (Relationship Matrix-view)
- [ ] `parentOf` relationstype → alder ved begivenheder automatisk; slægtstræ-view (v2)
- [ ] Vers-referencer pr. item + deep links til **jw.org dansk Studiebibel** (NYE VERDEN) — Åbn-i-ny-fane pr. kapitel, valgfrit citat-felt
- [ ] Parent/child-hierarki (parent-range advarsler)
- [ ] Dependencies (Blocks/Blocked by, FS/FF/SS/SF) + brud-varsel
- [ ] Filtre (global + per view), gemte filtre
- [ ] Skabeloner: **Bibel-kronologi**, **Bibelske personer**, Historisk, Projekt
- [ ] Lokal persistence (JSON i IndexedDB, import/export), statisk webapp (GitHub Pages/Vercel)

v2+: narrativ/outline-view, subway-view, mindmap, split-views, constraints med operatorer+offset, auto-resolution af dependency-brud.

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
- [ ] Milestone 3: entiteter/relationer (parentOf, vers-ref) + matrix
- [ ] Milestone 4: dependencies + filtre + bibel-skabeloner
- [ ] Milestone 5 (v2): slægtstræ-view, subway-spor, profeti→opfyldelse-buer

## Noter & beslutninger
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
