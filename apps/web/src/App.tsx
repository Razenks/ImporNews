import { useEffect, useRef, useState } from 'react';
import { MotionToggle, Soon, Splash, Ticker } from './components';
import { clock } from './format';
import { useBundle, useLiveQuotes, useNow } from './hooks';
import { useReveal, useScrollProgress } from './motion';
import { PlaceChip, PlacePicker } from './PlacePicker';
import { SearchPalette } from './SearchPalette';
import { Clima } from './sections/Clima';
import { Eleicoes } from './sections/Eleicoes';
import { Governo } from './sections/Governo';
import { Mercado } from './sections/Mercado';
import { Mundo } from './sections/Mundo';
import { Noticias } from './sections/Noticias';
import { Bancada } from './sections/Bancada';
import { Boas } from './sections/Boas';
import { Esportes } from './sections/Esportes';
import { Games } from './sections/Games';
import { Locais } from './sections/Locais';
import { Tecnologia } from './sections/Tecnologia';
import { Tempo } from './sections/Tempo';

/**
 * Cada item do menu é um "painel". No celular mostra um por vez; no computador, todos juntos.
 * `anchor` é a seção para onde rolar no computador; `keywords` alimenta a busca "Ir para".
 */
const SECTIONS = [
  { id: 'mercado', n: '01', label: 'Mercado', anchor: 'mercado', keywords: 'dólar dolar euro libra bitcoin ethereum selic ipca câmbio cotação juros inflação' },
  { id: 'politica', n: '02', label: 'Política', anchor: 'governo', keywords: 'congresso câmara camara senado deputados senadores bancada eleições eleicao votação projeto lei pec 6x1 tse' },
  { id: 'tempo', n: '03', label: 'Tempo', anchor: 'tempo', keywords: 'clima tempo previsão chuva calor frio alerta temperatura inmet umidade' },
  { id: 'mundo', n: '04', label: 'Mundo', anchor: 'mundo', keywords: 'onu oms internacional guerra crise saúde surto' },
  { id: 'tecnologia', n: '05', label: 'Tecnologia', short: 'Tech', anchor: 'tecnologia', keywords: 'tech nvidia apple openai google anthropic microsoft meta ia inteligência artificial celular' },
  { id: 'games', n: '06', label: 'Games', anchor: 'games', keywords: 'jogos videogame playstation ps5 xbox nintendo switch pc steam mobile esports lol free fire valorant' },
  { id: 'esportes', n: '07', label: 'Esportes', anchor: 'esportes', keywords: 'futebol f1 formula 1 motogp basquete nba vôlei volei tênis fisiculturismo artes marciais judô judo muay thai jiu-jitsu ufc mma boxe olimpíadas' },
  { id: 'local', n: '08', label: 'Notícias locais', short: 'Local', anchor: 'local', keywords: 'cidade estado região local notícias daqui bairro campo grande' },
  { id: 'noticias', n: '09', label: 'Notícias gerais', short: 'Gerais', anchor: 'noticias', keywords: 'notícias gerais agência brasil ibge brasil manchetes' },
  { id: 'boas', n: '10', label: 'Notícias boas', short: 'Boas', anchor: 'boas', keywords: 'boas notícias positivas alegria solidariedade conquista esperança feliz' },
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

function SearchButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" className={`search-btn ${className}`} onClick={onClick} aria-label="Buscar no site" aria-haspopup="dialog">
      <svg viewBox="0 0 14 14" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="6" cy="6" r="4.5" />
        <path d="M9.5 9.5L13 13" />
      </svg>
      <span className="search-btn-t">Buscar no site</span>
      <kbd aria-hidden="true">/</kbd>
    </button>
  );
}

