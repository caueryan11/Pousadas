"""Gera rotas/visitas/dia-XX.md: para cada dia de rotas/rotas.md, a lista de paradas com o preparo de visita (3 linhas) e a Msg 1."""
import glob, os, re
BASE = os.path.join(os.path.dirname(__file__), "..")
txt = {f: open(f, encoding="utf-8").read() for f in glob.glob(os.path.join(BASE, "mensagens/*.md"))}
def bloco(i):
    for f, s in txt.items():
        m = re.search(r'^### \[?' + i + r'\]?[ \n][^\n]*\n', s, re.M)
        if m and "ver grupo" not in m.group(0):
            nxt = re.search(r'^### ', s[m.end():], re.M)
            return s[m.end(): m.end() + nxt.start() if nxt else len(s)]
    return ""
rotas = open(os.path.join(BASE, "rotas/rotas.md"), encoding="utf-8").read()
os.makedirs(os.path.join(BASE, "rotas/visitas"), exist_ok=True)
for d in re.finditer(r'^## (Dia (\d+): [^\n]+)\n(.*?)(?=^## |\Z)', rotas, re.M | re.S):
    titulo, n, corpo = d.group(1), int(d.group(2)), d.group(3)
    out = [f"# {titulo}", "", "Folha de campo. Leve impressa ou no celular. Depois de cada visita, anote: com quem falou, interesse (0–3), próximo passo.", ""]
    for linha in re.findall(r'^\| (\d+) \| (\w+)[^|]*\| ([^|]+)\| ([^|]+)\| ([^|]+)\|', corpo, re.M):
        k, i, nome, end, cont = [x.strip() for x in linha]
        b = bloco(i)
        vis = re.search(r'\*\*Visita:\*\*\s*\n((?:- .*\n?)+)', b)
        msg = re.search(r'\*\*Msg 1:\*\*\s*(.*)', b)
        out += [f"## {k}. {nome} ({i})", f"- **Onde:** {end}", f"- **Contato:** {cont}"]
        out += (vis.group(1).rstrip().splitlines() if vis else ["- (sem preparo: ver arquivo de leads)"])
        if msg: out += ["- **Se não encontrar o dono, deixe recado ou mande depois:** " + msg.group(1).strip()]
        out.append("- **Concierge:** pergunte onde ele manda o hóspede jantar, ver baleia e passar dia de chuva (é o começo do guia dele).")
        out += ["- **Anotação:** ________________________________", ""]
    open(os.path.join(BASE, f"rotas/visitas/dia-{n:02d}.md"), "w", encoding="utf-8").write("\n".join(out))
print("ok")
