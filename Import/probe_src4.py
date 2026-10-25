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

# hvor ligger link-records? soeg paa et kendt link-id i hele documentet
target = "9349D16D-A357-43E1-9F52-528CBE6E9525"
def find(o, path="", hits=None):
    if hits is None: hits = []
    if isinstance(o, dict):
        for k, v in o.items():
            if v == target or k == target: hits.append(path + "." + k)
            find(v, path + "." + str(k), hits)
    elif isinstance(o, list):
        for n, v in enumerate(o):
            if v == target: hits.append(f"{path}[{n}]")
            find(v, f"{path}[{n}]", hits)
    return hits
print("link-id forekomster:", find(doc)[:10])

def paths_of(o, pred, path="", hits=None):
    if hits is None: hits = []
    if isinstance(o, dict):
        for k, v in o.items():
            if pred(k, v): hits.append((path + "." + k, v))
            paths_of(v, pred, path + "." + str(k), hits)
    elif isinstance(o, list):
        for n, v in enumerate(o):
            paths_of(v, pred, f"{path}[{n}]", hits)
    return hits

u = paths_of(doc, lambda k, v: isinstance(v, str) and v.startswith("https://"))
print("http-strenge:", len(u))
for p, v in u[:8]: print("  ", p, "=", v[:90])

# userCreatedLinks?
ulk = paths_of(doc, lambda k, v: "ink" in str(k) and isinstance(v, (list, dict)))
c = collections.Counter(p.rpartition(".")[2] for p, v in ulk)
print("link-nøgle-forekomster:", dict(c))
for p, v in ulk:
    if "userCreated" in p:
        print("  USERLINK", p, json.dumps(v, ensure_ascii=False)[:300]); break

# items med links: hvaeder link-objektet ud? print faelte felt-navne via attachment/links
for it in items.values():
    if it.get("links"):
        print("item med links:", it["label"][:40], "links=", json.dumps(it["links"], ensure_ascii=False)[:120], "locationUri=", str(it.get("locationUri"))[:120])
        break

# notes-indhold (cilater som faei tekst?)
notes = [(it["label"], it["propertyValues"].get("notes", "")) for it in items.values() if (it.get("propertyValues") or {}).get("notes")]
print("poster med notes:", len(notes))
for lab, n in notes[:6]: print("  ", lab[:30], "::", str(n)[:200].replace("\n", " / "))

# kilde-poster: har de notes/links/beloeb?
for it in items.values():
    if it["type"] == "1BF14654-D815-4B9D-AE9A-F4E256A1034A" or it["type"] == "source":
        print("KILDE:", it["displayId"], it["label"][:40], "| summary=", str(it.get("summary"))[:80], "| notes=", str((it.get("propertyValues") or {}).get("notes"))[:120], "| startDate=", json.dumps(it.get("startDate"), ensure_ascii=False)[:80])
