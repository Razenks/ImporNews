# ImporNews

Painel pessoal, escuro e responsivo, com o que importa no Brasil e no mundo: câmbio e cripto quase em tempo real, indicadores do Banco Central, Congresso, eleições, clima, tecnologia e notícias. Funciona no celular e no computador, e dá para instalar na tela inicial (PWA).

```
apps/web   React + Vite + TypeScript   → Vercel
apps/api   Node + Fastify + TypeScript → Railway
           Neon Postgres (histórico das cotações + arquivo de notícias de 30 dias)
```

## Atualiza sozinho

Nada precisa de recarregar a página:

- **Cotações**: a cada ~30 s, empurradas para o navegador por um canal ao vivo (SSE).
- **Demais fontes**: a API busca cada uma no seu ritmo (5 a 30 min). O site pede os dados novos a cada 60 s e quando você volta para a aba.
- **Notícias novas**: se chegar algo mais novo que o topo da lista, aparece o aviso "↑ N novas notícias" (a lista não pula enquanto você lê).

Cada fonte roda isolada: se uma cair, o painel mostra o último dado bom marcado como "desatualizado".

**Plano B das cotações:** a AwesomeAPI limita por IP (erro 429) e servidores de hospedagem compartilham IPs. Se ela recusar, a API usa automaticamente o câmbio do BCE (Frankfurter) e a cripto da Coinbase, e volta para a principal depois de alguns minutos. **Câmbio em tempo real (recomendado):** sem chave, a AwesomeAPI limita a 100 requisições e os servidores da Railway dividem o mesmo IP, então o painel cai no plano B (câmbio diário do BCE). Com uma chave gratuita são 100 mil requisições por mês, sem cache. Crie a conta em awesomeapi.com.br, confirme o e-mail, copie a chave em "API Keys" e coloque na Railway como `AWESOMEAPI_TOKEN=SUA_CHAVE` (o painel usa ~65 mil requisições por mês).

## Abas

Mercado · Política · Tempo · Notícias locais · Mundo · Tecnologia · Games · Esportes · Notícias · Notícias boas

Quem escolhe a região (botão no topo/menu: **estado** e, se quiser, **cidade**, qualquer uma das 5.570 do IBGE) personaliza três abas. A escolha fica salva só naquele aparelho, sem login.

- **Tempo**: tempo agora e previsão da cidade, alertas do INMET do estado, capitais e alertas do país.
- **Notícias locais**: da cidade ou do estado, de 24 h a 30 dias, com busca, filtro por veículo e o interruptor **"Sem crimes e tragédias"** (esconde manchetes de assalto, assassinato, acidente etc.). Fontes: Google Notícias (que reúne veículos locais, prefeituras e câmaras) + feeds próprios (hoje MS: Campo Grande News e Primeira Página; para incluir outros, edite `DIRECT` em `apps/api/src/sources/local.ts`). O link abre a matéria no site do veículo.
- **Política → Sua bancada**: deputados e senadores do estado, com link para o perfil de cada um.

As buscas de região são feitas na hora (cache de 10 min no servidor), sem ocupar o banco.

## Games e Esportes

**Games** (aba 07): IGN Brasil, Adrenaline, Meups, Critical Hits, PSX Brasil, Nintendo Blast, Mais Esports e GameVicio (Brasil); IGN, GameSpot, Eurogamer, PC Gamer, Kotaku, Polygon, Rock Paper Shotgun, VGC, GamesRadar, Destructoid, Dexerto, Nintendo Life, Push Square, PlayStation Blog e Xbox Wire (mundo), mais uma busca no Google Notícias. Filtro por plataforma: PlayStation, Xbox, Nintendo, PC, Mobile, eSports.

**Esportes** (aba 08): ge, ESPN Brasil, Gazeta Esportiva, Folha, Placar, Trivela e Motorsport.com Brasil (Brasil); BBC Sport, ESPN, CBS Sports, Motorsport.com, Autosport, Crash.net e The Race (mundo), mais buscas por modalidade no Google Notícias (em português e, para as lutas, vôlei e olímpicos, em inglês). Filtro por modalidade: futebol, F1, MotoGP, basquete, vôlei, tênis, fisiculturismo, **artes marciais** (com submenu: MMA/UFC, boxe, judô, muay thai, jiu-jitsu, outras lutas) e olímpicos.

Em Esportes, Games e Notícias boas há também o filtro **Tudo · Brasil · Mundo**, que separa veículos brasileiros dos internacionais. A modalidade/plataforma de cada notícia vem do feed (quando é de uma só) ou é descoberta por palavras no título (`apps/api/src/sports.ts` e `games.ts`; dá para ajustar as listas). A lista de veículos mostra só os 12 mais ativos; os demais aparecem pela busca.

## Notícias boas

Aba só com conquistas, descobertas e solidariedade, em dois modos: **Brasil e mundo** e **Perto de mim** (usa a região escolhida).

