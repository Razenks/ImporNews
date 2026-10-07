import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export const UFS: { uf: string; nome: string }[] = [
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'], ['CE', 'Ceará'],
  ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'], ['GO', 'Goiás'], ['MA', 'Maranhão'], ['MT', 'Mato Grosso'],
  ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'], ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'],
  ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'],
  ['RS', 'Rio Grande do Sul'], ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'],
  ['SP', 'São Paulo'], ['SE', 'Sergipe'], ['TO', 'Tocantins'],
].map(([uf, nome]) => ({ uf, nome }));

export const ufName = (uf: string): string => UFS.find((u) => u.uf === uf)?.nome ?? uf;

/** Região escolhida pela pessoa: um estado e, se quiser, uma cidade. */
export interface Place {
  uf: string;
  city?: string;
}

const KEY = 'impornews:place';

function load(): Place | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Place | null;
    return p && UFS.some((u) => u.uf === p.uf) ? { uf: p.uf, city: p.city || undefined } : null;
  } catch {
    return null;
  }
}

interface Ctx {
  place: Place | null;
  setPlace: (p: Place | null) => void;
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
}

const PlaceCtx = createContext<Ctx | null>(null);

export function PlaceProvider({ children }: { children: ReactNode }) {
  const [place, setPlaceState] = useState<Place | null>(load);
  const [pickerOpen, setPickerOpen] = useState(false);

  const setPlace = useCallback((p: Place | null) => {
    setPlaceState(p);
    try {
      if (p) localStorage.setItem(KEY, JSON.stringify(p));
      else localStorage.removeItem(KEY);
    } catch { /* storage bloqueado: vale só nesta visita */ }
  }, []);

  const value = useMemo<Ctx>(
    () => ({ place, setPlace, pickerOpen, openPicker: () => setPickerOpen(true), closePicker: () => setPickerOpen(false) }),
    [place, setPlace, pickerOpen],
  );
  return <PlaceCtx.Provider value={value}>{children}</PlaceCtx.Provider>;
}

export function usePlace(): Ctx {
  const c = useContext(PlaceCtx);
  if (!c) throw new Error('usePlace fora do PlaceProvider');
  return c;
}

/** "Campo Grande · MS" ou "Mato Grosso do Sul". */
export const placeLabel = (p: Place): string => (p.city ? `${p.city} · ${p.uf}` : ufName(p.uf));
