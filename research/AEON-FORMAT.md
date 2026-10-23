# .aeon filformat — reverse engineeret (filVersion 7)

Fil: `Import/Tidslinie-Historien Til nu.aeon` (25.958.270 bytes).

## Overordnet struktur
```
[0 … ~25,1 MB]      Billed-blob: PNG- og JPEG-billeder i rau forlængelse
                    (start each med signatur 89 50 4E 47 / FFD8 FFE0 "JFIF")
[~25,28 MB …]       RÅ JSON (ikke komprimeret!) — hele tidslinje-dokumentet
[slutten af JSON]   ..."fileVersion":7}
[...64+ bytes]      Zero-padding + binær footer: index over sektionerne
                    ("timeline3.json", "attachments", "timeline" med offsets/længder)
```
Altså IKKE zip/gzip/sqlite — bare concat af billeder + JSON + footer-index.

## JSON-dokument (start `{"definitions":`)
- `definitions` — `types.byId` (11 posttyper med label/enabled), `references.byId`
  (relationstyper: label + inverseLabel, fx parentRef Parent/Child), `colors.byId`
  (swatchColor), `calendar`, view-indstillinger, `fileVersion: 7`.
- `data.items.byId` — 361 poster:
  - `id` (UUID), `type` (fx defaultEvent/defaultPerson/stateItem/category…),
  - `label`, `summary` (= noter), `color` (color-id), `super`/`children` (hierarki),
  - `ongoing`, `tags` (id'er → `data.tags` map id→navn),
  - `startDate`: `{era, year, month, day, hour…, precision, timestamp, weekday}`
    - **era: 0 = f.Kr. (årstal positivt!), 1 = e.Kr.** → astronomisk: astro = era==0 ? 1-year : year
    - **precision: -1 = ingen dato, 0=år, 1=måned, ≥2=dag, ≥8=time**
  - `duration`: `{years, months, weeks, days, hours, minutes, seconds}`
  - usikkerhed: `latestStartDate`, `durationToEarliestEnd` (ubrugt i denne fil)
- `data.relationships.byId` — `{id, subject, reference, object}` =
  "subjects **<reference>** er object" (fx subject=Jesus, reference=parentRef,
  object=Josef → Josef er Jesu forælder). 77 parentRef, 76 categoryRef, 49
  participantRef, 17 spouseRef, 14 locationRef, 3 birthplaceRef, 2 siblingRef, 39 custom "Source".
- `data.tags` — map tagId → navn; `data.mindmaps` (genericNode-poster, springes over ved import).

## Import i appen
`src/core/aeonImport.ts` — finder JSON-blobben (søgning efter `{"definitions"` /
`{"data"`, parser fra første kandidat der lykkedes op til `}` efter `"fileVersion"`),
mapper til vores `TimelineDoc`. UI-knap "Importer .aeon" i headeren.
Tests: `src/core/aeonImport.test.ts` (syntetisk + den virkelige fil, 7 tests).
