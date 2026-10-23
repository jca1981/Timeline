# Bibel- & slægtslinje-features (produkt-ideer)

Hvad gør vores version særlig god til **bibel-research + slægt** (ud over standard Aeon-features):

## Dato-motoren tilpasses Bibelen
- **f.Kr./e.Kr. (BC/AD)** understøttelse helt ned i årtusinder — JS's indbyggede Date dugter ikke; brug astronomisk årstal (1 f.Kr. = år 0) + Julian Day Numbers internt for sammenligning/zoom. Vores skala: 4000 f.Kr. → nutid uden problemer.
- **Usikre datoer som standard**: bibelkronologi er omstridt (Ussher 4004 f.Kr. vs. moderne forskning) — 4-felt usikkerhed (tidligste/seneste start/slut) er perfekt; to forsknings-traditioner kan vises som gradienter over hinanden.
- **Relative datoer**: "3. år af Josjias' regering", "480 år efter Israel gik ud af Egypten" (1 Kong 6,1) — date-style "år regeret fra begivenhed" (fx Skabelsen / Udfarten / Babylons fald som zero-events).
- **Parallelle tidslinjer**: Israels/Judas konger samtidigt, dynastier, profeters virkeperioders som spor i Subway-view → sammenlign parallelt (Aejon's subway-fit er perfekt til "kongerækker over for profeter").

## Kilder som førsteklasses data
- **Vers-referencer pr. item**: felt `references` (fx "1 Mos 12,1-5; Gal 3,16"), multiple pr. item.
- **JW.org Studiebibel (dansk, Nye Verden) er vores bibelkilde** (i stedet for bible-api.com):
  - Pr. kapitel-URL er rent og stabilt: `https://www.jw.org/da/bibliotek/bibelen/studiebibel/bøger/<slug>/<kapitel>/` — alle 66 bøger + forkortelser ekstraheret til `research/jw-books.json` (fx `1-mosebog`, `1 Mos.`)
  - Link-knap pr. reference åbner kapitlet i ny fane. Vers-tekst kan IKKE hentes automatisk (client-renderet SPA bag AWS WAF + CORS) — det er OK: deep links er stabile, lovligt og respecterer jw.org
  - **Citat-felt pr. item**: brugeren kan selv kopiere vers-tekst fra jw.org ind i feltet (offline-citat, privat brug) — valgfrihelper-knap "Åbn jw.org" gør det 2 klik
  - Vers-forankring dybere end kapitel er ikke dokumenteret på jw.org → vi linker til kapitlet og husker versnummeret i vores ref
- **Tillid/kildekritik**: attribut "kilde" (bibelsk, Josefus, arkæologisk, tradition) med farvkodning af events.

## Profetier & mønstre
- Relations-forudindstillinger: **"profeti → opfyldelse"** (link event A til begivenhed B), **"type/modell"**, **"citat fra"**. Gør profetiers opfyldelse visuelt som buer/grænser på tidslinjen.
- **Tema-tracks** (opfylder Aeon's Story Arc-koncept): lørdige temaer som "Forbund", "Exodus-tema", "Davides trone" som arcs man filtrerer på.

## Slægtstræ (Jesus' slægtslinje use-case)
- `parentOf` er indbygget relationstype mellem Person-items → **slægtstræ vises automatisk** afledt af data (ingen separat "family tree app").
- **To linjer mod Jesus**: Matt 1 (Salomo-linjen via Jakob→Josef) og Luk 3 (Natan-linjen via Eli→Josef) — grafen tåler naturally at Josef har to fædre i træet; vis kilden (Mattias/Lukas) som relationstype-note.
- **Generation-tælling**: "42 led" (Matt 1,17) automatisk; marker generation-niveauer i træ-visning.
- **Alder ved begivenhed**: Person med fødato → alder vises automatisk på events (Aeon gør dette; "hvor gammel var Josef da Jesus var 12?").
- **Levetid-bjælker**: livstider som ongoing bars på tidslinjen under personens spor — konger/regeringsår = født/regeringsslut.
- Slægtstræ-view (generations-kolonner, klik på node → inspector) = **v2-milepæl**, men datastrukturen (`parentOf`) designes fra start.

## Skabeloner vi vil have
1. **Bibel-kronologi** (f.Kr.-datoer, usikkerhed til, parallelle spor for riger/konger, tema-arcs)
2. **Bibelske personer** (Person-typer med faddernavn, referencer; slægtstræ klar)
3. Generisk: Historisk research, Personligt livslinje (fusion med life-org), Fiktion, Projekter

## Vigtigt for web-valget
- Statisk webapp (build → GitHub Pages/Vercel/egen server), **local-first**: IndexedDB + JSON-fil eksport/import (kan dele tidslinjer som fil). Ingen konto i v1.
- Deling af tidslinje: JSON-fil eller skrivebeskyttet visning via URL (base64-i-hash) som nem win senere.
