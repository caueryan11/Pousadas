"""Agrupa leads A/A+ por zona e monta roteiros de 8 a 10 visitas por dia -> rotas/rotas.md"""
import csv, os, re
BASE = os.path.join(os.path.dirname(__file__), "..")
rows = [r for r in csv.DictReader(open(os.path.join(BASE, "leads/leads.csv"), encoding="utf-8"))
        if r["prioridade"].startswith("A")]

# grupos: só o primeiro ID visita (os demais vão juntos)
grupos = {"FE08": "FE04", "FE14": "FE04", "FE17": "AD19", "FE18": "AD19", "FE19": "AD19", "FE35": "AD19",
          "FE09": "FE36", "GA27": "AD11", "RX66": "IB12", "FE15": "GA19", "FE33": "FE16",
          "RX95": "RX42", "GA62": "GA11"}

ZONAS = [
    ("Z3", "Rosa Sul / Caminho do Rei / Alto do Morro", r"rosa sul|caminho do rei|alto do morro|canto sul|seu man[eé] chico|mirante"),
    ("Z4", "Ibiraquera / Barra de Ibiraquera / Praia do Luz", r"barra de ibiraquera|ibiraquera|praia do luz|ara[cç]atuba|piteira|lagoa de cima"),
    ("Z2", "Rosa Norte / Lagoa do Rosa / Vale", r"rosa norte|lagoa do rosa|vale|pico da tribo|dente de le[aã]o|poncianos"),
    ("Z1", "Rosa Centrinho", r"centr|porto novo|av\. central|fruta do conde|john lennon|praia do rosa|rosa|idalino|aracu[aã]|mogno|estrada geral do rosa|engenho"),
    ("Z5", "Ferrugem / Capão / Praia da Barra / Encantada", r"ferrugem|cap[aã]o|barrinha|praia da barra|encantada|ouvidor|casuarinas|baleias|jardim da lagoa|jardim das flores"),
    ("Z7", "Silveira / Siriú", r"silveira|siri[uú]"),
    ("Z6", "Garopaba Centro / Palhocinha / Morrinhos", r"garopaba|palhocinha|morrinhos|ferraz|vigia|pinguirito|campo d"),
    ("Z8", "Imbituba sede (Vila Nova, Centro, Ribanceira, Itapirubá)", r"vila nova|ribanceira|itapirub|praia da vila|imbituba|arroio"),
]
MANUAL = {"RX58": "Z3", "RX40": "Z2", "RX84": "Z1"}
def zona(r):
    b = (r["bairro"] + " " + r["nome"]).lower()
    pref = r["id"][:2]
    if pref == "FE": return "Z5"
    if pref == "IM": return "Z8"
    if pref == "RS": return "Z3"
    if pref == "IB": return "Z4"
    if r["id"] in MANUAL: return MANUAL[r["id"]]
    if pref == "AD":
        for z, pat in (("Z5", r"^sede na ferrugem|^ferrugem|estrada geral da ferrugem"), ("Z6", r"garopaba"),
                       ("Z8", r"imbituba|itapirub"), ("Z4", r"ibiraquera"), ("Z1", r"rosa")):
            if re.search(pat, b): return z
    for z, _, pat in ZONAS:
        if pref == "GA" and z in ("Z1", "Z2", "Z3", "Z4"): continue
        if re.search(pat, b): return z
    return "Z1" if pref in ("RX", "RN", "RA") else "Z6"

def rank(r):
    p = r["prioridade"]
    return (0 if "top" in p else 1, 0 if p.startswith("A+") else 1, r["id"])

por_zona = {}
for r in rows:
    if r["id"] in grupos: continue
    por_zona.setdefault(zona(r), []).append(r)

nomes = {z: n for z, n, _ in ZONAS}
ordem = ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7", "Z8"]
out = ["# Rotas de visita (A e A+)", "",
       "Gerado por `scripts/rotas.py` a partir de `leads/leads.csv`. Grupos aparecem uma vez só (visite o dono e fale de todas as unidades).",
       "Ordem dentro do dia: os **top** primeiro. Ajuste a ordem física pelo caminho real (a zona é aproximada, pelo endereço publicado).",
       "**Antes de sair:** confira o horário de quem atende (alguns têm recepção só de manhã). Melhor janela: **9h30–11h30 e 14h30–17h**.", ""]
dia = 0
resumo = []
for z in ordem:
    lst = sorted(por_zona.get(z, []), key=rank)
    if not lst: continue
    n = len(lst)
    ndias = max(1, -(-n // 10))
    cortes = [round(i * n / ndias) for i in range(ndias + 1)]
    for i in range(ndias):
        bloco = lst[cortes[i]:cortes[i+1]]
        if not bloco: continue
        dia += 1
        resumo.append((dia, nomes[z], len(bloco)))
        out += [f"## Dia {dia}: {nomes[z]} ({len(bloco)} visitas)", "",
                "| # | ID | Lead | Endereço/bairro | Contato | Prior. | Status |", "|---|---|---|---|---|---|---|"]
        for j, r in enumerate(bloco, 1):
            junto = [k for k, v in grupos.items() if v == r["id"]]
            extra = f" (+ {', '.join(junto)})" if junto else ""
            out.append(f"| {j} | {r['id']}{extra} | {r['nome']} | {r['bairro']} | {r['telefone'][:70]} | {r['prioridade']} | a visitar |")
        if len(bloco) < 8:
            out.append("_Dia curto: complete com leads B da mesma zona (ver `leads/00-consolidado.md`) ou com retornos D+2/D+5._")
        out.append("")
cab = ["## Resumo", "", "| Dia | Zona | Visitas |", "|---|---|---|"] + [f"| {d} | {z} | {n} |" for d, z, n in resumo] + [""]
out = out[:6] + cab + out[6:]
open(os.path.join(BASE, "rotas/rotas.md"), "w", encoding="utf-8").write("\n".join(out))
print("\n".join(f"Dia {d}: {z} ({n})" for d, z, n in resumo))
