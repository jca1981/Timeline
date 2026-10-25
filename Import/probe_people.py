import json, re

P = 'C:/Users/jensa/projects/aeon-clone/Import/Tidslinie-Historien Til nu.aeon'
buf = open(P, 'rb').read()
s = buf.find(b'{"definitions"')
if s < 0:
    s = buf.find(b'{\n  "definitions"')
obj, _end = json.JSONDecoder().raw_decode(buf[s:s + 25_000_000].decode('utf-8', 'replace'))
j = obj
data = j['data']
defs = j['definitions']

items = data['items']['byId']
types = defs['types']['byId']

out = {}
# type labels + counts
cnt = {}
for it in items.values():
    cnt[it['type']] = cnt.get(it['type'], 0) + 1
out['types'] = [(types.get(t, {}).get('label', '?'), t[:12], n) for t, n in sorted(cnt.items(), key=lambda kv: -kv[1])]

# events named like birth/death
birth = re.compile('(f\u00f8dsel|birth|born)', re.I)
death = re.compile('(d\u00f8d|death|died)', re.I)
out['birth_labels'] = [it.get('label', '')[:40] for it in items.values() if birth.search(it.get('label') or '')][:12]
out['death_labels'] = [it.get('label', '')[:40] for it in items.values() if death.search(it.get('label') or '')][:12]
out['n_birth'] = sum(1 for it in items.values() if birth.search(it.get('label') or ''))
out['n_death'] = sum(1 for it in items.values() if death.search(it.get('label') or ''))

# a few person items with their relations
rels = data['relationships']
rels = rels if isinstance(rels, list) else list(rels['byId'].values())
by_subj = {}
for r in rels:
    by_subj.setdefault(r['subject'], []).append(r)
person_type_ids = [t for t in types if 'person' in (types[t].get('label', '') + t).lower()]
sample = []
for it in items.values():
    if it['type'] in person_type_ids:
        sample.append({
            'label': it.get('label'),
            'rels': [(r['reference'], (items.get(r['object']) or {}).get('label')) for r in by_subj.get(it['id'], [])],
            'dates': it.get('startDate'),
        })
out['person_sample'] = sample[:6]
out['n_person'] = sum(1 for it in items.values() if it['type'] in person_type_ids)
# how many persons have a super (parent) chain
out['person_types'] = [(types[t].get('label'), t) for t in person_type_ids]

open('C:/Users/jensa/projects/aeon-clone/.tmp/people_probe.json', 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=True, indent=1))
