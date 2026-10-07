import type { Bundle } from '../api';
import { Empty, SectionHead, Skeleton } from '../components';

function until(s: string): string {
  const m = s.match(/^\d{4}-(\d{2})-(\d{2}) (\d{2}:\d{2})/);
  return m ? `${m[2]}/${m[1]} ${m[3]}` : s;
}

export function Clima({ bundle, now }: { bundle: Bundle | null; now: number }) {
  const w = bundle?.weather;
  const a = bundle?.alerts;
  const cities = w?.data;
  const alerts = a?.data;
  const sev = alerts ? Object.entries(alerts.porSeveridade).sort((x, y) => y[1] - x[1]) : [];

  return (
    <section id="clima" className="section" aria-labelledby="clima-t" data-sec="regiao">
      <SectionHead id="clima" n="·" title="Brasil: capitais e alertas" env={[w, a]} now={now} />

      <div className="clima">
        <div className="cities">
          <h3 className="sub-head">Agora nas capitais <span>Open-Meteo</span></h3>
          {!cities ? <Skeleton rows={6} /> : (
            <ul className="city-list">
              {cities.map((c) => (
                <li key={c.uf}>
                  <div className="city-name">
                    <b>{c.name}</b>
                    <span>{c.label}</span>
                  </div>
                  <div className="city-temp num">{c.temp}°</div>
                  <div className="city-range">
                    <span>↓{c.min}° ↑{c.max}°</span>
                    <span>{c.rain !== null ? `chuva ${c.rain}%` : ''}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="alerts">
          <h3 className="sub-head">Alertas do INMET <span>{alerts ? `${alerts.total} ativos hoje` : ''}</span></h3>
          {!alerts ? <Skeleton rows={4} /> : alerts.total === 0 ? <Empty text="Nenhum alerta ativo." /> : (
            <>
              <div className="sev-row">
                {sev.map(([name, n]) => (
                  <span key={name} className="sev">{name} <b>{n}</b></span>
                ))}
              </div>
              <ul className="alert-list">
                {alerts.avisos.map((x) => (
                  <li key={x.id} style={{ ['--sev' as string]: x.cor }}>
                    <div className="alert-top">
                      <b>{x.tipo}</b>
                      <span className="sevtag">{x.severidade}</span>
                    </div>
                    <p className="where">{x.estados}</p>
                    <p>{x.risco}</p>
                    <p className="byline">até {until(x.fim)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
