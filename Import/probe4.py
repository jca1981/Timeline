import json, struct
f = "Tidslinie-Historien Til nu.aeon"
data = open(f, "rb").read()

# footer-index: find name-length+name entries near EOF
tail = data[-600:]
for name in [b"timeline3.json", b"attachments", b"timeline"]:
    print(name, tail.find(name))

# gæt: JSON starter hvor footer peger (25283369) ELLER find '{' efter sidste image
cands = []
i = 25283369
print("ved 25283369:", data[i-16:i+48])
# find alle PNG/JPEG-slutter tæt på: sidste image-end før JSON
lastimg = 0
p = 0
while True:
    q = data.find(b"IEND", p)
    if q < 0: break
    lastimg = q + 12
    p = q + 4
print("sidste IEND:", lastimg, data[lastimg:lastimg+32])
