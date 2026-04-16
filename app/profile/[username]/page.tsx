'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { calcChallengePoints, calcFightLogPoints } from '@/lib/points';
import { computeElo, PVP_TYPES, type EloEvent, type PvpType } from '@/utils/elo';

type Profile = {
  id: string;
  username: string;
  created_at: string;
};

type FightLog = {
  id: string;
  player1: string;
  player2: string;
  winner: string;
  pvp_type: PvpType;
  score: string | null;
  created_at: string;
  p1?: any;
  p2?: any;
};

type ChallengeRecord = {
  id: string;
  challenger: string;
  challenged: string;
  status: string;
  winner: string | null;
  challenger_wins: number;
  challenged_wins: number;
  completed_at: string | null;
  created_at: string;
  ch?: any;
  cd?: any;
};

type Stats = {
  rank: number;
  total_points: number;
  total_wins: number;
  total_losses: number;
  fight_wins: number;
  fight_losses: number;
  challenge_wins: number;
  challenge_losses: number;
};

export default function ProfilePage() {
  const params = useParams<{ username?: string | string[] }>();
  const username = Array.isArray(params.username) ? params.username[0] : params.username;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [fights, setFights] = useState<FightLog[]>([]);
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([]);
  const [pvpBreakdown, setPvpBreakdown] = useState<Record<string, { wins: number; losses: number }>>({});
  const [eloByType, setEloByType] = useState<Record<string, number>>({});
  const [eloOverall, setEloOverall] = useState(1000);
  const [eloAverage, setEloAverage] = useState(1000);
  const [bestType, setBestType] = useState<string>('—');
  const [strongerThan, setStrongerThan] = useState<string[]>([]);
  const [lostTo, setLostTo] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'fights' | 'challenges'>('fights');

  useEffect(() => {
    if (username) loadProfile(username);
  }, [username]);

  async function loadProfile(uname: string) {
    setLoading(true);

    try {
      const { data: user } = await supabase.from('users').select('id, username, created_at').ilike('username', uname).maybeSingle();
      if (!user) {
        setProfile(null);
        return;
      }
      setProfile(user);

      const [lbRes, fightRes, challengeRes, usersRes, challengeMatchesRes, overrideRes] = await Promise.all([
        supabase.from('leaderboard').select('rank,total_points,total_wins,total_losses,fight_wins,fight_losses,challenge_wins,challenge_losses').eq('id', user.id).maybeSingle(),
        supabase.from('fight_logs').select('id,player1,player2,winner,pvp_type,score,created_at,p1:users!fight_logs_player1_fkey(username),p2:users!fight_logs_player2_fkey(username)').or(`player1.eq.${user.id},player2.eq.${user.id}`).eq('is_confirmed', true).eq('rejected', false).order('created_at', { ascending: false }),
        supabase.from('challenges').select('id,challenger,challenged,status,winner,challenger_wins,challenged_wins,completed_at,created_at,ch:users!challenges_challenger_fkey(username),cd:users!challenges_challenged_fkey(username)').or(`challenger.eq.${user.id},challenged.eq.${user.id}`).order('created_at', { ascending: false }),
        supabase.from('users').select('id'),
        supabase.from('challenge_matches').select('winner,pvp_type,created_at,challenge:challenges!challenge_matches_challenge_id_fkey(challenger,challenged)'),
        supabase.from('user_admin_overrides').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      const lb = lbRes.data as Stats | null;
      const ov: any = overrideRes.data;
      const finalStats = lb ? {
        ...lb,
        total_points: ov?.total_points_override ?? lb.total_points,
        total_wins: ov?.total_wins_override ?? lb.total_wins,
        total_losses: ov?.total_losses_override ?? lb.total_losses,
      } : null;
      setStats(finalStats);

      const fightData = (fightRes.data as FightLog[] | null) ?? [];
      setFights(fightData);
      setChallenges((challengeRes.data as ChallengeRecord[] | null) ?? []);

      const breakdown: Record<string, { wins: number; losses: number }> = Object.fromEntries(PVP_TYPES.map((t) => [t, { wins: 0, losses: 0 }]));
      fightData.forEach((f) => {
        if (f.winner === user.id) breakdown[f.pvp_type].wins += 1;
        else breakdown[f.pvp_type].losses += 1;
      });
      setPvpBreakdown(breakdown);

      const events: EloEvent[] = [];
      fightData.forEach((f) => {
        events.push({ playerA: f.player1, playerB: f.player2, winner: f.winner, pvp_type: f.pvp_type, created_at: f.created_at });
      });
      (challengeMatchesRes.data as any[] | null)?.forEach((m) => {
        const c = m.challenge;
        if (!c?.challenger || !c?.challenged) return;
        events.push({ playerA: c.challenger, playerB: c.challenged, winner: m.winner, pvp_type: m.pvp_type as PvpType, created_at: m.created_at });
      });

      const userIds = ((usersRes.data ?? []) as { id: string }[]).map((u) => u.id);
      const elo = computeElo(userIds, events);
      const own = elo[user.id];
      if (own) {
        const byType: Record<string, number> = {};
        PVP_TYPES.forEach((t) => {
          byType[t] = ov?.[`elo_${t}_override`] ?? own.byType[t];
        });
        setEloByType(byType);
        setEloOverall(ov?.elo_overall_override ?? own.overall);
        setEloAverage(ov?.elo_average_override ?? own.average);

        const sortedBest = [...PVP_TYPES].sort((a, b) => (byType[b] ?? 1000) - (byType[a] ?? 1000));
        setBestType(sortedBest[0] ?? '—');
      }

      const winsAgainst = new Set<string>();
      const lossesAgainst = new Set<string>();
      ((challengeRes.data as ChallengeRecord[] | null) ?? []).forEach((c) => {
        if (c.status !== 'completed' || !c.winner) return;
        const opponent = c.challenger === user.id ? c.cd?.username : c.ch?.username;
        if (!opponent) return;
        if (c.winner === user.id) winsAgainst.add(opponent);
        else lossesAgainst.add(opponent);
      });
      setStrongerThan([...winsAgainst]);
      setLostTo([...lossesAgainst]);
    } finally {
      setLoading(false);
    }
  }

  const winRate = useMemo(() => {
    if (!stats) return 0;
    return Math.round((stats.total_wins / Math.max(stats.total_wins + stats.total_losses, 1)) * 100);
  }, [stats]);

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 24px' }}><p className="font-pixel" style={{ fontSize: '1.5rem' }}>Loading…</p></div>;

  if (!profile) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <h1 className="font-pixel" style={{ fontSize: '2rem' }}>Player Not Found</h1>
        <Link href="/rankings">← Back to Rankings</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 24px' }}>
      <Link href="/rankings" style={{ color: 'var(--color-muted)', textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>← Back to Rankings</Link>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p className="font-mono" style={{ color: 'var(--color-muted)', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Player Profile</p>
            <h1 className="font-pixel" style={{ fontSize: '2.1rem', color: 'var(--color-green)' }}>{profile.username}</h1>
            <p style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>Joined {new Date(profile.created_at).toLocaleDateString()}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="font-mono" style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>Best at</p>
            <p className="font-pixel" style={{ fontSize: '1.3rem', color: 'var(--color-gold)' }}>{bestType.toUpperCase()}</p>
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          <Stat label="Rank" value={stats ? `#${stats.rank}` : '—'} />
          <Stat label="Points" value={stats ? stats.total_points : 0} />
          <Stat label="Wins" value={stats?.total_wins ?? 0} />
          <Stat label="Losses" value={stats?.total_losses ?? 0} />
          <Stat label="Winrate" value={`${winRate}%`} />
          <Stat label="Overall ELO" value={eloOverall} />
          <Stat label="Average ELO" value={eloAverage} />
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h2 className="font-pixel" style={{ fontSize: '1.1rem', marginBottom: 10 }}>ELO by PvP Type</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
          {PVP_TYPES.map((t) => (
            <div key={t} style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 2 }}>
              <p className="font-mono" style={{ fontSize: '0.66rem', color: 'var(--color-muted)', textTransform: 'uppercase' }}>{t}</p>
              <p style={{ color: 'var(--color-gold)', fontWeight: 700 }}>{eloByType[t] ?? 1000}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>{pvpBreakdown[t]?.wins ?? 0}W / {pvpBreakdown[t]?.losses ?? 0}L</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h2 className="font-pixel" style={{ fontSize: '1.1rem', marginBottom: 10 }}>Challenge Strength</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Currently stronger than</p>
            {strongerThan.length === 0 ? <p style={{ color: 'var(--color-text-dim)' }}>No completed challenge wins yet.</p> : <ul>{strongerThan.map((u) => <li key={u} style={{ color: 'var(--color-green)' }}>{u}</li>)}</ul>}
          </div>
          <div>
            <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Lost challenges to</p>
            {lostTo.length === 0 ? <p style={{ color: 'var(--color-text-dim)' }}>No completed challenge losses yet.</p> : <ul>{lostTo.map((u) => <li key={u} style={{ color: 'var(--color-red)' }}>{u}</li>)}</ul>}
          </div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
          <button onClick={() => setTab('fights')} style={{ padding: '12px 14px', background: 'transparent', border: 'none', borderBottom: tab === 'fights' ? '2px solid var(--color-green)' : '2px solid transparent', color: tab === 'fights' ? 'var(--color-green)' : 'var(--color-muted)', cursor: 'pointer' }}>Fights</button>
          <button onClick={() => setTab('challenges')} style={{ padding: '12px 14px', background: 'transparent', border: 'none', borderBottom: tab === 'challenges' ? '2px solid var(--color-gold)' : '2px solid transparent', color: tab === 'challenges' ? 'var(--color-gold)' : 'var(--color-muted)', cursor: 'pointer' }}>Challenges</button>
        </div>

        {tab === 'fights' ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Opponent</th><th>Result</th><th>Score</th></tr></thead>
              <tbody>
                {fights.slice(0, 50).map((f) => {
                  const opp = f.player1 === profile.id ? (f.p2 as any)?.username : (f.p1 as any)?.username;
                  const won = f.winner === profile.id;
                  return (
                    <tr key={f.id}>
                      <td>{new Date(f.created_at).toLocaleDateString()}</td>
                      <td><span className="badge badge-muted">{f.pvp_type}</span></td>
                      <td>{opp ?? '?'}</td>
                      <td style={{ color: won ? 'var(--color-green)' : 'var(--color-red)' }}>{won ? 'Win' : 'Loss'}</td>
                      <td>{f.score ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Opponent</th><th>Status</th><th>Series</th><th>Result</th></tr></thead>
              <tbody>
                {challenges.slice(0, 50).map((c) => {
                  const opp = c.challenger === profile.id ? (c.cd as any)?.username : (c.ch as any)?.username;
                  const won = c.winner === profile.id;
                  return (
                    <tr key={c.id}>
                      <td>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td>{opp ?? '?'}</td>
                      <td><span className="badge badge-muted">{c.status}</span></td>
                      <td>{c.challenger === profile.id ? `${c.challenger_wins}-${c.challenged_wins}` : `${c.challenged_wins}-${c.challenger_wins}`}</td>
                      <td style={{ color: c.status !== 'completed' ? 'var(--color-muted)' : won ? 'var(--color-green)' : 'var(--color-red)' }}>{c.status !== 'completed' ? '—' : won ? 'Win' : 'Loss'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 2, padding: '9px 10px' }}>
      <p className="font-mono" style={{ fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>{label}</p>
      <p className="font-pixel" style={{ fontSize: '1.1rem', color: 'var(--color-text)' }}>{value}</p>
    </div>
  );
}
