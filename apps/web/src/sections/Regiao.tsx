import { useState } from 'react';
import {
  fetchBancada, fetchLocalAlerts, fetchLocalNews, fetchLocalWeather,
  type Bundle, type LocalItem, type LocalNewsPage, type Parlamentar,
} from '../api';
import { Empty, Ext, Item, Segmented, SectionHead, Skeleton } from '../components';
import { ago, weekdayShort } from '../format';
import { useAsync, useDebounced, usePagedList } from '../hooks';
import { ufName, usePlace, type Place } from '../place';

type Period = '1d' | '7d' | '30d';
const DAYS = { '1d': 1, '7d': 7, '30d': 30 } as const;
const LABEL = { '1d': 'últimas 24 horas', '7d': 'últimos 7 dias', '30d': 'últimos 30 dias' } as const;

/** Bloco que falhou: avisa e oferece tentar de novo. */
function Failed({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="empty-box">
      <p>{text}</p>
      <button type="button" className="more-link" onClick={onRetry}>Tentar de novo</button>
    </div>
  );
}

// ── Notícias da região ────────────────────────────────────────────────

function PlaceNews({ place, now }: { place: Place; now: number }) {
  const [period, setPeriod] = useState<Period>('1d');
  const [scope, setScope] = useState<'city' | 'state'>(place.city ? 'city' : 'state');
  const [text, setText] = useState('');
  const [source, setSource] = useState<string | undefined>();
  const q = useDebounced(text, 400).trim() || undefined;
  const days = DAYS[period];
  const effScope = place.city ? scope : 'state';

  const list = usePagedList<LocalItem, LocalNewsPage>(
    (offset, limit) => fetchLocalNews({ uf: place.uf, city: place.city, scope: effScope, days, q, source, limit, offset }),
    (i) => i.url,
    (i) => i.date,
    [place.uf, place.city, effScope, days, q, source],
  );
  const total = list.extra?.total ?? 0;
  const sources = list.extra?.sources ?? [];
  const where = effScope === 'city' && place.city ? place.city : ufName(place.uf);

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
          <span className="sr">Buscar nas notícias da região</span>
          <input type="search" inputMode="search" placeholder="Buscar em notícias daqui…" value={text} maxLength={60} onChange={(e) => setText(e.target.value)} />
        </label>
      </div>

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
        <b>{total}</b> {total === 1 ? 'notícia' : 'notícias'} sobre <b>{where}</b> · {LABEL[period]}
        {q ? <> · busca “{q}”</> : null}
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
          <p>{q ? 'Nada encontrado para essa busca neste período.' : 'Nenhuma notícia encontrada neste período.'}</p>
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
        <ul className={`feed local-feed ${list.loading ? 'is-loading' : ''}`}>
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
        <button type="button" className="more-btn" disabled={list.loadingMore} onClick={list.loadMore}>
          {list.loadingMore ? 'Carregando…' : `Mostrar mais · ${total - list.items.length} restantes`}
        </button>
      )}
      <p className="source-note">Fontes: veículos locais{place.uf === 'MS' ? ' (Campo Grande News, Primeira Página)' : ''} e Google Notícias. O link abre a matéria no site do veículo.</p>
    </div>
  );
}

// ── Clima, alertas e bancada ──────────────────────────────────────────

function WeatherCard({ place }: { place: Place }) {
  const w = useAsync(() => fetchLocalWeather(place.uf, place.city), [place.uf, place.city]);
  return (
    <div className="wx">
      <h3 className="sub-head">Clima <span>{w.data?.place.name ?? place.city ?? 'capital'}</span></h3>
      {w.loading && !w.data ? <Skeleton rows={3} /> : !w.data ? <Failed text="Clima indisponível agora." onRetry={w.reload} /> : (
        <>
          <div className="wx-now">
            <div className="wx-temp num">{w.data.now.temp}°</div>
            <div className="wx-desc">
              <b>{w.data.now.label}</b>
              <span>sensação {w.data.now.feels}° · umidade {w.data.now.humidity}% · vento {w.data.now.wind} km/h</span>
            </div>
          </div>
          <ul className="wx-days">
            {w.data.days.map((d, i) => (
              <li key={d.date}>
                <time>{i === 0 ? 'hoje' : weekdayShort(d.date)}</time>
                <span className="wx-lbl">{d.label}</span>
                <span className="num">{d.min}° / {d.max}°</span>
                <span className="wx-rain">{d.rain !== null ? `chuva ${d.rain}%` : ''}</span>
              </li>
            ))}
          </ul>
          {w.data.place.capital && <p className="source-note">Você escolheu só o estado, então mostro a capital ({w.data.place.name}).</p>}
        </>
      )}
    </div>
  );
}

