import json, collections

raw = open("Tidslinie-Historien Til nu.aeon", "rb").read()
i = raw.index(b'{"definitions"')
d=0;instr=False;esc=False
for j in range(i, len(raw)):
    c=raw[j]
    if instr:
        if esc: esc=False
        elif c==0x5c: esc=True
        elif c==0x22: instr=False
        continue
    if c==0x22: instr=True
    elif c==0x7b: d+=1
    elif c==0x7d:
        d-=1
        if d==0: doc=json.loads(raw[i:j+1].decode("utf-8")); break

items = doc["data"]["items"]["byId"]
refs_def = doc["definitions"]["references"]["byId"]
types = doc["definitions"]["types"]["byId"]

# find et item hvor references ikke er tom
ex = [it for it in items.values() if it.get("references")]
print("poster med references:", len(ex))
print("sample references:", json.dumps(ex[0]["references"][:4], ensure_ascii=False)[:700])
exl = [it for it in items.values() if it.get("links")]
print("poster med links:", len(exl))
if exl: print("sample links:", json.dumps(exl[0]["links"][:3], ensure_ascii=False)[:500])
exp = [it for it in items.values() if it.get("propertyValues")]
print("poster med propertyValues:", len(exp))
if exp: print("sample pv:", json.dumps(exp[0]["propertyValues"], ensure_ascii=False)[:600])

# relationshipsById / data.relationships shape
rels = doc["data"].get("relationships")
if isinstance(rels, dict): rels = rels.get("byId", {})
rl = list(rels.values()) if isinstance(rels, dict) else list(rels)
print("relationships n=", len(rl))
print("sample rel:", json.dumps(rl[:3], ensure_ascii=False)[:400])
cnt = collections.Counter(r.get("reference") for r in rl)
for rid, n in cnt.most_common():
    rd = refs_def.get(rid, {})
    print(f"  {n:5d} {rid:40s} key={rd.get('key')} label={rd.get('label')}")

# source-typer
src_ref_ids = [rid for rid, rd in refs_def.items() if "source" in str(rd.get("label","")).lower() or "source" in str(rd.get("key","")).lower()]
print("source ref ids:", src_ref_ids)
tgt_types = set()
for rid in src_ref_ids: tgt_types |= set(refs_def[rid].get("types") or [])
print("maal-typer for source refs:", [(t, types.get(t,{}).get("label")) for t in tgt_types])

# poster af de typer (selve kilderne)
src_items = [it for it in items.values() if it["type"] in tgt_types]
print("kilde-poster:", len(src_items))
for it in src_items[:6]:
    print("  ", it["displayId"], "|", it["label"][:60], "| refs:", json.dumps(it.get("references"), ensure_ascii=False)[:200])
    print("      pv:", json.dumps(it.get("propertyValues"), ensure_ascii=False)[:300])
    print("      links:", json.dumps(it.get("links"), ensure_ascii=False)[:200])

# hvem refererer til kilder (counts)
src_ids = {it["id"] for it in src_items}
citing = collections.Counter()
for r in rl:
    if r.get("object") in src_ids or r.get("subject") in src_ids:
        citing[r.get("reference")] += 1
print("relationer ind/ud af kilde-poster:", dict(citing))

# labels paa kilde-poster: ser de som 'bog titel'?
print("=== alle kilde-post labels ===")
for it in src_items[:25]:
    print("   ", it["displayId"], it["label"][:70], "| super:", (items.get(it["super"]) or {}).get("label") if it.get("super") else None)
