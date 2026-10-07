import { fetchLocalAlerts, fetchLocalWeather, type Bundle } from '../api';
import { Ext, SectionHead, Skeleton } from '../components';
import { weekdayShort } from '../format';
import { useAsync } from '../hooks';
import { ufName, usePlace, type Place } from '../place';
import { Failed, Onboard } from './RegionBits';

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

/** Tempo da cidade escolhida (ou da capital do estado) e alertas do INMET no estado. */
export function Tempo({ bundle, now }: { bundle: Bundle | null; now: number }) {
  const { place } = usePlace();
  return (
    <section id="tempo" className="section" aria-labelledby="tempo-t" data-sec="tempo">
      <SectionHead id="tempo" n="03" title="Tempo" env={bundle?.alerts} now={now} />
      {!place ? (
        <Onboard
          title="Veja o tempo da sua cidade"
          intro="Escolha onde você mora para ver:"
          bullets={[
            <><b>Tempo agora</b> e a previsão dos próximos dias</>,
            <><b>Alertas</b> de chuva forte, calor e baixa umidade no seu estado</>,
          ]}
        />
      ) : (
        <div className="region-grid first" key={`${place.uf}|${place.city ?? ''}`}>
          <WeatherCard place={place} />
          <AlertsCard place={place} />
        </div>
      )}
    </section>
  );
}
