import json, re
f = "Tidslinie-Historien Til nu.aeon"
data = open(f, "rb").read()
end = data.rfind(b'"fileVersion":7}') + 1
blob_end = data.find(b'\x00', end)
print("json-slut:", blob_end, repr(data[end:end+8]))
# find kandidater '{' i interval
starts = [m.start() for m in re.finditer(rb"\{\"", data[25_090_000:25_300_000])]
starts = [s + 25_090_000 for s in starts]
print("kandidater:", len(starts), starts[:5], starts[-5:])
for s in reversed(starts):
    try:
        doc = json.loads(data[s:blob_end])
        print("PARSER OK ved", s, "keys:", list(doc.keys())[:10])
        break
    except Exception as e:
        continue
else:
    print("ingen kandidate virkede — første keys around start af tail:")
    print(repr(data[blob_end-60:blob_end]))