- **Fontes feitas para isso**: Só Notícia Boa (BR), Good News Network, Reasons to be Cheerful e Optimist Daily (em inglês).
- **Filtro por palavras** (`apps/api/src/mood.ts`): o que já coletamos de Brasil e mundo e uma busca específica no Google Notícias só entram se o título tiver palavra de conquista, descoberta ou solidariedade e nenhuma palavra de crime, morte, acidente ou guerra. Notícias de produto/empresa de tecnologia não contam. A classificação é por palavras-chave, então pode escapar uma manchete ou outra; para ajustar, edite as listas em `mood.ts`.

## Busca e links

- **Buscar no site** (botão no topo/menu, tecla `/` ou `Ctrl+K`): acha notícias dos últimos 30 dias (todas as seções), projetos de lei da Câmara e do Senado e leva direto a uma seção ("dólar" → Mercado, "nvidia" → Tecnologia…).
- **Congresso**: busca de projetos de lei e **link em todos os itens** (votações, projetos, matérias, agenda), abrindo a página oficial da Câmara ou do Senado.

## Notícias: 24 h, 7 dias e 30 dias

As notícias coletadas ficam guardadas no Neon (tabela `articles`). Em **Tecnologia** e **Notícias** dá para escolher **24 h · 7 dias · 30 dias**, buscar por texto e filtrar por veículo.

- **Retenção**: 30 dias de consulta + 1 de margem. Uma rotina agendada (ao iniciar e a cada 6 h) **apaga sozinha** tudo com mais de 31 dias, e as cotações com mais de 8 dias. O banco não cresce.
- **Histórico inicial**: ao subir, a API busca o que cada fonte permite voltar (páginas antigas do TechCrunch, Showmetech e Mobile Time; busca por data do Hacker News e do IBGE; feeds longos como OpenAI e Hugging Face). Fontes sem acesso ao passado (ex.: Tecnoblog, The Verge) acumulam dia a dia, e a tela avisa quando uma fonte ainda não tem o período completo.

## Fontes

| Módulo | Fonte |
|---|---|
| Câmbio, BTC, ETH | AwesomeAPI + CoinGecko |
| PTAX, Selic, IPCA | Banco Central (SGS) |
| Congresso | Câmara dos Deputados, Senado Federal (dados abertos) |
| Clima | Open-Meteo, INMET (alertas) |
| Mundo | ONU News, OMS (Disease Outbreak News) |
| Notícias | Agência Brasil (RSS), IBGE |
| **Tecnologia · Brasil** | Tecnoblog, Canaltech, Olhar Digital, Mobile Time, G1 Tecnologia, Folha Tec, Showmetech |
| **Tecnologia · Mundo** | Ars Technica, The Verge, Wired, TechCrunch, MIT Technology Review, BBC Technology, IEEE Spectrum, Engadget, The Register, Hacker News |
| **Tecnologia · Empresas** (newsrooms oficiais) | NVIDIA, Apple (Newsroom e ML Research), OpenAI, **Anthropic**\*, Google (blog, AI, DeepMind, Research), Microsoft, Meta, AWS, Samsung, GitHub, Hugging Face, Mistral AI, Cloudflare |

\* A Anthropic não publica RSS; a API lê a página oficial `anthropic.com/news`. Se o formato dela mudar, essa fonte falha isolada e as demais seguem.

Para incluir ou tirar uma fonte de tecnologia, edite a lista `FEEDS` em `apps/api/src/sources/tech.ts`.

## Rodar localmente

```bash
npm install
cp apps/api/.env.example apps/api/.env   # preencha DATABASE_URL (Neon)
npm run dev                              # API :3001 + site :5173
```

Sem `DATABASE_URL` a API sobe do mesmo jeito, guardando histórico e notícias só em memória.

## Deploy

**1. Neon** — crie o projeto e copie a connection string. As tabelas são criadas sozinhas no primeiro start.

**2. Railway (API)**
- New Project → Deploy from GitHub → *Root Directory*: `apps/api`
- Variáveis:
  - `DATABASE_URL` = connection string do Neon
  - `ALLOWED_ORIGINS` = URL do site na Vercel (ex.: `https://impornews.vercel.app`), separadas por vírgula se forem várias
- Build: `npm run build` · Start: `npm run start`
- Teste: `https://SUA-API.up.railway.app/api/health`
- Importante: deixe o serviço **sempre ligado** (sem "sleep"); é ele que coleta e arquiva as notícias o tempo todo.

**3. Vercel (site)**
- Import Project → *Root Directory*: `apps/web` (o Vite é detectado sozinho)
- Variável: `VITE_API_URL` = URL pública da API na Railway (sem barra no final)

## Animações

Vêm ligadas por padrão (abertura, entrada ao rolar, expandir ao clicar, hovers, cursor nos gráficos). O botão **Animações** no rodapé / barra lateral desliga tudo e a escolha fica salva no navegador.

## Ainda não incluído (aparecem cinza e sem clique, como "Em breve")

- **Apuração do TSE** (2º turno de 25/10): o painel mostra a contagem regressiva, as notícias do tema e um link direto para resultados.tse.jus.br; os arquivos de apuração ainda não foram integrados.
- Diário Oficial, Portal da Transparência (exige chave), Tesouro, Itamaraty e DATASUS.
