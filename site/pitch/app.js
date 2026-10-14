/* Farol Hospeda · site-pitch. Sem dependências, sem coleta de dados. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const raiz = document.documentElement;
  const semMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const in_out = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const reais = n => "R$ " + Math.round(n).toLocaleString("pt-BR");
  const numero = txt => {
    const limpo = String(txt || "").replace(/[^\d,]/g, "").replace(",", ".");
    const n = parseFloat(limpo);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  /* ---------- WhatsApp comercial ---------- */
  const WHATS = "https://wa.me/5548984683798?text=" +
    encodeURIComponent("Olá! Vi a apresentação da Farol Hospeda (site-pitch) e quero conversar sobre a minha pousada.");
  $$(".js-whats").forEach(a => { a.href = WHATS; });

  /* ---------- abertura: entra uma vez ---------- */
  requestAnimationFrame(() => requestAnimationFrame(() => raiz.classList.add("pronto")));

  /* ---------- botão flutuante: aparece depois da abertura, some no fechamento ---------- */
  const flutuante = $(".whats-flutuante");
  const vistos = {abertura: true, fechamento: false};
  const atualizarFlutuante = () => flutuante.classList.toggle("mostrar", !vistos.abertura && !vistos.fechamento);
  new IntersectionObserver(es => {
    es.forEach(e => { vistos[e.target.id] = e.isIntersecting; });
    atualizarFlutuante();
  }, {threshold: 0.12}).observe($("#abertura"));
  new IntersectionObserver(es => {
    es.forEach(e => { vistos[e.target.id] = e.isIntersecting; });
    atualizarFlutuante();
  }, {threshold: 0.35}).observe($("#fechamento"));

  /* ---------- revelação em sequência (peças soltas e passos da entrada) ---------- */
  const revelaveis = [...$$(".peca"), ...$$(".entrada-passos li")];
  revelaveis.forEach((el, i) => { el.classList.add("revelar"); el.style.setProperty("--i", el.classList.contains("peca") ? i : i % 4); });
  const ioRevelar = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("visto"); ioRevelar.unobserve(e.target); }
  }), {threshold: 0.2, rootMargin: "0px 0px -8% 0px"});
  revelaveis.forEach(el => ioRevelar.observe(el));

  /* ---------- praia do exemplo ---------- */
  const praia = $("#praia");
  praia.addEventListener("input", () => {
    const v = praia.value.trim() || "Garopaba";
    $$(".js-praia").forEach(el => { el.textContent = v; });
  });

  /* ---------- o caminho: o loop se monta com a rolagem ---------- */
  const trilho = $("#loop-trilho");
  const caminho = $("#caminho");
  const nos = $$(".no");
  const passos = $$(".passo");
  const marcas = $$(".loop-marcas li");
  const aceso = $("#loop-aceso");
  const dadosG = $("#loop-dados");
  const miniSite = $("#mini-site");
  const COMPRIMENTO = aceso.getTotalLength();
  aceso.style.strokeDasharray = COMPRIMENTO;
  // fim de cada etapa (fração da rolagem do trilho)
  const S = [0, 0.19, 0.38, 0.57, 0.76, 1];
  // trecho em que cada arco se desenha: 1 Google>Site, 2 Site>WhatsApp, 3 WhatsApp>Lumi, 4 Lumi>Google
  const ARCOS = [[S[0] + 0.08, S[1] - 0.01], [S[1] + 0.08, S[2] - 0.01], [S[2] + 0.08, S[3] - 0.01], [S[4] + 0.03, S[4] + 0.14]];
  const TOTAL_QUADROS = 311;
  const quadros = new Array(TOTAL_QUADROS).fill(null);
  const prontos = new Array(TOTAL_QUADROS).fill(false);
  let desenhado = 0, loopVisivel = false;

  function carregarQuadros() {
    if (quadros[0]) return;
    // passes de 16, 8, 4, 2, 1: o voo inteiro aparece rápido e os quadros do meio vão chegando
    const ordem = [];
    for (const passo of [32, 16, 8, 4, 2, 1]) for (let i = 0; i < TOTAL_QUADROS; i += passo) if (!ordem.includes(i)) ordem.push(i);
    let k = 0, ativos = 0;
    const proximo = () => {
      while (ativos < 6 && k < ordem.length) {
        const i = ordem[k++]; ativos++;
        const im = new Image();
        im.decoding = "async";
        im.onload = () => { prontos[i] = true; ativos--; pedirDesenho(); proximo(); };
        im.onerror = () => { ativos--; proximo(); };
        im.src = `assets/passeio3/q${String(i + 1).padStart(3, "0")}.webp`;
        quadros[i] = im;
      }
    };
    proximo();
  }

  /* vídeo do passeio no site de exemplo: o quadro mostrado persegue o da rolagem com suavidade,
     e dois quadros vizinhos se misturam, então a passagem fica lisa mesmo com rolagem aos trancos */
  const tela = $("#passeio-canvas");
  const ctx = tela ? tela.getContext("2d") : null;
  let alvo = 0, mostrado = 0, rafPasseio = 0, ultimoDesenho = -1;
  const pronto = i => {
    for (let d = 0; d < TOTAL_QUADROS; d++) {
      if (prontos[i - d]) return i - d;
      if (prontos[i + d]) return i + d;
    }
    return -1;
  };
  function desenharPasseio() {
    rafPasseio = 0;
    if (!ctx) return;
    mostrado += (alvo - mostrado) * (semMovimento ? 1 : 0.06);
    if (Math.abs(alvo - mostrado) < 0.01) mostrado = alvo;
    if (Math.abs(mostrado - ultimoDesenho) > 0.002) {
      const base = Math.floor(mostrado), f = mostrado - base;
      const a = pronto(base), b = pronto(Math.min(TOTAL_QUADROS - 1, base + 1));
      if (a >= 0) {
        ctx.globalAlpha = 1;
        ctx.drawImage(quadros[a], 0, 0, tela.width, tela.height);
        if (b >= 0 && b !== a && f > 0.01) { ctx.globalAlpha = f; ctx.drawImage(quadros[b], 0, 0, tela.width, tela.height); }
        ctx.globalAlpha = 1;
        ultimoDesenho = mostrado;
      }
    }
    if (mostrado !== alvo) pedirDesenho();
  }
  function pedirDesenho() { if (!rafPasseio) rafPasseio = requestAnimationFrame(desenharPasseio); }

  function aplicarLoop(p, ativo) {
    desenhado = ARCOS.reduce((soma, [a, b]) => soma + 0.25 * clamp((p - a) / (b - a)), 0);
    aceso.style.strokeDashoffset = COMPRIMENTO * (1 - desenhado);
    nos.forEach((no, i) => {
      const encaixa = i === 0 ? p > 0.003 : desenhado >= i * 0.25 - 0.0005;
      no.classList.toggle("encaixado", encaixa);
      no.classList.toggle("ativo", ativo === i + 1);
    });
    passos.forEach(el => el.classList.toggle("visivel", Number(el.dataset.passo) === ativo));
    marcas.forEach((li, i) => li.classList.toggle("feito", i < Math.min(ativo, 4)));
    caminho.classList.toggle("completo", desenhado > 0.999);
  }

  function rolagemLoop() {
    const r = trilho.getBoundingClientRect();
    const total = trilho.offsetHeight - innerHeight;
    const p = clamp(-r.top / total);
    let ativo = 1;
    for (let k = 1; k < S.length; k++) if (p >= S[k - 1]) ativo = k;
    aplicarLoop(p, ativo);
    if (p > 0.08) carregarQuadros();
    if (ativo === 2 || (ativo === 1 && p > S[1] - 0.04) || (ativo === 3 && p < S[2] + 0.04)) {
      const t = clamp((p - S[1]) / (S[2] - S[1]));
      alvo = t * (TOTAL_QUADROS - 1);
      pedirDesenho();
      // no fim do passo, a página de exemplo rola e mostra os quartos
      if (miniSite) miniSite.style.setProperty("--rol", (in_out(clamp((t - 0.6) / 0.35)) * 32).toFixed(2));
    }
  }

  // dados que fluem pelo trecho aceso do anel
  const NS = "http://www.w3.org/2000/svg";
  const pontos = Array.from({length: 7}, () => {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("r", "4.5"); c.setAttribute("class", "loop-dado"); c.style.opacity = "0";
    dadosG.appendChild(c); return c;
  });
  let rafDados = 0;
  function fluir(t) {
    const completo = desenhado > 0.999;
    const n = completo ? pontos.length : 3;
    const velocidade = completo ? 0.00005 : 0.00009;
    pontos.forEach((c, i) => {
      if (i >= n || desenhado < 0.02) { c.style.opacity = "0"; return; }
      const fase = ((t * velocidade) + i / n) % 1;
      const frac = completo ? fase : fase * desenhado;
      const ang = Math.PI + frac * Math.PI * 2;
      c.setAttribute("cx", (300 + 210 * Math.cos(ang)).toFixed(1));
      c.setAttribute("cy", (300 + 210 * Math.sin(ang)).toFixed(1));
      // some perto da ponta do traço para não "vazar" da luz
      const borda = completo ? 1 : clamp((desenhado - frac) / 0.04);
      c.style.opacity = String(0.95 * Math.min(borda, clamp(fase / 0.06)));
    });
    rafDados = loopVisivel ? requestAnimationFrame(fluir) : 0;
  }

  if (!semMovimento) {
    raiz.classList.add("movimento");
    new IntersectionObserver(es => es.forEach(e => {
      loopVisivel = e.isIntersecting;
      if (loopVisivel && !rafDados) rafDados = requestAnimationFrame(fluir);
    })).observe(trilho);
  } else {
    // sem movimento: o caminho aparece montado, com todos os passos em lista
    aceso.style.strokeDashoffset = 0;
    desenhado = 1;
    nos.forEach(no => no.classList.add("encaixado"));
    passos.forEach(el => el.classList.add("visivel"));
    caminho.classList.add("completo");
  }

  /* ---------- peças soltas: se afastam com a rolagem ---------- */
  const pecas = $(".pecas");
  function rolagemPecas() {
    const r = pecas.getBoundingClientRect();
    const t = clamp((innerHeight - r.top) / (innerHeight + r.height));
    pecas.style.setProperty("--solto", (t * 1.6 - 0.3).toFixed(3));
  }

  let agendado = false;
  function aoRolar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => {
      agendado = false;
      if (!semMovimento) { rolagemLoop(); rolagemPecas(); }
    });
  }
  addEventListener("scroll", aoRolar, {passive: true});
  addEventListener("resize", aoRolar, {passive: true});
  aoRolar();

  /* ---------- demonstração ---------- */
  const CENARIOS = {
    mare: {
      nome: "Casa Maré Mansa",
      roteiro: [
        {de: "h", hora: "23:41", texto: "Hola! ¿Tienen lugar del 3 al 8 de enero para 2 adultos y un niño de 6 años? Viajamos con una perrita pequeña."},
        {de: "l", hora: "23:41", texto: "¡Hola! Sobre la perrita: aceptamos mascotas pequeñas con aviso previo. El bungaló frente al mar tiene tarifa por noche desde R$ 1.480 en enero, con desayuno (valor de ejemplo). La disponibilidad y el total los confirma la Casa en la reserva. ¿Me dices tu nombre para dejar la solicitud lista?"},
        {de: "h", hora: "23:43", texto: "Valentina Ruiz. ¡Gracias!"},
        {de: "l", hora: "23:43", texto: "Gracias, Valentina. Ya pasé tu solicitud al equipo de Casa Maré Mansa: del 3 al 8 de enero, 2 adultos y 1 niño, con la perrita. Te escriben por aquí para confirmar."},
      ],
      aviso: {hora: "23:43", nome: "Valentina Ruiz", datas: "3 a 8 de janeiro (5 noites)", pessoas: "2 adultos e 1 criança de 6 anos", idioma: "espanhol", obs: "vem com cachorrinha pequena (a pousada aceita pet pequeno)"},
    },
    vento: {
      nome: "Pousada Ponta do Vento",
      roteiro: [
        {de: "h", hora: "00:12", texto: "Hi! We're coming for our honeymoon, Feb 14 to 17. Do you have a sea view suite? And how do we get there from the airport?"},
        {de: "l", hora: "00:12", texto: "Hi, and congratulations! Our sea-view suites start at R$ 1,950 per night in February, breakfast included (sample price). The airport is about an hour and a half away by car, and the team can tell you about transfers. They confirm availability and the final amount. May I have your name?"},
        {de: "h", hora: "00:14", texto: "Daniel Price. Thank you!"},
        {de: "l", hora: "00:14", texto: "Thank you, Daniel. I've sent your request to the team: Feb 14 to 17, 2 adults, sea-view suite, asking about an airport transfer. They'll reply here to confirm."},
      ],
      aviso: {hora: "00:14", nome: "Daniel Price", datas: "14 a 17 de fevereiro (3 noites)", pessoas: "2 adultos, lua de mel", idioma: "inglês", obs: "quer suíte com vista para o mar e perguntou de transfer do aeroporto"},
    },
    jacaranda: {
      nome: "Vila Jacarandá",
      roteiro: [
        {de: "h", hora: "22:58", audio: "0:18", texto: "Oi, tudo bem? Tem restaurante aberto perto daí de noite? E dá para reservar em fevereiro para quatro pessoas?"},
        {de: "l", hora: "22:58", texto: "Oi! A Cantina da Figueira fica a 900 m e abre até as 23h. Deixei no mapa: ", link: "app.oilumi.com.br/mapa/vila-jacaranda", depois: ". Em fevereiro, o chalé para 4 pessoas tem diária a partir de R$ 1.320, mínimo de 4 noites (valores de exemplo, confirmados pela pousada na reserva). Quais são as datas e o seu nome?"},
        {de: "h", hora: "23:01", texto: "Chego dia 14 e saio dia 18. Sou a Renata Albuquerque."},
        {de: "l", hora: "23:01", texto: "Anotado, Renata: de 14 a 18 de fevereiro, 4 pessoas. Passei para a equipe da Vila Jacarandá, que confirma a vaga e o valor por aqui."},
      ],
      aviso: {hora: "23:01", nome: "Renata Albuquerque", datas: "14 a 18 de fevereiro (4 noites)", pessoas: "4 pessoas", idioma: "português, por áudio", obs: "perguntou de restaurante perto (recebeu o mapa)"},
    },
  };

  const conversa = $("#tel-conversa");
  const dono = $("#tel-dono");
  const espera = $("#tel-espera");
  const telNome = $("#tel-nome");
  const cartoes = $$(".cartao-pousada");
  let geracao = 0, cenarioAtual = "mare";
  const esperar = ms => new Promise(r => setTimeout(r, semMovimento ? 0 : ms));

  function bolha(m) {
    const el = document.createElement("div");
    el.className = "msg " + (m.de === "h" ? "msg-hospede" : "msg-lumi");
    if (m.de === "l") {
      const q = document.createElement("span"); q.className = "quem"; q.textContent = "Lumi"; el.appendChild(q);
    }
    if (m.audio) {
      const a = document.createElement("span"); a.className = "msg-audio";
      a.innerHTML = '<i class="ph ph-play" aria-hidden="true"></i><span class="onda" aria-hidden="true"></span>';
      a.append(document.createTextNode(m.audio));
      el.appendChild(a);
      const tr = document.createElement("span"); tr.className = "msg-transcricao";
      tr.textContent = "Áudio: " + m.texto;
      el.appendChild(tr);
    } else {
      el.append(document.createTextNode(m.texto));
      if (m.link) {
        const l = document.createElement("span"); l.className = "msg-link"; l.textContent = m.link;
        el.append(l, document.createTextNode(m.depois));
      }
    }
    const h = document.createElement("small"); h.textContent = m.hora; el.appendChild(h);
    return el;
  }

  function avisoDono(a, nome) {
    const el = document.createElement("div");
    el.className = "aviso";
    el.innerHTML = `<span class="aviso-titulo"><i class="ph ph-bell-simple-ringing" aria-hidden="true"></i>Pedido de reserva · <span></span></span>
      <dl><dt>Nome</dt><dd></dd><dt>Datas</dt><dd></dd><dt>Pessoas</dt><dd></dd><dt>Idioma</dt><dd></dd><dt>Obs.</dt><dd></dd></dl>
      <span class="aviso-acao">Confirme a vaga e o valor direto com o hóspede.</span><small></small>`;
    el.querySelector(".aviso-titulo span").textContent = nome;
    const dds = el.querySelectorAll("dd");
    [a.nome, a.datas, a.pessoas, a.idioma, a.obs].forEach((v, i) => { dds[i].textContent = v; });
    el.querySelector("small").textContent = a.hora;
    return el;
  }

  const entrar = el => requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("entrou")));
  const rolarConversa = () => { conversa.scrollTop = conversa.scrollHeight; };

  async function tocar(chave) {
    const g = ++geracao;
    const c = CENARIOS[chave];
    telNome.textContent = c.nome;
    conversa.replaceChildren();
    dono.replaceChildren(espera);
    await esperar(500);
    for (const m of c.roteiro) {
      if (g !== geracao) return;
      if (m.de === "l") {
        const dig = document.createElement("div");
        dig.className = "digitando"; dig.setAttribute("aria-label", "Lumi está digitando");
        dig.innerHTML = "<span></span><span></span><span></span>";
        conversa.appendChild(dig); rolarConversa();
        await esperar(1400);
        if (g !== geracao) return;
        dig.remove();
      }
      const el = bolha(m);
      conversa.appendChild(el); entrar(el); rolarConversa();
      await esperar(m.de === "h" ? 1100 : 1900);
    }
    if (g !== geracao) return;
    await esperar(400);
    const av = avisoDono(c.aviso, c.nome);
    dono.replaceChildren(av); entrar(av);
  }

  function escolher(chave) {
    cenarioAtual = chave;
    cartoes.forEach(b => b.setAttribute("aria-checked", String(b.dataset.cenario === chave)));
    tocar(chave);
  }
  cartoes.forEach((b, i) => {
    b.addEventListener("click", () => escolher(b.dataset.cenario));
    b.addEventListener("keydown", e => {
      const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const prox = cartoes[(i + dir + cartoes.length) % cartoes.length];
      prox.focus(); escolher(prox.dataset.cenario);
    });
    b.tabIndex = b.getAttribute("aria-checked") === "true" ? 0 : -1;
  });
  // radiogroup: só o marcado entra no Tab
  const sincronizarTab = () => cartoes.forEach(b => { b.tabIndex = b.getAttribute("aria-checked") === "true" ? 0 : -1; });
  cartoes.forEach(b => b.addEventListener("click", sincronizarTab));
  cartoes.forEach(b => b.addEventListener("keyup", sincronizarTab));
  $("#demo-repetir").addEventListener("click", () => tocar(cenarioAtual));
  let demoComecou = false;
  new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && !demoComecou) { demoComecou = true; tocar(cenarioAtual); }
  }), {threshold: 0.35}).observe($(".telefones"));

  /* ---------- investimento e conta ---------- */
  const PLANOS = {
    essencial: {nome: "Essencial", mensal: [490, 550, 590], impl: 2900, lumi: false, insta: false},
    reserva: {nome: "Reserva Direta", mensal: [690, 790, 890], impl: 3900, lumi: true, insta: false},
    completo: {nome: "Completo", mensal: [990, 1190, 1490], impl: 4900, lumi: true, insta: true},
  };
  const FAIXAS = ["até 5 acomodações", "6 a 12 acomodações", "13 ou mais acomodações"];
  let faixa = 2, plano = "reserva";

  const botoesFaixa = $$(".faixas button");
  botoesFaixa.forEach((b, i) => {
    b.addEventListener("click", () => {
      faixa = Number(b.dataset.faixa);
      botoesFaixa.forEach(x => { x.setAttribute("aria-checked", String(x === b)); x.tabIndex = x === b ? 0 : -1; });
      $$(".js-mensal").forEach(el => {
        const v = el.dataset.valores.split(",").map(Number)[faixa];
        if (semMovimento) { el.textContent = reais(v); return; }
        el.classList.add("trocando");
        setTimeout(() => { el.textContent = reais(v); el.classList.remove("trocando"); }, 170);
      });
      calcular();
    });
    b.addEventListener("keydown", e => {
      const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const prox = botoesFaixa[(i + dir + botoesFaixa.length) % botoesFaixa.length];
      prox.focus(); prox.click();
    });
    b.tabIndex = b.getAttribute("aria-checked") === "true" ? 0 : -1;
  });

  const artigos = $$(".plano");
  function marcarPlano() {
    artigos.forEach(a => {
      const sim = a.dataset.plano === plano;
      a.classList.toggle("escolhido", sim);
      const b = a.querySelector(".js-escolher");
      b.setAttribute("aria-pressed", String(sim));
      b.classList.toggle("botao-ouro", sim);
      b.classList.toggle("botao-linha", !sim);
      b.textContent = sim ? "Plano selecionado" : "Escolher este plano";
    });
  }
  artigos.forEach(a => a.querySelector(".js-escolher").addEventListener("click", () => {
    plano = a.dataset.plano; marcarPlano(); calcular();
  }));

  const campos = {site: $("#c-site"), bot: $("#c-bot"), insta: $("#c-insta"), motor: $("#c-motor")};
  const ROTULOS = {site: "Site, hospedagem ou agência", bot: "Atendimento ou chatbot", insta: "Instagram ou social media", motor: "Motor de reservas ou sistema"};
  const barraHoje = $("#barra-hoje"), barraFarol = $("#barra-farol");
  const dica = $("#dica"), figura = $("#barras");

  function formatarCampo(inp) {
    const n = numero(inp.value);
    if (inp.value.trim() === "") return;
    inp.value = n ? Math.round(n).toLocaleString("pt-BR") : "";
  }

  function desenharBarra(barra, partes, maximo) {
    barra.replaceChildren();
    const total = partes.reduce((s, p) => s + p.valor, 0);
    if (!total) {
      const v = document.createElement("span"); v.className = "barra-vazia"; v.textContent = "Digite ao lado o que você paga hoje";
      barra.appendChild(v); return;
    }
    partes.filter(p => p.valor > 0).forEach(p => {
      const s = document.createElement("span");
      s.className = "seg seg-" + p.tipo;
      s.style.flexGrow = String(p.valor);
      s.dataset.rotulo = p.rotulo; s.dataset.valor = reais(p.valor);
      barra.appendChild(s);
    });
    if (maximo > total) {
      const resto = document.createElement("span");
      resto.style.flexGrow = String(maximo - total); resto.style.flexBasis = "0";
      barra.appendChild(resto);
    }
  }

  function valorReserva() {
    return numero($("#rp-diaria").value) * numero($("#rp-noites").value);
  }

  function calcular() {
    if (!campos.site) { reservaPerdida(); return; }   // a seção da conta saiu do site
    const P = PLANOS[plano], mensal = P.mensal[faixa];
    const v = Object.fromEntries(Object.entries(campos).map(([k, el]) => [k, numero(el.value)]));
    const assume = {site: true, bot: P.lumi, insta: P.insta, motor: false};
    const hoje = ["site", "bot", "insta", "motor"].map(k => ({rotulo: ROTULOS[k], valor: v[k], tipo: assume[k] ? "troca" : "fica"}));
    hoje.sort((a, b) => (a.tipo === "fica") - (b.tipo === "fica"));
    const ficam = hoje.filter(p => p.tipo === "fica");
    const farol = [{rotulo: `Farol Hospeda, ${P.nome}`, valor: mensal, tipo: "farol"}, ...ficam];
    const tHoje = hoje.reduce((s, p) => s + p.valor, 0);
    const tFarol = farol.reduce((s, p) => s + p.valor, 0);
    const maximo = Math.max(tHoje, tFarol);
    desenharBarra(barraHoje, hoje, maximo);
    desenharBarra(barraFarol, farol, maximo);
    $("#valor-hoje").textContent = reais(tHoje);
    $("#valor-farol").textContent = reais(tFarol);
    $("#conta-plano-nome").textContent = `${P.nome}, ${FAIXAS[faixa]}`;

    const corpo = $("#tabela-corpo");
    corpo.replaceChildren();
    const linhas = [
      ...["site", "bot", "insta", "motor"].map(k => [ROTULOS[k], v[k], assume[k] ? 0 : v[k]]),
      [`Mensalidade ${P.nome}`, 0, mensal],
      ["Total por mês", tHoje, tFarol],
      [`Implantação ${P.nome} (uma vez)`, 0, P.impl],
    ];
    linhas.forEach(([n, a, b]) => {
      const tr = document.createElement("tr");
      [n, reais(a), reais(b)].forEach((t, i) => { const td = document.createElement(i ? "td" : "th"); if (!i) td.scope = "row"; td.textContent = t; tr.appendChild(td); });
      corpo.appendChild(tr);
    });

    const resumo = $("#conta-resumo");
    if (!tHoje) {
      resumo.innerHTML = "";
      const g = document.createElement("span"); g.className = "grande"; g.textContent = `${reais(mensal)} por mês + ${reais(P.impl)} de implantação`;
      resumo.append(g, document.createTextNode("Digite o que você paga hoje para ver as duas contas lado a lado."));
    } else {
      const ano1Hoje = tHoje * 12, ano1Farol = tFarol * 12 + P.impl, dif = ano1Farol - ano1Hoje;
      const difMes = tFarol - tHoje;
      const g = document.createElement("span"); g.className = "grande";
      g.textContent = difMes === 0 ? "Mesmo valor por mês" : `${reais(Math.abs(difMes))} ${difMes < 0 ? "a menos" : "a mais"} por mês`;
      let frase = `Em 12 meses, contando a implantação de ${reais(P.impl)}: hoje ${reais(ano1Hoje)}; com a Farol, ${reais(ano1Farol)}. `;
      if (dif <= 0) frase += `Pelos números que você digitou, a Farol custa ${reais(-dif)} a menos no primeiro ano.`;
      else {
        const r = valorReserva();
        frase += `Pelos números que você digitou, a Farol custa ${reais(dif)} a mais no primeiro ano`;
        frase += r ? `, o equivalente a ${(dif / r).toLocaleString("pt-BR", {maximumFractionDigits: 1})} ${dif / r <= 1 ? "reserva" : "reservas"} de ${reais(r)} (a sua diária vezes as noites, logo abaixo).` : ".";
      }
      resumo.replaceChildren(g, document.createTextNode(frase));
    }
    reservaPerdida();
  }

  function reservaPerdida() {
    const P = PLANOS[plano], mensal = P.mensal[faixa];
    const r = valorReserva(), diaria = numero($("#rp-diaria").value);
    $("#rp-valor").textContent = r ? reais(r) : "R$ 0";
    const c = $("#rp-compara");
    if (!r) { c.textContent = "Preencha a diária e as noites para comparar."; return; }
    const x = (P.impl / r).toLocaleString("pt-BR", {maximumFractionDigits: 1});
    const noites = (mensal / diaria).toLocaleString("pt-BR", {maximumFractionDigits: 1});
    c.innerHTML = "";
    const s1 = document.createElement("strong"); s1.textContent = `${x} ${P.impl / r <= 1 ? "reserva" : "reservas"}`;
    const s2 = document.createElement("strong"); s2.textContent = `${noites} ${mensal / diaria <= 1 ? "diária" : "diárias"}`;
    c.append(`A implantação do plano ${P.nome} (${reais(P.impl)}) equivale a `, s1, " como essa. A mensalidade equivale a ", s2, " por mês.");
  }

  Object.values(campos).filter(Boolean).forEach(inp => {
    inp.addEventListener("input", calcular);
    inp.addEventListener("blur", () => { formatarCampo(inp); calcular(); });
  });
  ["#rp-diaria", "#rp-noites"].forEach(s => {
    const inp = $(s);
    inp.addEventListener("input", calcular);
    inp.addEventListener("blur", () => { formatarCampo(inp); calcular(); });
  });

  // dica ao passar o mouse sobre um trecho da barra
  if (figura) figura.addEventListener("pointermove", e => {
    const seg = e.target.closest(".seg");
    if (!seg) { dica.hidden = true; return; }
    const fr = figura.getBoundingClientRect(), sr = seg.getBoundingClientRect();
    dica.textContent = `${seg.dataset.rotulo}: ${seg.dataset.valor}`;
    dica.style.left = (sr.left + sr.width / 2 - fr.left) + "px";
    dica.style.top = (sr.top - fr.top) + "px";
    dica.hidden = false;
  });
  if (figura) figura.addEventListener("pointerleave", () => { dica.hidden = true; });

  marcarPlano();
  calcular();
})();
