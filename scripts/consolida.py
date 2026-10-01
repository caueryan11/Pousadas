"""Gera leads/00-consolidado.md e leads/leads.csv a partir das tabelas em leads/*.md."""
import csv, glob, os, re

BASE = os.path.join(os.path.dirname(__file__), "..", "leads")
rows = []
for path in sorted(glob.glob(os.path.join(BASE, "*.md"))):
    if os.path.basename(path).startswith("00-"):
        continue
    header = None
    for line in open(path, encoding="utf-8"):
        if not line.startswith("|"):
            header = None if not line.strip() else header
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if cells[0] == "#":
            header = [h.lower() for h in cells]
            continue
        if header is None or set(cells[0]) <= set("-"):
            continue
        if not re.match(r"^[A-Z]{2}\d+", cells[0]):
            continue
        d = dict(zip(header, cells))
        prior = next((c for c in cells if re.match(r"^\*\*(A\+|A|B|C)(\*\*| \()", c)), "")
        p = re.match(r"^\*\*([^*]+)\*\*", prior)
        rows.append({
            "id": cells[0],
            "nome": d.get("nome", ""),
            "tipo": d.get("tipo", ""),
            "bairro": d.get("bairro") or d.get("área", ""),
            "telefone": d.get("telefone / whatsapp", ""),
            "instagram": d.get("instagram", ""),
            "whatsapp": d.get("whatsapp?", ""),
            "estrangeiro": d.get("sinal estrangeiro", ""),
            "avaliacoes": d.get("avaliações", d.get("carteira temporada", "")),
            "prioridade": p.group(1) if p else "",
            "observacao": d.get("observação citável", ""),
            "status": "a contatar",
            "arquivo": os.path.basename(path),
        })

ordem = {"A+ (top)": 0, "A (top)": 0, "A (top volume)": 0}
def rank(r):
    pr = r["prioridade"]
    if pr.startswith("A+"): k = 0
    elif pr.startswith("A"): k = 1
    elif pr.startswith("B"): k = 2
    else: k = 3
    return (k, 0 if "top" in pr else 1, r["id"])
rows.sort(key=rank)

with open(os.path.join(BASE, "leads.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)

from collections import Counter
cnt = Counter(r["prioridade"].split()[0] for r in rows)
out = ["# Consolidado de leads (gerado por scripts/consolida.py)", "",
       f"Total: **{len(rows)}** leads. " + " · ".join(f"{k}: {v}" for k, v in sorted(cnt.items())), "",
       "Status inicial: todos **a contatar**. Detalhes e fontes ficam no arquivo de cada região.", ""]
for titulo, filtro in [("A+ (administradoras / várias unidades)", lambda r: r["prioridade"].startswith("A+")),
                       ("A (pousadas-alvo)", lambda r: r["prioridade"].startswith("A") and not r["prioridade"].startswith("A+")),
                       ("B (visita / segunda onda)", lambda r: r["prioridade"].startswith("B")),
                       ("C (deixar para depois)", lambda r: r["prioridade"].startswith("C"))]:
    sel = [r for r in rows if filtro(r)]
    out += [f"## {titulo} ({len(sel)})", "", "| ID | Nome | Bairro | Telefone / WhatsApp | Estrangeiro | Prior. | Status |", "|---|---|---|---|---|---|---|"]
    for r in sel:
        out.append(f"| {r['id']} | {r['nome']} | {r['bairro']} | {r['telefone']} | {r['estrangeiro'] or '—'} | {r['prioridade']} | {r['status']} |")
    out.append("")
open(os.path.join(BASE, "00-consolidado.md"), "w", encoding="utf-8").write("\n".join(out))
print(len(rows), dict(cnt))
