import json
f = "Tidslinie-Historien Til nu.aeon"
data = open(f, "rb").read()
end = data.rfind(b'"fileVersion":7}') + len(b'}')
# balancér baglæns (se bort fra strenge)
depth = 0; instr = False; esc = False; start = None
i = end - 1
while i >= 0:
    c = data[i]
    if instr:
        if esc: esc = False
        elif c == 0x5c: esc = True
        elif c == 0x22: instr = False
    else:
        if c == 0x22: instr = True
        elif c == 0x7d: depth += 1
        elif c == 0x7b:
            depth -= 1
            if depth == 0: start = i; break
    i -= 1
print("JSON:", start, "->", end, "(", end-start, "bytes )")
doc = json.loads(data[start:end])
print("topkeys:", list(doc.keys()))
def walk(d, path="", depth=0):
    if depth > 2: return
    if isinstance(d, dict):
        for k, v in list(d.items())[:14]:
            t = type(v).__name__
            n = len(v) if isinstance(v, (dict, list, str)) else v
            print("  " * depth, path + "/" + k, t, n if isinstance(v, (dict, list)) else "")
            if isinstance(v, dict): walk(v, path + "/" + k, depth + 1)
walk(doc)
