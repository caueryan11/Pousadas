# Custo por cliente, tempo de implantação e semana grátis

Estimativas para planejar, **não números medidos**. Meça na primeira semana de cada cliente: tokens usados (o campo `usage` de cada resposta da API), número de conversas e horas gastas.

## 1. Custo de operação por cliente (por mês)

### IA: o maior custo variável
Preços por milhão de tokens (API da Anthropic, tabela de set/2026):

| Modelo | Entrada | Entrada em cache | Saída |
|---|---|---|---|
| Claude Haiku 4.5 | US$ 1 | US$ 0,10 | US$ 5 |
| Claude Sonnet 5.5 | US$ 2 | US$ 0,20 | US$ 10 |
| Claude Opus 5.5 | US$ 4 | US$ 0,20 | US$ 20 |

Hipótese de uma conversa: 5 trocas; a ficha da pousada (~4 mil tokens) fica em cache; histórico médio de ~1.200 tokens; ~300 tokens de resposta por troca.
- Haiku 4.5: ~US$ 0,016 por conversa
- Sonnet 5.5: ~US$ 0,031 por conversa
- Opus 5.5: ~US$ 0,06 por conversa

Por mês (30 dias, dólar a R$ 5,50, **hipótese**):

| Volume | Haiku 4.5 | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|
| Baixa temporada: 5 conversas/dia | ~R$ 13 | ~R$ 26 | ~R$ 52 |
| Média: 15 conversas/dia | ~R$ 38 | ~R$ 77 | ~R$ 154 |
| Pico de verão: 30 conversas/dia | ~R$ 77 | ~R$ 153 | ~R$ 307 |

**Conclusão:** com Sonnet ou Opus no pico, a IA pode comer metade ou mais da mensalidade de R$ 297 (ou de R$ 197). Para as perguntas do dia a dia, use **Haiku 4.5** e deixe um modelo maior só para conversas difíceis (ou teste o Sonnet 5.5 em esforço baixo e compare). Coloque um teto de conversas no contrato da administradora (que tem muito mais volume).

### Outros custos

| Item | Estimativa por cliente/mês | Observação |
|---|---|---|
| WhatsApp (API oficial da Meta) | ~R$ 0 a poucos reais | Respostas a conversas iniciadas pelo hóspede (janela de 24h) não são cobradas. Avisos ao dono fora da janela usam modelo "utilidade", cobrado por mensagem. **Conferir a tabela atual da Meta para o Brasil.** |
| Número | R$ 0 se usar o número da pousada | A Meta permite usar o mesmo número no app WhatsApp Business e na API ("coexistência"): confirmar se vale para cada caso. Número novo: chip + plano. |
| API não oficial (Z-API, Evolution etc.) | mensalidade por número | **Evite.** Pode levar ao bloqueio do número do cliente. |
| Servidor | R$ 3–6 (um VPS de ~R$ 30–60 dividido por 10 clientes) | |
| Impostos | ~6% a 15,5% da receita | Simples Nacional, Anexo III ou V conforme o "fator R". **Confirmar com o contador.** Em R$ 297: ~R$ 18 a R$ 46. |
| Cartão | ~3–5% se cobrar no cartão | Pix: quase zero. |

### Total estimado por cliente (pico de verão, 30 conversas/dia)
- **Com Haiku 4.5:** ~R$ 100–130 de custo para R$ 297 de mensalidade (Plano Temporada).
- **Com Sonnet 5.5:** ~R$ 175–205.
- No **Plano Ano** (R$ 197/mês), use Haiku por padrão, senão a margem do verão fica muito estreita. Na baixa temporada o custo cai para R$ 20–40.

## 2. Tempo de implantação por cliente

| Etapa | Primeiros clientes | Com processo pronto (depois do 3º ou 4º) |
|---|---|---|
| Reunião de coleta da ficha (preços, regras, pet, café, check-in, como chegar) | 1 h | 40 min |
| Montar a base de conhecimento e as respostas | 1,5–2 h | 45 min (com modelo pronto) |
| Conectar o WhatsApp (Business Manager da Meta, número, verificação) | 1 h ativa + espera de aprovação (pode levar dias) | 30 min |
| Calendário (iCal do Airbnb/Booking ou channel manager) | 30 min | 15 min |
| Teste com o dono (conversas simuladas em PT, ES e EN) | 45 min | 30 min |
| Ajustes na primeira semana | 1–2 h | 45 min |
| **Total** | **~6–7 h** | **~3–3,5 h** |

- Some o deslocamento das visitas.
- **Administradoras:** +15–20 min de ficha por imóvel. Para 50 imóveis, são mais 12–17 h: cobre a implantação à parte.
- **Ponto de atenção:** 10 clientes até 15/11 podem significar ~40–60 h de implantação. Isso concorre com as visitas. Vale padronizar a ficha (um formulário que o dono preenche antes) e implantar em lote.

## 3. Uma semana grátis para cada um?

Hoje a oferta já tem **1 semana de garantia** (o cliente paga e, se não fizer sentido, não segue). Trocar por semana grátis para todos tem prós e contras:

**A favor:** baixa a barreira do "sim"; o dono vê funcionando com o próprio WhatsApp.
**Contra:**
- Cada teste custa as ~6 h de implantação, mesmo para quem não fecha.
- Em outubro o volume de mensagens ainda é baixo: em 7 dias o dono pode ver pouca coisa acontecer.
- "Grátis" tende a adiar a decisão.

**Recomendação:**
1. **Demonstração grátis com os dados da pousada, não implantação grátis:** em 15–20 min, na visita, monte uma conversa de teste com o preço, o café e a regra de pet dela (num número de testes seu). O dono vê o atendente falando da pousada dele sem você instalar nada.
2. **3 pilotos com semana grátis**, só para leads do topo (grupos e donos argentinos). Em troca: o dono preenche a ficha antes, e topa dar um depoimento real e mostrar os números da semana se gostar. É assim que vocês ganham os **primeiros casos de verdade**, que hoje não existem.
3. **Para os demais, manter a garantia:** a entrada é paga (pode ser a 1ª parcela das 3), e se em 7 dias não fizer sentido, você devolve. Assim o cliente se compromete, e você não perde as horas de implantação.
