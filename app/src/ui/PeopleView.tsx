// **** Person-visning (M30): alle personer på ét ark - levetid, familie, fødested, kilder ****
// Personer findes ud fra postens type ("Person"/"defaultPerson") eller via familie-relationer.
// Klik på en person åbner inspektøren; klik på en slægtning hopper til den person.
import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { matchesFilter } from '../core/filters';
import { lifespanText, peopleOf, peopleStats, sortPeople, type PeopleSort } from '../core/people';
import { DateValueEditor } from './DateFields';
import type { Item } from '../model/doc';

const SORTS: Array<{ id: PeopleSort; label: string; title: string }> = [
  { id: 'levetid', label: 'levetid', title: 'Fødselsår – ukendte sidst' },
  { id: 'navn', label: 'navn', title: 'Alfabetisk' },
  { id: 'barn', label: 'flest børn', title: 'Slægtstræets rødder først' },
  { id: 'kilde', label: 'flest kilder', title: 'Personer med flest kildehenvisninger først' },
];

/** En række med navne man kan hoppe til. */
function Kin({ list, onPick }: { list: Item[]; onPick: (id: string) => void }) {
  if (!list.length) return <span className="dim">—</span>;
  return (
    <>
      {list.map((it, i) => (
        <span key={it.id}>
          {i > 0 && <span className="dim">, </span>}
          <button className="plink" onClick={() => onPick(it.id)} title={`Åbn ${it.label}`}>{it.label}</button>
        </span>
      ))}
    </>
  );
}

/**
 * Person-overblik: arket viser poster, slægtstræet viser kanter — denne fane viser
 * *menneskerne* på tværs af begge: hvem levede hvornår, hvis børn de er, og hvor godt
 * belagt det er. Godt til at finde huller (personer uden dato, uden slægtninge).
 */
export function PeopleView() {
  const doc = useApp((s) => s.doc);
  const activeFilter = useApp((s) => s.activeFilter);
  const select = useApp((s) => s.select);
  const updateItem = useApp((s) => s.updateItem);
  const selectedId = useApp((s) => s.selectedId);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<PeopleSort>('levetid');
  const [kinOnly, setKinOnly] = useState(false);

  const all = useMemo(() => peopleOf(doc), [doc]);

  const rows = useMemo(() => {
    let r = all;
    if (activeFilter) r = r.filter((row) => matchesFilter(row.item, activeFilter));
    if (kinOnly) r = r.filter((row) => row.children.length || row.parents.length || row.spouses.length);
    const needle = q.trim().toLowerCase();
    if (needle) {
      r = r.filter((row) =>
        [row.item.label, ...row.parents.map((p) => p.label), ...row.children.map((c) => c.label), ...row.spouses.map((s) => s.label), ...row.places.map((p) => p.label)]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      );
    }
    return sortPeople(r, sort);
  }, [all, activeFilter, kinOnly, q, sort]);

  const stats = peopleStats(all);

  return (
    <div className="people">
      <div className="toolbar">
        <input value={q} placeholder="Søg navn / slægtning / sted…" onChange={(e) => setQ(e.target.value)} />
        {SORTS.map((s) => (
          <button key={s.id} className={sort === s.id ? 'primary' : ''} title={s.title} onClick={() => setSort(s.id)}>{s.label}</button>
        ))}
        <button
          className={kinOnly ? 'primary' : ''}
          title="Skjul personer uden forældre, børn eller ægtefælle"
          onClick={() => setKinOnly((v) => !v)}
        >kun med slægt</button>
        <span className="count">
          {all.length} personer · {stats.dated} med dato · {stats.families} med børn · {stats.cited} med kilder
          {stats.lonely ? ` · ${stats.lonely} uden slægtninge` : ''}
        </span>
      </div>

      {all.length === 0 && (
        <p className="dim">
          Ingen person-typer i dokumentet. Opret en type der hedder <b>Person</b> (eller knyt poster sammen med
          Forælder-relationer), så dukker de op her.
        </p>
      )}
      {all.length > 0 && rows.length === 0 && <p className="dim">Ingen personer matcher søgningen/filtret.</p>}

      {rows.length > 0 && (
        <table className="sheet">
          <thead>
            <tr>
              <th>Person</th>
              <th>Levetid</th>
              <th>Forældre</th>
              <th>Børn</th>
              <th>Ægtefælle</th>
              <th>Steder</th>
              <th title="Kilder knyttet til personen selv">Kilder</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.item.id} className={r.item.id === selectedId ? 'sel' : undefined}>
                <td>
                  <button
                    className={r.item.id === selectedId ? 'pname on' : 'pname'}
                    style={r.color ? { borderLeft: `4px solid ${r.color}` } : undefined}
                    onClick={() => select(r.item.id)}
                    title={r.item.notes || r.item.label}
                  >{r.item.label}</button>
                  <span className="dim"> {r.typeName}</span>
                </td>
                <td className="life" title={lifespanText(r) || 'ukendt'}>
                  {/* issue #18: vælg levetid direkte her (valgfri) - skrives til personens eget span */}
                  <span className="life-edit">
                    <label title="Fødselsdato (valgfri)">f.{' '}<DateValueEditor value={r.item.span.start} onChange={(v) => updateItem(r.item.id, { span: { ...r.item.span, start: v } })} /></label>
                    <label title="Dødsdato (valgfri)">d.{' '}<DateValueEditor value={r.item.span.end} onChange={(v) => updateItem(r.item.id, { span: { ...r.item.span, end: v } })} /></label>
                  </span>
                </td>
                <td><Kin list={r.parents} onPick={select} /></td>
                <td><Kin list={r.children} onPick={select} /></td>
                <td><Kin list={r.spouses} onPick={select} /></td>
                <td><Kin list={r.places} onPick={select} /></td>
                <td className={r.cites ? 'cited' : 'dim'}>{r.cites || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
