# Site

`recepcao-24h-whatsapp.html`: página ilustrada do atendente (versão standalone, abre direto no navegador).

Cópias:
- Artifact: https://claude.ai/artifact/BtwBBRLCmwgK69KezKWAxy
- Google Drive: pasta "Assistente de Pousadas" → https://drive.google.com/drive/folders/1GsHL6Pa_xie92O7SbrQsT74gVciFRsOv

## Publicado

- Railway (projeto `pousadas-site`, serviço `recepcao-24h`): https://recepcao-24h-production.up.railway.app
- Deploy automático a cada push na branch `claude/prospeccao-whatsapp-pousadas-k0akrw` (pasta `site/`, servida pelo `index.html`).
- Domínio próprio: **oilumi.com.br** (registrado em 08/10/2026 no registro.br, titular Caue). `www.oilumi.com.br` aponta por CNAME para o Railway; o domínio sem www depende de DNS com CNAME flattening (ver pendência abaixo).
- `/`: landing da Lumi para pousadas (fonte: `../lumi-pousadas/index.html` na pasta do projeto). Desde 08/10/2026 fica na raiz; `/lumi/` redireciona para `/`.
- `/mira/`: landing da Mira, tour em vídeo da pousada (fonte: `../tour-pousada/index.html`). Vídeos em `mira/media/`. `/tour/` redireciona para `/mira/`.
- `/negocios/`: landing genérica da Lumi (salão, barbearia, corretor, clínica, loja); fonte: `../lumi-site/index.html`.
- A página antiga continua em `/recepcao-24h-whatsapp.html` (nome e preços antigos).
- As duas têm botões uma para a outra (links relativos `/` e `/mira/`, funcionam em qualquer domínio).
