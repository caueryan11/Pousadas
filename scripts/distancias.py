"""Distâncias em linha reta e estimativa de tempo a partir de um ponto.

Uso:
    python3 scripts/distancias.py LAT LON              # tabela até todos os pontos de guias/pontos.csv
    python3 scripts/distancias.py LAT LON "Praia do Ouvidor"

É o mesmo cálculo que o bot faz quando o hóspede manda a localização no
WhatsApp. Linha reta subestima a rota real; o fator 1,4 é uma aproximação
para estrada. Para rota exata, usar a API do Google Maps (Distance Matrix).
"""
import csv
import math
import sys

FATOR_ESTRADA = 1.4
PE_KMH = 4.5
CARRO_KMH = 35  # estradas de chão e centro na temporada


def haversine(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def estimativa(km_reta):
    km = km_reta * FATOR_ESTRADA
    pe = km / PE_KMH * 60
    carro = km / CARRO_KMH * 60
    return km, pe, carro


def fmt_min(m):
    m = max(1, round(m))
    return f"{m} min" if m < 60 else f"{m // 60}h{m % 60:02d}"


def carregar(caminho="guias/pontos.csv"):
    with open(caminho, encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if r["lat"] and r["lon"]]


def main():
    lat, lon = float(sys.argv[1]), float(sys.argv[2])
    filtro = sys.argv[3].lower() if len(sys.argv) > 3 else None
    linhas = []
    for p in carregar():
        if filtro and filtro not in p["nome"].lower():
            continue
        reta = haversine(lat, lon, float(p["lat"]), float(p["lon"]))
        km, pe, carro = estimativa(reta)
        linhas.append((reta, p["nome"], p["tipo"], km, pe, carro))
    linhas.sort()
    print("| Lugar | Tipo | Linha reta | Estrada (est.) | A pé | Carro |")
    print("|---|---|---|---|---|---|")
    for reta, nome, tipo, km, pe, carro in linhas:
        a_pe = fmt_min(pe) if km <= 6 else "—"
        print(f"| {nome} | {tipo} | {reta:.1f} km | {km:.1f} km | {a_pe} | {fmt_min(carro)} |")


if __name__ == "__main__":
    main()
