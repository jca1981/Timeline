import json, collections
data = open("Tidslinie-Historien Til nu.aeon","rb").read()
doc = json.loads(data[25282857:data.find(b'\x00', data.rfind(b'"fileVersion":7}')+1)])
its = list(doc["data"]["items"]["byId"].values())

# era & precision fordeling
eras = collections.Counter((i["startDate"] or {}).get("era") for i in its)
prec = collections.Counter((i["startDate"] or {}).get("precision") for i in its)
print("era:", eras, "precision:", prec)
# BC-eksempel
for i in its:
    sd = i["startDate"]
    if sd and sd.get("era") == 1:
        print("BC-ex:", i["label"][:40], json.dumps(sd)); break
# usikre eksempler
for i in its:
    if i.get("latestStartDate") or i.get("durationToEarliestEnd"):
        print("Usikker:", i["label"][:30], "latest:", i.get("latestStartDate"), "d2ee:", i.get("durationToEarliestEnd")); break
# ongoing
for i in its:
    if i.get("ongoing"): print("Ongoing:", i["label"][:30]); break
# typer
print("types:", {k: v["label"] for k,v in doc["definitions"]["types"]["byId"].items() if v.get("enabled")})
# references (relationstyper)
refs = doc["definitions"]["references"]["byId"]
print("refs:", {k: (v.get("label"), v.get("inverseLabel")) for k,v in list(refs.items())[:8]})
# farver
cols = doc["definitions"]["colors"]
print("colors type:", type(cols), str(cols)[:200])
# notes/summary + links + locationUri
n = sum(1 for i in its if i.get("summary")); print("med summary:", n)
print("med references:", sum(1 for i in its if i.get("references")))
print("med super:", sum(1 for i in its if i.get("super")))
# notes-felt? kig på keys på en "Jesus" post
for i in its:
    if "Jesus" in (i.get("label") or ""):
        print("JESUS-keys:", sorted(i.keys()))
        print("note-lignende:", {k: v for k,v in i.items() if isinstance(v,str) and len(v)>40})
        break
