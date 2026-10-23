import zlib, struct
f = "Tidslinie-Historien Til nu.aeon"
data = open(f, "rb").read()

# 1) walk PNG chunks from start
def walk_png(off, label):
    if data[off:off+8] != b"\x89PNG\r\n\x1a\n":
        print(label, "ikke PNG ved", off); return None
    p = off + 8
    while p + 8 <= len(data):
        ln = struct.unpack(">I", data[p:p+4])[0]
        typ = data[p+4:p+8]
        p += 8 + ln + 4
        if typ == b"IEND":
            return p
    return None

off = 0
n = 0
while off is not None and n < 20:
    end = walk_png(off, f"png{n}")
    n += 1
    print(f"png{n-1} slutter ved {end}, næste bytes:", data[end:end+16] if end else None)
    # find næste PNG-magic efter this
    off = data.find(b"\x89PNG\r\n\x1a\n", end) if end is not None else None

# 2) search for interesting markers anywhere
for sig in [b"SQLite", b'{"', b"items", b"timeline", b"aeon", b"Aeon"]:
    i = data.rfind(sig)
    print(repr(sig), "sidste forekomst:", i, data[max(0,i-16):i+48] if i>0 else b"")
