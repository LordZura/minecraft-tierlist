'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getSessionUser } from '@/lib/authSession';
import { ChallengeForm } from '@/components/ChallengeForm';

type Challenge = {
  id: string;
  challenger: string;
  challenged: string;
  status: string;
  winner: string | null;
  challenger_wins: number;
  challenged_wins: number;
  created_at: string;
  ch_user?: { username: string };
  cd_user?: { username: string };
};

export default function ChallengePage() {
  const router = useRouter();
  const [myId, setMyId]             = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);

  useEffect(() => {
    const user = getSessionUser();
    if (!user) { router.push('/login'); return; }
    setMyId(user.id);
    loadChallenges(user.id);
  }, []);

  async function loadChallenges(userId: string) {
    const { data } = await supabase
      .from('challenges')
      .select('*, ch_user:users!challenges_challenger_fkey(username), cd_user:users!challenges_challenged_fkey(username)')
      .or(`challenger.eq.${userId},challenged.eq.${userId}`)
      .order('created_at', { ascending: false });
    setChallenges((data as Challenge[]) ?? []);
    setLoading(false);
  }

  const statusColor: Record<string, string> = {
    pending: 'badge-gold', accepted: 'badge-green', rejected: 'badge-red', completed: 'badge-muted',
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p className="font-mono" style={{ color: 'var(--color-gold)', fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
            Head-to-Head
          </p>
          <h1 className="font-pixel" style={{ fontSize: '2.5rem', color: 'var(--color-text)' }}>Challenges</h1>
          <p style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem', marginTop: 6 }}>
            10-match series. Majority wins. 3-day cooldown after a loss.
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="btn btn-primary"
          style={{ padding: '10px 24px', background: 'var(--color-gold)', borderColor: 'var(--color-gold)', color: '#080c08' }}
        >
          {showForm ? '✕ Cancel' : '⚔ New Challenge'}
        </button>
      </div>

      {showForm && <div style={{ marginBottom: 28 }}><ChallengeForm /></div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <span className="font-pixel" style={{ fontSize: '1.5rem', color: 'var(--color-muted)' }}>Loading…</span>
        </div>
      ) : challenges.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <p className="font-pixel" style={{ fontSize: '1.5rem', color: 'var(--color-muted)', marginBottom: 8 }}>No challenges yet</p>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Issue a challenge to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {challenges.map(c => {
            const chName = (c.ch_user as any)?.username ?? '?';
            const cdName = (c.cd_user as any)?.username ?? '?';
            const total  = c.challenger_wins + c.challenged_wins;
            return (
              <Link key={c.id} href={`/challenge/${c.id}`} style={{ textDecoration: 'none' }}>
                <div
                  className="card"
                  style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-gold)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 2 }}>
                      <span style={{ color: 'var(--color-gold)' }}>{chName}</span>
                      <span style={{ color: 'var(--color-muted)', margin: '0 8px', fontSize: '0.8rem' }}>vs</span>
                      <span>{cdName}</span>
                    </p>
                    <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="font-pixel" style={{ fontSize: '1.6rem', color: 'var(--color-green)' }}>{c.challenger_wins}</span>
                    <span className="font-mono" style={{ color: 'var(--color-muted)' }}>:</span>
                    <span className="font-pixel" style={{ fontSize: '1.6rem' }}>{c.challenged_wins}</span>
                    <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>({total}/10)</span>
                  </div>
                  <span className={`badge ${statusColor[c.status] ?? 'badge-muted'}`}>{c.status}</span>
                  <span style={{ color: 'var(--color-muted)' }}>›</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}