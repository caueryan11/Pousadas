# Guias (concierge local)

O atendente responde o hóspede com base em dois textos: o guia da pousada e o guia regional.

| Arquivo | O que é |
|---|---|
| `regional.md` | Base comum a todos os clientes: baleias (temporada, regras, mirantes), praias, trilhas, distâncias, saúde, clima. Com fontes e pendências. |
| `modelo-pousada.md` | Modelo do guia de cada cliente, mais as 10 perguntas para a conversa de 20 min com o dono. |
| `exemplo-fazenda-verde.md` | Exemplo pronto (lead RX83), feito só com informação pública. Para mostrar na visita. |
| `pontos.csv` | Pontos com coordenadas (marcados `fonte` ou `aprox`). |
| `../scripts/distancias.py` | `python3 scripts/distancias.py LAT LON [filtro]`: distâncias e tempos a partir de um ponto. |

Regras:
- O bot não inventa: o que não está nos guias, ele passa para a equipe.
- Nada de passeio de barco para ver baleia enquanto o turismo embarcado seguir suspenso (ver `regional.md`).
- Guia de cliente só entra no bot depois da aprovação do dono.
