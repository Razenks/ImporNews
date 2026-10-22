import { useState } from 'react';
import { fetchDevs, type Repo } from '../api';
import { Ext, Item, Segmented, SectionHead, Skeleton } from '../components';
import { ago, intl } from '../format';
import { useAsync, useDebounced } from '../hooks';
import { Failed } from './RegionBits';

type View = 'trending' | 'novos' | 'atualizados';
type Period = '1d' | '7d' | '30d';
const DAYS = { '1d': 1, '7d': 7, '30d': 30 } as const;

const LANGS = ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C#', 'PHP', 'Kotlin', 'Swift', 'C++', 'Ruby', 'Dart'];

const PERIOD_LABELS: Record<View, { value: Period; label: string }[]> = {
  trending: [{ value: '1d', label: 'Hoje' }, { value: '7d', label: 'Semana' }, { value: '30d', label: 'Mês' }],
  novos: [{ value: '1d', label: '24 h' }, { value: '7d', label: '7 dias' }, { value: '30d', label: '30 dias' }],
  atualizados: [{ value: '1d', label: '24 h' }, { value: '7d', label: '7 dias' }, { value: '30d', label: '30 dias' }],
};

const GAINED: Record<Period, string> = { '1d': 'hoje', '7d': 'na semana', '30d': 'no mês' };

const HELP: Record<View, (p: Period) => string> = {
  trending: (p) => `Os que mais ganharam estrelas ${GAINED[p]} (lista do GitHub Trending).`,
  novos: (p) => `Criados ${p === '1d' ? 'nas últimas 24 horas' : p === '7d' ? 'nos últimos 7 dias' : 'nos últimos 30 dias'}, dos mais estrelados para os menos.`,
  atualizados: (p) => `Projetos já populares (muitas estrelas) com código novo ${p === '1d' ? 'nas últimas 24 horas' : p === '7d' ? 'nos últimos 7 dias' : 'nos últimos 30 dias'}.`,
};

function RepoCard({ r, period, view, now }: { r: Repo; period: Period; view: View; now: number }) {
  const [owner, name] = r.name.split('/');
  return (
    <Item>
      <div className="feed-meta repo-meta">
        {r.language && (
          <span className="lang">
            <i className="lang-dot" style={{ background: r.color ?? 'var(--t3)' }} aria-hidden="true" />
            {r.language}
          </span>
        )}
        <span>★ {intl(r.stars)}</span>
        {r.gained !== null && view === 'trending' && <span className="gain">+{intl(r.gained)} {GAINED[period]}</span>}
        {r.forks !== null && <span>⑂ {intl(r.forks)}</span>}
        {view === 'novos' && r.createdAt && <time dateTime={r.createdAt}>criado {ago(r.createdAt, now)}</time>}
        {view === 'atualizados' && r.pushedAt && <time dateTime={r.pushedAt}>ativo {ago(r.pushedAt, now)}</time>}
      </div>
      <Ext href={r.url} className="headline">
        <span className="owner">{owner}/</span>{name}
        <i className="ext" aria-hidden="true"> ↗</i>
      </Ext>
      {r.description && <p>{r.description}</p>}
    </Item>
  );
}

/** Repositórios do GitHub: o que está em alta, o que é novo e o que está sendo atualizado. */
export function Devs({ now }: { now: number }) {
  const [view, setView] = useState<View>('trending');
  const [period, setPeriod] = useState<Period>('7d');
  const [lang, setLang] = useState<string | undefined>();
  const [text, setText] = useState('');
  const q = useDebounced(text, 600).trim() || undefined;
  const canSearch = view !== 'trending';

  const r = useAsync(
    () => fetchDevs({ view, days: DAYS[period], lang, q: canSearch ? q : undefined }),
    [view, period, lang, canSearch ? q : undefined],
  );
  const items = r.data ?? [];

  return (
    <section id="devs" className="section" aria-labelledby="devs-t" data-sec="devs">
      <SectionHead id="devs" n="11" title="Devs" now={now}>
        <Segmented<View>
          label="Tipo de lista"
          value={view}
          onChange={(v) => setView(v)}
          options={[
            { value: 'trending', label: 'Em alta' },
            { value: 'novos', label: 'Novos' },
            { value: 'atualizados', label: 'Atualizados' },
          ]}
        />
      </SectionHead>
      <p className="blurb">
        Repositórios do GitHub para ficar por dentro do que está acontecendo no código aberto: o que está em alta, o que acabou de nascer e
        quais projetos grandes estão sendo atualizados. Filtre por linguagem.
      </p>

      <div className="toolbar">
        <Segmented<Period> label="Período" value={period} onChange={setPeriod} options={PERIOD_LABELS[view]} />
        {canSearch && (
          <label className="search">
            <span className="sr">Buscar repositórios</span>
            <input
              type="search"
              inputMode="search"
              placeholder="Buscar (ex.: agent, cli)…"
              value={text}
              maxLength={60}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        )}
      </div>

      <div className="chips tags" role="group" aria-label="Filtrar por linguagem">
        <button type="button" aria-pressed={!lang} onClick={() => setLang(undefined)}>Todas</button>
        {LANGS.map((l) => (
          <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(lang === l ? undefined : l)}>{l}</button>
        ))}
      </div>

      <p className="archive-info">
        <b>{items.length}</b> repositórios{lang ? <> em <b>{lang}</b></> : null}{q && canSearch ? <> · busca “{q}”</> : null} · {HELP[view](period)}
      </p>

      {r.loading && !r.data ? (
        <Skeleton rows={6} />
      ) : r.error && !r.data ? (
        <Failed text="Não consegui buscar os repositórios agora (o GitHub limita as consultas). Tente de novo em instantes." onRetry={r.reload} />
      ) : items.length === 0 ? (
        <div className="empty-box"><p>Nenhum repositório encontrado com esses filtros.</p></div>
      ) : (
        <ul className={`feed local-feed ${r.loading ? 'is-loading' : ''}`} key={`${view}|${period}|${lang ?? ''}|${q ?? ''}`}>
          {items.map((x) => (
            <RepoCard key={x.name} r={x} period={period} view={view} now={now} />
          ))}
        </ul>
      )}
      <p className="source-note">
        Fonte: GitHub (API pública de busca e a lista de Trending). O GitHub limita as consultas, por isso as listas são guardadas por alguns
        minutos. O link abre o repositório no GitHub.
      </p>
    </section>
  );
}
