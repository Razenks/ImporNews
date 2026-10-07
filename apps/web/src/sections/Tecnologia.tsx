import { useState } from 'react';
import type { Bundle } from '../api';
import { Segmented, SectionHead } from '../components';
import { ArchiveFeed } from './ArchiveFeed';

type Tab = 'tech-br' | 'tech-mundo' | 'empresas';

const BLURB: Record<Tab, string> = {
  'tech-br': 'Tecnoblog, Canaltech, Olhar Digital, Mobile Time, G1 Tecnologia, Folha Tec e Showmetech.',
  'tech-mundo': 'Ars Technica, The Verge, Wired, TechCrunch, MIT Technology Review, BBC, IEEE Spectrum, Engadget, The Register e Hacker News.',
  empresas: 'Newsrooms oficiais: NVIDIA, Apple, OpenAI, Anthropic, Google (DeepMind, Research), Microsoft, Meta, AWS, Samsung, GitHub, Hugging Face, Mistral e Cloudflare.',
};

export function Tecnologia({ bundle, now }: { bundle: Bundle | null; now: number }) {
  const [tab, setTab] = useState<Tab>('tech-br');
  return (
    <section id="tecnologia" className="section" aria-labelledby="tecnologia-t" data-sec="tecnologia">
      <SectionHead id="tecnologia" n="05" title="Tecnologia" env={bundle?.tech} now={now}>
        <Segmented<Tab>
          label="Origem"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'tech-br', label: 'Brasil' },
            { value: 'tech-mundo', label: 'Mundo' },
            { value: 'empresas', label: 'Empresas' },
          ]}
        />
      </SectionHead>
      <p className="blurb">{BLURB[tab]}</p>
      <ArchiveFeed key={tab} cat={tab} now={now} defaultPeriod={tab === 'empresas' ? '7d' : '1d'} />
    </section>
  );
}
