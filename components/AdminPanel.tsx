'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getSessionUser, isAdminUnlocked, setAdminUnlocked } from '@/lib/authSession';

const ADMIN_PASSWORD = '123123';
const ELO_FIELDS = ['overall', 'average', 'crystal', 'sword', 'axe', 'uhc', 'manhunt', 'mace', 'smp', 'cart', 'bow'] as const;

type FightLog = {
  id: string;
  player1: string;
  player2: string;
  winner: string;
  pvp_type: string;
  score: string | null;
  is_confirmed: boolean;
  rejected: boolean;
  created_at: string;
  p1?: { username: string };
  p2?: { username: string };
  w?: { username: string };
};

type Challenge = {
  id: string;
  challenger: string;
  challenged: string;
  status: string;
  winner: string | null;
  challenger_wins: number;
  challenged_wins: number;
  created_at: string;
  ch?: { username: string };
  cd?: { username: string };
};

type UserRow = {
  id: string;
  username: string;
  created_at: string;
};

type OverrideRow = {
  user_id: string;
  total_points_override: number | null;
  total_wins_override: number | null;
  total_losses_override: number | null;
  elo_overall_override: number | null;
  elo_average_override: number | null;
  elo_crystal_override: number | null;
  elo_sword_override: number | null;
  elo_axe_override: number | null;
  elo_uhc_override: number | null;
  elo_manhunt_override: number | null;
  elo_mace_override: number | null;
  elo_smp_override: number | null;
  elo_cart_override: number | null;
  elo_bow_override: number | null;
};

type Tab = 'fights' | 'challenges' | 'users' | 'logs';

