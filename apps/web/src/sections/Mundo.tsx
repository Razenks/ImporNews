import type { Bundle } from '../api';
import { ago } from '../format';
import { Empty, Ext, Img, Item, SectionHead, Skeleton, Soon } from '../components';
import { ArticleMore } from './Eleicoes';

export function Mundo({ bundle, now }: { bundle: Bundle | null; now: number }) {
  const onu = bundle?.onu;
  const oms = bundle?.oms;

  return (
    <section id="mundo" className="section" aria-labelledby="mundo-t" data-sec="mundo">
      <SectionHead id="mundo" n="05" title="Mundo" env={[onu, oms]} now={now} />

      <div className="world">
        <div>
          <h3 className="sub-head">ONU News <span>conflitos, crises e clima</span></h3>
          {!onu?.data ? <Skeleton rows={5} /> : onu.data.length === 0 ? <Empty env={onu} /> : (
            <ul className="feed">
              {onu.data.slice(0, 8).map((a) => (
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

        <div>
          <h3 className="sub-head">Alertas da OMS <span>surtos · em inglês</span></h3>
          {!oms?.data ? <Skeleton rows={4} /> : oms.data.length === 0 ? <Empty env={oms} /> : (
            <ul className="feed">
              {oms.data.map((o) => (
                <Item key={o.url} more={<Ext href={o.url} className="more-link">Ler o boletim da OMS ↗</Ext>}>
                  <div className="feed-meta"><time>{ago(o.date, now)}</time><span className="tag">WHO · DON</span></div>
                  <h4 className="headline">{o.title}</h4>
                  <p>{o.summary}</p>
                </Item>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Soon
        items={[
          { name: 'Itamaraty', what: 'alertas para brasileiros no exterior' },
          { name: 'DATASUS', what: 'vacinação e doenças no Brasil' },
        ]}
      />
    </section>
  );
}
