import { useRef, useState } from 'react';
import type { Arc } from '../api';
import { Empty, Ext, Img, Item, Segmented, Skeleton } from '../components';
import { ago, dayMonth } from '../format';
import { useArticles, useDebounced } from '../hooks';
import { scrollToNew } from '../motion';
import { ArticleMore } from './Eleicoes';
import { Failed } from './RegionBits';

type Period = '1d' | '7d' | '30d';
type Region = 'tudo' | 'br' | 'mundo';

/** Uma pílula de modalidade/plataforma. `match` são as tags guardadas no banco; `children` abrem um submenu. */
export interface TagDef {
  id: string;
  label: string;
  match: string[];
  children?: { id: string; label: string; match: string[] }[];
}

/** Máximo de botões de veículo (o resto fica acessível pela busca). */
const MAX_CHIPS = 12;
const DAYS = { '1d': 1, '7d': 7, '30d': 30 } as const;
const LABEL = { '1d': 'últimas 24 horas', '7d': 'últimos 7 dias', '30d': 'últimos 30 dias' } as const;

function Entry({ a, now, lead = false }: { a: Arc; now: number; lead?: boolean }) {
  if (lead) {
    return (
      <article className="lead">
        <Img src={a.image} className="lead-img" />
        <div className="feed-meta">
          <span className="tag">{a.source}</span>
          <time dateTime={a.date}>{ago(a.date, now)}</time>
        </div>
        <Ext href={a.url} className="lead-title">{a.title}</Ext>
        {a.summary && <p>{a.summary}</p>}
      </article>
    );
  }
  return (
    <Item className="with-img" more={<ArticleMore a={a} />}>
      <div>
        <div className="feed-meta">
          <span className="tag">{a.source}</span>
          <time dateTime={a.date} title={new Date(a.date).toLocaleString('pt-BR')}>{ago(a.date, now)}</time>
        </div>
        <h4 className="headline">{a.title}</h4>
        {a.summary && <p>{a.summary}</p>}
      </div>
      <Img src={a.image} className="thumb" />
    </Item>
  );
}

/**
 * Notícias guardadas no banco (30 dias): período, busca, filtro por veículo,
 * aviso de notícias novas e "mostrar mais". Usada em Tecnologia e Notícias.
 */