export default function App() {
  const now = useNow(1000);
  const { bundle, error } = useBundle();
  const { quotes, online, at } = useLiveQuotes(bundle?.quotes.data);
  const [tab, setTab] = useState<Id>(loadTab);
  const [searching, setSearching] = useState(false);
  const [searchSeed, setSearchSeed] = useState('');
  const progress = useRef<HTMLDivElement>(null);
  useReveal();
  useScrollProgress(progress);

  const go = (id: string) => {
    const s = SECTIONS.find((x) => x.id === id);
    if (!s) return;
    setTab(s.id);
    try { localStorage.setItem(KEY, s.id); } catch { /* ok */ }
    if (window.matchMedia('(min-width: 1100px)').matches) {
      document.getElementById(s.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        const id = (hit?.target as HTMLElement | undefined)?.dataset.sec;
        if (id && SECTIONS.some((s) => s.id === id)) setTab(id as Id);
      },
      { rootMargin: '-25% 0px -65% 0px' },
    );
    document.querySelectorAll('.section').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [bundle !== null]);

  // na barra inferior (que rola no celular), mantém a aba atual visível
  useEffect(() => {
    document.querySelector('.tabbar [aria-current="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [tab]);

  // atalhos: "/" ou Ctrl/Cmd+K abrem a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSearching(true);
      } else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setSearching(true);
      }
    };
    // outras telas podem pedir a busca geral já com um termo ("Buscar notícias sobre …")
    const onSeed = (e: Event) => {
      setSearchSeed(String((e as CustomEvent).detail ?? ''));
      setSearching(true);
    };
    addEventListener('keydown', onKey);
    addEventListener('impornews:search', onSeed);
    return () => {
      removeEventListener('keydown', onKey);
      removeEventListener('impornews:search', onSeed);
    };
  }, []);

  const openSearch = () => {
    setSearchSeed('');
    setSearching(true);
  };

  const status = online ? (
    <span className="live on"><i /><span className="live-t">ao vivo <time>{at ? clock(at) : '--:--:--'}</time></span></span>
  ) : (
    <span className="live"><i /><span className="live-t">{bundle ? 'reconectando…' : 'conectando…'}</span></span>
  );

  const nav = (cls: string) => (
    <nav className={cls} aria-label="Seções">
      <ol>
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <button type="button" aria-current={tab === s.id ? 'true' : undefined} onClick={() => go(s.id)}>
              <span className="nav-n">{s.n}</span>
              <span className="nav-l">
                {'short' in s ? (
                  <>
                    <span className="l-full">{s.label}</span>
                    <span className="l-short">{s.short}</span>
                  </>
                ) : (
                  s.label
                )}
              </span>
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
        <div className="rail-tools">
          <SearchButton onClick={openSearch} />
          <PlaceChip className="wide" />
        </div>
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
          <div className="topbar-actions">
            <SearchButton className="icon" onClick={openSearch} />
            <PlaceChip className="compact" />
            {status}
          </div>
        </header>
        <Ticker quotes={quotes} />

        {error && !bundle && (
          <p className="banner" role="alert">Sem conexão com o servidor de dados. Tentando de novo…</p>
        )}

        <main>
          <div className="pane" data-active={tab === 'mercado'}><Mercado bundle={bundle} quotes={quotes} now={now} /></div>
          <div className="pane" data-active={tab === 'politica'}>
            <Governo bundle={bundle} now={now} />
            <Eleicoes bundle={bundle} now={now} />
            <Bancada now={now} />
            <section className="section soon-sec" data-sec="politica">
              <Soon
                items={[
                  { name: 'Diário Oficial da União', what: 'leis, decretos e nomeações' },
                  { name: 'Portal da Transparência', what: 'gastos públicos' },
                ]}
              />
            </section>
          </div>
          <div className="pane" data-active={tab === 'tempo'}>
            <Tempo bundle={bundle} now={now} />
            <Clima bundle={bundle} now={now} />
          </div>
          <div className="pane" data-active={tab === 'mundo'}><Mundo bundle={bundle} now={now} /></div>
          <div className="pane" data-active={tab === 'tecnologia'}><Tecnologia bundle={bundle} now={now} /></div>
          <div className="pane" data-active={tab === 'games'}><Games bundle={bundle} now={now} /></div>
          <div className="pane" data-active={tab === 'esportes'}><Esportes bundle={bundle} now={now} /></div>
          <div className="pane" data-active={tab === 'local'}><Locais bundle={bundle} now={now} /></div>
          <div className="pane" data-active={tab === 'noticias'}><Noticias bundle={bundle} now={now} /></div>
          <div className="pane" data-active={tab === 'boas'}><Boas bundle={bundle} now={now} /></div>
        </main>

        <footer className="foot">
          <p>
            Fontes: Banco Central · AwesomeAPI · BCE · Coinbase · Câmara dos Deputados · Senado Federal · IBGE · INMET ·
            Open-Meteo · Agência Brasil · ONU News · OMS · Google Notícias · veículos de tecnologia e newsrooms oficiais
          </p>
          <p>Cotações e indicadores têm caráter informativo.</p>
          <MotionToggle />
        </footer>
      </div>

      {nav('tabbar')}

      <PlacePicker />
      <SearchPalette
        open={searching}
        onClose={() => setSearching(false)}
        onGo={go}
        initial={searchSeed}
        jumps={SECTIONS.map((s) => ({ id: s.id, n: s.n, label: s.label, keywords: s.keywords }))}
      />
    </div>
  );
}
