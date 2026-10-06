import { getJson, plain, ymd } from '../http.js';

export interface Camara {
  proposicoes: { id: number; ref: string; ementa: string; data: string; url: string }[];
  eventos: { id: number; inicio: string; tipo: string; descricao: string; local: string | null; situacao: string }[];
  votacoes: { id: string; data: string; descricao: string; aprovada: boolean | null; orgao: string }[];
}

export async function fetchCamara(): Promise<Camara> {
  const base = 'https://dadosabertos.camara.leg.br/api/v2';
  const [prop, ev, vot] = await Promise.all([
    getJson(`${base}/proposicoes?siglaTipo=PL,PEC,PLP&ordem=DESC&ordenarPor=id&itens=8`),
    getJson(`${base}/eventos?dataInicio=${ymd()}&dataFim=${ymd(7)}&ordem=ASC&ordenarPor=dataHoraInicio&itens=8`),
    getJson(`${base}/votacoes?ordem=DESC&ordenarPor=dataHoraRegistro&itens=6`),
  ]);
  return {
    proposicoes: (prop.dados ?? []).map((p: any) => ({
      id: p.id,
      ref: `${p.siglaTipo} ${p.numero}/${p.ano}`,
      ementa: plain(p.ementa, 220),
      data: p.dataApresentacao,
      url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
    })),
    eventos: (ev.dados ?? []).map((e: any) => ({
      id: e.id,
      inicio: e.dataHoraInicio,
      tipo: e.descricaoTipo,
      descricao: plain(e.descricao, 160),
      local: e.localCamara?.nome ?? e.localExterno ?? null,
      situacao: e.situacao,
    })),
    votacoes: (vot.dados ?? []).map((v: any) => ({
      id: v.id,
      data: v.dataHoraRegistro ?? v.data,
      descricao: plain(v.descricao, 200),
      aprovada: v.aprovacao === 1 ? true : v.aprovacao === 0 ? false : null,
      orgao: v.siglaOrgao,
    })),
  };
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
  }[];
  materias: { id: number; ref: string; ementa: string; autoria: string; situacao: string; data: string; url: string | null }[];
}

export async function fetchSenado(): Promise<Senado> {
  const base = 'https://legis.senado.leg.br/dadosabertos';
  const year = ymd().slice(0, 4);
  const [vot, mat] = await Promise.all([
    getJson<any[]>(`${base}/votacao?ano=${year}`, 40_000),
    getJson<any[]>(`${base}/processo?dataInicioApresentacao=${ymd(-10)}`),
  ]);

  const votacoes = [...vot]
    .sort((a, b) => b.dataSessao.localeCompare(a.dataSessao) || (b.sequencialVotacao ?? 0) - (a.sequencialVotacao ?? 0))
    .slice(0, 6)
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
      };
    });

  const materias = [...mat]
    .sort((a, b) => (b.dataApresentacao ?? '').localeCompare(a.dataApresentacao ?? ''))
    .slice(0, 8)
    .map((m) => ({
      id: m.id,
      ref: m.identificacao,
      ementa: plain(m.ementa, 220),
      autoria: m.autoria,
      situacao: m.situacaoAtual,
      data: m.dataApresentacao,
      url: m.urlDocumento ?? null,
    }));

  return { votacoes, materias };
}
