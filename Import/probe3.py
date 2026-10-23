f = "Tidslinie-Historien Til nu.aeon"
data = open(f, "rb").read()
print("--- sidste 512 bytes ---")
print(data[-512:].hex())
import re
# JSON blob: find first { efter sidste image-sektion
i = data.find(b'"data":{"items"')
# gå tilbage til start af stor JSON: find '{"' ved at scanke tilbage til usynlig grænse; i stedet findalle top-niveau '{' kandidate
j = data.rfind(b'{"', 0, i)  # tidl. fund
# find starten: search for b'{"' near start of the tail area backwards until match with balance
# simple: balancér fra en candidt start
start = data.rfind(b'{', 0, i-100000)
print("kandidat start", start, data[start:start+80])
