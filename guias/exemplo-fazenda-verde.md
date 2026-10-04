# Guia de exemplo: Fazenda Verde by Neco (Praia do Rosa)

> **Para que serve:** mostrar na visita (lead RX83) como ficaria o guia da pousada dentro do atendente.
> **Montado só com informação pública** (site, agregadores, La Nación), em 04/10/2026. **Não foi aprovado pelo dono.** Onde as fontes divergem, isso aparece em ⚠. O bot só usaria a versão que o Neco ou a Rose aprovassem.
> Não confundir com a "Fazenda do Rosa", que é outro negócio.

---

## 1. Ficha
- **Nome:** Fazenda Verde by Neco (antes "Fazenda Verde Praia do Rosa"). Fundada por Cristiano "Neco" Agrifoglio, surfista que chegou ao Rosa em 1985; hoje opera com a esposa, Rose. (La Nación, 16/01/2025)
- **Endereço:** Estrada Geral da Praia do Rosa, Imbituba/SC, 88780-000. Número: não encontrado. (Booking)
- **Onde fica:** à beira-mar, junto à Lagoa do Meio, entre o Rosa Norte e o Rosa Sul. O centrinho fica a cerca de 800 m. (praiadorosa.fazendaverde.com; trivago)
  - ⚠ Um agregador indica a Lagoa do Meio a 1,5 km, o que contradiz o site.
- **Coordenadas:** não encontrado. *Pedir ao dono.* Até lá, usar o ponto aproximado "Praia do Rosa – centro" de `guias/pontos.csv`.
- **Praia:** acesso direto e exclusivo por um portão com senha, só para hóspedes. Entre as casas e a praia há apenas jardins. (site)
- **Área:** mais de 40.000 m² de jardins e Mata Atlântica. (site)
- **Contato:** WhatsApp +55 48 99699-8074 · tel. 48 3355-6060 · reservas@fazendaverde.com (site/contato)
- **Recepção:** reservas das 8h às 22h; a pousada funciona 24h, o ano todo. (site)
- **Representante em Buenos Aires:** Paula Lanusse Viajes y Turismo. (Facebook da pousada para a Argentina; La Nación 2023)
- **Idiomas no atendimento:** não encontrado. *Pedir ao dono.*

## 2. Estadia
- **Check-in / check-out:** check-in das 14h30 às 22h; check-out das 8h às 11h. (site)
  - ⚠ Um agregador diz check-in a partir das 16h. *Confirmar.*
- **Café da manhã:** incluso. Horário: não encontrado.
- **Wi-fi e estacionamento:** gratuitos. (site)
- **Nas unidades:** ar-condicionado, cofre, secador, TV, cozinha, varanda com churrasqueira, rede e cadeiras de praia. (site)
- **Piscina:** aquecida, com vista para o mar, jacuzzi e área rasa para crianças. (blog de viagem)
- **Lazer:** academia, sala de jogos, playground e quadra de padel. (site)
- **Pets:** aceitos de qualquer porte. Para animais que não sejam cão, gato ou ave, consultar a recepção. O tutor responde por danos.
  - ⚠ A taxa diverge entre as fontes: R$ 30 por pet ao dia (blog da pousada) ou R$ 50 por pet, máximo de 2 (agregador). *Confirmar.*
- **Crianças:** todas as idades; berço grátis. (agregador)
- **Cancelamento:** varia conforme a acomodação (Booking). Política própria: não encontrado.

## 3. Acomodações
| Tipo | O que tem | Observação |
|---|---|---|
| Suíte casal | varanda | vista para o mar, a mata ou a lagoa, conforme a unidade |
| Casa 2 quartos | cozinha, sala, churrasqueira, varanda | |
| Casa 3 suítes "Exclusive" | idem | categoria nomeada no site |

⚠ O número de unidades varia entre as fontes (de 17 a 28). O site atual fala em 28.

## 4. Comer sem sair
- **Solar Café & Bar:** restaurante da pousada, com pizzas, hambúrgueres e grelhados. (site)
- **Deck na beira da praia:** fica no portão da praia, com três restaurantes parceiros. (site)
- ⚠ Uma avaliação conta que o restaurante fechou para hóspedes num dia de evento. O bot deve avisar quando houver evento (o dono informa a agenda).

## 5. Dicas do dono — *vazio de propósito*
Esta é a parte que só o Neco pode preencher. É o que diferencia o guia dele de qualquer site:
- Restaurante preferido fora da pousada:
- Dia de chuva:
- De onde se vê baleia dali (julho a novembro):
- Melhor horário para o surf:
- Um lugar que turista não conhece:

