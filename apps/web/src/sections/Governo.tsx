import type { Bundle } from '../api';
import { Empty, Ext, Item, SectionHead, Skeleton } from '../components';
import { dayMonth, weekdayTime } from '../format';

function Verdict({ kind }: { kind: 'aprovada' | 'rejeitada' | 'outro' | null }) {
  if (kind === 'aprovada') return <span className="verdict ok">Aprovada</span>;
  if (kind === 'rejeitada') return <span className="verdict no">Rejeitada</span>;
  return <span className="verdict">Registrada</span>;
}

/** Placar do Senado: as barras crescem quando o item abre. */
function Placar({ sim, nao, abst }: { sim: number; nao: number; abst: number }) {
  const total = Math.max(1, sim + nao + abst);
  const rows = [
    ['Sim', sim],
    ['Não', nao],
    ['Abstenção', abst],
  ] as const;
  return (
    <div className="bars">
      {rows.map(([label, n]) => (
        <div key={label}>
          <span>{label}</span>
          <div className="bar"><i style={{ ['--w' as string]: `${(n / total) * 100}%` }} /></div>
          <b className="num">{n}</b>
        </div>
      ))}
    </div>
  );
}

export function Governo({ bundle, now }: { bundle: Bundle | null; now: number }) {
  const cam = bundle?.camara;
  const sen = bundle?.senado;
  const c = cam?.data;
  const s = sen?.data;

  return (
    <section id="governo" className="section" aria-labelledby="governo-t" data-sec="governo">
      <SectionHead id="governo" n="02" title="Congresso" env={[cam, sen]} now={now} />

      <div className="gov">
        <div className="gov-col">
          <h3 className="sub-head">Câmara dos Deputados <span>votações recentes</span></h3>
          {!c ? <Skeleton /> : c.votacoes.length === 0 ? <Empty env={cam} /> : (
            <ul className="feed">
              {c.votacoes.map((v) => (
                <Item key={v.id}>
                  <div className="feed-meta">
                    <time>{dayMonth(v.data)}</time>
                    <Verdict kind={v.aprovada === null ? 'outro' : v.aprovada ? 'aprovada' : 'rejeitada'} />
                    <span className="tag">{v.orgao}</span>
                  </div>
                  <p>{v.descricao}</p>
                </Item>
              ))}
            </ul>
          )}

          <h3 className="sub-head">Projetos apresentados <span>Câmara</span></h3>
          {!c ? <Skeleton rows={3} /> : (
            <ul className="feed">
              {c.proposicoes.map((p) => (
                <Item
                  key={p.id}
                  more={<Ext href={p.url} className="more-link">Abrir ficha de tramitação ↗</Ext>}
                >
                  <div className="feed-meta">
                    <span className="ref plain">{p.ref}</span>
                    <time>{dayMonth(p.data)}</time>
                  </div>
                  <p>{p.ementa}</p>
                </Item>
              ))}
            </ul>
          )}
        </div>

        <div className="gov-col">
          <h3 className="sub-head">Senado Federal <span>votações recentes</span></h3>
          {!s ? <Skeleton /> : s.votacoes.length === 0 ? <Empty env={sen} /> : (
            <ul className="feed">
              {s.votacoes.map((v) => (
                <Item
                  key={v.id}
                  more={v.sim !== null ? <Placar sim={v.sim} nao={v.nao ?? 0} abst={v.abst ?? 0} /> : undefined}
                >
                  <div className="feed-meta">
                    <time>{dayMonth(v.data)}</time>
                    <Verdict kind={v.resultado} />
                    <span className="ref plain">{v.ref}</span>
                  </div>
                  <p>{v.descricao}</p>
                </Item>
              ))}
            </ul>
          )}

          <h3 className="sub-head">Matérias novas <span>Senado</span></h3>
          {!s ? <Skeleton rows={3} /> : (
            <ul className="feed">
              {s.materias.map((m) => (
                <Item
                  key={m.id}
                  more={
                    <>
                      <p className="byline">{m.autoria}</p>
                      <p className="byline">Situação: {m.situacao.toLowerCase()}</p>
                      {m.url && <Ext href={m.url} className="more-link">Ver documento ↗</Ext>}
                    </>
                  }
                >
                  <div className="feed-meta">
                    <span className="ref plain">{m.ref}</span>
                    <time>{dayMonth(m.data)}</time>
                  </div>
                  <p>{m.ementa}</p>
                </Item>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="agenda">
        <h3 className="sub-head">Agenda da Câmara <span>próximos 7 dias</span></h3>
        {!c ? <Skeleton rows={2} /> : c.eventos.length === 0 ? <Empty text="Nenhum evento agendado." /> : (
          <ul className="agenda-list">
            {c.eventos.map((e) => (
              <li key={e.id}>
                <time>{weekdayTime(e.inicio)}</time>
                <div>
                  <b>{e.tipo}</b>
                  <span>{e.descricao}</span>
                  {e.local && <em>{e.local}</em>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
