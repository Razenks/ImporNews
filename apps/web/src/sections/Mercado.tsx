import { useState } from 'react';
import type { Bundle, Indicator, Point, Quote } from '../api';
import { CountUp, Delta, Flash, Segmented, SectionHead, Skeleton, Soon, Spark } from '../components';
import { arrow, dec, dir, dayMonth, intl, monthYear, money } from '../format';
import { useHistories } from '../hooks';

const SYMBOLS = ['USD', 'EUR', 'GBP', 'BTC', 'ETH'];
const PAIR = 'USD/BRL';

const vals = (p: Point[] | undefined) => (p ?? []).map((x) => x.v);
const times = (p: Point[] | undefined) => (p ?? []).map((x) => x.t);

function toneOf(values: number[], fallback: 'up' | 'down' | 'flat'): 'up' | 'down' | 'flat' {
  if (values.length < 2) return fallback;
  const d = values[values.length - 1] - values[0];
  return d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
}

export function Mercado({ bundle, quotes, now }: { bundle: Bundle | null; quotes: Quote[]; now: number }) {
  const [range, setRange] = useState<'30d' | '24h'>('30d');
  const [open, setOpen] = useState<string | null>(null);
  const hist = useHistories(SYMBOLS, range);
  const by = Object.fromEntries(quotes.map((q) => [q.symbol, q]));
  const usd = by.USD;
  const others = SYMBOLS.slice(1).map((s) => by[s]).filter(Boolean);
  const indicators = bundle?.indicators.data ?? [];

  return (
    <section id="mercado" className="section" aria-labelledby="mercado-t" data-sec="mercado">
      <SectionHead id="mercado" n="01" title="Mercado" env={[bundle?.quotes, bundle?.indicators]} now={now}>
        <Segmented
          label="Período dos gráficos"
          value={range}
          onChange={setRange}
          options={[{ value: '30d', label: '30 dias' }, { value: '24h', label: '24 h' }]}
        />
      </SectionHead>

      {!usd ? (
        <Skeleton rows={5} />
      ) : (
        <div className="mkt">
          <article className="hero">
            <div className="hero-top">
              <span className="sym">{PAIR}</span>
              <span className="muted">Dólar americano</span>
            </div>
            <div className="hero-num">
              <Flash value={usd.value}>
                <small>R$</small>
                <CountUp value={usd.value} format={(v) => money('USD', v)} />
              </Flash>
            </div>
            <div className="hero-sub">
              <Delta value={usd.pct} className="big" />
              <span className="muted">hoje</span>
              {usd.high !== null && usd.low !== null && (
                <span className="range">
                  mín <b>{money('USD', usd.low)}</b> · máx <b>{money('USD', usd.high)}</b>
                </span>
              )}
            </div>
            <Spark
              key={range}
              className="hero-spark"
              values={vals(hist.USD)}
              tone={toneOf(vals(hist.USD), dir(usd.pct))}
              scrub={{ fmt: (v) => money('USD', v), times: times(hist.USD), withTime: range === '24h' }}
            />
            <p className="hint">Passe o mouse ou o dedo sobre o gráfico para ver cada ponto.</p>
          </article>

          <div className="rows" role="list">
            {others.map((q) => {
              const v = vals(hist[q.symbol]);
              const isOpen = open === q.symbol;
              const span = q.high !== null && q.low !== null ? q.high - q.low : 0;
              const pos = span > 0 ? Math.min(1, Math.max(0, (q.value - (q.low as number)) / span)) : 0.5;
              const toggle = () => setOpen(isOpen ? null : q.symbol);
              return (
                <div className={`qwrap ${isOpen ? 'open' : ''}`} role="listitem" key={q.symbol}>
                  <div
                    className="qrow"
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={toggle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggle();
                      }
                    }}
                  >
                    <div className="qrow-id">
                      <b>{q.symbol}</b>
                      <span>{q.name}</span>
                    </div>
                    <Spark key={range} className="qrow-spark" values={v} tone={toneOf(v, dir(q.pct))} />
                    <div className="qrow-val">
                      <Flash value={q.value}>
                        <span className="num">
                          <small>R$</small>
                          {money(q.symbol, q.value)}
                        </span>
                      </Flash>
                      <Delta value={q.pct} />
                    </div>
                  </div>
                  <div className="item-more" inert={!isOpen}>
                    <div>
                      <div className="more-body qdetail">
                        <div className="rbar">
                          <div className="rbar-lbl">
                            <span>mín <b>{q.low !== null ? money(q.symbol, q.low) : '—'}</b></span>
                            <span>máx <b>{q.high !== null ? money(q.symbol, q.high) : '—'}</b></span>
                          </div>
                          <div className="rbar-track" style={{ ['--pos' as string]: pos }}>
                            <i />
                          </div>
                          <div className="rbar-cap">posição no intervalo do dia</div>
                        </div>
                        {q.usd !== null && (
                          <div className="qstat">
                            <span>em dólar</span>
                            <b className="num">US$ {intl(q.usd)}</b>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Ledger items={indicators} />
      <Soon items={[{ name: 'Tesouro Direto', what: 'taxas e dívida pública' }]} />
    </section>
  );
}

function Ledger({ items }: { items: Indicator[] }) {
  if (!items.length) return null;
  return (
    <div className="ledger">
      <h3 className="sub-head">Indicadores oficiais <span>Banco Central</span></h3>
      <div className="ledger-grid">
        {items.map((i) => {
          const change = i.prev === null ? null : i.value - i.prev;
          const d = dir(change);
          const isMoney = i.unit === 'BRL';
          const digits = isMoney ? 4 : 2;
          return (
            <article className="ind" key={i.id}>
              <div className="ind-top">
                <span>{i.label}</span>
                <time>{i.id === 'ptax' ? dayMonth(i.ref) : i.id === 'selic' ? `reunião ${dayMonth(i.ref)}` : monthYear(i.ref)}</time>
              </div>
              <div className="ind-val">
                {isMoney ? <small>R$</small> : null}
                <CountUp className="num" value={i.value} format={(v) => dec(v, digits)} />
                {!isMoney && <small>{i.unit}</small>}
              </div>
              <div className="ind-foot">
                {change !== null && (
                  <span className={`delta ${d}`}>
                    <i aria-hidden="true">{arrow(d)}</i>
                    {change > 0 ? '+' : change < 0 ? '−' : ''}
                    {dec(Math.abs(change), digits)}
                    {isMoney ? '' : ' p.p.'}
                  </span>
                )}
                <span className="muted">{i.note}</span>
              </div>
              <Spark className="ind-spark" values={i.series} tone="flat" />
            </article>
          );
        })}
      </div>
    </div>
  );
}
