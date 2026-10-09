import { useState } from 'react';
import type { Bundle } from '../api';
import { Segmented, SectionHead } from '../components';
import { usePlace } from '../place';
import { ArchiveFeed } from './ArchiveFeed';
import { LocalNews } from './Locais';
import { Onboard } from './RegionBits';

type Scope = 'geral' | 'perto';

/** Só notícias boas: conquistas, descobertas, solidariedade. */
export function Boas({ bundle, now }: { bundle: Bundle | null; now: number }) {
  const [scope, setScope] = useState<Scope>('geral');
  const { place } = usePlace();
  return (
    <section id="boas" className="section" aria-labelledby="boas-t" data-sec="boas">
      <SectionHead id="boas" n="10" title="Notícias boas" env={bundle?.tech} now={now}>
        <Segmented<Scope>
          label="Onde"
          value={scope}
          onChange={setScope}
          options={[{ value: 'geral', label: 'Brasil e mundo' }, { value: 'perto', label: 'Perto de mim' }]}
        />
      </SectionHead>
      <p className="blurb">
        Conquistas, descobertas e gestos de solidariedade, sem crimes e tragédias. Reunimos sites feitos para isso
        (Só Notícia Boa, Good News Network, Reasons to be Cheerful, Optimist Daily) e filtramos o resto por palavras-chave,
        então pode escapar uma manchete ou outra.
      </p>
      {scope === 'geral' ? (
        <ArchiveFeed key="geral" cat="boas" now={now} defaultPeriod="7d" coverage={false} regions />
      ) : !place ? (
        <Onboard
          title="Boas notícias perto de você"
          intro="Escolha onde você mora para ver só as boas notícias da sua cidade ou estado:"
          bullets={[<><b>Conquistas</b>, prêmios e homenagens locais</>, <><b>Solidariedade</b> e projetos que transformam a comunidade</>]}
        />
      ) : (
        <LocalNews key={`${place.uf}|${place.city ?? ''}`} place={place} now={now} good />
      )}
    </section>
  );
}
