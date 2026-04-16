import { FightLogForm } from '@/components/FightLogForm';

export default function FightLogPage() {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <p className="font-mono" style={{ color: 'var(--color-green)', fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
          Match Recording
        </p>
        <h1 className="font-pixel" style={{ fontSize: '2.5rem', color: 'var(--color-text)', marginBottom: 8 }}>
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