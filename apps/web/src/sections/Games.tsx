import type { Bundle } from '../api';
import { SectionHead } from '../components';
import { ArchiveFeed, type TagDef } from './ArchiveFeed';

const PLATFORMS: TagDef[] = [
  { id: 'playstation', label: 'PlayStation', match: ['playstation'] },
  { id: 'xbox', label: 'Xbox', match: ['xbox'] },
  { id: 'nintendo', label: 'Nintendo', match: ['nintendo'] },
  { id: 'pc', label: 'PC', match: ['pc'] },
  { id: 'mobile', label: 'Mobile', match: ['mobile'] },
  { id: 'esports', label: 'eSports', match: ['esports'] },
  { id: 'outros', label: 'Geral', match: ['outros'] },
];

export function Games({ bundle, now }: { bundle: Bundle | null; now: number }) {
  return (
    <section id="games" className="section" aria-labelledby="games-t" data-sec="games">
      <SectionHead id="games" n="06" title="Games" env={bundle?.tech} now={now} />
      <p className="blurb">
        Do Brasil: IGN Brasil, Adrenaline, Meups, Critical Hits, PSX Brasil, Nintendo Blast, Mais Esports. Do mundo: IGN, GameSpot, Eurogamer,
        PC Gamer, Kotaku, Polygon, Rock Paper Shotgun, VGC, GamesRadar, Push Square, Nintendo Life, PlayStation Blog, Xbox Wire e outros.
      </p>
      <ArchiveFeed cat="games" now={now} defaultPeriod="1d" regions tags={PLATFORMS} coverage={false} />
    </section>
  );
}