export function ArchiveFeed({
  cat, now, lead = false, defaultPeriod = '1d', coverage = true, regions = false, tags,
}: {
  cat: string;
  now: number;
  lead?: boolean;
  defaultPeriod?: Period;
  coverage?: boolean;
  /** mostra o filtro Tudo · Brasil · Mundo */
  regions?: boolean;
  /** pílulas de modalidade/plataforma (esportes e games) */
  tags?: TagDef[];
}) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [group, setGroup] = useState<string | undefined>();
  const [region, setRegion] = useState<Region>('tudo');
  const [tagId, setTagId] = useState<string | undefined>();
  const [subId, setSubId] = useState<string | undefined>();
  const [text, setText] = useState('');
  const q = useDebounced(text, 350).trim() || undefined;
  const days = DAYS[period];

  const tagDef = tags?.find((t) => t.id === tagId);
  const subDef = tagDef?.children?.find((c) => c.id === subId);
  const tagParam = (subDef ?? tagDef)?.match.join(',') || undefined;
  const a = useArticles({ cat, days, group, q, tag: tagParam, region: region === 'tudo' ? undefined : region });
  const countOf = (match: string[]) => a.tagCounts.filter((t) => match.includes(t.tag)).reduce((s, t) => s + t.n, 0);
  const pickTag = (id: string | undefined) => { setTagId(id); setSubId(undefined); setGroup(undefined); };
  const listRef = useRef<HTMLUListElement>(null);
  const showMore = async () => {
    const before = listRef.current?.children.length ?? 0;
    await a.loadMore();
    scrollToNew(listRef.current, before);
  };

  const since = new Date(now - days * 86_400_000).toISOString();
  const partial = coverage && days >= 7 ? a.groups.filter((g) => g.oldest > since) : [];
  const topChips = a.groups.filter((g) => g.n > 0).slice(0, MAX_CHIPS);
  const chips = group && !topChips.some((g) => g.grp === group) ? [...topChips, ...a.groups.filter((g) => g.grp === group)] : topChips;
  const [first, ...rest] = a.items;
  const useLead = lead && !q && !!first;
  const list = useLead ? rest : a.items;

  return (
    <div className="archive">
      <div className="toolbar">
        <Segmented<Period>
          label="Período"
          value={period}
          onChange={(p) => { setPeriod(p); setGroup(undefined); }}
          options={[
            { value: '1d', label: '24 h' },
            { value: '7d', label: '7 dias' },
            { value: '30d', label: '30 dias' },
          ]}
        />
        {regions && (
          <Segmented<Region>
            label="Origem do veículo"
            value={region}
            onChange={(r) => { setRegion(r); setGroup(undefined); }}
            options={[{ value: 'tudo', label: 'Tudo' }, { value: 'br', label: 'Brasil' }, { value: 'mundo', label: 'Mundo' }]}
          />
        )}
        <label className="search">
          <span className="sr">Buscar nestas notícias</span>
          <input
            type="search"
            inputMode="search"
            placeholder="Buscar…"
            value={text}
            maxLength={80}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      </div>

      {tags && (
        <div className="chips tags" role="group" aria-label="Filtrar por modalidade">
          <button type="button" aria-pressed={!tagId} onClick={() => pickTag(undefined)}>Todos</button>
          {tags.map((t) => {
            const n = countOf(t.match);
            return n > 0 || tagId === t.id ? (
              <button key={t.id} type="button" aria-pressed={tagId === t.id} onClick={() => pickTag(tagId === t.id ? undefined : t.id)}>
                {t.label}<b>{n}</b>
              </button>
            ) : null;
          })}
        </div>
      )}
      {tagDef?.children && (
        <div className="chips tags sub" role="group" aria-label={`Filtrar dentro de ${tagDef.label}`}>
          <button type="button" aria-pressed={!subId} onClick={() => { setSubId(undefined); setGroup(undefined); }}>Todas as lutas</button>
          {tagDef.children.map((c) => {
            const n = countOf(c.match);
            return n > 0 || subId === c.id ? (
              <button key={c.id} type="button" aria-pressed={subId === c.id} onClick={() => { setSubId(subId === c.id ? undefined : c.id); setGroup(undefined); }}>
                {c.label}<b>{n}</b>
              </button>
            ) : null;
          })}
        </div>
      )}

      {chips.length > 1 && (
        <div className="chips" role="group" aria-label="Filtrar por fonte">
          <button type="button" aria-pressed={!group} onClick={() => setGroup(undefined)}>Todas</button>
          {chips.map((g) => (
            <button key={g.grp} type="button" aria-pressed={group === g.grp} onClick={() => setGroup(group === g.grp ? undefined : g.grp)}>
              {g.grp}<b>{g.n}</b>
            </button>
          ))}
        </div>
      )}

      <p className="archive-info">
        <b>{a.total}</b> {a.total === 1 ? 'notícia' : 'notícias'} · {LABEL[period]}
        {region !== 'tudo' ? <> · {region === 'br' ? 'veículos do Brasil' : 'veículos do mundo'}</> : null}
        {(subDef ?? tagDef) ? <> · {(subDef ?? tagDef)!.label}</> : null}
        {q ? <> · busca “{q}”</> : null}
        {days === 30 && <> · o arquivo guarda 30 dias e apaga o resto sozinho</>}
      </p>
      {partial.length > 0 && (
        <p className="archive-note">
          {partial.length === a.groups.length ? 'Todas as fontes' : `${partial.length} de ${a.groups.length} fontes`} ainda não têm {days} dias
          de histórico ({partial.slice(0, 4).map((g) => g.grp).join(', ')}{partial.length > 4 ? '…' : ''}). O arquivo cresce a cada dia.
        </p>
      )}

      {a.freshCount > 0 && (
        <button type="button" className="fresh" onClick={a.applyFresh}>
          <i aria-hidden="true">↑</i> {a.freshCount} {a.freshCount === 1 ? 'nova notícia' : 'novas notícias'}
        </button>
      )}

      {a.loading && !a.items.length ? (
        <Skeleton rows={6} />
      ) : a.error && !a.items.length ? (
        <Failed text="Não consegui carregar as notícias agora. Estou tentando de novo sozinho." onRetry={a.reload} />
      ) : !a.items.length ? (
        <div className="empty-box">
          <p>{q ? 'Nada encontrado para essa busca neste período.' : 'Nenhuma notícia neste período.'}</p>
          {days < 30 && (
            <button type="button" className="more-link" onClick={() => setPeriod(days === 1 ? '7d' : '30d')}>
              Ver {days === 1 ? 'os últimos 7 dias' : 'os últimos 30 dias'}
            </button>
          )}
        </div>
      ) : (
        <div className={`${useLead ? 'news' : 'plain-list'} ${a.loading ? 'is-loading' : ''}`} key={`${period}|${group ?? ''}|${q ?? ''}`}>
          {useLead && <Entry a={first} now={now} lead />}
          <ul className="feed news-list" ref={listRef}>
            {list.map((x) => (
              <Entry key={x.url} a={x} now={now} />
            ))}
          </ul>
        </div>
      )}

      {a.items.length > 0 && a.items.length < a.total && (
        <button type="button" className="more-btn" disabled={a.loadingMore} onClick={showMore}>
          {a.loadingMore ? 'Carregando…' : `Mostrar mais ${Math.min(20, a.total - a.items.length)} · ${a.total - a.items.length} restantes`}
        </button>
      )}
      {dayMonth(a.items.at(-1)?.date) && a.items.length > 0 && a.items.length >= a.total && (
        <p className="archive-end">Fim da lista · a mais antiga é de {dayMonth(a.items.at(-1)?.date)}</p>
      )}
    </div>
  );
}
