'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export function ChallengeForm() {
  const router = useRouter();
  const [myId, setMyId]         = useState<string | null>(null);
  const [players, setPlayers]   = useState<{ id: string; username: string }[]>([]);
  const [opponent, setOpponent] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setMyId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (playerSearch.length < 1) { setPlayers([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('users')
        .select('id, username')
        .ilike('username', `%${playerSearch}%`)
        .neq('id', myId ?? '')
        .limit(10);
      setPlayers(data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [playerSearch, myId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!opponent) { setError('Select an opponent first.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenged: opponent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('Challenge sent! Waiting for the opponent to accept.');
      setOpponent(''); setPlayerSearch('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedPlayer = players.find(p => p.id === opponent);

  return (
    <div className="card" style={{ padding: 36 }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="font-mono" style={{ display: 'block', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>
            Challenge Who? *
          </label>
          {selectedPlayer ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(251,191,36,0.05)', border: '1px solid var(--color-gold)', borderRadius: 2 }}>
              <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>{selectedPlayer.username}</span>
              <button
                type="button"
                onClick={() => { setOpponent(''); setPlayerSearch(''); }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '1rem' }}
              >
                ×
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type="text"
                placeholder="Search by username…"
                value={playerSearch}
                onChange={e => setPlayerSearch(e.target.value)}
              />
              {players.length > 0 && (
                <div
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                    borderTop: 'none', borderRadius: '0 0 2px 2px',
                  }}
                >
                  {players.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setOpponent(p.id); setPlayerSearch(p.username); setPlayers([]); }}
                      style={{
                        display: 'block', width: '100%', padding: '10px 14px', background: 'none',
                        border: 'none', borderBottom: '1px solid var(--color-border)',
                        color: 'var(--color-text)', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-body)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {p.username}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rules info */}
        <div
          style={{
            padding: '14px 16px',
            background: 'rgba(251,191,36,0.04)',
            border: '1px solid rgba(251,191,36,0.15)',
            borderRadius: 2,
          }}
        >
          <p className="font-mono" style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: 8 }}>
            Challenge Rules
          </p>
          <ul style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem', lineHeight: 1.7, listStyle: 'none', padding: 0 }}>
            <li>• 10 matches total, majority wins the series</li>
            <li>• Opponent must accept before matches begin</li>
            <li>• Results affect global rankings (+20/−10 pts)</li>
            <li>• 3-day cooldown after a loss to the same player</li>
          </ul>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 2 }}>
            <p style={{ color: 'var(--color-red)', fontSize: '0.875rem' }}>{error}</p>
          </div>
        )}
        {success && (
          <div style={{ padding: '10px 14px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 2 }}>
            <p style={{ color: 'var(--color-green)', fontSize: '0.875rem' }}>{success}</p>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading || !opponent} style={{ padding: '12px', width: '100%', fontSize: '0.95rem', background: opponent ? 'var(--color-gold)' : undefined, borderColor: opponent ? 'var(--color-gold)' : undefined, marginTop: 4 }}>
          {loading ? 'Sending…' : '⚔ Send Challenge'}
        </button>
      </form>
    </div>
  );
}