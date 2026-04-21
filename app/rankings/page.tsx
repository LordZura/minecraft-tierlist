import RankingTable from '@/components/RankingTable';

export default function RankingsPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <p className="font-mono page-kicker">
          Global Standings
        </p>
        <h1 className="font-pixel page-title" style={{ color: 'var(--color-text)', marginBottom: 4 }}>
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