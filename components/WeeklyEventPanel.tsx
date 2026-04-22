'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionUser } from '@/lib/authSession';

type Assignment = {
  id: string;
  pvp_type: string;
  round_number: number;
  player_a: string;
  player_b: string;
  player_a_name: string;
  player_b_name: string;
  a_ready_at: string | null;
  b_ready_at: string | null;
  ready_by_at: string | null;
  status: string;
  winner: string | null;
  win_type: string | null;
};

type Progress = {
  pvp_type: string;
  required_rounds: number;
  completed_rounds: number;
  penalty_applied: boolean;
};

export default function WeeklyEventPanel() {
  const router = useRouter();
  const [cycle, setCycle] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    } catch (e: any) {
      if (!silent) setError(e.message ?? 'Failed to load weekly event.');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function confirm(assignmentId: string) {
    if (!myId) return;
    setBusyId(assignmentId);
    try {
      const res = await fetch('/api/weekly/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': myId },
        body: JSON.stringify({ assignment_id: assignmentId }),
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

  async function report(assignmentId: string, winnerId: string) {
    if (!myId) return;
    setBusyId(assignmentId);
    try {
      const res = await fetch('/api/weekly/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': myId },
        body: JSON.stringify({ assignment_id: assignmentId, winner_id: winnerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to report match.');
      await load(myId, true);
    } catch (e: any) {
      alert(e.message ?? 'Failed to report match.');
    } finally {
      setBusyId(null);
    }
  }

  const progressMap = useMemo(() => Object.fromEntries(progress.map((p) => [p.pvp_type, p])), [progress]);
  const remainingMs = cycle ? new Date(cycle.end_at).getTime() - Date.now() : 0;
  const remainingText =
    remainingMs <= 0
      ? 'Ended'
      : `${Math.floor(remainingMs / (1000 * 60 * 60 * 24))}d ${Math.floor((remainingMs / (1000 * 60 * 60)) % 24)}h`;

  if (loading) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <span className="font-pixel" style={{ color: 'var(--color-muted)' }}>Loading weekly event…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <p style={{ color: 'var(--color-red)' }}>{error}</p>
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <p style={{ color: 'var(--color-muted)' }}>No active weekly cycle yet.</p>
      </div>
    );
  }

  const selectedTypes: string[] = cycle.selected_pvp_types ?? [];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="card" style={{ padding: 20 }}>
        <p className="font-mono page-kicker">Weekly Required PvP Event</p>
        <h2 className="font-pixel" style={{ marginTop: 8, color: 'var(--color-green)', fontSize: '1.5rem' }}>Cycle #{cycle.id.slice(0, 8)}</h2>
        <p style={{ color: 'var(--color-text-dim)', marginTop: 8 }}>Ends {new Date(cycle.end_at).toLocaleString()} ({remainingText} remaining)</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {selectedTypes.map((type) => (
            <span key={type} className="badge badge-gold">{type}</span>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 className="font-pixel" style={{ marginBottom: 12, fontSize: '1.1rem' }}>Your required progress</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
          {selectedTypes.map((type) => {
            const row = progressMap[type];
            const done = row?.completed_rounds ?? 0;
            const required = row?.required_rounds ?? cycle.required_rounds_per_type ?? 3;
            const pct = Math.min(100, Math.round((done / required) * 100));
            return (
              <div key={type} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12 }}>
                <p style={{ fontWeight: 700, marginBottom: 8 }}>{type}</p>
                <p className="font-mono" style={{ fontSize: '0.8rem', marginBottom: 8 }}>{done}/{required} rounds</p>
                <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-green)' }} />
                </div>
                {row?.penalty_applied && <p style={{ marginTop: 8, color: 'var(--color-red)', fontSize: '0.75rem' }}>Penalty applied</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 className="font-pixel" style={{ marginBottom: 12, fontSize: '1.1rem' }}>Assigned weekly matches</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {assignments.length === 0 && <p style={{ color: 'var(--color-muted)' }}>No assignments yet. This can happen with very low player counts.</p>}
          {assignments.map((a) => {
            const meIsA = myId === a.player_a;
            const meName = meIsA ? a.player_a_name : a.player_b_name;
            const oppName = meIsA ? a.player_b_name : a.player_a_name;
            const myReady = meIsA ? a.a_ready_at : a.b_ready_at;
            const oppReady = meIsA ? a.b_ready_at : a.a_ready_at;
            const resolved = a.status === 'completed' || a.status === 'expired';
            return (
              <div key={a.id} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <p style={{ fontWeight: 700 }}>{a.pvp_type} · Round {a.round_number}</p>
                  <span className="badge badge-muted">{a.status}</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', marginTop: 4 }}>{meName} vs {oppName}</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 6 }}>
                  Ready: You {myReady ? '✅' : '⏳'} · Opponent {oppReady ? '✅' : '⏳'}
                  {a.ready_by_at ? ` · Timeout ${new Date(a.ready_by_at).toLocaleString()}` : ''}
                </p>
                {a.winner && (
                  <p style={{ fontSize: '0.78rem', marginTop: 6, color: a.winner === myId ? 'var(--color-green)' : 'var(--color-text-dim)' }}>
                    Winner: {a.winner === a.player_a ? a.player_a_name : a.player_b_name}
                    {a.win_type === 'default' ? ' (default win)' : ''}
                  </p>
                )}
                {!resolved && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {!myReady && (
                      <button disabled={busyId === a.id} className="btn btn-ghost" onClick={() => confirm(a.id)}>
                        {busyId === a.id ? 'Saving…' : 'Confirm ready'}
                      </button>
                    )}
                    {myReady && oppReady && (
                      <>
                        <button disabled={busyId === a.id} className="btn btn-primary" onClick={() => report(a.id, a.player_a)}>
                          {a.player_a_name} won
                        </button>
                        <button disabled={busyId === a.id} className="btn btn-primary" onClick={() => report(a.id, a.player_b)}>
                          {a.player_b_name} won
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

      <div className="card" style={{ padding: 20 }}>
        <h3 className="font-pixel" style={{ marginBottom: 8, fontSize: '1rem' }}>Rules</h3>
        <ul style={{ paddingLeft: 18, color: 'var(--color-text-dim)', lineHeight: 1.7 }}>
          <li>Exactly 3 PvP types are selected globally each week.</li>
          <li>You need 3 completed rounds per selected type.</li>
          <li>If one player confirms ready and the other does not within 24h, a default win is awarded automatically.</li>
          <li>Unfinished required types at cycle end trigger a type-specific Elo penalty.</li>
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
