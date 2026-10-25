import json, re, collections

raw = open("Tidslinie-Historien Til nu.aeon", "rb").read()
i = raw.index(b'{"definitions"')
d = 0; instr = False; esc = False
for j in range(i, len(raw)):
    c = raw[j]
    if instr:
        if esc: esc = False
        elif c == 0x5c: esc = True
        elif c == 0x22: instr = False
        continue
    if c == 0x22: instr = True
    elif c == 0x7b: d += 1
    elif c == 0x7d:
        d -= 1
        if d == 0:
            doc = json.loads(raw[i:j+1].decode("utf-8")); break

items = doc["data"]["items"]["byId"]
refs_def = doc["definitions"]["references"]["byId"]
props = doc["definitions"]["properties"]["byId"]
types = doc["definitions"]["types"]["byId"]

print("=== reference-typer med 'source' i id/key ===")
for k, v in refs_def.items():
    if "source" in k.lower() or "source" in str(v.get("key","")).lower() or "source" in str(v.get("label","")).lower():
        print(" ", k, "key=", v.get("key"), "label=", v.get("label"), "types=", v.get("types"))

print("=== properties (sourceType / reliability) ===")
for k, v in props.items():
    if str(v.get("key","")).lower() in ("sourcetype","reliability","notes","gender","occupation","shortName","title"):
        allowed = [a["id"] for a in (v.get("allowed") or [])]
        print(" ", v.get("key"), "label=", v.get("label"), "format=", v.get("format"), "allowed=", allowed)

# item field shapes
it0 = next(iter(items.values()))
for f in ("references","inverseReferences","propertyValues","links","attachments","tags"):
    print("=== shape", f, "===")
    print(json.dumps(it0.get(f), ensure_ascii=False)[:400])

used = collections.Counter()
for it in items.values():
    for rid, lst in (it.get("references") or {}).items():
        used[rid] += len(lst) if isinstance(lst, list) else 1
print("=== reference-counts paa poster ===")
for rid, n in used.most_common():
    rd = refs_def.get(rid, {})
    print(f"  {n:5d}  {rid:42s} key={rd.get('key')} label={rd.get('label')}")

print("=== item-typer brugt ===")
tc = collections.Counter(it["type"] for it in items.values())
for t, n in tc.most_common():
    td = types.get(t, {})
    print(f"  {n:5d}  {t:40s} label={td.get('label')} prefix={td.get('identifierPrefix')} refs={td.get('references')}")

# Source-lignende typer: hvilke har sourceRef i sine refs?
src_types = {t for t, td in types.items() if "sourceRef" in (td.get("references") or [])}
print("typer der kan have sourceRef:", len(src_types))

# hvordan ser en source-ref ud: find en post med sourceRef og se maal-postens type
tgt_ids = []
for it in items.values():
    for rid, lst in (it.get("references") or {}).items():
        if "source" in str(refs_def.get(rid, {}).get("key", "")).lower():
            for t in (lst if isinstance(lst, list) else []):
                tgt_ids.append((it["label"][:40], t, items.get(t, {}).get("type"), items.get(t, {}).get("label"), items.get(t, {}).get("displayId")))
print("=== sourceRef-eksempler ===", len(tgt_ids))
for row in tgt_ids[:12]:
    print("  ", row)

print("=== poster med links / userCreatedLinks ===")
cnt = 0
for it in items.values():
    lk = it.get("links")
    if lk:
        cnt += 1
        if cnt <= 4: print("  ", json.dumps(lk, ensure_ascii=False)[:300])
print(" poster med links:", cnt)

print("=== source-typer med egne posters propertyValues ===")
for it in items.values():
    if it["type"] in src_types and it.get("propertyValues"):
        print("  ", it["displayId"], it["label"][:50], json.dumps(it["propertyValues"], ensure_ascii=False)[:400])
        break

# Source-item selv: type label
print("=== propertyValues-keys paa tvaers ===")
pv = collections.Counter()
for it in items.values():
    for k in (it.get("propertyValues") or {}): pv[k] += 1
print(dict(pv))

print("=== notes-innhold hoeve? ===")
n = sum(1 for it in items.values() if (it.get("propertyValues",{}).get("notes") or "").strip())
print("poster med notes:", n)
