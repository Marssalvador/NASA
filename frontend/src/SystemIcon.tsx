import { Activity, Bone, Brain, Heart, Shield } from 'lucide-react';
export default function SystemIcon({ id, size = 27 }: { id: string; size?: number }) {
  const props = { size, strokeWidth: 1.35, 'aria-hidden': true as const };
  if (id === 'heart') return <Heart {...props} />;
  if (id === 'brain') return <Brain {...props} />;
  if (id === 'skeleton') return <Bone {...props} />;
  if (id === 'muscles') return <Activity {...props} />;
  if (id === 'metabolic') return <Shield {...props} />;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {id === 'lungs' ? (
        <>
          <path d="M14 3v13l-4 5m8-18v13l4 5M12 9C8 8 5 14 4 20s0 8 4 8c5 0 5-7 6-12m6-7c4-1 7 5 8 11s0 8-4 8c-5 0-5-7-6-12" />
          <path d="M14 13h4" />
        </>
      ) : (
        <>
          <path d="M11 5C4 3 2 12 4 20c1 6 6 7 9 3 2-3-2-4-2-8s5-6 0-10Zm10 0c7-2 9 7 7 15-1 6-6 7-9 3-2-3 2-4 2-8s-5-6 0-10Z" />
          <path d="M12 17c3 0 3 7 3 12m5-12c-3 0-3 7-3 12" />
        </>
      )}
    </svg>
  );
}