function AlertsCard({ place }: { place: Place }) {
  const a = useAsync(() => fetchLocalAlerts(place.uf), [place.uf]);
  return (
    <div className="alerts">
      <h3 className="sub-head">Alertas em {place.uf} <span>INMET · {a.data ? `${a.data.total} ativos` : ''}</span></h3>
      {a.loading && !a.data ? <Skeleton rows={3} /> : !a.data ? <Failed text="Alertas indisponíveis agora." onRetry={a.reload} /> : a.data.total === 0 ? (
        <p className="empty">Nenhum alerta meteorológico ativo para {ufName(place.uf)} hoje.</p>
      ) : (
        <ul className="alert-list">
          {a.data.avisos.map((x) => (
            <li key={x.id} style={{ ['--sev' as string]: x.cor }}>
              <div className="alert-top"><b>{x.tipo}</b><span className="sevtag">{x.severidade}</span></div>
              <p>{x.risco}</p>
              <p className="byline">até {x.fim.slice(8, 10)}/{x.fim.slice(5, 7)} {x.fim.slice(11, 16)}</p>
            </li>
          ))}
        </ul>
      )}
      <Ext href="https://alertas2.inmet.gov.br/" className="more-link">Ver todos os alertas no INMET ↗</Ext>
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  const [ok, setOk] = useState(true);
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return src && ok ? (
    <img className="avatar" src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setOk(false)} />
  ) : (
    <span className="avatar ph" aria-hidden="true">{initials}</span>
  );
}

function Parl({ p }: { p: Parlamentar }) {
  return (
    <li>
      <Ext href={p.url} className="parl">
        <Avatar src={p.foto} name={p.nome} />
        <span className="parl-name">{p.nome}</span>
        <span className="parl-party">{p.partido}</span>
      </Ext>
    </li>
  );
}

function BancadaBlock({ place }: { place: Place }) {
  const b = useAsync(() => fetchBancada(place.uf), [place.uf]);
  return (
    <div className="bancada">
      <h3 className="sub-head">Bancada de {ufName(place.uf)} no Congresso <span>quem te representa em Brasília</span></h3>
      {b.loading && !b.data ? <Skeleton rows={4} /> : !b.data ? <Failed text="Bancada indisponível agora." onRetry={b.reload} /> : (
        <div className="bancada-grid">
          <div>
            <h4 className="mini-head">Senadores <b>{b.data.senadores.length}</b></h4>
            <ul className="parl-list">{b.data.senadores.map((p) => <Parl key={p.id} p={p} />)}</ul>
          </div>
          <div>
            <h4 className="mini-head">Deputados federais <b>{b.data.deputados.length}</b></h4>
            <ul className="parl-list">{b.data.deputados.map((p) => <Parl key={p.id} p={p} />)}</ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Seção ─────────────────────────────────────────────────────────────

export function Regiao({ bundle, now }: { bundle: Bundle | null; now: number }) {
  const { place, openPicker } = usePlace();
  const key = place ? `${place.uf}|${place.city ?? ''}` : 'none';

  return (
    <section id="regiao" className="section" aria-labelledby="regiao-t" data-sec="regiao">
      <SectionHead id="regiao" n="03" title="Minha região" env={bundle?.alerts} now={now} />

      {!place ? (
        <div className="onboard">
          <h3>Veja o que acontece perto de você</h3>
          <p>Escolha seu estado e, se quiser, sua cidade. O painel passa a mostrar:</p>
          <ul>
            <li><b>Notícias</b> da sua cidade ou do estado, de 24 horas até 30 dias</li>
            <li><b>Clima</b> e previsão dos próximos dias</li>
            <li><b>Alertas</b> meteorológicos ativos no seu estado</li>
            <li><b>Deputados e senadores</b> do seu estado</li>
          </ul>
          <button type="button" className="btn-solid" onClick={openPicker}>Escolher minha região</button>
        </div>
      ) : (
        <div key={key}>
          <h3 className="sub-head">
            Notícias de {place.city ?? ufName(place.uf)}
            <button type="button" className="sub-action" onClick={openPicker}>trocar região</button>
          </h3>
          <PlaceNews place={place} now={now} />
          <div className="region-grid">
            <WeatherCard place={place} />
            <AlertsCard place={place} />
          </div>
          <BancadaBlock place={place} />
        </div>
      )}
    </section>
  );
}
