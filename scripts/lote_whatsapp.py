"""Extrai Contato + Msg 1 (e ES) dos rascunhos para uma lista de IDs -> arquivo pronto para copiar.
Uso: python3 scripts/lote_whatsapp.py saida.md "Título" ID1 ID2 ..."""
import glob, re, sys, os
BASE = os.path.join(os.path.dirname(__file__), "..")
txt = {f: open(f, encoding="utf-8").read() for f in glob.glob(os.path.join(BASE, "mensagens/*.md"))}
def bloco(i):
    for f, s in txt.items():
        m = re.search(r'^### \[?' + i + r'\]?[ \n][^\n]*\n', s, re.M)
        if m:
            nxt = re.search(r'^### ', s[m.end():], re.M)
            return os.path.basename(f), m.group(0).strip(), s[m.end(): m.end() + nxt.start() if nxt else len(s)]
    return None
out_path, titulo, ids = sys.argv[1], sys.argv[2], sys.argv[3:]
out = [f"# {titulo}", "", "Rascunhos para o Caue enviar **manualmente**, um a um. Antes de cada envio, confira o número no Instagram ou no site. Depois, me diga quem respondeu.", ""]
for n, i in enumerate(ids, 1):
    b = bloco(i)
    if not b:
        out.append(f"## {n}. {i}: bloco não encontrado"); continue
    f, cab, corpo = b
    if "ver grupo" in cab:
        out.append(f"## {n}. {cab.lstrip('# ')}"); continue
    get = lambda k: (re.search(r'\*\*' + re.escape(k) + r':\*\*\s*(.*)', corpo) or [None, ""])[1].strip()
    out += [f"## {n}. {cab.lstrip('# ')}", f"- **Contato:** {get('Contato')}", "", f"> {get('Msg 1')}", ""]
    es = get('Msg 1 (ES)')
    if es: out += ["Versão ES:", f"> {es}", ""]
    out += [f"_D+2 e D+5 em `mensagens/{f}`_", ""]
open(os.path.join(BASE, out_path), "w", encoding="utf-8").write("\n".join(out))
print("ok", len(ids))
