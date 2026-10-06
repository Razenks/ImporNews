# ImporNews — design

Painel pessoal, responsivo e escuro, com dados do Brasil e do mundo. Uso próprio, sem login.

## Objetivo
Abrir no celular ou no computador e ver, num só lugar: câmbio e cripto quase em tempo real, indicadores oficiais, política, clima, notícias e alertas globais.

## Arquitetura
- `apps/web` — Vite + React + TypeScript, CSS próprio (sem Tailwind/shadcn). Hospedagem: Vercel. PWA instalável.
- `apps/api` — Node + Fastify + TypeScript. Hospedagem: Railway. Agrega as fontes, converte XML/RSS para JSON, mantém cache em memória e empurra cotações por SSE.
- Neon Postgres — histórico de cotações (`quote_history`) para os mini-gráficos. A API sobe e funciona sem o banco (fallback em memória).

## Fontes (v1)
| Módulo | Fonte | Atualização |
|---|---|---|
| Câmbio, BTC | AwesomeAPI | 30 s |
| BTC, ETH | CoinGecko | 60 s |
| PTAX, Selic, IPCA | Banco Central SGS | 30 min |
| Proposições, eventos | Câmara dos Deputados | 10 min |
| Votações do plenário | Senado (XML) | 10 min |
| Notícias | Agência Brasil (RSS), IBGE | 5 min |
| Mundo | ONU News (RSS), OMS | 10 min |
| Clima | Open-Meteo, INMET (alertas) | 15 min |

v2: Eleições (TSE), Diário Oficial, Transparência, Tesouro.

## API
- `GET /api/overview` — cotações atuais + indicadores
- `GET /api/stream` — SSE com cotações
- `GET /api/history/:symbol` — série para sparkline
- `GET /api/gov`, `/api/news`, `/api/world`, `/api/weather`
- CORS restrito a `ALLOWED_ORIGINS`, rate limit por IP.

## Design visual
"Mesa de redação financeira à noite". Preto/grafite/cinza/branco; roxo como acento único (ao vivo, foco, item ativo), sem gradientes. Schibsted Grotesk + Martian Mono (números tabulares). Linhas finas de 1px, sem cards arredondados com sombra. Seções numeradas. Números piscam ao mudar. Sparklines em SVG próprio.

## Responsivo
Mobile-first. Celular: coluna única, abas fixas embaixo, faixa de cotações rolável, alvos ≥ 44px, safe-area. Tablet: 2 colunas. Desktop (≥ 1100px): grade assimétrica, navegação lateral.

## Erros
Cada módulo falha isoladamente: se uma fonte cair, serve o último dado em cache marcado como "desatualizado" e o resto do painel segue funcionando.
