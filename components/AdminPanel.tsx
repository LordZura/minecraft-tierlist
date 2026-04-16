'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getSessionUser } from '@/lib/authSession';

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
  is_admin: boolean;
  created_at: string;
};

type Tab = 'fights' | 'challenges' | 'users' | 'logs';

export function AdminPanel() {
  const router = useRouter();
  const [isAdmin, setIsAdmin]     = useState<boolean | null>(null);
  const [tab, setTab]             = useState<Tab>('fights');
  const [fights, setFights]       = useState<FightLog[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [users, setUsers]         = useState<UserRow[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState<string | null>(null);
  const [msg, setMsg]             = useState('');

  useEffect(() => {
    const user = getSessionUser();
    if (!user) { router.push('/login'); return; }
    if (!user.is_admin) { setIsAdmin(false); return; }
    setIsAdmin(true);
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [fRes, cRes, uRes, lRes] = await Promise.all([
      supabase.from('fight_logs').select('*, p1:users!fight_logs_player1_fkey(username), p2:users!fight_logs_player2_fkey(username), w:users!fight_logs_winner_fkey(username)').order('created_at', { ascending: false }).limit(50),
      supabase.from('challenges').select('*, ch:users!challenges_challenger_fkey(username), cd:users!challenges_challenged_fkey(username)').order('created_at', { ascending: false }).limit(50),
      supabase.from('users').select('id, username, is_admin, created_at').order('created_at', { ascending: false }),
      supabase.from('admin_logs').select('*, admin:users!admin_logs_admin_id_fkey(username)').order('created_at', { ascending: false }).limit(50),
    ]);
    setFights((fRes.data as FightLog[]) ?? []);
    setChallenges((cRes.data as Challenge[]) ?? []);
    setUsers((uRes.data as UserRow[]) ?? []);
    setAdminLogs(lRes.data ?? []);
    setLoading(false);
  }

  async function logAction(action: string, targetType: string, targetId: string, details?: object) {
    const user = getSessionUser();
    if (!user) return;
    await supabase.from('admin_logs').insert({ admin_id: user.id, action, target_type: targetType, target_id: targetId, details });
  }

  async function approveFight(id: string) {
    setActing(id);
    await supabase.from('fight_logs').update({ is_confirmed: true, confirmed_at: new Date().toISOString() }).eq('id', id);
    await logAction('approve_fight', 'fight_log', id);
    setFights(prev => prev.map(f => f.id === id ? { ...f, is_confirmed: true } : f));
    setMsg('Fight approved.');
    setActing(null);
  }

  async function rejectFight(id: string) {
    setActing(id);
    await supabase.from('fight_logs').update({ rejected: true, is_confirmed: false }).eq('id', id);
    await logAction('reject_fight', 'fight_log', id);
    setFights(prev => prev.map(f => f.id === id ? { ...f, rejected: true } : f));
    setMsg('Fight rejected.');
    setActing(null);
  }

  async function deleteFight(id: string) {
    if (!confirm('Delete this fight log permanently?')) return;
    setActing(id);
    await supabase.from('fight_logs').delete().eq('id', id);
    await logAction('delete_fight', 'fight_log', id);
    setFights(prev => prev.filter(f => f.id !== id));
    setMsg('Fight deleted.');
    setActing(null);
  }

  async function completeChallenge(id: string, winnerId: string) {
    setActing(id);
    await supabase.from('challenges').update({ status: 'completed', winner: winnerId, completed_at: new Date().toISOString() }).eq('id', id);
    await logAction('complete_challenge', 'challenge', id, { winner: winnerId });
    setChallenges(prev => prev.map(c => c.id === id ? { ...c, status: 'completed', winner: winnerId } : c));
    setMsg('Challenge completed.');
    setActing(null);
  }

  async function deleteChallenge(id: string) {
    if (!confirm('Delete this challenge?')) return;
    setActing(id);
    await supabase.from('challenges').delete().eq('id', id);
    await logAction('delete_challenge', 'challenge', id);
    setChallenges(prev => prev.filter(c => c.id !== id));
    setMsg('Challenge deleted.');
    setActing(null);
  }

  async function toggleAdmin(userId: string, current: boolean) {
    setActing(userId);
    await supabase.from('users').update({ is_admin: !current }).eq('id', userId);
    await logAction(current ? 'remove_admin' : 'grant_admin', 'user', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !current } : u));
    setMsg(`Admin ${current ? 'removed' : 'granted'}.`);
    setActing(null);
  }

  async function deleteUser(userId: string) {
    if (!confirm('This will delete the user and ALL their data. Are you sure?')) return;
    setActing(userId);
    await supabase.from('users').delete().eq('id', userId);
    await logAction('delete_user', 'user', userId);
    setUsers(prev => prev.filter(u => u.id !== userId));
    setMsg('User deleted.');
    setActing(null);
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'fights',     label: `Fights (${fights.length})` },
    { key: 'challenges', label: `Challenges (${challenges.length})` },
    { key: 'users',      label: `Users (${users.length})` },
    { key: 'logs',       label: `Audit Log` },
  ];

  if (isAdmin === false) {
    return (
      <div className="card" style={{ padding: 60, textAlign: 'center' }}>
        <p className="font-pixel" style={{ fontSize: '2rem', color: 'var(--color-red)' }}>Access Denied</p>
        <p style={{ color: 'var(--color-text-dim)', marginTop: 12 }}>You must be an admin to view this page.</p>
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

      {/* Tabs */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 4px', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '14px 20px', background: 'transparent', border: 'none',
                borderBottom: tab === t.key ? '2px solid var(--color-gold)' : '2px solid transparent',
                color: tab === t.key ? 'var(--color-gold)' : 'var(--color-muted)',
                fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.8rem',
                letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Fights tab ── */}
        {tab === 'fights' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Player 1</th>
                  <th>Player 2</th>
                  <th>Winner</th>
                  <th>Type</th>
                  <th>Score</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fights.map(f => (
                  <tr key={f.id}>
                    <td>
                      <span className={`badge ${f.is_confirmed ? 'badge-green' : f.rejected ? 'badge-red' : 'badge-gold'}`}>
                        {f.is_confirmed ? 'confirmed' : f.rejected ? 'rejected' : 'pending'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text)' }}>{(f.p1 as any)?.username ?? '?'}</td>
                    <td style={{ color: 'var(--color-text)' }}>{(f.p2 as any)?.username ?? '?'}</td>
                    <td style={{ color: 'var(--color-green)', fontWeight: 600 }}>{(f.w as any)?.username ?? '?'}</td>
                    <td><span className="badge badge-muted">{f.pvp_type}</span></td>
                    <td className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>{f.score ?? '—'}</td>
                    <td className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{new Date(f.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!f.is_confirmed && !f.rejected && (
                          <button onClick={() => approveFight(f.id)} disabled={acting === f.id} className="btn btn-primary" style={{ padding: '3px 10px', fontSize: '0.72rem' }}>✓</button>
                        )}
                        {!f.rejected && (
                          <button onClick={() => rejectFight(f.id)} disabled={acting === f.id} className="btn btn-danger" style={{ padding: '3px 10px', fontSize: '0.72rem' }}>✗</button>
                        )}
                        <button onClick={() => deleteFight(f.id)} disabled={acting === f.id} className="btn btn-danger" style={{ padding: '3px 10px', fontSize: '0.72rem' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Challenges tab ── */}
        {tab === 'challenges' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Challenger</th>
                  <th>Challenged</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {challenges.map(c => (
                  <tr key={c.id}>
                    <td style={{ color: 'var(--color-text)' }}>{(c.ch as any)?.username ?? '?'}</td>
                    <td style={{ color: 'var(--color-text)' }}>{(c.cd as any)?.username ?? '?'}</td>
                    <td>
                      <span className={`badge ${c.status === 'completed' ? 'badge-green' : c.status === 'accepted' ? 'badge-gold' : c.status === 'rejected' ? 'badge-red' : 'badge-muted'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--color-green)' }}>{c.challenger_wins}</span>
                      <span style={{ color: 'var(--color-muted)' }}> – </span>
                      <span style={{ color: 'var(--color-red)' }}>{c.challenged_wins}</span>
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {c.status === 'accepted' && (
                          <>
                            <button onClick={() => completeChallenge(c.id, c.challenger)} disabled={acting === c.id} className="btn btn-primary" style={{ padding: '3px 8px', fontSize: '0.7rem' }}>Chr Win</button>
                            <button onClick={() => completeChallenge(c.id, c.challenged)} disabled={acting === c.id} className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '0.7rem' }}>Chd Win</button>
                          </>
                        )}
                        <button onClick={() => deleteChallenge(c.id)} disabled={acting === c.id} className="btn btn-danger" style={{ padding: '3px 8px', fontSize: '0.7rem' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Users tab ── */}
        {tab === 'users' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--color-green)', fontWeight: 600 }}>{u.username}</td>
                    <td>
                      {u.is_admin ? (
                        <span className="badge badge-gold">Admin</span>
                      ) : (
                        <span className="badge badge-muted">Player</span>
                      )}
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => toggleAdmin(u.id, u.is_admin)} disabled={acting === u.id} className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: '0.72rem' }}>
                          {u.is_admin ? 'Revoke Admin' : 'Make Admin'}
                        </button>
                        <button onClick={() => deleteUser(u.id)} disabled={acting === u.id} className="btn btn-danger" style={{ padding: '3px 8px', fontSize: '0.72rem' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Audit logs tab ── */}
        {tab === 'logs' && (
          <div style={{ overflowX: 'auto' }}>
            {adminLogs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}>No admin actions logged yet.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {adminLogs.map(l => (
                    <tr key={l.id}>
                      <td style={{ color: 'var(--color-gold)' }}>{(l.admin as any)?.username ?? '?'}</td>
                      <td className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>{l.action}</td>
                      <td className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                        {l.target_type}: <span style={{ color: 'var(--color-muted)' }}>{l.target_id?.slice(0, 8)}…</span>
                      </td>
                      <td className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                        {new Date(l.created_at).toLocaleString()}
                      </td>
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