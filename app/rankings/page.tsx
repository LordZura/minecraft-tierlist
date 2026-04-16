import RankingTable from '@/components/RankingTable';

export default function RankingsPage() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <p className="font-mono" style={{ color: 'var(--color-green)', fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
          Global Standings
        </p>
        <h1 className="font-pixel" style={{ fontSize: '2.5rem', color: 'var(--color-text)', marginBottom: 4 }}>
          Rankings
        </h1>
        <p style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem' }}>
          Points: +10 per fight win · −5 per fight loss · +20 per challenge win · −10 per challenge loss
        </p>
      </div>
      <RankingTable />
    </div>
  );
}