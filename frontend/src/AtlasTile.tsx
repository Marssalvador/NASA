import type { CSSProperties } from 'react';

export default function AtlasTile({
  asset,
  index,
  label,
  className = '',
}: {
  asset: string;
  index: number;
  label: string;
  className?: string;
}) {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const style: CSSProperties = {
    backgroundImage: `url("${asset}")`,
    backgroundPosition: `${column * 50}% ${(row / 3) * 100}%`,
    backgroundSize: '300% 400%',
  };
  return <div className={`atlas-tile ${className}`} role="img" aria-label={label} style={style} />;
}
