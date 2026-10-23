import json
data = open("Tidslinie-Historien Til nu.aeon","rb").read()
doc = json.loads(data[25282857:data.find(b'\x00', data.rfind(b'"fileVersion":7}')+1)])
d = doc["definitions"]; dt = doc["data"]
print("definitions keys:", list(d.keys()))
print("data keys:", list(dt.keys()))
its = dt["items"]["byId"]
print("items:", len(its))
sample = list(its.values())[1]
print(json.dumps(sample, ensure_ascii=False)[:1500])
print("---")
for k in ["itemTypes","types","relations","relationships","tags","groups"]:
    if k in d: print("def", k, str(d[k])[:300])
    if k in dt: print("data", k, str(dt[k])[:300])
