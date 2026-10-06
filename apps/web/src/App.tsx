import { useEffect, useRef, useState } from 'react';
import { MotionToggle, Splash, Ticker } from './components';
import { clock } from './format';
import { useBundle, useLiveQuotes, useNow } from './hooks';
import { useReveal, useScrollProgress } from './motion';
import { Clima } from './sections/Clima';
import { Eleicoes } from './sections/Eleicoes';
import { Governo } from './sections/Governo';
import { Mercado } from './sections/Mercado';
import { Mundo } from './sections/Mundo';
import { Noticias } from './sections/Noticias';

const SECTIONS = [
  { id: 'mercado', n: '01', label: 'Mercado' },
  { id: 'governo', n: '02', label: 'Congresso' },
  { id: 'eleicoes', n: '03', label: 'Eleições' },
  { id: 'clima', n: '04', label: 'Clima' },
  { id: 'mundo', n: '05', label: 'Mundo' },
  { id: 'noticias', n: '06', label: 'Notícias' },
] as const;

type Id = (typeof SECTIONS)[number]['id'];

const KEY = 'impornews:tab';
function loadTab(): Id {
  try {
    const saved = localStorage.getItem(KEY);
    if (SECTIONS.some((s) => s.id === saved)) return saved as Id;
  } catch { /* storage bloqueado */ }
  return 'mercado';
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="ImporNews">
      impor<i>/</i>news
    </a>
  );
}

export default function App() {
  const now = useNow(1000);
  const { bundle, error } = useBundle();
  const { quotes, online, at } = useLiveQuotes(bundle?.quotes.data);
  const [tab, setTab] = useState<Id>(loadTab);
  const progress = useRef<HTMLDivElement>(null);
  useReveal();
  useScrollProgress(progress);

  const go = (id: Id) => {
    setTab(id);
    try { localStorage.setItem(KEY, id); } catch { /* ok */ }
    if (window.matchMedia('(min-width: 1100px)').matches) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0 });
    }
  };

  // No desktop todas as seções aparecem juntas; o menu acompanha a que está na tela.
  useEffect(() => {
    if (!window.matchMedia('(min-width: 1100px)').matches) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setTab((hit.target as HTMLElement).dataset.sec as Id);
      },
      { rootMargin: '-25% 0px -65% 0px' },
    );
    document.querySelectorAll('.section').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [bundle !== null]);

  const status = online ? (
    <span className="live on"><i />ao vivo <time>{at ? clock(at) : '--:--:--'}</time></span>
  ) : (
    <span className="live"><i />{bundle ? 'reconectando…' : 'conectando…'}</span>
  );

  const nav = (cls: string) => (
    <nav className={cls} aria-label="Seções">
      <ol>
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <button type="button" aria-current={tab === s.id ? 'true' : undefined} onClick={() => go(s.id)}>
              <span className="nav-n">{s.n}</span>
              <span className="nav-l">{s.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );

  return (
    <div className="app">
      <Splash />
      <div className="progress" ref={progress} aria-hidden="true" />
      <aside className="rail">
        <Brand />
        {nav('railnav')}
        <div className="rail-foot">
          {status}
          <p>Dados abertos do governo, Banco Central, ONU e OMS. Atualiza sozinho.</p>
          <MotionToggle />
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Brand />
          {status}
        </header>
        <Ticker quotes={quotes} />

        {error && !bundle && (
          <p className="banner" role="alert">Sem conexão com o servidor de dados. Tentando de novo…</p>
        )}

        <main>
          <div className="pane" data-active={tab === 'mercado'}><Mercado bundle={bundle} quotes={quotes} now={now} /></div>
          <div className="pane" data-active={tab === 'governo'}><Governo bundle={bundle} now={now} /></div>
          <div className="pane" data-active={tab === 'eleicoes'}><Eleicoes bundle={bundle} now={now} /></div>
          <div className="pane" data-active={tab === 'clima'}><Clima bundle={bundle} now={now} /></div>
          <div className="pane" data-active={tab === 'mundo'}><Mundo bundle={bundle} now={now} /></div>
          <div className="pane" data-active={tab === 'noticias'}><Noticias bundle={bundle} now={now} /></div>
        </main>

        <footer className="foot">
          <p>
            Fontes: Banco Central · AwesomeAPI · CoinGecko · Câmara dos Deputados · Senado Federal · IBGE ·
            Agência Brasil · ONU News · OMS · INMET · Open-Meteo
          </p>
          <p>Cotações e indicadores têm caráter informativo.</p>
          <MotionToggle />
        </footer>
      </div>

      {nav('tabbar')}
    </div>
  );
}
