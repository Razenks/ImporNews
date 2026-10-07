import type { Article, Bundle } from '../api';
import { CountUp, Empty, Ext, Img, Item, SectionHead } from '../components';
import { ago, daysUntil, intl } from '../format';

const SECOND_ROUND = '2026-10-25';
const TOPIC = /elei[çc]|turno|urna|candidat|governador|senador|presidente|deputad|tse\b|voto/i;

/** Parte que aparece ao expandir uma notícia: imagem grande + link para a fonte. */
export function ArticleMore({ a }: { a: Article }) {
  return (
    <>
      <Img src={a.image} className="big" />
      <Ext href={a.url} className="more-link">Ler na fonte ↗</Ext>
    </>
  );
}

export function Eleicoes({ bundle, now }: { bundle: Bundle | null; now: number }) {
  const days = daysUntil(SECOND_ROUND, now);
  const news = (bundle?.agenciabrasil.data ?? []).filter((a) => TOPIC.test(a.title)).slice(0, 5);

  return (
    <section id="eleicoes" className="section" aria-labelledby="eleicoes-t" data-sec="politica">
      <SectionHead id="eleicoes" n="·" title="Eleições 2026" env={bundle?.agenciabrasil} now={now} />

      <div className="elec">
        <div className="count">
          <div className="count-num" aria-live="off">
            {days > 0 ? <CountUp value={days} format={(v) => intl(Math.round(v))} /> : days === 0 ? 'Hoje' : '—'}
          </div>
          <div className="count-lbl">
            {days > 1 ? 'dias para o 2º turno' : days === 1 ? 'dia para o 2º turno' : days === 0 ? 'é dia de 2º turno' : '2º turno encerrado'}
          </div>
          <dl className="dates">
            <div><dt>1º turno</dt><dd>4 de outubro</dd></div>
            <div><dt>2º turno</dt><dd>25 de outubro</dd></div>
          </dl>
          <Ext href="https://resultados.tse.jus.br" className="btn">Apuração oficial no TSE ↗</Ext>
        </div>

        <div className="elec-news">
          <h3 className="sub-head">Na imprensa pública <span>Agência Brasil</span></h3>
          {news.length === 0 ? <Empty text="Nenhuma notícia sobre eleições nas últimas publicações." /> : (
            <ul className="feed">
              {news.map((a) => (
                <Item key={a.url} className="with-img" more={<ArticleMore a={a} />}>
                  <div>
                    <div className="feed-meta"><time>{ago(a.date, now)}</time></div>
                    <h4 className="headline">{a.title}</h4>
                    <p>{a.summary}</p>
                  </div>
                  <Img src={a.image} className="thumb" />
                </Item>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
