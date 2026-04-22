'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSessionUser } from '@/lib/authSession';

type Assignment = {
  id: string;
  pvp_type: string;
  status: string;
  ready_deadline_at: string;
  ready_a_at: string | null;
  ready_b_at: string | null;
  rounds_a: number | null;
  rounds_b: number | null;
  winner: string | null;
  player_a: string;
  player_b: string | null;
  a?: { username: string };
  b?: { username: string };
  w?: { username: string };
};

export function WeeklyCyclePanel() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [cycle, setCycle] = useState<any>(null);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [myId, setMyId] = useState<string>('');
  const [actingId, setActingId] = useState<string>('');
  const [scoreDraft, setScoreDraft] = useState<Record<string, { a: string; b: string }>>({});

  useEffect(() => {
    const user = getSessionUser();
    if (!user) return;
    setMyId(user.id);
    load(user.id);
  }, []);

  async function load(uid: string) {
    const res = await fetch('/api/weekly', { headers: { 'x-user-id': uid } });
    if (!res.ok) return;
    const data = await res.json();
    setCycle(data.cycle);
    setRequirements(data.requirements ?? []);
    setAssignments(data.assignments ?? []);
  }

  async function runAction(assignmentId: string, action: string) {
    if (!myId) return;
    setActingId(assignmentId);
    const draft = scoreDraft[assignmentId] ?? { a: '0', b: '0' };
    await fetch('/api/weekly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': myId },
      body: JSON.stringify({ assignment_id: assignmentId, action, rounds_a: Number(draft.a), rounds_b: Number(draft.b) }),
    });
    await load(myId);
    setActingId('');
  }

  const progressByType = useMemo(() => {
    const out: Record<string, number> = {};
    assignments.forEach((a) => {
      const rounds = a.player_a === myId ? (a.rounds_a ?? 0) : (a.rounds_b ?? 0);
      out[a.pvp_type] = (out[a.pvp_type] ?? 0) + rounds;
    });
    return out;
  }, [assignments, myId]);

  if (!cycle) return null;

  return (
    <div className="card" style={{ marginBottom: 20, padding: 18 }}>
      <p className="font-mono" style={{ color: 'var(--color-gold)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>Weekly Required PvP</p>
      <p style={{ color: 'var(--color-text-dim)', marginBottom: 12 }}>
        Cycle: {new Date(cycle.start_at).toLocaleString()} → {new Date(cycle.end_at).toLocaleString()}
      </p>

      <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
        {requirements.map((r) => {
          const done = progressByType[r.pvp_type] ?? 0;
          return <p key={r.id} className="font-mono" style={{ fontSize: '0.78rem' }}>{r.pvp_type}: {done}/{r.rounds_required} rounds</p>;
        })}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {assignments.map((a) => {
          const meIsA = a.player_a === myId;
          const myReady = meIsA ? a.ready_a_at : a.ready_b_at;
          const bothReady = !!a.ready_a_at && !!a.ready_b_at;

          return (
            <div key={a.id} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <span className="badge badge-muted">{a.pvp_type}</span>
                  <p style={{ fontSize: '0.86rem', marginTop: 6 }}>{a.a?.username ?? 'TBD'} vs {a.b?.username ?? 'BYE'}</p>
                  <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>Deadline: {new Date(a.ready_deadline_at).toLocaleString()}</p>
                </div>
                <span className="badge badge-gold">{a.status}</span>
              </div>

              {(a.status === 'assigned' || a.status === 'ready') && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" disabled={!!myReady || actingId === a.id} onClick={() => runAction(a.id, 'confirm_ready')}>Confirm Ready</button>
                  <button className="btn btn-ghost" disabled={actingId === a.id} onClick={() => runAction(a.id, 'resolve_timeout')}>Resolve 24h Timeout</button>
                </div>
              )}

              {bothReady && a.status !== 'played' && (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                  <input className="input" type="number" min={0} max={10} placeholder="Rounds A" value={scoreDraft[a.id]?.a ?? ''} onChange={(e) => setScoreDraft((p) => ({ ...p, [a.id]: { a: e.target.value, b: p[a.id]?.b ?? '' } }))} />
                  <input className="input" type="number" min={0} max={10} placeholder="Rounds B" value={scoreDraft[a.id]?.b ?? ''} onChange={(e) => setScoreDraft((p) => ({ ...p, [a.id]: { a: p[a.id]?.a ?? '', b: e.target.value } }))} />
                  <button className="btn btn-primary" style={{ gridColumn: '1 / -1' }} onClick={() => runAction(a.id, 'submit_result')}>Submit Result</button>
                </div>
              )}

              {(a.status === 'played' || a.status === 'default_win') && (
                <p className="font-mono" style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--color-green)' }}>
                  Winner: {a.w?.username ?? '—'} ({a.rounds_a ?? 0}-{a.rounds_b ?? 0})
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
