import type { Bundle } from '../api';
import { SectionHead } from '../components';
import { ArchiveFeed, type TagDef } from './ArchiveFeed';

// As pílulas só aparecem quando há notícias da modalidade no período escolhido.
const SPORTS: TagDef[] = [
  { id: 'futebol', label: 'Futebol', match: ['futebol'] },
  { id: 'f1', label: 'F1', match: ['f1'] },
  { id: 'motogp', label: 'MotoGP', match: ['motogp'] },
  { id: 'basquete', label: 'Basquete', match: ['basquete'] },
  { id: 'volei', label: 'Vôlei', match: ['volei'] },
  { id: 'tenis', label: 'Tênis', match: ['tenis'] },
  { id: 'fisiculturismo', label: 'Fisiculturismo', match: ['fisiculturismo'] },
  {
    id: 'artes-marciais',
    label: 'Artes marciais',
    match: ['mma', 'boxe', 'judo', 'muaythai', 'jiujitsu', 'lutas'],
    children: [
      { id: 'mma', label: 'MMA / UFC', match: ['mma'] },
      { id: 'boxe', label: 'Boxe', match: ['boxe'] },
      { id: 'judo', label: 'Judô', match: ['judo'] },
      { id: 'muaythai', label: 'Muay thai', match: ['muaythai'] },
      { id: 'jiujitsu', label: 'Jiu-jitsu', match: ['jiujitsu'] },
      { id: 'lutas', label: 'Outras lutas', match: ['lutas'] },
    ],
  },
  { id: 'olimpicos', label: 'Olímpicos', match: ['olimpicos'] },
  { id: 'outros', label: 'Outros', match: ['outros'] },
];

export function Esportes({ bundle, now }: { bundle: Bundle | null; now: number }) {
  return (
    <section id="esportes" className="section" aria-labelledby="esportes-t" data-sec="esportes">
      <SectionHead id="esportes" n="08" title="Esportes" env={bundle?.tech} now={now} />
      <p className="blurb">
        Notícias dos principais canais de esporte do Brasil (ge, ESPN Brasil, Gazeta Esportiva, Folha, Placar, Trivela, Motorsport.com Brasil)
        e do mundo (BBC Sport, ESPN, CBS Sports, Motorsport.com, Autosport, Crash.net, The Race), mais buscas por modalidade.
        Escolha a modalidade e se quer veículos do Brasil ou do mundo.
      </p>
      <ArchiveFeed cat="esportes" now={now} defaultPeriod="1d" regions tags={SPORTS} coverage={false} />
    </section>
  );
}
