import { getJson, plain, ymd } from '../http.js';

const CAMARA = 'https://dadosabertos.camara.leg.br/api/v2';
const SENADO = 'https://legis.senado.leg.br/dadosabertos';

/** Páginas públicas (as que uma pessoa abre no navegador). */
const camaraFicha = (id: string | number) => `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`;
const camaraEvento = (id: string | number) => `https://www.camara.leg.br/evento-legislativo/${id}`;
const senadoMateria = (codigo: string | number | null | undefined) =>
  codigo ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigo}` : null;

/** Último número de uma URI da API ("…/eventos/82965" → "82965"). */
const lastId = (uri: unknown): string | null => {
  const m = String(uri ?? '').match(/\/(\d+)\/?$/);
  return m ? m[1] : null;
};

export interface Proposicao {
  id: number;
  ref: string;
  ementa: string;
  data: string;
  url: string;
  casa: 'Câmara' | 'Senado';
}

export interface Camara {
  proposicoes: Proposicao[];
  eventos: { id: number; inicio: string; tipo: string; descricao: string; local: string | null; situacao: string; url: string }[];
  votacoes: {
    id: string;
    data: string;
    descricao: string;
    aprovada: boolean | null;
    orgao: string;
    url: string | null; // sessão/evento em que foi votada
    ref: string | null; // proposição votada, quando informada
    propUrl: string | null;
  }[];
}

const toProposicao = (p: any): Proposicao => ({
  id: p.id,
  ref: `${p.siglaTipo} ${p.numero}/${p.ano}`,
  ementa: plain(p.ementa, 220),
  data: p.dataApresentacao,
  url: camaraFicha(p.id),
  casa: 'Câmara',
});

export async function fetchCamara(): Promise<Camara> {
  const [prop, ev, vot] = await Promise.all([
    getJson(`${CAMARA}/proposicoes?siglaTipo=PL,PEC,PLP&ordem=DESC&ordenarPor=id&itens=12`),
    getJson(`${CAMARA}/eventos?dataInicio=${ymd()}&dataFim=${ymd(7)}&ordem=ASC&ordenarPor=dataHoraInicio&itens=10`),
    getJson(`${CAMARA}/votacoes?ordem=DESC&ordenarPor=dataHoraRegistro&itens=8`),
  ]);
  return {
    proposicoes: (prop.dados ?? []).map(toProposicao),
    eventos: (ev.dados ?? []).map((e: any) => ({
      id: e.id,
      inicio: e.dataHoraInicio,
      tipo: e.descricaoTipo,
      descricao: plain(e.descricao, 160),
      local: e.localCamara?.nome ?? e.localExterno ?? null,
      situacao: e.situacao,
      url: camaraEvento(e.id),
    })),
    votacoes: (vot.dados ?? []).map((v: any) => {
      const evento = lastId(v.uriEvento);
      const prop = lastId(v.uriProposicaoObjeto);
      return {
        id: v.id,
        data: v.dataHoraRegistro ?? v.data,
        descricao: plain(v.descricao, 200),
        aprovada: v.aprovacao === 1 ? true : v.aprovacao === 0 ? false : null,
        orgao: v.siglaOrgao,
        url: evento ? camaraEvento(evento) : null,
        ref: v.proposicaoObjeto ? plain(v.proposicaoObjeto, 40) : null,
        propUrl: prop ? camaraFicha(prop) : null,
      };
    }),
  };
}

async function searchCamara(q: string, limit: number): Promise<Proposicao[]> {
  const j = await getJson<{ dados: any[] }>(
    `${CAMARA}/proposicoes?keywords=${encodeURIComponent(q)}&itens=${limit}&ordem=DESC&ordenarPor=id`,
  );
  return (j.dados ?? []).map(toProposicao);
}

async function searchSenado(q: string, limit: number): Promise<Proposicao[]> {
  // só o último ano: a busca devolve tudo desde 1949, em ordem do mais antigo
  const rows = await getJson<any[]>(
    `${SENADO}/processo?termo=${encodeURIComponent(q)}&dataInicioApresentacao=${ymd(-365)}`,
    30_000,
  );
  return [...rows]
    .sort((a, b) => (b.dataApresentacao ?? '').localeCompare(a.dataApresentacao ?? ''))
    .slice(0, limit)
    .map((m) => ({
      id: m.id,
      ref: m.identificacao,
      ementa: plain(m.ementa, 220),
      data: m.dataApresentacao,
      url: senadoMateria(m.codigoMateria) ?? m.urlDocumento ?? 'https://www25.senado.leg.br/web/atividade/materias',
      casa: 'Senado' as const,
    }));
}

/**
 * Busca projetos na Câmara e no Senado e junta (mais recentes primeiro).
 * Se uma das casas falhar, devolve só a outra.
 */
export async function searchProposicoes(q: string, limit = 8): Promise<Proposicao[]> {
  const half = Math.max(3, Math.ceil(limit / 2) + 1);
  const [cam, sen] = await Promise.allSettled([searchCamara(q, half), searchSenado(q, half)]);
  if (cam.status === 'rejected' && sen.status === 'rejected') throw cam.reason;
  const all = [...(cam.status === 'fulfilled' ? cam.value : []), ...(sen.status === 'fulfilled' ? sen.value : [])];
  return all.sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '')).slice(0, limit);
}

export interface Senado {
  votacoes: {
    id: number;
    ref: string;
    descricao: string;
    data: string;
    resultado: 'aprovada' | 'rejeitada' | 'outro';
    sim: number | null;
    nao: number | null;
    abst: number | null;
    url: string | null;
  }[];
  materias: {
    id: number;
    ref: string;
    ementa: string;
    autoria: string;
    situacao: string;
    data: string;
    url: string | null; // página da matéria
    doc: string | null; // texto do documento
  }[];
}

export async function fetchSenado(): Promise<Senado> {
  const year = ymd().slice(0, 4);
  const [vot, mat] = await Promise.all([
    getJson<any[]>(`${SENADO}/votacao?ano=${year}`, 40_000),
    getJson<any[]>(`${SENADO}/processo?dataInicioApresentacao=${ymd(-10)}`),
  ]);

  const votacoes = [...vot]
    .sort((a, b) => b.dataSessao.localeCompare(a.dataSessao) || (b.sequencialVotacao ?? 0) - (a.sequencialVotacao ?? 0))
    .slice(0, 8)
    .map((v) => {
      const votos: any[] = Array.isArray(v.votos) ? v.votos : [];
      const count = (s: string) => votos.filter((x) => x.siglaVotoParlamentar === s).length;
      const hasVotes = votos.length > 0;
      return {
        id: v.codigoSessaoVotacao,
        ref: v.identificacao ?? `${v.sigla} ${v.numero}`,
        descricao: plain(v.ementa || v.descricaoVotacao, 200),
        data: v.dataSessao,
        resultado: (v.resultadoVotacao === 'A' ? 'aprovada' : v.resultadoVotacao === 'R' ? 'rejeitada' : 'outro') as
          | 'aprovada'
          | 'rejeitada'
          | 'outro',
        sim: v.totalVotosSim ?? (hasVotes ? count('Sim') : null),
        nao: v.totalVotosNao ?? (hasVotes ? count('Não') : null),
        abst: v.totalVotosAbstencao ?? (hasVotes ? count('Abstenção') : null),
        url: senadoMateria(v.codigoMateria),
      };
    });

  const materias = [...mat]
    .sort((a, b) => (b.dataApresentacao ?? '').localeCompare(a.dataApresentacao ?? ''))
    .slice(0, 10)
    .map((m) => ({
      id: m.id,
      ref: m.identificacao,
      ementa: plain(m.ementa, 220),
      autoria: m.autoria,
      situacao: m.situacaoAtual,
      data: m.dataApresentacao,
      url: senadoMateria(m.codigoMateria),
      doc: m.urlDocumento ?? null,
    }));

  return { votacoes, materias };
}
