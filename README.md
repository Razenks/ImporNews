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

**Plano B das cotações:** a AwesomeAPI limita por IP (erro 429) e servidores de hospedagem compartilham IPs. Se ela recusar, a API usa automaticamente o câmbio do BCE (Frankfurter) e a cripto da Coinbase, e volta para a principal depois de alguns minutos. Opcional: crie uma chave gratuita na AwesomeAPI e coloque em `AWESOMEAPI_TOKEN` na Railway para ter mais limite.

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

## Ainda não incluído

- **Apuração do TSE** (2º turno de 25/10): o painel mostra a contagem regressiva, as notícias do tema e um link direto para resultados.tse.jus.br; os arquivos de apuração ainda não foram integrados.
- Diário Oficial, Portal da Transparência (exige chave), Tesouro, Itamaraty e DATASUS.
