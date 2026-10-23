import json, collections
data = open("Tidslinie-Historien Til nu.aeon","rb").read()
doc = json.loads(data[25282857:data.find(b'\x00', data.rfind(b'"fileVersion":7}')+1)])
its = list(doc["data"]["items"]["byId"].values())
def fields(sd):
    return tuple(k for k in ["year","month","day","hour","minute","second"] if sd.get(k) not in (None,0))
m = collections.defaultdict(collections.Counter)
for i in its:
    sd = i["startDate"]
    if sd: m[sd["precision"]][fields(sd)] += 1
for p, c in sorted(m.items()): print(p, dict(c))
# usikkerhed-felter
n_latest = sum(1 for i in its if i.get("latestStartDate"))
n_d2ee = sum(1 for i in its if i.get("durationToEarliestEnd"))
n_prefdur = sum(1 for i in its if any(v for v in (i.get("preferredDuration") or {}).values()))
n_dur = sum(1 for i in its if any(v for v in (i.get("duration") or {}).values()))
print("latestStart:", n_latest, "d2ee:", n_d2ee, "prefDuration:", n_prefdur, "duration:", n_dur)
# links / locationUri
lk = [i["links"] for i in its if i.get("links")]
print("links:", lk[:2], "locationUri:", [i["locationUri"] for i in its if i.get("locationUri")][:3])
# super/children eksempel
sup = [i for i in its if i.get("super")]
lbl = {i["id"]: i["label"] for i in its}
print("child->parent:", [(i["label"][:20], lbl.get(i["super"],"")[:20]) for i in sup[:4]])
