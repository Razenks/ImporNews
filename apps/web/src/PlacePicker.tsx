import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { fetchCities, type City } from './api';
import { UFS, placeLabel, usePlace } from './place';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const cache = new Map<string, City[]>();

/** Janela "Sua região": estado + cidade (opcional), com autocompletar. Fica salvo neste aparelho. */
export function PlacePicker() {
  const { place, setPlace, pickerOpen, closePicker } = usePlace();
  const [uf, setUf] = useState('');
  const [text, setText] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [hint, setHint] = useState('');
  const first = useRef<HTMLSelectElement>(null);
  const listId = useId();

  // ao abrir, parte do que já estava salvo
  useEffect(() => {
    if (!pickerOpen) return;
    setUf(place?.uf ?? '');
    setText(place?.city ?? '');
    setHint('');
    setOpen(false);
    const t = setTimeout(() => first.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [pickerOpen, place]);

  // cidades do estado escolhido
  useEffect(() => {
    if (!uf) {
      setCities([]);
      return;
    }
    const hit = cache.get(uf);
    if (hit) {
      setCities(hit);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchCities(uf)
      .then((c) => {
        cache.set(uf, c);
        if (alive) setCities(c);
      })
      .catch(() => alive && setCities([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [uf]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && closePicker();
    addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [pickerOpen, closePicker]);

  const q = norm(text);
  const matches = useMemo(() => {
    if (!q) return [];
    const starts = cities.filter((c) => norm(c.nome).startsWith(q));
    const inside = cities.filter((c) => !norm(c.nome).startsWith(q) && norm(c.nome).includes(q));
    return [...starts, ...inside].slice(0, 8);
  }, [cities, q]);

  const exact = cities.find((c) => norm(c.nome) === q);

  const choose = (c: City) => {
    setText(c.nome);
    setOpen(false);
    setHint('');
  };

  const save = () => {
    if (!uf) return setHint('Escolha o estado.');
    if (text.trim() && !exact) return setHint('Escolha uma cidade da lista ou deixe em branco para ver o estado todo.');
    setPlace({ uf, city: exact?.nome });
    closePicker();
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(matches.length - 1, a + 1));
    } else if (e.key === 'ArrowUp' && matches.length) {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && matches[active]) choose(matches[active]);
      else save();
    }
  };

  if (!pickerOpen) return null;
  return (
    <div className="modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closePicker()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="place-t">
        <h2 id="place-t">Sua região</h2>
        <p className="sheet-sub">Escolha o estado e, se quiser, a cidade. Notícias, clima, alertas e a bancada passam a mostrar o que é daí. Fica salvo só neste aparelho.</p>

        <label className="field">
          <span>Estado</span>
          <select ref={first} value={uf} onChange={(e) => { setUf(e.target.value); setText(''); setHint(''); }}>
            <option value="">Selecione…</option>
            {UFS.map((u) => (
              <option key={u.uf} value={u.uf}>{u.nome} ({u.uf})</option>
            ))}
          </select>
        </label>

        <div className="field">
          <label htmlFor="place-city">Cidade <em>(opcional)</em></label>
          <div className="combo">
            <input
              id="place-city"
              type="text"
              role="combobox"
              aria-expanded={open && matches.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              autoComplete="off"
              disabled={!uf}
              placeholder={!uf ? 'Escolha o estado primeiro' : loading ? 'Carregando cidades…' : 'Digite o nome da cidade'}
              value={text}
              onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); setHint(''); }}
              onFocus={() => setOpen(true)}
              onKeyDown={onInputKey}
            />
            {open && matches.length > 0 && !exact && (
              <ul id={listId} role="listbox" className="combo-list">
                {matches.map((c, i) => (
                  <li
                    key={c.id}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => { e.preventDefault(); choose(c); }}
                    onMouseEnter={() => setActive(i)}
                  >
                    {c.nome}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {hint && <p className="hint-err" role="alert">{hint}</p>}

        <div className="sheet-actions">
          <button type="button" className="btn-solid" onClick={save}>Salvar</button>
          <button type="button" className="btn-ghost" onClick={closePicker}>Cancelar</button>
          {place && (
            <button type="button" className="btn-link" onClick={() => { setPlace(null); closePicker(); }}>
              Remover região
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Botão que mostra a região atual e abre o seletor. */
export function PlaceChip({ className = '' }: { className?: string }) {
  const { place, openPicker } = usePlace();
  return (
    <button type="button" className={`place-chip ${place ? '' : 'empty'} ${className}`} onClick={openPicker} aria-haspopup="dialog">
      <svg viewBox="0 0 14 16" width="12" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M7 15s5-4.6 5-8.4A5 5 0 0 0 2 6.6C2 10.4 7 15 7 15Z" />
        <circle cx="7" cy="6.6" r="1.7" />
      </svg>
      <span>{place ? placeLabel(place) : 'Escolher região'}</span>
    </button>
  );
}
