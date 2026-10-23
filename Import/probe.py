import sys
f = "Tidslinie-Historien Til nu.aeon"
data = open(f, "rb").read()
print("size", len(data))
for sig in [b"SQLite format 3", b"PK\x03\x04", b"\x1f\x8b", b"BM", b"\x00\x00\x00"]:
    i = data.find(sig)
    print(repr(sig), i)
i = data.find(b"IEND")
print("IEND at", i, "næste byte:", data[i+4:i+68])
