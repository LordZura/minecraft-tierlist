'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { calcChallengePoints, calcFightLogPoints } from '@/lib/points';

type Player = {
  id: string;
  username: string;
  rank: number;
  total_points: number;
  total_wins: number;
  total_losses: number;
  fight_wins: number;
  fight_losses: number;
  challenge_wins: number;
  challenge_losses: number;
  elo_overall: number;
  elo_average: number;
  elo_by_type: Record<PvpType, number>;
};

type SortKey = 'rank' | 'total_points' | 'total_wins' | 'challenge_wins';

export default function RankingTable() {
  const [players, setPlayers]   = useState<Player[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [sortBy, setSortBy]     = useState<SortKey>('rank');

  useEffect(() => {
    loadRankings();
  }, []);

  async function loadRankings() {
    setLoading(true);

    const [
      { data: users, error: usersError },
      { data: fights, error: fightsError },
      { data: challenges, error: challengesError },
    ] = await Promise.all([
      supabase.from('users').select('id, username'),
      supabase.from('fight_logs').select('player1, player2, winner').eq('is_confirmed', true).eq('rejected', false),
      supabase.from('challenges').select('challenger, challenged, winner, status').eq('status', 'completed'),
    ]);

    if (usersError || fightsError || challengesError || !users) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    const stats = new Map<string, Player>();

    users.forEach((u) => {
      stats.set(u.id, {
        id: u.id,
        username: u.username,
        rank: 0,
        total_points: 0,
        total_wins: 0,
        total_losses: 0,
        fight_wins: 0,
        fight_losses: 0,
        challenge_wins: 0,
        challenge_losses: 0,
      });
    });

    (fights ?? []).forEach((fight) => {
      const winner = stats.get(fight.winner);
      const loserId = fight.winner === fight.player1 ? fight.player2 : fight.player1;
      const loser = stats.get(loserId);
      if (!winner || !loser) return;

      winner.fight_wins += 1;
      winner.total_wins += 1;
      winner.total_points += calcFightLogPoints(true);

      loser.fight_losses += 1;
      loser.total_losses += 1;
      loser.total_points += calcFightLogPoints(false);
    });

    (challenges ?? []).forEach((challenge) => {
      if (!challenge.winner) return;

      const winner = stats.get(challenge.winner);
      const loserId =
        challenge.winner === challenge.challenger ? challenge.challenged : challenge.challenger;
      const loser = stats.get(loserId);
      if (!winner || !loser) return;

      winner.challenge_wins += 1;
      winner.total_wins += 1;
      winner.total_points += calcChallengePoints(true);

      loser.challenge_losses += 1;
      loser.total_losses += 1;
      loser.total_points += calcChallengePoints(false);
    });

    const ranked = [...stats.values()].sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
      return a.username.localeCompare(b.username);
    });

    ranked.forEach((p, idx) => {
      p.rank = idx + 1;
    });

    setPlayers(ranked);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let list = [...players];
    if (search) list = list.filter((p) => p.username.toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => {
      if (sortBy === 'rank') return a.rank - b.rank;
      return (b[sortBy] ?? 0) - (a[sortBy] ?? 0);
    });
    return list;
  }, [players, search, sortBy]);

  const rankLabel = (rank: number) => {
    if (rank === 1) return { label: '🥇', color: '#fbbf24' };
    if (rank === 2) return { label: '🥈', color: '#9ca3af' };
    if (rank === 3) return { label: '🥉', color: '#cd7c35' };
    return { label: `#${rank}`, color: 'var(--color-muted)' };
  };

  const winRate = (w: number, l: number) => {
    const total = w + l;
    if (!total) return '—';
    return `${Math.round((w / total) * 100)}%`;
  };

  return (
    <div>
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" type="text" placeholder="Search players…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 220, padding: '7px 12px' }} />
        <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} style={{ maxWidth: 220, padding: '7px 12px' }}>
          <option value="rank">Sort: Rank</option>
          <option value="total_points">Sort: Total Points</option>
          <option value="elo_overall">Sort: Overall ELO</option>
          <option value="elo_average">Sort: Avg ELO</option>
          <option value="total_wins">Sort: Total Wins</option>
          <option value="challenge_wins">Sort: Challenge Wins</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--color-muted)', letterSpacing: '0.1em' }}>{filtered.length} PLAYERS</span>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}><span className="font-pixel" style={{ fontSize: '1.5rem' }}>Loading…</span></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <p className="font-pixel" style={{ fontSize: '1.5rem', color: 'var(--color-muted)' }}>No players yet</p>
            <p style={{ color: 'var(--color-muted)', marginTop: 8, fontSize: '0.875rem' }}>Be the first to register and log a fight.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th><th>Player</th><th>Points</th><th>ELO</th><th>Avg ELO</th><th>Wins</th><th>Losses</th><th>W/R</th><th>Challenges</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const r = rankLabel(p.rank);
                  return (
                    <tr key={p.id}>
                      <td><span className="font-mono" style={{ color: r.color, fontWeight: 700, fontSize: p.rank <= 3 ? '1.1rem' : '0.85rem' }}>{r.label}</span></td>
                      <td><Link href={`/profile/${p.username}`} style={{ color: 'var(--color-green)', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem' }}>{p.username}</Link></td>
                      <td><span className="font-mono" style={{ color: p.total_points >= 0 ? 'var(--color-green)' : 'var(--color-red)', fontWeight: 700 }}>{p.total_points >= 0 ? '+' : ''}{p.total_points}</span></td>
                      <td><span className="font-mono" style={{ color: 'var(--color-gold)', fontWeight: 700 }}>{p.elo_overall}</span></td>
                      <td><span className="font-mono" style={{ color: 'var(--color-text)' }}>{p.elo_average}</span></td>
                      <td><span style={{ color: 'var(--color-green)' }}>{p.total_wins}</span></td>
                      <td><span style={{ color: 'var(--color-red)' }}>{p.total_losses}</span></td>
                      <td><span className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>{winRate(p.total_wins, p.total_losses)}</span></td>
                      <td><span style={{ color: 'var(--color-green)', marginRight: 4 }}>{p.challenge_wins}W</span><span style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>/ {p.challenge_losses}L</span></td>
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
