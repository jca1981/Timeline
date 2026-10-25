"""Dump kilde-strukturen fra .aeon til JSON (ASCII-escaped, saa konsollen er sikker)."""
import json, re

FIL = 'Tidslinie-Historien Til nu.aeon'
raw = open(FIL, 'rb').read()
start = raw.find(b'{"definitions"')
blob = raw[start:].decode('utf-8', errors='replace')
j, _end = json.JSONDecoder().raw_decode(blob)

defs = j['definitions']
data = j['data']
out = {}

# 1) alle definitioners toptekster
out['definition_keys'] = sorted(defs.keys())

def label_of(d):
    return (d.get('label') or d.get('name') or '')

# 2) referencer med source/kilde i label eller id
refs = defs['references']['byId'] if 'references' in defs else {}
out['source_refs'] = {k: v for k, v in refs.items()
                      if re.search(r'source|kilde', k + ' ' + json.dumps(v, ensure_ascii=False), re.I)}
out['ref_count'] = len(refs)

# 3) typer der kan vaere kilder
types = defs['types']['byId']
out['source_types'] = {k: v for k, v in types.items()
                       if re.search(r'source|kilde', k + ' ' + json.dumps(v, ensure_ascii=False), re.I)}

# 4) ejenskabs-definitioner (hvad end de hedder i formatet)
for key in defs:
    if 'propert' in key.lower():
        node = defs[key]
        byid = node.get('byId', node) if isinstance(node, dict) else node
        if isinstance(byid, dict):
            out['property_defs_' + key] = {k: v for k, v in list(byid.items())[:40]}

# 5) relationer: fa aske form
rels = data.get('relationships')
if isinstance(rels, dict):
    rels = list(rels.get('byId', {}).values())
out['rel_sample'] = rels[:3]
src_ref_ids = set(out['source_refs'].keys())
out['source_rels'] = [r for r in rels if r.get('reference') in src_ref_ids][:12]
out['source_rel_count'] = len([r for r in rels if r.get('reference') in src_ref_ids])

# 6) poster af kilde-typer
src_type_ids = set(out['source_types'].keys())
items = data['items']['byId'] if 'items' in data else data.get('itemsById', {})
out['source_items'] = {k: v for k, v in items.items() if v.get('type') in src_type_ids}

# 7) ejenskabsvaerdier paa poster (alle, faa forekomster)
pv = {k: v for k, v in items.items() if v.get('propertyValues')}
out['items_with_propertyValues'] = pv

# 8) links + attachments
links = {k: v.get('links') for k, v in items.items() if v.get('links')}
out['items_with_links_count'] = len(links)
out['items_with_links_sample'] = dict(list(links.items())[:6])
att = data.get('attachments', {}).get('byId', {})
if not att:
    att = data.get('attachmentsById', {}) or {}
out['attachment_count'] = len(att)
out['attachment_sample'] = dict(list(att.items())[:4])
#attachments der faktisk er linket fra en post
linked_ids = [i for v in links.values() for i in v]
out['linked_attachments'] = {i: att[i] for i in linked_ids[:8] if i in att}

# 9) hoe mange poster har en source-rel
subj = set(r['subject'] for r in rels if r.get('reference') in src_ref_ids)
out['items_referencing_sources'] = len(subj)

open('src_dump.json', 'w', encoding='utf-8').write(json.dumps(out, indent=1, ensure_ascii=True, sort_keys=True))
print('ok bytes:', len(json.dumps(out)))
