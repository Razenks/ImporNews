# ImporNews

Painel pessoal, escuro e responsivo, com o que importa no Brasil e no mundo: câmbio e cripto quase em tempo real, indicadores do Banco Central, Congresso, eleições, clima e notícias. Funciona no celular e no computador, e dá para instalar na tela inicial (PWA).

```
apps/web   React + Vite + TypeScript   → Vercel
apps/api   Node + Fastify + TypeScript → Railway
           Neon Postgres (histórico das cotações para os gráficos de 24 h)
```

## Fontes

| Módulo | Fonte | Atualização |
|---|---|---|
| Câmbio, BTC, ETH | AwesomeAPI + CoinGecko | 30 s (ao vivo por SSE) |
| PTAX, Selic, IPCA | Banco Central (SGS) | 30 min |
| Câmara dos Deputados | dadosabertos.camara.leg.br | 10 min |
| Senado Federal | legis.senado.leg.br/dadosabertos | 10 min |
| Notícias | Agência Brasil (RSS), IBGE | 5–10 min |
| Mundo | ONU News (RSS), OMS (Disease Outbreak News) | 10–30 min |
| Clima | Open-Meteo, INMET (alertas) | 15 min |

Cada fonte roda isolada: se uma cair, o painel mostra o último dado bom marcado como "desatualizado".

## Rodar localmente

```bash
npm install
cp apps/api/.env.example apps/api/.env   # preencha DATABASE_URL (Neon)
npm run dev                              # API :3001 + site :5173
```

Sem `DATABASE_URL` a API sobe do mesmo jeito, guardando o histórico só em memória.

## Deploy

**1. Neon** — crie o projeto e copie a connection string. A tabela `quote_history` é criada sozinha no primeiro start.

**2. Railway (API)**
- New Project → Deploy from GitHub → *Root Directory*: `apps/api`
- Variáveis:
  - `DATABASE_URL` = connection string do Neon
  - `ALLOWED_ORIGINS` = URL do site na Vercel (ex.: `https://impornews.vercel.app`), separadas por vírgula se forem várias
- Build: `npm run build` · Start: `npm run start`
- Teste: `https://SUA-API.up.railway.app/api/health`

**3. Vercel (site)**
- Import Project → *Root Directory*: `apps/web` (o Vite é detectado sozinho)
- Variável: `VITE_API_URL` = URL pública da API na Railway (sem barra no final)

## Animações

Vêm ligadas por padrão (abertura, entrada ao rolar, expandir ao clicar, hovers, cursor nos gráficos). O botão **Animações** no rodapé / barra lateral desliga tudo e a escolha fica salva no navegador.

## Ainda não incluído

- **Apuração do TSE** (2º turno de 25/10): o painel mostra a contagem regressiva, as notícias do tema e um link direto para resultados.tse.jus.br; os arquivos de apuração ainda não foram integrados.
- Diário Oficial, Portal da Transparência (exige chave), Tesouro, Itamaraty e DATASUS.
