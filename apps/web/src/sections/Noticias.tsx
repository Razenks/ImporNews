import type { Bundle } from '../api';
import { SectionHead } from '../components';
import { ArchiveFeed } from './ArchiveFeed';

export function Noticias({ bundle, now }: { bundle: Bundle | null; now: number }) {
  return (
    <section id="noticias" className="section" aria-labelledby="noticias-t" data-sec="noticias">
      <SectionHead id="noticias" n="07" title="Notícias" env={[bundle?.agenciabrasil, bundle?.ibge]} now={now} />
      <p className="blurb">Agência Brasil (agência pública de notícias) e IBGE.</p>
      <ArchiveFeed cat="brasil" now={now} lead />
    </section>
  );
}
