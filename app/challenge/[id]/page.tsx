'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const PVP_TYPES = ['crystal','sword','axe','uhc','manhunt','mace','smp','cart','bow'];

type Challenge = {
  id: string;
  challenger: string;
  challenged: string;
  status: string;
  winner: string | null;
  challenger_wins: number;
  challenged_wins: number;
  created_at: string;
  completed_at: string | null;
  ch_user?: { username: string };
  cd_user?: { username: string };
};

type Match = {
  id: string;
  match_number: number;
  winner: string;
  pvp_type: string;
  created_at: string;
  winner_user?: { username: string };
};

export default function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [myId, setMyId]             = useState<string | null>(null);
  const [challenge, setChallenge]   = useState<Challenge | null>(null);
  const [matches, setMatches]       = useState<Match[]>([]);
  const [loading, setLoading]       = useState(true);
  const [pvpType, setPvpType]       = useState('');
  const [winner, setWinner]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  useEffect(() => {
    let alive = true;

    const init = async () => {
        const { data } = await supabase.auth.getUser();

        if (!alive) return;

        if (!data.user) {
        router.push('/login');
        return;
        }

        setMyId(data.user.id);
        await loadChallenge(data.user.id);
    };

    init();

    return () => {
        alive = false;
    };
    }, [id]);

  async function loadChallenge(userId: string) {
    setLoading(true);
    const { data: c } = await supabase
      .from('challenges')
      .select('*, ch_user:users!challenges_challenger_fkey(username), cd_user:users!challenges_challenged_fkey(username)')
      .eq('id', id)
      .single();

    if (!c || (c.challenger !== userId && c.challenged !== userId)) {
      router.push('/challenge');
      return;
    }
    setChallenge(c as Challenge);

    const { data: m } = await supabase
      .from('challenge_matches')
      .select('*, winner_user:users!challenge_matches_winner_fkey(username)')
      .eq('challenge_id', id)
      .order('match_number');
    setMatches((m as Match[]) ?? []);
    setLoading(false);
  }

  async function logMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!pvpType || !winner) { setError('Fill in all fields.'); return; }
    setError(''); setSuccess(''); setSubmitting(true);
    try {
      const res = await fetch('/api/challenge/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: id, winner_id: winner, pvp_type: pvpType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`Match ${data.matchNumber} logged!`);
      setPvpType(''); setWinner('');
      loadChallenge(myId!);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><span className="font-pixel" style={{ fontSize: '1.5rem', color: 'var(--color-muted)' }}>Loading…</span></div>;
  if (!challenge) return null;

  const chUsername = (challenge.ch_user as any)?.username;
  const cdUsername = (challenge.cd_user as any)?.username;
  const myIsChallenger = myId === challenge.challenger;
  const totalMatches = challenge.challenger_wins + challenge.challenged_wins;
  const progressPct = (totalMatches / 10) * 100;
  const isActive = challenge.status === 'accepted';
  const amParticipant = myId === challenge.challenger || myId === challenge.challenged;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
      <Link href="/challenge" style={{ color: 'var(--color-muted)', textDecoration: 'none', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
        ← Back
      </Link>

      {/* Challenge header */}
      <div className="card" style={{ padding: 28, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <p className="font-mono" style={{ fontSize: '0.65rem', letterSpacing: '0.15em', color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
              Challenge Series
            </p>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-text)' }}>
              <span style={{ color: 'var(--color-gold)' }}>{chUsername}</span>
              <span style={{ color: 'var(--color-muted)', margin: '0 12px' }}>vs</span>
              <span style={{ color: 'var(--color-text)' }}>{cdUsername}</span>
            </h1>
          </div>
          <span className={`badge ${challenge.status === 'completed' ? 'badge-green' : challenge.status === 'accepted' ? 'badge-gold' : challenge.status === 'rejected' ? 'badge-red' : 'badge-muted'}`} style={{ alignSelf: 'flex-start', padding: '6px 14px' }}>
            {challenge.status.toUpperCase()}
          </span>
        </div>

        {/* Score display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <p className="font-pixel" style={{ fontSize: '3rem', color: 'var(--color-gold)', lineHeight: 1 }}>{challenge.challenger_wins}</p>
            <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--color-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{chUsername}</p>
          </div>
          <div>
            <p className="font-mono" style={{ fontSize: '1.2rem', color: 'var(--color-border2)' }}>:</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p className="font-pixel" style={{ fontSize: '3rem', color: 'var(--color-text)', lineHeight: 1 }}>{challenge.challenged_wins}</p>
            <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--color-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{cdUsername}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'var(--color-surface2)', borderRadius: 2, height: 6, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--color-green)', transition: 'width 0.3s' }} />
        </div>
        <p className="font-mono" style={{ fontSize: '0.7rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          {totalMatches} / 10 matches played
        </p>

        {challenge.status === 'completed' && challenge.winner && (
          <div style={{ marginTop: 16, textAlign: 'center', padding: '12px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 2 }}>
            <p className="font-pixel" style={{ color: 'var(--color-green)', fontSize: '1.3rem' }}>
              🏆 {challenge.winner === challenge.challenger ? chUsername : cdUsername} wins the series!
            </p>
          </div>
        )}
      </div>

      {/* Log match form */}
      {isActive && amParticipant && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 className="font-mono" style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 16 }}>
            Log Next Match
          </h2>
          <form onSubmit={logMatch} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="font-mono" style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>
                PvP Type
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PVP_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => setPvpType(t)}
                    className={pvpType === t ? 'badge badge-green' : 'badge badge-muted'}
                    style={{ cursor: 'pointer', padding: '5px 10px', fontSize: '0.72rem' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-mono" style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>
                Who Won?
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ id: challenge.challenger, name: chUsername }, { id: challenge.challenged, name: cdUsername }].map(p => (
                  <button key={p.id} type="button" onClick={() => setWinner(p.id)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 2, cursor: 'pointer',
                      background: winner === p.id ? 'rgba(74,222,128,0.1)' : 'var(--color-surface2)',
                      border: winner === p.id ? '1px solid var(--color-green)' : '1px solid var(--color-border)',
                      color: winner === p.id ? 'var(--color-green)' : 'var(--color-text-dim)',
                      fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s',
                    }}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {error && <p style={{ color: 'var(--color-red)', fontSize: '0.875rem' }}>{error}</p>}
            {success && <p style={{ color: 'var(--color-green)', fontSize: '0.875rem' }}>{success}</p>}

            <button type="submit" className="btn btn-primary" disabled={submitting || !pvpType || !winner} style={{ width: '100%', padding: '10px' }}>
              {submitting ? 'Logging…' : 'Log Match'}
            </button>
          </form>
        </div>
      )}

      {/* Match history */}
      {matches.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
            <p className="font-mono" style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
              Match History
            </p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Winner</th>
                <th>Type</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(m => (
                <tr key={m.id}>
                  <td className="font-mono" style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>{m.match_number}</td>
                  <td style={{ color: 'var(--color-green)', fontWeight: 600 }}>{(m.winner_user as any)?.username}</td>
                  <td><span className="badge badge-muted">{m.pvp_type}</span></td>
                  <td className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}