export function AdminPanel() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [tab, setTab] = useState<Tab>('fights');
  const [fights, setFights] = useState<FightLog[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, OverrideRow>>({});
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.is_admin || isAdminUnlocked()) {
      setIsAdmin(true);
      loadAll();
      return;
    }

    setIsAdmin(false);
    setLoading(false);
  }, []);

  async function loadAll() {
    setLoading(true);
    const [fRes, cRes, uRes, lRes, oRes] = await Promise.all([
      supabase.from('fight_logs').select('*, p1:users!fight_logs_player1_fkey(username), p2:users!fight_logs_player2_fkey(username), w:users!fight_logs_winner_fkey(username)').order('created_at', { ascending: false }).limit(100),
      supabase.from('challenges').select('*, ch:users!challenges_challenger_fkey(username), cd:users!challenges_challenged_fkey(username)').order('created_at', { ascending: false }).limit(100),
      supabase.from('users').select('id, username, created_at').order('created_at', { ascending: false }),
      supabase.from('admin_logs').select('*, admin:users!admin_logs_admin_id_fkey(username)').order('created_at', { ascending: false }).limit(100),
      supabase.from('user_admin_overrides').select('*'),
    ]);

    setFights((fRes.data as FightLog[]) ?? []);
    setChallenges((cRes.data as Challenge[]) ?? []);
    setUsers((uRes.data as UserRow[]) ?? []);
    setAdminLogs(lRes.data ?? []);

    const map: Record<string, OverrideRow> = {};
    (oRes.data as OverrideRow[] | null)?.forEach((row) => {
      map[row.user_id] = row;
    });
    setOverrides(map);

    setLoading(false);
  }

  async function logAction(action: string, targetType: string, targetId: string, details?: object) {
    const user = getSessionUser();
    if (!user) return;
    await supabase.from('admin_logs').insert({ admin_id: user.id, action, target_type: targetType, target_id: targetId, details });
  }

  async function unlockAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (password !== ADMIN_PASSWORD) {
      setPasswordError('Wrong admin password.');
      return;
    }

    setAdminUnlocked(true);
    setIsAdmin(true);
    setPassword('');
    setPasswordError('');
    loadAll();
  }

  async function approveFight(id: string) {
    setActing(id);
    await supabase.from('fight_logs').update({ is_confirmed: true, rejected: false, confirmed_at: new Date().toISOString() }).eq('id', id);
    await logAction('approve_fight', 'fight_log', id, { forced: true });
    setFights((prev) => prev.map((f) => (f.id === id ? { ...f, is_confirmed: true, rejected: false } : f)));
    setMsg('Fight approved/forced.');
    setActing(null);
  }

  async function rejectFight(id: string) {
    setActing(id);
    await supabase.from('fight_logs').update({ rejected: true, is_confirmed: false }).eq('id', id);
    await logAction('reject_fight', 'fight_log', id);
    setFights((prev) => prev.map((f) => (f.id === id ? { ...f, rejected: true, is_confirmed: false } : f)));
    setMsg('Fight rejected.');
    setActing(null);
  }

  async function deleteFight(id: string) {
    if (!confirm('Delete this fight log permanently?')) return;
    setActing(id);
    await supabase.from('fight_logs').delete().eq('id', id);
    await logAction('delete_fight', 'fight_log', id);
    setFights((prev) => prev.filter((f) => f.id !== id));
    setMsg('Fight deleted.');
    setActing(null);
  }

  async function completeChallenge(id: string, winnerId: string) {
    setActing(id);
    await supabase.from('challenges').update({ status: 'completed', winner: winnerId, completed_at: new Date().toISOString() }).eq('id', id);
    await logAction('complete_challenge', 'challenge', id, { winner: winnerId, forced: true });
    setChallenges((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'completed', winner: winnerId } : c)));
    setMsg('Challenge force-completed.');
    setActing(null);
  }

  async function deleteChallenge(id: string) {
    if (!confirm('Delete this challenge?')) return;
    setActing(id);
    await supabase.from('challenges').delete().eq('id', id);
    await logAction('delete_challenge', 'challenge', id);
    setChallenges((prev) => prev.filter((c) => c.id !== id));
    setMsg('Challenge deleted.');
    setActing(null);
  }

  async function deleteUser(userId: string) {
    if (!confirm('This will delete the user and ALL their data. Are you sure?')) return;
    setActing(userId);
    await supabase.from('users').delete().eq('id', userId);
    await logAction('delete_user', 'user', userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setMsg('User deleted.');
    setActing(null);
  }

  function startEditUser(userId: string) {
    const ov = overrides[userId];
    setEditUserId(userId);
    setEditValues({
      total_points_override: ov?.total_points_override?.toString() ?? '',
      total_wins_override: ov?.total_wins_override?.toString() ?? '',
      total_losses_override: ov?.total_losses_override?.toString() ?? '',
      ...Object.fromEntries(ELO_FIELDS.map((field) => [`elo_${field}_override`, (ov as any)?.[`elo_${field}_override`]?.toString() ?? ''])),
    });
  }

  async function saveUserOverrides(userId: string) {
    setActing(userId);
    const payload: any = { user_id: userId };

    for (const [key, value] of Object.entries(editValues)) {
      payload[key] = value.trim() === '' ? null : Number(value);
      if (value.trim() !== '' && Number.isNaN(payload[key])) {
        setMsg(`Invalid number in ${key}`);
        setActing(null);
        return;
      }
    }

    const { data, error } = await supabase
      .from('user_admin_overrides')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      setMsg(error.message);
      setActing(null);
      return;
    }

    setOverrides((prev) => ({ ...prev, [userId]: data as OverrideRow }));
    await logAction('set_user_override', 'user', userId, payload);
    setEditUserId(null);
    setEditValues({});
    setMsg('User overrides saved.');
    setActing(null);
  }

  const TABS: { key: Tab; label: string }[] = useMemo(() => [
    { key: 'fights', label: `Fights (${fights.length})` },
    { key: 'challenges', label: `Challenges (${challenges.length})` },
    { key: 'users', label: `Users (${users.length})` },
    { key: 'logs', label: `Audit Log` },
  ], [fights.length, challenges.length, users.length]);

  if (isAdmin === false) {
    return (
      <div className="card" style={{ padding: 40, maxWidth: 460, margin: '30px auto' }}>
        <h2 className="font-pixel" style={{ fontSize: '1.6rem', marginBottom: 10 }}>Admin Login</h2>
        <p style={{ color: 'var(--color-text-dim)', marginBottom: 14 }}>Enter admin password to unlock admin mode.</p>
        <form onSubmit={unlockAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" />
          {passwordError && <p style={{ color: 'var(--color-red)', fontSize: '0.85rem' }}>{passwordError}</p>}
          <button className="btn btn-primary" type="submit">Unlock Admin</button>
        </form>
      </div>
    );
  }

  if (isAdmin === null || loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><span className="font-pixel" style={{ fontSize: '1.5rem', color: 'var(--color-muted)' }}>Loading…</span></div>;
  }

  return (
    <div>
      {msg && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 2, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--color-green)', fontSize: '0.875rem' }}>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 4px', flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '14px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t.key ? '2px solid var(--color-gold)' : '2px solid transparent',
                color: tab === t.key ? 'var(--color-gold)' : 'var(--color-muted)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '0.8rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'fights' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Status</th><th>Player 1</th><th>Player 2</th><th>Winner</th><th>Type</th><th>Score</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {fights.map((f) => (
                  <tr key={f.id}>
                    <td><span className={`badge ${f.is_confirmed ? 'badge-green' : f.rejected ? 'badge-red' : 'badge-gold'}`}>{f.is_confirmed ? 'confirmed' : f.rejected ? 'rejected' : 'pending'}</span></td>
                    <td>{(f.p1 as any)?.username ?? '?'}</td>
                    <td>{(f.p2 as any)?.username ?? '?'}</td>
                    <td style={{ color: 'var(--color-green)' }}>{(f.w as any)?.username ?? '?'}</td>
                    <td><span className="badge badge-muted">{f.pvp_type}</span></td>
                    <td>{f.score ?? '—'}</td>
                    <td>{new Date(f.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => approveFight(f.id)} disabled={acting === f.id} className="btn btn-primary" style={{ padding: '3px 10px', fontSize: '0.72rem' }}>Force ✓</button>
                        <button onClick={() => rejectFight(f.id)} disabled={acting === f.id} className="btn btn-danger" style={{ padding: '3px 10px', fontSize: '0.72rem' }}>Reject</button>
                        <button onClick={() => deleteFight(f.id)} disabled={acting === f.id} className="btn btn-danger" style={{ padding: '3px 10px', fontSize: '0.72rem' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'challenges' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Challenger</th><th>Challenged</th><th>Status</th><th>Score</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {challenges.map((c) => (
                  <tr key={c.id}>
                    <td>{(c.ch as any)?.username ?? '?'}</td>
                    <td>{(c.cd as any)?.username ?? '?'}</td>
                    <td><span className={`badge ${c.status === 'completed' ? 'badge-green' : c.status === 'accepted' ? 'badge-gold' : c.status === 'rejected' ? 'badge-red' : 'badge-muted'}`}>{c.status}</span></td>
                    <td>{c.challenger_wins} - {c.challenged_wins}</td>
                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => completeChallenge(c.id, c.challenger)} disabled={acting === c.id} className="btn btn-primary" style={{ padding: '3px 8px', fontSize: '0.7rem' }}>Chr Win</button>
                        <button onClick={() => completeChallenge(c.id, c.challenged)} disabled={acting === c.id} className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '0.7rem' }}>Chd Win</button>
                        <button onClick={() => deleteChallenge(c.id)} disabled={acting === c.id} className="btn btn-danger" style={{ padding: '3px 8px', fontSize: '0.7rem' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'users' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Joined</th>
                  <th>Overrides</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--color-green)', fontWeight: 600 }}>{u.username}</td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      {editUserId === u.id ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 6, minWidth: 560 }}>
                          {[
                            ['total_points_override', 'Points'],
                            ['total_wins_override', 'Wins'],
                            ['total_losses_override', 'Losses'],
                            ...ELO_FIELDS.map((k) => [`elo_${k}_override`, `ELO ${k}`]),
                          ].map(([key, label]) => (
                            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.72rem' }}>
                              {label}
                              <input className="input" value={editValues[key] ?? ''} onChange={(e) => setEditValues((p) => ({ ...p, [key]: e.target.value }))} />
                            </label>
                          ))}
                        </div>
                      ) : (
                        <span className="badge badge-muted">{overrides[u.id] ? 'Custom set' : 'Default computed'}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {editUserId === u.id ? (
                          <>
                            <button onClick={() => saveUserOverrides(u.id)} disabled={acting === u.id} className="btn btn-primary" style={{ padding: '3px 8px', fontSize: '0.72rem' }}>Save</button>
                            <button onClick={() => { setEditUserId(null); setEditValues({}); }} className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '0.72rem' }}>Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => startEditUser(u.id)} className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '0.72rem' }}>Edit Stats</button>
                        )}
                        <button onClick={() => deleteUser(u.id)} disabled={acting === u.id} className="btn btn-danger" style={{ padding: '3px 8px', fontSize: '0.72rem' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'logs' && (
          <div style={{ overflowX: 'auto' }}>
            {adminLogs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}>No admin actions logged yet.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Admin</th><th>Action</th><th>Target</th><th>Date</th></tr></thead>
                <tbody>
                  {adminLogs.map((l) => (
                    <tr key={l.id}>
                      <td style={{ color: 'var(--color-gold)' }}>{(l.admin as any)?.username ?? '?'}</td>
                      <td>{l.action}</td>
                      <td>{l.target_type}: {l.target_id?.slice(0, 8)}…</td>
                      <td>{new Date(l.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
