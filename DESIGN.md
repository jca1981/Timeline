# DESIGN — Aeon Clone (web)

Web-tidslinje-app, local-first, bibel-research + slægtstræer som first-class borgere.
Datamodellen er reverse-engineeret fra Aeon Timeline's dokumentation (se `research/FUNKTIONSKORT.md`).

## Principper
1. **Local-first**: IndexedDB som primær lager; eksport/import = én JSON-fil (delbar). Ingen backend/konto i v1. Statisk deploy (Pages/Vercel).
2. **Dato-motoren er fundamentet** — bygges og testes først, alt andet er views ovenpå.
3. **Alt er Items** (Aeon-princip). Slægt = relationstype, ikke speciel-kode.

## Datamodel (TypeScript)

```ts
type Id = string; // crypto.randomUUID()

// ---- Dato-motor ----
// Internt: astronomisk årstal (1 f.Kr. = 0, 2 f.Kr. = -1). Sammenlign/zoom via JDN (Julian Day Number, float).
type Precision = 'year' | 'month' | 'day' | 'time';

interface DateValue {
  y: number; mo?: number; d?: number; h?: number; mi?: number; s?: number;
  precision: Precision;
}

interface Span {
  start?: DateValue;        // uden dato = tidlig (chronology-order styrer)
  end?: DateValue;          // holdes sync med duration
  duration?: Duration;      // {y?,mo?,d?,h?,mi?,s?}
  ongoing?: boolean;        // "XX – Present"
  uncertain?: {             // usikre datoer (bibel-kronologi!)
    latestStart?: DateValue; earliestEnd?: DateValue;
  };
}

type DateStyle =
  | { kind: 'absolute' }                                     // f.Kr./e.Kr.
  | { kind: 'relative'; unit: 'day'|'week'|'time'; zero?: DateValue }; // Day 0, Week 0…

// ---- Items & typer ----
interface ItemType {
  id: Id; name: string; plural: string; color: string; icon?: string;
  isEventish: boolean;   // skal med i kronologisk orden (Event, Task, Prophecy…)
  allowsDates: boolean;
  orderableUnder: Id[];  // hierarki-regler ( hvad kan være parent)
}

interface Item {
  id: Id; typeId: Id; label: string; notes: string;
  color?: string; tags: string[];
  parent?: Id;                        // én parent (Aeon-rule)
  span: Span;                         // tom span for ren entitet
  refs: VerseRef[];                   // KILDER — vores bibel-twist (Aeon har det ikke!)
  attrs: Record<string, string|number|boolean>; // custom felter (fx "konge af Juda")
  chronologicalIndex: number;         // manuel orden for datede-løse events (#-kolonne)
}

interface VerseRef { bookSlug: string; ch: number; vs?: number; vsEnd?: number; quote?: string; }
// bookSlug matcher jw.org-slugs (research/jw-books.json, 66 bøger + forkortelser som "1 Mos.")
// display: "1 Mos 12,1-5" — link-knap: https://www.jw.org/da/bibliotek/bibelen/studiebibel/bøger/{bookSlug}/{ch}/ (åbner i ny fane)
// `quote`: valgfrit manuelt kopieret vers-tekst (offline-citat). Automatisk opslag er IKKE muligt: jw.org er SPA bag AWS WAF/CORS — deep links er designvalget

// ---- Relationer (mange-til-mange, typebare) ----
interface RelationType { id: Id; name: string; reverseName: string; builtIn?: boolean; }
// built-ins: 'parentOf'/'childOf' (slægt!), 'fulfills'/'fulfilledBy' (profeti→opfyldelse),
//            'locatedAt'/'contains' (sted), 'participatedIn' (person→event)
interface Relation { id: Id; fromId: Id; toId: Id; typeId: Id; note?: string; }
// tilsløring: Story Arcs = Relations med arc-entiteter, filterbare

// ---- Dependencies & constraints ----
type DepKind = 'FS'|'FF'|'SS'|'SF';
interface Dependency { id: Id; blockerId: Id; blockedId: Id; kind: DepKind; }
interface Constraint {   // v2 — design plads nu
  id: Id; itemId: Id;
  target: { type: 'fixed'; date: DateValue } | { type: 'item'; itemId: Id; part: 'start'|'end' };
  op: '<'|'<='|'='|'>='|'>';
  offset?: Duration; field: 'start'|'end';
}

// ---- Filtre ----
interface Filter {
  match: 'all'|'any';
  types?: Id[]; tags?: string[]; colors?: string[];
  entityIds?: Id[];   // relation til disse entiteter (fx "Peter")
  dateRange?: [DateValue, DateValue]; text?: string;
}

// ---- Dokument (= en "tidslinje") ----
interface TimelineDoc {
  version: 1; name: string;
  dateStyle: DateStyle; narrativeEnabled: boolean;
  itemTypes: ItemType[]; relationTypes: RelationType[];
  items: Item[]; relations: Relation[]; dependencies: Dependency[]; constraints: Constraint[];
  savedFilters: Record<string, Filter>;
}
```

## Dato-motor — API & regler (Milestone 0)
```
toJDN(d: DateValue): number         // sorterbar, virker fra 4000 f.Kr.
format(d: DateValue, style): string // "24. maj 8 v.Kr." / "Week 3, Monday" / "8 f.Kr. – 30 e.Kr. (~)"
syncSpan(span, change): Span        // start↔duration↔end; afvis neg duration; inclusive-regler:
                                    // start 2021 + 2 år → end 2022 (31 dec); midnat-end → forrige dag 24:00
clampChildren(parent, children)     // parent-range advarsler
ageAt(person, date): string         // "32 år" — brugt i views
```
Test-cases (golden): år 0/1 f.Kr. grænse, skudår, "2021+2år=2022", "jan 2021+2mdr=feb", Day-0 konvertering, usikker-range display `~`.

## Views (MVP → v2)
| Milestone | View | Indhold |
|---|---|---|
| M1 | **Spreadsheet** | tabel CRUD, kolonner pr. type, drag-reorder (= chronologicalIndex) |
| M2 | **Timeline** | SVG, horisontal tidslinje, zoom-levels (årtusinde→år→mdr→dag→tid), bars fra Span, usikker=gradient, ongoing=pil, click→Inspector |
| M3 | **Matrix + Inspector** | relationship-matrix (rækker=events, kolonner=entiteter), inspector-tabs (Details/Dates/Relations), vers-links → jw.org i ny fane |
| M4 | **Filtre + Skabeloner** | filter-panel (global + per view), skabeloner: Bibel-kronologi (f.Kr., usikkerhed til, rige/konge-typer), Bibelske personer |
| M5 (v2) | **Slægtstræ** | afledt af `parentOf`: generation-kolonner, to rødder (Matt/Luk markeret via relation.note), gen-tælling "42 led" |
| v2+ | Subway (spor pr. person/kongerække), Narrative/Outline, Mindmap, split-views, constraints med auto-resolve |

## State & lag
- Zustand store: `TimelineDoc` + selections/filters/ui
- Repo-lag: `idb.get/put(doc)` debounce; `exportJson()/importJson()`; "åbn fil" via File API
- Ingen router i v1 (én app-side med view-switch); doc-vælger = liste i IndexedDB

## Estimeret rækkefølge
M0 dato-motor+tests (~1 aften) → M1 spreadsheet (~1 aften) → M2 timeline zoom (~2 aftener, sværeste UI) → M3 relationer (~1 aften) → M4 filtre+skabeloner (~1 aften) → brug i egen bibel-research → iterér.
