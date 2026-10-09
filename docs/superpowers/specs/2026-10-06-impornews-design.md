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

## Adendo — arquivo de notícias e Tecnologia (06/10/2026)
- Tabela `articles` (url única, fonte, grupo, categoria, título, resumo, imagem, data) no Neon.
- Categorias: `brasil`, `tech-br`, `tech-mundo`, `empresas`. `GET /api/articles?cat&days(1|7|30)&group&q&limit&offset`.
- Retenção: 30 dias de consulta; rotina agendada apaga o que passa de 31 dias (ao iniciar e a cada 6 h). Cotações: 8 dias.
- Coleta de ~34 fontes a cada 10 min; backfill de 30 dias na partida (idempotente).
- Seções: 06 Tecnologia (Brasil / Mundo / Empresas), 07 Notícias (Agência Brasil + IBGE), ambas com período, busca, filtro por veículo, aviso de novas e "mostrar mais".

## Adendo — região, busca e links (07/10/2026)
- Navegação com 6 painéis: Mercado, Política (Congresso + Eleições), Minha região (+ capitais/alertas do país), Mundo, Tecnologia, Notícias.
- "Minha região": UF + cidade (IBGE) no `localStorage`. Endpoints `/api/local/{news,cidades,clima,bancada,alertas}`; notícias via Google Notícias RSS + feeds locais, com cache em memória (10 min), sem gravar no banco.
- Busca geral `/api/search` (arquivo de 30 dias + projetos da Câmara e do Senado) e `/api/congresso/busca`.
- Congresso: links em votações (sessão/evento ou matéria), projetos, matérias do Senado e agenda.

## Adendo — abas Tempo, Notícias locais e Notícias boas (07/10/2026)
- "Minha região" dividida em Tempo e Notícias locais; bancada passou para Política. 8 abas no total.
- Notícias boas: coluna `articles.good` (marcada na gravação por `mood.ts`), fontes dedicadas (categoria `boas`) e busca positiva no Google Notícias; "Perto de mim" usa `/api/local/news?good=1`. Interruptor "sem crimes e tragédias" usa `calm=1`.

## Adendo — Games, Esportes e filtro Brasil/Mundo (09/10/2026)
- Categorias `esportes` e `games` no arquivo; colunas `articles.tag` (modalidade/plataforma) e `articles.region` ('br' | 'mundo').
- `GET /api/articles` ganhou `tag` (lista separada por vírgula), `region` e devolve `tagCounts` para as pílulas.
- Barra inferior rola de lado no celular (10 abas); menu lateral lista todas no computador.
