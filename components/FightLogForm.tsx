'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getSessionUser } from '@/lib/authSession';

const PVP_TYPES = ['crystal','sword','axe','uhc','manhunt','mace','smp','cart','bow'];

export function FightLogForm() {
  const router = useRouter();
  const [myId, setMyId]             = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState('');
  const [players, setPlayers]       = useState<{ id: string; username: string }[]>([]);
  const [opponent, setOpponent]     = useState('');
  const [pvpType, setPvpType]       = useState('');
  const [winner, setWinner]         = useState<'me' | 'opponent'>('me');
  const [score, setScore]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [playerSearch, setPlayerSearch] = useState('');

  useEffect(() => {
    const user = getSessionUser();
    if (!user) { router.push('/login'); return; }
    setMyId(user.id);
    setMyUsername(user.username);
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

    if (!opponent || !pvpType) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const winnerId = winner === 'me' ? myId : opponent;
      const res = await fetch('/api/fight-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': myId ?? '' },
        body: JSON.stringify({ player2: opponent, pvp_type: pvpType, winner: winnerId, score }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('Fight logged! Waiting for opponent confirmation.');
      setOpponent(''); setPvpType(''); setScore(''); setPlayerSearch(''); setWinner('me');
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
        {/* Opponent search */}
        <div>
          <label className="font-mono" style={{ display: 'block', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>
            Opponent *
          </label>
          {selectedPlayer ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(74,222,128,0.05)', border: '1px solid var(--color-green)', borderRadius: 2 }}>
              <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>{selectedPlayer.username}</span>
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
                    borderTop: 'none', borderRadius: '0 0 2px 2px', maxHeight: 200, overflowY: 'auto',
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

        {/* PvP Type */}
        <div>
          <label className="font-mono" style={{ display: 'block', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>
            PvP Type *
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PVP_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setPvpType(t)}
                className={pvpType === t ? 'badge badge-green' : 'badge badge-muted'}
                style={{ cursor: 'pointer', fontSize: '0.75rem', padding: '6px 12px', border: pvpType === t ? '' : '1px solid var(--color-border)', transition: 'all 0.15s' }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Winner */}
        <div>
          <label className="font-mono" style={{ display: 'block', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>
            Who Won? *
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['me', 'opponent'] as const).map(side => (
              <button
                key={side}
                type="button"
                onClick={() => setWinner(side)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 2, cursor: 'pointer',
                  background: winner === side ? (side === 'me' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)') : 'var(--color-surface2)',
                  border: winner === side ? `1px solid ${side === 'me' ? 'var(--color-green)' : 'var(--color-red)'}` : '1px solid var(--color-border)',
                  color: winner === side ? (side === 'me' ? 'var(--color-green)' : 'var(--color-red)') : 'var(--color-text-dim)',
                  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                  transition: 'all 0.15s',
                }}
              >
                {side === 'me' ? `I Won (${myUsername || 'Me'})` : `They Won (${selectedPlayer?.username || 'Opponent'})`}
              </button>
            ))}
          </div>
        </div>

        {/* Score */}
        <div>
          <label className="font-mono" style={{ display: 'block', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>
            Score <span style={{ color: 'var(--color-border2)' }}>(optional)</span>
          </label>
          <input
            className="input"
            type="text"
            placeholder="e.g. 5–2 or 10–7"
            value={score}
            onChange={e => setScore(e.target.value)}
          />
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

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '12px', width: '100%', fontSize: '0.95rem', marginTop: 4 }}>
          {loading ? 'Submitting…' : 'Submit Fight Log'}
        </button>
      </form>
    </div>
  );
}