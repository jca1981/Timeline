import json, re, collections, sys

raw = open("Tidslinie-Historien Til nu.aeon", "rb").read()
print("filesize", len(raw))

# find JSON blob start: either {"definitions" or {"fileVersion"
starts = [m.start() for m in re.finditer(rb'\{"(definitions|fileVersion)"', raw)]
print("json starts:", starts[:5], "…", starts[-3:] if len(starts) > 5 else "")

def parse_at(i):
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
                return json.loads(raw[i:j+1].decode("utf-8")), j
    return None, -1

for s in starts:
    doc, end = parse_at(s)
    if doc:
        print("parsed at", s, "end", end, "top keys", list(doc.keys()))
        break

def walk(o, path="", out=None):
    if out is None: out = collections.Counter()
    if isinstance(o, dict):
        for k, v in o.items():
            out[path + "." + k] += 1
            walk(v, path + "." + k, out)
    elif isinstance(o, list):
        for v in o[:3]:
            walk(v, path + "[]", out)
    return out

print("--- definitions keys ---")
defs = doc.get("definitions") or (doc.get("core", {}).get("definitions")) or {}
print(list(defs.keys()))
for name, container in defs.items():
    byid = container.get("byId") if isinstance(container, dict) else None
    if isinstance(byid, dict) and byid:
        k0 = next(iter(byid.values()))
        print(" ", name, "n=", len(byid), "fields=", list(k0.keys()))
        if name != "colors":
            for kk, vv in list(byid.items())[:6]:
                print("     ", kk, "->", {a: b for a, b in vv.items() if a != "id"})

data = doc.get("data") or (doc.get("core", {}).get("data")) or {}
print("--- data keys ---", list(data.keys()))
items = (data.get("items") or {}).get("byId") or data.get("itemsById") or {}
print("items n=", len(items))
kc = collections.Counter()
for it in items.values():
    for k in it: kc[k] += 1
print("item field counts:", dict(kc))
sample = list(items.values())[0]
print("sample item:", json.dumps(sample, ensure_ascii=False)[:900])

# anywhere with http / source / url / citation
txt = json.dumps(doc, ensure_ascii=False)
for pat in ["http://", "https://", "ource", "itation", "webpage", "url", "URL"]:
    print(pat, txt.count(pat))
m = re.findall(r'https?://[^"]{0,80}', txt)
print("url samples:", m[:10])
keys = set(re.findall(r'"(\w*(?:[Ss]ource|[Rr]eferen|[Cc]itat|[Uu]rl|[Ww]eb|[Ll]ink|[Nn]ote)\w*)"', txt))
print("matching keys:", sorted(keys))
