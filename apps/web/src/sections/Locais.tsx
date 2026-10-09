import { useRef, useState } from 'react';
import { fetchLocalNews, type Bundle, type LocalItem, type LocalNewsPage } from '../api';
import { Ext, Item, Segmented, SectionHead, Skeleton } from '../components';
import { ago } from '../format';
import { useDebounced, usePagedList } from '../hooks';
import { scrollToNew } from '../motion';
import { ufName, usePlace, type Place } from '../place';
import { Failed, Onboard } from './RegionBits';

type Period = '1d' | '7d' | '30d';
const DAYS = { '1d': 1, '7d': 7, '30d': 30 } as const;
const LABEL = { '1d': 'últimas 24 horas', '7d': 'últimos 7 dias', '30d': 'últimos 30 dias' } as const;

const CALM_KEY = 'impornews:calm';
const loadCalm = (): boolean => {
  try {
    return localStorage.getItem(CALM_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Notícias da cidade ou do estado escolhidos. Com `good`, só notícias boas.
 * Sem `good`, há o interruptor "sem crimes e tragédias".
 */
export function LocalNews({ place, now, good = false }: { place: Place; now: number; good?: boolean }) {
  const [period, setPeriod] = useState<Period>(good ? '7d' : '1d');
  const [scope, setScope] = useState<'city' | 'state'>(place.city ? 'city' : 'state');
  const [text, setText] = useState('');
  const [source, setSource] = useState<string | undefined>();
  const [calm, setCalm] = useState(loadCalm);
  const q = useDebounced(text, 400).trim() || undefined;
  const days = DAYS[period];
  const effScope = place.city ? scope : 'state';

  const list = usePagedList<LocalItem, LocalNewsPage>(
    (offset, limit) => fetchLocalNews({ uf: place.uf, city: place.city, scope: effScope, days, q, source, limit, offset, good, calm: !good && calm }),
    (i) => i.url,
    (i) => i.date,
    [place.uf, place.city, effScope, days, q, source, good, calm],
  );
  const listRef = useRef<HTMLUListElement>(null);
  const showMore = async () => {
    const before = listRef.current?.children.length ?? 0;
    await list.loadMore();
    scrollToNew(listRef.current, before);
  };
  const total = list.extra?.total ?? 0;
  const sources = list.extra?.sources ?? [];
  const where = effScope === 'city' && place.city ? place.city : ufName(place.uf);

  const toggleCalm = () => {
    const next = !calm;
    setCalm(next);
    setSource(undefined);
    try { localStorage.setItem(CALM_KEY, next ? '1' : '0'); } catch { /* ok */ }
  };

  return (
    <div className="archive">
      <div className="toolbar">
        <Segmented<Period>
          label="Período"
          value={period}
          onChange={(p) => { setPeriod(p); setSource(undefined); }}
          options={[{ value: '1d', label: '24 h' }, { value: '7d', label: '7 dias' }, { value: '30d', label: '30 dias' }]}
        />
        {place.city && (
          <Segmented<'city' | 'state'>
            label="Abrangência"
            value={scope}
            onChange={(s) => { setScope(s); setSource(undefined); }}
            options={[{ value: 'city', label: place.city.length > 14 ? 'Cidade' : place.city }, { value: 'state', label: `Estado · ${place.uf}` }]}
          />
        )}
        <label className="search">
          <span className="sr">Buscar nas notícias daqui</span>
          <input type="search" inputMode="search" placeholder="Buscar em notícias daqui…" value={text} maxLength={60} onChange={(e) => setText(e.target.value)} />
        </label>
      </div>

      {!good && (
        <button type="button" className="calm" aria-pressed={calm} onClick={toggleCalm}>
          <i aria-hidden="true" />
          <span>Sem crimes e tragédias</span>
          <em>{calm ? 'ligado' : 'desligado'}</em>
        </button>
      )}

      {sources.length > 1 && (
        <div className="chips" role="group" aria-label="Filtrar por veículo">
          <button type="button" aria-pressed={!source} onClick={() => setSource(undefined)}>Todos</button>
          {sources.map((s) => (
            <button key={s.name} type="button" aria-pressed={source === s.name} onClick={() => setSource(source === s.name ? undefined : s.name)}>
              {s.name}<b>{s.n}</b>
            </button>
          ))}
        </div>
      )}

      <p className="archive-info">
        <b>{total}</b> {total === 1 ? 'notícia' : 'notícias'} {good ? 'boas ' : ''}sobre <b>{where}</b> · {LABEL[period]}
        {q ? <> · busca “{q}”</> : null}
        {!good && calm ? <> · sem crimes e tragédias</> : null}
      </p>

      {list.freshCount > 0 && (
        <button type="button" className="fresh" onClick={list.applyFresh}>
          <i aria-hidden="true">↑</i> {list.freshCount} {list.freshCount === 1 ? 'nova notícia' : 'novas notícias'}
        </button>
      )}

      {list.loading && !list.items.length ? (
        <Skeleton rows={6} />
      ) : list.error && !list.items.length ? (
        <Failed text="Não consegui buscar as notícias agora." onRetry={list.reload} />
      ) : !list.items.length ? (
        <div className="empty-box">
          <p>{q ? 'Nada encontrado para essa busca neste período.' : good ? 'Nenhuma notícia boa encontrada aqui neste período. Boas notícias são mais raras de achar em lugares pequenos.' : 'Nenhuma notícia encontrada neste período.'}</p>
          {days < 30 && (
            <button type="button" className="more-link" onClick={() => setPeriod(days === 1 ? '7d' : '30d')}>
              Ver {days === 1 ? 'os últimos 7 dias' : 'os últimos 30 dias'}
            </button>
          )}
          {effScope === 'city' && (
            <button type="button" className="more-link" onClick={() => setScope('state')}>Ver o estado todo</button>
          )}
        </div>
      ) : (
        <ul className={`feed local-feed ${list.loading ? 'is-loading' : ''}`} ref={listRef}>
          {list.items.map((x) => (
            <Item key={x.url}>
              <div className="feed-meta">
                <span className="tag">{x.source}</span>
                <time dateTime={x.date} title={new Date(x.date).toLocaleString('pt-BR')}>{ago(x.date, now)}</time>
              </div>
              <Ext href={x.url} className="headline">{x.title}<i className="ext" aria-hidden="true"> ↗</i></Ext>
              {x.summary && <p>{x.summary}</p>}
            </Item>
          ))}
        </ul>
      )}

      {list.items.length > 0 && list.items.length < total && (
        <button type="button" className="more-btn" disabled={list.loadingMore} onClick={showMore}>
          {list.loadingMore ? 'Carregando…' : `Mostrar mais ${Math.min(20, total - list.items.length)} · ${total - list.items.length} restantes`}
        </button>
      )}
      <p className="source-note">
        Fontes: veículos locais{place.uf === 'MS' ? ' (Campo Grande News, Primeira Página)' : ''} e Google Notícias. O link abre a matéria no site do veículo.
        {good || calm ? ' A seleção é feita por palavras-chave, então pode escapar algo.' : ''}
      </p>
    </div>
  );
}

export function Locais({ bundle, now }: { bundle: Bundle | null; now: number }) {
  const { place, openPicker } = usePlace();
  return (
    <section id="local" className="section" aria-labelledby="local-t" data-sec="local">
      <SectionHead id="local" n="08" title="Notícias locais" env={bundle?.agenciabrasil} now={now} />
      {!place ? (
        <Onboard
          title="Veja as notícias da sua cidade ou estado"
          intro="Escolha onde você mora e o painel passa a mostrar o que acontece por perto:"
          bullets={[
            <><b>Notícias</b> da sua cidade ou do estado inteiro, de 24 horas até 30 dias</>,
            <><b>Busca</b> dentro das notícias daqui e filtro por veículo</>,
            <><b>Sem crimes e tragédias</b>: um interruptor para esconder o que pesa</>,
          ]}
        />
      ) : (
        <div key={`${place.uf}|${place.city ?? ''}`}>
          <h3 className="sub-head">
            {place.city ?? ufName(place.uf)}
            <button type="button" className="sub-action" onClick={openPicker}>trocar região</button>
          </h3>
          <LocalNews place={place} now={now} />
        </div>
      )}
    </section>
  );
}