## 6. Perto daqui
As distâncias saem de `scripts/distancias.py` a partir do ponto aproximado do Rosa. São linha reta mais uma estimativa de estrada. Ver a tabela em [Distâncias](#distâncias).

## 7. Respostas prontas (rascunho — o dono aprova)
| Pergunta provável | Resposta-base |
|---|---|
| Tem vaga de [datas]? | "Vou passar teu pedido pra equipe confirmar. Me diz: quantas pessoas, quantas crianças (idades) e se vem pet?" |
| Precisa de carro? | "Pra quase nada: a praia é direto pelo portão e o centrinho fica a uns 800 m." (o site diz que "não é necessário sair de carro para quase nada") |
| Como vou da recepção ao café? | ⚠ Uma avaliação menciona subida; os agregadores citam escada com corrimão e caminho sem degraus até a entrada. *Pedir ao dono a resposta certa, principalmente para idoso e criança pequena.* |
| Aceitam cachorro? | "Sim, de qualquer porte. A taxa é R$ [confirmar] por dia." |
| ¿Hablan español? | *Confirmar com o dono; o bot responde em espanhol de qualquer forma.* |
| A piscina é aquecida? | "Sim, aquecida, com jacuzzi e área rasa pras crianças." |

## O que perguntar ao Neco na visita (10 min)
1. As coordenadas da recepção (ou abrir o Maps no celular dele).
2. Qual check-in vale: 14h30 ou 16h? E a taxa de pet?
3. O caminho até o café: o que dizer a quem tem dificuldade para andar?
4. Agenda de eventos: como o bot fica sabendo?
5. Para onde ele manda o hóspede ver baleia, jantar fora e passar dia de chuva?
6. A Paula (Buenos Aires) vende pacotes: o bot deve encaminhar argentinos para ela ou para a recepção?

## Fontes
- La Nación (16/01/2025): lanacion.com.ar/revista-lugares/…-nid16012025/
- Site: fazendaverde.com · praiadorosa.fazendaverde.com · blog.fazendaverde.com
- Booking: booking.com/hotel/br/fazenda-verde.html
- Agregadores: trivago, hotels.com, trip.com, hotelsantacatarina
- Facebook: facebook.com/praiadorosafazendaverdeargentina

## Distâncias

Calculadas a partir do ponto aproximado do centrinho do Rosa (-28.1269, -48.6514), porque a coordenada da pousada ainda não foi encontrada. Com a coordenada real, rodar `python3 scripts/distancias.py LAT LON` de novo.

| Lugar | Tipo | Linha reta | Estrada (est.) | A pé | Carro (est.) | Obs. |
|---|---|---|---|---|---|---|
| Rosa Sul | praia | 1.1 km | 1.6 km | 21 min | 3 min | coordenada aproximada |
| Rosa Norte (estacionamento) | praia | 1.4 km | 2.0 km | 27 min | 4 min |  |
| Praia do Luz | praia | 1.8 km | 2.6 km | 34 min | 5 min | coordenada aproximada |
| Praia Vermelha | praia | 2.0 km | 2.8 km | 37 min | 6 min | coordenada aproximada |
| Lagoa de Ibiraquera | lagoa | 2.1 km | 3.0 km | 40 min | 6 min |  |
| Praia do Ouvidor (início da trilha) | praia | 2.6 km | 3.6 km | 48 min | 7 min |  |
| Barra de Ibiraquera | praia | 3.2 km | 4.4 km | 59 min | 9 min | coordenada aproximada |
| Praia da Ferrugem | praia | 6.4 km | 9.0 km | — | 18 min |  |
| Praia do Silveira | praia | 10.7 km | 15.0 km | — | 20 min |  |
| Praia do Porto / Museu da Baleia | museu | 11.2 km | 15.7 km | — | 21 min |  |
| Praia/Mirante da Vigia | mirante | 11.7 km | 16.4 km | — | 22 min | coordenada aproximada |
| Centro de Garopaba | cidade | 12.1 km | 17.0 km | — | 23 min |  |
| Centro de Imbituba | cidade | 12.7 km | 17.8 km | — | 24 min |  |
| Siriú | praia | 15.6 km | 21.9 km | — | 29 min |  |
| Aeroporto de Florianópolis (FLN) | aeroporto | 51.7 km | 72.4 km | — | 1h07 | publicado (do Rosa): ~85 km, ~1h25 |
| Aeroporto de Jaguaruna (JJG) | aeroporto | 72.9 km | 102.0 km | — | 1h34 | publicado (do Rosa): ~90 km |

**Como o bot responderia** (exemplo): "Pra Praia Vermelha: da pousada até o estacionamento do Rosa Norte são uns 2 km (cerca de 25 min a pé). De lá começa a trilha, de ~1,5 km e uns 30 min, leve e bem marcada, com escadas. Leva água e tênis 🙂"
