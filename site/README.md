# Site

`recepcao-24h-whatsapp.html`: página ilustrada do atendente (versão standalone, abre direto no navegador).

Cópias:
- Artifact: https://claude.ai/artifact/BtwBBRLCmwgK69KezKWAxy
- Google Drive: pasta "Assistente de Pousadas" → https://drive.google.com/drive/folders/1GsHL6Pa_xie92O7SbrQsT74gVciFRsOv

## Publicado

- Railway (projeto `pousadas-site`, serviço `recepcao-24h`): https://recepcao-24h-production.up.railway.app
- Deploy automático a cada push na branch `claude/prospeccao-whatsapp-pousadas-k0akrw` (pasta `site/`, servida pelo `index.html`).
- `/` redireciona para `/lumi/` (desde 07/10/2026). A página antiga continua em `/recepcao-24h-whatsapp.html` (nome e preços antigos).
- `/lumi/`: landing da Lumi para pousadas (fonte: `../lumi-pousadas/index.html` na pasta do projeto).
- `/negocios/`: landing genérica da Lumi (salão, barbearia, corretor, clínica, loja); fonte: `../lumi-site/index.html`.
- `/tour/`: landing do tour em vídeo da pousada (fonte: `../tour-pousada/index.html`). Vídeos em `tour/media/`.
- As duas têm botões uma para a outra (links absolutos no domínio do Railway).
