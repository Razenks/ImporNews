import type { ReactNode } from 'react';
import { usePlace } from '../place';

/** Bloco que falhou: avisa e oferece tentar de novo. */
export function Failed({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="empty-box">
      <p>{text}</p>
      <button type="button" className="more-link" onClick={onRetry}>Tentar de novo</button>
    </div>
  );
}

/** Convite para escolher a região (mostrado onde o conteúdo depende dela). */
export function Onboard({ title, intro, bullets }: { title: string; intro: string; bullets: ReactNode[] }) {
  const { openPicker } = usePlace();
  return (
    <div className="onboard">
      <h3>{title}</h3>
      <p>{intro}</p>
      <ul>
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      <button type="button" className="btn-solid" onClick={openPicker}>Escolher minha região</button>
    </div>
  );
}
