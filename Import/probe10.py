import json
data = open("Tidslinie-Historien Til nu.aeon","rb").read()
doc = json.loads(data[25282857:data.find(b'\x00', data.rfind(b'"fileVersion":7}')+1)])
lbl = {i["id"]: i["label"] for i in doc["data"]["items"]["byId"].values()}
rel = list(doc["data"]["relationships"]["byId"].values())
par = [r for r in rel if r["reference"] == "parentRef"]
print("parentRef:", len(par))
# kendt par: Jesus / Maria? David/Solomon?
for r in par:
    s, o = lbl.get(r["subject"],"?"), lbl.get(r["object"],"?")
    if any(k in s for k in ["Jesus","Salomo","Kong"]) or any(k in o for k in ["Jesus","Salomo"]):
        print("SUBJ:", s[:30], "-> OBJ:", o[:30])
print("---alle first 8---")
for r in par[:8]: print(lbl.get(r["subject"],"?")[:25], "->", lbl.get(r["object"],"?")[:25])
# hvilke reference-typer bruges faktisk
import collections
c = collections.Counter(r["reference"] for r in rel)
print(c)
refs = doc["definitions"]["references"]["byId"]
print({k: (refs[k].get("label"), refs[k].get("inverseLabel")) for k in c if k in refs})
