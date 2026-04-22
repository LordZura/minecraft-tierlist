'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionUser } from '@/lib/authSession';

type Matchup = {
  id: string;
  pvp_type: string;
  player_a: string;
  player_b: string;
  player_a_name: string;
  player_b_name: string;
  my_ready: boolean;
  opponent_ready: boolean;
  ready_by_at: string | null;
  unresolved_rounds: number;
  completed_rounds: number;
  my_wins: number;
  opponent_wins: number;
  status: string;
  has_default: boolean;
};

type Progress = {
  pvp_type: string;
  required_rounds: number;
  completed_rounds: number;
  penalty_applied: boolean;
};

const STATUS_LABELS: Record<string, { label: string; tone: 'good' | 'warn' | 'muted' }> = {
  waiting_for_you: { label: 'Waiting for you', tone: 'warn' },
  waiting_for_opponent: { label: 'Waiting for opponent', tone: 'warn' },
  both_ready: { label: 'Both ready', tone: 'good' },
  result_pending: { label: 'Result pending', tone: 'muted' },
  completed: { label: 'Completed', tone: 'good' },
  default_win: { label: 'Default win', tone: 'muted' },
};

export default function WeeklyEventPanel() {
  const router = useRouter();
  const [cycle, setCycle] = useState<any>(null);
  const [assignments, setAssignments] = useState<Matchup[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, { mine: number; opp: number }>>({});

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setMyId(user.id);
    load(user.id);
    const interval = setInterval(() => load(user.id, true), 20_000);
    return () => clearInterval(interval);
  }, []);

  async function load(userId: string, silent = false) {
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      await fetch('/api/weekly/sync', { method: 'POST', headers: { 'x-user-id': userId } });
      const res = await fetch('/api/weekly/me', { headers: { 'x-user-id': userId } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load weekly event.');
      setCycle(data.cycle);
      setAssignments(data.assignments ?? []);
      setProgress(data.progress ?? []);
      setHistory(data.history ?? []);
      setScores((prev) => {
        const next = { ...prev };
        for (const item of data.assignments ?? []) {
          if (!next[item.id]) next[item.id] = { mine: Math.max(1, item.unresolved_rounds ?? 1), opp: 0 };
        }
        return next;
      });
    } catch (e: any) {
      if (!silent) setError(e.message ?? 'Failed to load weekly event.');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function confirm(matchupId: string) {
    if (!myId) return;
    setBusyId(matchupId);
    try {
      const res = await fetch('/api/weekly/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': myId },
        body: JSON.stringify({ assignment_id: matchupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to confirm ready.');
      await load(myId, true);
    } catch (e: any) {
      alert(e.message ?? 'Failed to confirm ready.');
    } finally {
      setBusyId(null);
    }
  }

  async function report(matchup: Matchup) {
    if (!myId) return;
    const score = scores[matchup.id] ?? { mine: 0, opp: 0 };

    setBusyId(matchup.id);
    try {
      const res = await fetch('/api/weekly/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': myId },
        body: JSON.stringify({
          assignment_id: matchup.id,
          my_round_wins: score.mine,
          opponent_round_wins: score.opp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit matchup result.');
      await load(myId, true);
    } catch (e: any) {
      alert(e.message ?? 'Failed to submit matchup result.');
    } finally {
      setBusyId(null);
    }
  }

  const progressMap = useMemo(() => Object.fromEntries(progress.map((p) => [p.pvp_type, p])), [progress]);
  const selectedTypes: string[] = cycle?.selected_pvp_types ?? [];
  const remainingMs = cycle ? new Date(cycle.end_at).getTime() - Date.now() : 0;
  const remainingText =
    remainingMs <= 0
      ? 'Ended'
      : `${Math.floor(remainingMs / (1000 * 60 * 60 * 24))}d ${Math.floor((remainingMs / (1000 * 60 * 60)) % 24)}h`;

  const sections = useMemo(() => {
    return selectedTypes.map((type) => ({
      type,
      cards: assignments.filter((a) => a.pvp_type === type),
      progress: progressMap[type],
    }));
  }, [selectedTypes, assignments, progressMap]);

  const totalRequired = selectedTypes.reduce((acc, type) => acc + (progressMap[type]?.required_rounds ?? cycle?.required_rounds_per_type ?? 3), 0);
  const totalDone = selectedTypes.reduce((acc, type) => acc + (progressMap[type]?.completed_rounds ?? 0), 0);

  if (loading) return <div className="card" style={{ padding: 32, textAlign: 'center' }}><span className="font-pixel" style={{ color: 'var(--color-muted)' }}>Loading weekly event…</span></div>;
  if (error) return <div className="card" style={{ padding: 24 }}><p style={{ color: 'var(--color-red)' }}>{error}</p></div>;
  if (!cycle) return <div className="card" style={{ padding: 24 }}><p style={{ color: 'var(--color-muted)' }}>No weekly cycle found.</p></div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="card" style={{ padding: 20 }}>
        <p className="font-mono page-kicker">Weekly Required PvP Event</p>
        <h2 className="font-pixel" style={{ marginTop: 8, color: 'var(--color-green)', fontSize: '1.4rem' }}>Cycle #{cycle.id.slice(0, 8)}</h2>
        <p style={{ color: 'var(--color-text-dim)', marginTop: 6 }}>Status: <b>{cycle.status}</b> · Ends {new Date(cycle.end_at).toLocaleString()} ({remainingText} remaining)</p>
        <p style={{ color: 'var(--color-text-dim)', marginTop: 4 }}>Overall progress: {totalDone}/{totalRequired} resolved rounds</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {selectedTypes.map((type) => <span key={type} className="badge badge-gold">{type}</span>)}
        </div>
      </div>

      {sections.map(({ type, cards, progress: row }) => {
        const required = row?.required_rounds ?? cycle.required_rounds_per_type ?? 3;
        const done = row?.completed_rounds ?? 0;
        const pct = Math.min(100, Math.round((done / required) * 100));

        return (
          <div key={type} className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <h3 className="font-pixel" style={{ fontSize: '1.05rem' }}>{type.toUpperCase()}</h3>
              <p className="font-mono" style={{ color: 'var(--color-text-dim)', fontSize: '0.78rem' }}>{done}/{required} rounds completed</p>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 8, marginBottom: 12 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-green)' }} />
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {cards.length === 0 && <p style={{ color: 'var(--color-muted)' }}>No matchup cards for this type in this cycle.</p>}
              {cards.map((card) => {
                const status = STATUS_LABELS[card.status] ?? STATUS_LABELS.result_pending;
                const score = scores[card.id] ?? { mine: 0, opp: 0 };
                const maxRounds = Math.max(card.unresolved_rounds, 0);

                return (
                  <div key={card.id} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ fontWeight: 700 }}>{card.player_a_name} vs {card.player_b_name}</p>
                      <span className={`badge ${status.tone === 'good' ? 'badge-green' : status.tone === 'warn' ? 'badge-gold' : 'badge-muted'}`}>{status.label}</span>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
                      Ready: You {card.my_ready ? '✅' : '⏳'} · Opponent {card.opponent_ready ? '✅' : '⏳'}
                      {card.ready_by_at ? ` · Deadline ${new Date(card.ready_by_at).toLocaleString()}` : ''}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
                      Result: {card.my_wins}-{card.opponent_wins} · Remaining rounds in this matchup: {card.unresolved_rounds}
                    </p>

                    {card.unresolved_rounds > 0 && (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {!card.my_ready && (
                          <button disabled={busyId === card.id} className="btn btn-ghost" onClick={() => confirm(card.id)}>
                            {busyId === card.id ? 'Saving…' : 'Confirm ready for matchup'}
                          </button>
                        )}

                        {card.my_ready && card.opponent_ready && (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
                              <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                                My round wins
                                <input
                                  className="input"
                                  type="number"
                                  min={0}
                                  max={maxRounds}
                                  value={score.mine}
                                  onChange={(e) => setScores((prev) => ({ ...prev, [card.id]: { ...score, mine: Math.max(0, Number(e.target.value) || 0) } }))}
                                />
                              </label>
                              <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                                Opponent round wins
                                <input
                                  className="input"
                                  type="number"
                                  min={0}
                                  max={maxRounds}
                                  value={score.opp}
                                  onChange={(e) => setScores((prev) => ({ ...prev, [card.id]: { ...score, opp: Math.max(0, Number(e.target.value) || 0) } }))}
                                />
                              </label>
                            </div>
                            <button disabled={busyId === card.id} className="btn btn-primary" onClick={() => report(card)}>
                              {busyId === card.id ? 'Submitting…' : 'Submit matchup result'}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="card" style={{ padding: 20 }}>
        <h3 className="font-pixel" style={{ marginBottom: 8, fontSize: '1rem' }}>Rules</h3>
        <ul style={{ paddingLeft: 18, color: 'var(--color-text-dim)', lineHeight: 1.7 }}>
          <li>Weekly page now uses matchup cards (one readiness + one result submission per matchup).</li>
          <li>Submit matchup result as round wins for both players (e.g. 3-1).</li>
          <li>Each reported round win is recorded as a normal confirmed duel for rankings, Elo, and profile history.</li>
          <li>If one player confirms readiness and the other does not within 24h, default wins resolve the pending rounds.</li>
        </ul>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 className="font-pixel" style={{ marginBottom: 12, fontSize: '1rem' }}>Recent cycle history</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {history.map((h) => (
            <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, flexWrap: 'wrap' }}>
              <p style={{ fontSize: '0.82rem' }}>{new Date(h.start_at).toLocaleDateString()} - {new Date(h.end_at).toLocaleDateString()}</p>
              <p className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-gold)' }}>{(h.selected_pvp_types ?? []).join(', ')}</p>
              <span className="badge badge-muted">{h.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
