import WeeklyEventPanel from '@/components/WeeklyEventPanel';

export default function WeeklyEventPage() {
  return (
    <div className="page-shell" style={{ maxWidth: 980 }}>
      <div className="page-header">
        <p className="font-mono page-kicker">Global Event</p>
        <h1 className="font-pixel page-title" style={{ color: 'var(--color-text)' }}>
          Weekly Required PvP
        </h1>
        <p style={{ color: 'var(--color-text-dim)', marginTop: 8 }}>
          Shared weekly pool, required rounds, readiness deadlines, and automatic inactivity resolution.
        </p>
      </div>
      <WeeklyEventPanel />
    </div>
  );
}
