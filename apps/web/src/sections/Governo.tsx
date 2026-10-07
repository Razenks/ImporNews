import { useState } from 'react';
import { searchProposicoes, type Bundle } from '../api';
import { Empty, Ext, Item, SectionHead, Skeleton } from '../components';
import { dayMonth, weekdayTime } from '../format';
import { useAsync, useDebounced } from '../hooks';

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

/** Um ou mais botões de link, lado a lado. */
function Links({ children }: { children: React.ReactNode }) {
  return <div className="link-row">{children}</div>;
}

/** Busca de projetos de lei da Câmara por palavra-chave. */
function ProjectSearch() {
  const [text, setText] = useState('');
  const q = useDebounced(text, 400).trim();
  const on = q.length >= 2;
  const r = useAsync(() => searchProposicoes(q), [q], on);

  return (
    <div className="psearch">
      <label className="search wide">
        <span className="sr">Buscar projetos de lei na Câmara</span>
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar projetos de lei (ex.: escala 6x1, saúde, educação)…"
          value={text}
          maxLength={80}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {on && (
        <div className="psearch-out">
          <p className="archive-info">
            {r.loading ? 'Buscando…' : <><b>{r.data?.length ?? 0}</b> projetos mais recentes para “{q}” · Câmara e Senado</>}
          </p>
          {r.loading && !r.data ? <Skeleton rows={2} /> : !r.data?.length ? (
            <div className="empty-box">
              <p>{r.error ? 'A busca de projetos não respondeu agora.' : 'Nenhum projeto com esse termo. Os projetos usam palavras formais (ex.: “jornada de trabalho” em vez de “6x1”).'}</p>
              <button
                type="button"
                className="more-link"
                onClick={() => window.dispatchEvent(new CustomEvent('impornews:search', { detail: q }))}
              >
                Buscar notícias sobre “{q}”
              </button>
            </div>
          ) : (
            <ul className="feed">
              {r.data.map((p) => (
                <Item
                  key={`${p.casa}${p.id}`}
                  more={<Links><Ext href={p.url} className="more-link">{p.casa === 'Câmara' ? 'Abrir ficha de tramitação ↗' : 'Ver a matéria no Senado ↗'}</Ext></Links>}
                >
                  <div className="feed-meta"><span className="tag">{p.casa}</span><span className="ref plain">{p.ref}</span><time>{dayMonth(p.data)}</time></div>
                  <p>{p.ementa}</p>
                </Item>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function Governo({ bundle, now }: { bundle: Bundle | null; now: number }) {
  const cam = bundle?.camara;
  const sen = bundle?.senado;
  const c = cam?.data;
  const s = sen?.data;

  return (
    <section id="governo" className="section" aria-labelledby="governo-t" data-sec="politica">
      <SectionHead id="governo" n="02" title="Congresso" env={[cam, sen]} now={now} />

      <ProjectSearch />

      <div className="gov">
        <div className="gov-col">
          <h3 className="sub-head">Câmara dos Deputados <span>votações recentes</span></h3>
          {!c ? <Skeleton /> : c.votacoes.length === 0 ? <Empty env={cam} /> : (
            <ul className="feed">
              {c.votacoes.map((v) => (
                <Item
                  key={v.id}
                  more={v.url || v.propUrl ? (
                    <Links>
                      {v.url && <Ext href={v.url} className="more-link">Ver a sessão na Câmara ↗</Ext>}
                      {v.propUrl && <Ext href={v.propUrl} className="more-link">Ver o projeto{v.ref ? ` (${v.ref})` : ''} ↗</Ext>}
                    </Links>
                  ) : undefined}
                >
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
                <Item key={p.id} more={<Links><Ext href={p.url} className="more-link">Abrir ficha de tramitação ↗</Ext></Links>}>
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
                  more={v.sim !== null || v.url ? (
                    <>
                      {v.sim !== null && <Placar sim={v.sim} nao={v.nao ?? 0} abst={v.abst ?? 0} />}
                      {v.url && <Links><Ext href={v.url} className="more-link">Ver a matéria no Senado ↗</Ext></Links>}
                    </>
                  ) : undefined}
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
                      {(m.url || m.doc) && (
                        <Links>
                          {m.url && <Ext href={m.url} className="more-link">Ver a matéria ↗</Ext>}
                          {m.doc && <Ext href={m.doc} className="more-link">Ler o texto ↗</Ext>}
                        </Links>
                      )}
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
        <h3 className="sub-head">Agenda da Câmara <span>próximos 7 dias · toque para abrir</span></h3>
        {!c ? <Skeleton rows={2} /> : c.eventos.length === 0 ? <Empty text="Nenhum evento agendado." /> : (
          <ul className="agenda-list">
            {c.eventos.map((e) => (
              <li key={e.id}>
                <Ext href={e.url} className="agenda-row">
                  <time>{weekdayTime(e.inicio)}</time>
                  <div>
                    <b>{e.tipo}</b>
                    <span>{e.descricao}</span>
                    {e.local && <em>{e.local}</em>}
                  </div>
                  <i className="ext" aria-hidden="true">↗</i>
                </Ext>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
