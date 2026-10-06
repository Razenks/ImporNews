import { useMemo, useState } from 'react';
import type { Article, Bundle } from '../api';
import { ago } from '../format';
import { Empty, Ext, Img, Item, Segmented, SectionHead, Skeleton } from '../components';
import { ArticleMore } from './Eleicoes';

type Source = 'todas' | 'Agência Brasil' | 'IBGE';

export function Noticias({ bundle, now }: { bundle: Bundle | null; now: number }) {
  const [src, setSrc] = useState<Source>('todas');
  const ab = bundle?.agenciabrasil;
  const ib = bundle?.ibge;

  const items = useMemo(() => {
    const all: Article[] = [...(ab?.data ?? []), ...(ib?.data ?? [])];
    all.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    return src === 'todas' ? all : all.filter((a) => a.source === src);
  }, [ab?.data, ib?.data, src]);

  const loading = !ab?.data && !ib?.data;
  const [lead, ...rest] = items;

  return (
    <section id="noticias" className="section" aria-labelledby="noticias-t" data-sec="noticias">
      <SectionHead id="noticias" n="06" title="Notícias" env={[ab, ib]} now={now}>
        <Segmented
          label="Fonte"
          value={src}
          onChange={setSrc}
          options={[
            { value: 'todas', label: 'Todas' },
            { value: 'Agência Brasil', label: 'Ag. Brasil' },
            { value: 'IBGE', label: 'IBGE' },
          ]}
        />
      </SectionHead>

      {loading ? <Skeleton rows={6} /> : !lead ? <Empty text="Nenhuma notícia." /> : (
        <div className="news" key={src}>
          <article className="lead">
            <Img src={lead.image} className="lead-img" />
            <div className="feed-meta"><span className="tag">{lead.source}</span><time>{ago(lead.date, now)}</time></div>
            <Ext href={lead.url} className="lead-title">{lead.title}</Ext>
            <p>{lead.summary}</p>
          </article>
          <ul className="feed news-list">
            {rest.slice(0, 14).map((a) => (
              <Item key={a.url} className="with-img" more={<ArticleMore a={a} />}>
                <div>
                  <div className="feed-meta"><span className="tag">{a.source}</span><time>{ago(a.date, now)}</time></div>
                  <h4 className="headline">{a.title}</h4>
                </div>
                <Img src={a.image} className="thumb" />
              </Item>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
