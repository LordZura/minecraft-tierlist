import { FightLogForm } from '@/components/FightLogForm';

export default function FightLogPage() {
  return (
    <div className="page-shell" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <p className="font-mono page-kicker">
          Match Recording
        </p>
        <h1 className="font-pixel page-title" style={{ color: 'var(--color-text)', marginBottom: 8 }}>
          Log a Fight
        </h1>
        <p style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem' }}>
          Your opponent will be notified and must confirm the result before it counts toward rankings.
        </p>
      </div>
      <FightLogForm />
    </div>
  );
}