import { getJson, plain } from '../http.js';
import { ufFromName } from '../ufs.js';

const CITIES = [
  { name: 'São Paulo', uf: 'SP', lat: -23.55, lon: -46.63 },
  { name: 'Rio de Janeiro', uf: 'RJ', lat: -22.91, lon: -43.17 },
  { name: 'Brasília', uf: 'DF', lat: -15.78, lon: -47.93 },
  { name: 'Belo Horizonte', uf: 'MG', lat: -19.92, lon: -43.94 },
  { name: 'Salvador', uf: 'BA', lat: -12.97, lon: -38.51 },
  { name: 'Recife', uf: 'PE', lat: -8.05, lon: -34.88 },
  { name: 'Porto Alegre', uf: 'RS', lat: -30.03, lon: -51.23 },
  { name: 'Manaus', uf: 'AM', lat: -3.12, lon: -60.02 },
];

const WMO: Record<number, string> = {
  0: 'Céu limpo', 1: 'Poucas nuvens', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Neblina', 48: 'Neblina', 51: 'Garoa fraca', 53: 'Garoa', 55: 'Garoa forte',
  61: 'Chuva fraca', 63: 'Chuva', 65: 'Chuva forte', 66: 'Chuva gelada', 67: 'Chuva gelada',
  71: 'Neve fraca', 73: 'Neve', 75: 'Neve forte', 80: 'Pancadas fracas', 81: 'Pancadas de chuva',
  82: 'Pancadas fortes', 95: 'Trovoadas', 96: 'Trovoadas com granizo', 99: 'Trovoadas com granizo',
};

export const wmoLabel = (code: number): string => WMO[code] ?? '—';

export interface CityWeather {
  name: string;
  uf: string;
  temp: number;
  feels: number;
  min: number;
  max: number;
  humidity: number;
  rain: number | null;
  wind: number;
  label: string;
}

export async function fetchWeather(): Promise<CityWeather[]> {
  const q = new URLSearchParams({
    latitude: CITIES.map((c) => c.lat).join(','),
    longitude: CITIES.map((c) => c.lon).join(','),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'America/Sao_Paulo',
    forecast_days: '1',
  });
  const j = await getJson<any>(`https://api.open-meteo.com/v1/forecast?${q}`);
  const list: any[] = Array.isArray(j) ? j : [j];
  return list.map((r, i) => ({
    name: CITIES[i].name,
    uf: CITIES[i].uf,
    temp: Math.round(r.current.temperature_2m),
    feels: Math.round(r.current.apparent_temperature),
    min: Math.round(r.daily.temperature_2m_min[0]),
    max: Math.round(r.daily.temperature_2m_max[0]),
    humidity: Math.round(r.current.relative_humidity_2m),
    rain: r.daily.precipitation_probability_max?.[0] ?? null,
    wind: Math.round(r.current.wind_speed_10m),
    label: WMO[r.current.weather_code] ?? '—',
  }));
}

// ── INMET: avisos ativos ──────────────────────────────────────────────

const RANK: Record<string, number> = { 'Perigo Potencial': 1, Perigo: 2, 'Grande Perigo': 3 };

export interface Alert {
  id: number;
  tipo: string;
  severidade: string;
  rank: number;
  cor: string;
  estados: string;
  ufs: string[]; // siglas dos estados atingidos (para filtrar por região)
  inicio: string;
  fim: string;
  risco: string;
}

export interface Alerts {
  total: number;
  porSeveridade: Record<string, number>;
  avisos: Alert[];
}

export async function fetchAlerts(): Promise<Alerts> {
  const j = await getJson<{ hoje?: any[] }>('https://apiprevmet3.inmet.gov.br/avisos/ativos', 45_000);
  const hoje = (j.hoje ?? []).filter((a) => !a.encerrado);
  const porSeveridade: Record<string, number> = {};
  for (const a of hoje) porSeveridade[a.severidade] = (porSeveridade[a.severidade] ?? 0) + 1;

  const avisos = hoje
    .map((a) => ({
      id: a.id_aviso as number,
      tipo: a.descricao as string,
      severidade: a.severidade as string,
      rank: RANK[a.severidade] ?? 0,
      cor: (a.aviso_cor as string) ?? '#999',
      estados: plain(a.estados, 90),
      ufs: [...new Set(String(a.estados ?? '').split(',').map((s) => ufFromName(s)).filter((u): u is string => !!u))],
      inicio: String(a.inicio ?? ''),
      fim: String(a.fim ?? ''),
      risco: plain(a.riscos?.[0], 200),
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 60);

  return { total: hoje.length, porSeveridade, avisos };
}
