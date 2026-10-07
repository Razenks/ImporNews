import { useEffect, useMemo, useRef, useState } from 'react';
import { searchAll } from './api';
import { ago } from './format';
import { useAsync, useDebounced } from './hooks';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface Jump {
  id: string;
  n: string;
  label: string;
  keywords: string;
}

type Entry = { key: string; kind: 'jump'; id: string } | { key: string; kind: 'link'; href: string };

/** Busca geral (atalho "/" ou Ctrl+K): vai para uma seção, acha notícias e projetos de lei. */
export function SearchPalette({
  open, onClose, onGo, jumps, initial = '',
}: { open: boolean; onClose: () => void; onGo: (id: string) => void; jumps: Jump[]; initial?: string }) {
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const q = useDebounced(text, 300).trim();
  const on = q.length >= 2;
  const r = useAsync(() => searchAll(q), [q], on);

  useEffect(() => {
    if (!open) return;
    setText(initial);
    setActive(0);
    const t = setTimeout(() => input.current?.focus(), 40);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const needle = norm(text);
  const jumpList = useMemo(
    () => jumps.filter((j) => !needle || norm(`${j.label} ${j.keywords}`).includes(needle)),
    [jumps, needle],
  );
  const news = on ? r.data?.news ?? [] : [];
  const props = on ? r.data?.proposicoes ?? [] : [];

  const entries: Entry[] = [
    ...jumpList.map((j) => ({ key: `j:${j.id}`, kind: 'jump' as const, id: j.id })),
    ...news.map((n) => ({ key: `n:${n.url}`, kind: 'link' as const, href: n.url })),
    ...props.map((p) => ({ key: `p:${p.id}`, kind: 'link' as const, href: p.url })),
  ];
  const idx = (key: string) => entries.findIndex((e) => e.key === key);

  const run = (e: Entry | undefined) => {
    if (!e) return;
    if (e.kind === 'jump') {
      onClose();
      onGo(e.id);
    } else {
      window.open(e.href, '_blank', 'noopener,noreferrer');
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(entries.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(entries[active]);
    }
  };

  useEffect(() => setActive(0), [needle, r.data]);
  useEffect(() => {
    document.querySelector('.palette [data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;
  return (
    <div className="modal top" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Buscar no site" onKeyDown={onKey}>
        <div className="palette-in">
          <svg viewBox="0 0 14 14" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="6" cy="6" r="4.5" />
            <path d="M9.5 9.5L13 13" />
          </svg>
          <input
            ref={input}
            type="search"
            placeholder="Buscar notícias, projetos de lei ou ir para uma seção…"
            value={text}
            maxLength={80}
            onChange={(e) => setText(e.target.value)}
            aria-label="Buscar"
          />
          <button type="button" className="kbd" onClick={onClose} aria-label="Fechar busca">Esc</button>
        </div>

        <div className="palette-out">
          {jumpList.length > 0 && (
            <>
              <h3 className="mini-head">Ir para</h3>
              <ul>
                {jumpList.map((j) => (
                  <li key={j.id}>
                    <button
                      type="button"
                      className="pal-row"
                      data-active={active === idx(`j:${j.id}`)}
                      onMouseEnter={() => setActive(idx(`j:${j.id}`))}
                      onClick={() => run(entries[idx(`j:${j.id}`)])}
                    >
                      <span className="pal-n">{j.n}</span>
                      <b>{j.label}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!on && <p className="pal-tip">Digite pelo menos 2 letras para buscar nas notícias dos últimos 30 dias e nos projetos de lei da Câmara.</p>}
          {on && r.loading && !r.data && <p className="pal-tip">Buscando…</p>}
          {on && r.error && !r.data && <p className="pal-tip">A busca não respondeu agora. Tente de novo.</p>}

          {news.length > 0 && (
            <>
              <h3 className="mini-head">Notícias <b>{r.data?.newsTotal}</b></h3>
              <ul>
                {news.map((n) => (
                  <li key={n.url}>
                    <a
                      className="pal-row"
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-active={active === idx(`n:${n.url}`)}
                      onMouseEnter={() => setActive(idx(`n:${n.url}`))}
                    >
                      <span className="pal-tag">{n.source}</span>
                      <b>{n.title}</b>
                      <time>{ago(n.date)}</time>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

          {props.length > 0 && (
            <>
              <h3 className="mini-head">Projetos de lei <b>Câmara e Senado</b></h3>
              <ul>
                {props.map((p) => (
                  <li key={p.id}>
                    <a
                      className="pal-row"
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-active={active === idx(`p:${p.id}`)}
                      onMouseEnter={() => setActive(idx(`p:${p.id}`))}
                    >
                      <span className="pal-tag">{p.casa} · {p.ref}</span>
                      <b>{p.ementa}</b>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

          {on && !r.loading && r.data && news.length === 0 && props.length === 0 && jumpList.length === 0 && (
            <p className="pal-tip">Nada encontrado para “{q}”.</p>
          )}
        </div>
      </div>
    </div>
  );
}
