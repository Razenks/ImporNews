import { useState } from 'react';
import { fetchBancada, type Parlamentar } from '../api';
import { Ext, SectionHead, Skeleton } from '../components';
import { useAsync } from '../hooks';
import { ufName, usePlace, type Place } from '../place';
import { Failed } from './RegionBits';

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

/** Deputados e senadores do estado escolhido (fica na aba Política). */
export function Bancada({ now }: { now: number }) {
  const { place, openPicker } = usePlace();
  return (
    <section id="bancada" className="section" aria-labelledby="bancada-t" data-sec="politica">
      <SectionHead id="bancada" n="·" title="Sua bancada" now={now} />
      {!place ? (
        <div className="empty-box">
          <p>Escolha o seu estado para ver os deputados e senadores que te representam em Brasília.</p>
          <button type="button" className="more-link" onClick={openPicker}>Escolher minha região</button>
        </div>
      ) : (
        <div key={place.uf}>
          <BancadaBlock place={place} />
        </div>
      )}
    </section>
  );
}
