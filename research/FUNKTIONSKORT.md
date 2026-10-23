# Funktionskort — Aeon Timeline (reverse engineering)

Kilde: aeontimeline.com + help.timeline.app (12 hjælpeartikler, se research/*.html).
Metode: REA (Reverse Engineer Anything) — *decompose → understand → recreate*. Vi kan ikke decompile Aeon's native binaries lovligt/praktisk, men deres egen dokumentation afslører hele datamodellen og UI-strukturen — det ER bevisgrundlaget.

---

## 1. Hvad Aeon ER

Betalt desktop-app (Mac/Windows/iOS) til "timeline-software": visuelle tidslinjer hvor **begivenheder** og **entiteter** (personer, steder, genstande, idéer) forbindes. Målgrupper: skønnelitteratur (forfattere), jurister/eforskere, projektledere, undervisere/historikere. Integrationer: Scrivener, Ulysses, eksport/print.

## 2. Datamodelkernen (det vigtigste!)

### Items — én universal tabel
Alle objekter er "items" med en **Item Type**. Typer er konfigurerbare pr. skabelon:
- **Hændelsestyper** (dato-bårne, skal med i kronologien): Event, Backstory, Flashback, Flash-forward, Epic/Story/Task, Fact/Testimony
- **Entitetstyper** (kan have data men er ikke hændelser): Person, Place, Organization, Object, Idea/Theme, Story Arc, Location-grupper

Hvert item har: label, farve, noter, custom attributes (beregnet fra children: fx % færdig = sum af children), tags, parent (valgfri, kun ÉN parent).

### Dato-motoren (Aeons "secret sauce")
- Triad: **start + duration + slut** holdes altid synkron; negative durationer afvises
- **Præcision pr. item**: år/måne/dag/minut/sekund bland frit ("2012 + 3 år" = 2012–2014)
- **Inklusiv fortolkning**: start 2021, varighed 2 år → "2021–2022" (ikke 2023); midnat som slutning vises som forrige dags 24:00
- **Uncertain dates**: 4 felter — tidligste/seneste start + tidligste/seneste slut; vises som gradient ("fuzzy" zone) på tidslinjen, `~` i tekst
- **Ongoing**: checkbox → "XX – Present", tegnes til idag med tonet pil
- **Relative dato-stilarer**: Regular / Weekly (Week 0,1,2…) / Daily (Day 0,1…) / Time — konverterbart frem/tilbage via en "zero date"

### Hierarki
Parent/child (én parent pr. item). Parent-date kan overstyes af children → fejlmarkeres (error bars). Ændres parent-flytter alle children relativt, medmindre child er **låst**. Skabeloner kan vende default (historisk: børn flytter ikke).

### Relationer (mange-til-mange, typebare)
Fx Person↔Event ("medvirkede i"), Place↔Event, Task↔Project. Redigeres i Inspector, Relationship View (matrix-tabel, click i krydsfelt = toggle) eller Mindmap (træk streg). Relationer kan arves fra filtre (auto-tilføj når item oprettes i filtreret visning).

### Dependencies & Constraints
- **Dependencies**: Blocks / Blocked by, 4 typer: Finish→Start, Finish→Finish, Start→Start, Start→Finish. Angiver *rækkefølge*, ikke eksakt timing
- **Constraints**: mere magtfulde — start/end sammenlignet med fast dato ELLER andet item (start/end), operator =, >, ≥, <, ≤, plus **offset** ("A = B + 9 mdr"), delvis dato-match ("A falder på en mandag")
- **Brud-håndtering**: manuel / halv-manuel (Resolve All) / automatisk live-opsløsning (flytter datoer, aldrig durationer; bevarer din seneste ændring). Sikkerhedsgrænse: "må ikke skubbe ting tilbage før idag/i morgen/næste uge"

### To ordrer (genialt design)
1. **Kronologisk orden**: dato-bestemt; alle hændelsestyper er med (også uden dato — manuell rækkefølge). Brugt i Timeline/Spreadsheet/Relationship/Subway-views og af dependencies
2. **Narrativ orden**: opt-in, SEPARAT hierarki (Parts→Chapters→Scenes) + separat rækkefølge. Items kan være i kun den ene, den anden eller begge. Kan slås helt fra. (Løser flashbacks/time travel; jurister bruger den som "retssags-præsentation")

**Story Arcs** = entitetstype som events relationeres til → plot-tråde der kan filtreres og vises som subway-tracks.

### Filtre
Globalt + pr. "focused view" (split views har egne filtre = erstatning for v2's Group By). Match All/Any på farve, type, tags, dato-range, tekst, entiteter, booleans, lister. Gembare filtersæt. Ikke-matchende forældre med matchende børn → tonet.

## 3. Views (7 + split)

| View | Beskrivelse |
|---|---|
| **Timeline** | Horisontal lineær tidsskala, zoom fra sekunder til millionår; events som barer under tidslinjen; drag = reorder/resched |
| **Spreadsheet** | Tabel, hurtig dataentry, column-tilpasning, chronology-kolonnen (#) kan drag-sorteres |
| **Relationship** | Matrix: rækker = events, kolonner = valgte entiteter; krydsfelter toggler relationer |
| **Subway** | Uden tidsskala; events som stations-stop på spor pr. entitet/arc; "Separated" eller "Subway" (krydsninger=fælles events) |
| **Narrative** | Kort-layout af narrativ-hierarki (del→kapitel→scene) |
| **Outline** | Træ-tabel af narrativ orden |
| **Mindmap** | Frieform nodes+kanter, brainstorm |
| **Split** | Vilvillige vinduer side om side, uafhængige filtre, drag imellem views |

## 4. Skabeloner (onboarding)

Fiction/Novel, Screenplay, Legal Case, Project Management (med RACI-matrix), Historical/Genealogy, Education & Research. Skabelonen vælger: item-typer, dato-stil (fx Fiction = Daily relative), narrative on/off, auto-dependency-resolution, tilladte grupperinger.

## 5. UI-skellet

Sidebar (item-typer/entity-lister + views + filtre + arcs + constraints-panel) · Toolbar (view-switch, zoom, split) · Inspector-højre (tabs: Details/Dates/Relationships/Dependencies) · Settings-modal (Date & Narrative, Data Types, Automatic Date Adjustment).

---

## 6. REA → vores rebuild-plan

**Bevis:** alt ovenfor er dokumenteret af leverandøren selv — vi clone'er *konceptet og datamodellen*, ikke binærkoden (REA's egen juridiske ramme: interoperabilitet/learning; UI-kodning skal være vores egen).

### MVP-scope (v1)
1. Item-model + typer (custom typer, farver, noter)
2. Dato-motor: start/duration/end-sync, præcision, ongoing, usikre datoer (4-felt)
3. Timeline-view med zoom (canvas eller DOM), spreadsheet-view
4. Entiteter + relationer (inspector + relationship-matrix)
5. Parent/child-hierarki
6. Dependencies FS (+ de 3 andre typer), brud-varsler
7. Filtre + gemte filtre
8. Skabeloner (Fiction, Project, Historical) + lokal persistence (JSON-fil/IndexedDB)

### Senere (v2+)
Narrativ/Outline-view · Subway · Mindmap · Split-views · Constraints med offset+operatorer · auto-resolution · Scrivener-lignende sync · eksport/print.

### Stack-anbefaling
Web-first: **Vite + React + TypeScript**, tilstand: Zustand, persistence: IndexedDB (local-first) + JSON-import/export. Timeline-rendering: egen SVG/DOM i v1 (boundary med viewport-culling), canvas senere hvis performance kräver det. Se `DESIGN.md` (næste skridt).
