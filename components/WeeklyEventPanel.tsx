'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSessionUser } from '@/lib/authSession';
import { PVP_TYPES } from '@/lib/pvp';

type Assignment = {
  id: string;
  pvp_type: string;
  player_a: string;
  player_b: string;
  a_ready_at: string | null;
  b_ready_at: string | null;
  ready_deadline_at: string;
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
  const [cycle, setCycle] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    const user = getSessionUser();
    if (!user) return;
    setMyId(user.id);
    load(user.id);
  }, []);

  async function load(userId: string) {
    await fetch('/api/weekly/sync', { method: 'POST' });
    const res = await fetch('/api/weekly/me', { headers: { 'x-user-id': userId } });
    const data = await res.json();
    setCycle(data.cycle);
    setAssignments(data.assignments ?? []);
    setProgress(data.progress ?? []);
  }

  async function confirm(assignmentId: string) {
    await fetch('/api/weekly/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': myId ?? '' }, body: JSON.stringify({ assignment_id: assignmentId }) });
    if (myId) load(myId);
  }

  async function report(assignmentId: string, winnerId: string) {
    await fetch('/api/weekly/report', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': myId ?? '' }, body: JSON.stringify({ assignment_id: assignmentId, winner_id: winnerId }) });
    if (myId) load(myId);
  }

  const progressMap = useMemo(() => Object.fromEntries(progress.map((p) => [p.pvp_type, p])), [progress]);

  if (!cycle) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <p className="font-mono" style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: 'var(--color-gold)', marginBottom: 8 }}>WEEKLY REQUIRED PVP CYCLE</p>
      <p style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem', marginBottom: 10 }}>Cycle ends: {new Date(cycle.end_at).toLocaleString()}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, marginBottom: 14 }}>
        {PVP_TYPES.map((t) => {
          const p = progressMap[t];
          return <div key={t} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 8 }}><b>{t}</b><div style={{ fontSize: 12 }}>{p?.completed_rounds ?? 0}/{p?.required_rounds ?? 3} rounds</div></div>;
        })}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {assignments.map((a) => {
          const meIsA = myId === a.player_a;
          const myReady = meIsA ? a.a_ready_at : a.b_ready_at;
          const oppReady = meIsA ? a.b_ready_at : a.a_ready_at;
          const opp = meIsA ? a.player_b : a.player_a;
          return (
            <div key={a.id} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{a.pvp_type} vs {opp.slice(0, 6)}…</span>
                <span className="badge badge-muted">{a.status}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-muted)' }}>Deadline: {new Date(a.ready_deadline_at).toLocaleString()}</p>
              <p style={{ fontSize: 12 }}>Ready: You {myReady ? '✅' : '⏳'} / Opponent {oppReady ? '✅' : '⏳'}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                {!myReady && a.status !== 'completed' && a.status !== 'expired' && <button className="btn btn-ghost" onClick={() => confirm(a.id)}>Confirm ready</button>}
                {myReady && oppReady && a.status !== 'completed' && a.status !== 'expired' && (
                  <>
                    <button className="btn btn-primary" onClick={() => report(a.id, a.player_a)}>Report A won</button>
                    <button className="btn btn-primary" onClick={() => report(a.id, a.player_b)}>Report B won</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
