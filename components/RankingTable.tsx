'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { calcChallengePoints, calcFightLogPoints } from '@/lib/points';
import { computeElo, type EloEvent } from '@/utils/elo';
import { PVP_TYPES } from '@/lib/pvp';

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
  elo_by_type: Record<(typeof PVP_TYPES)[number], number>;
};

type SortKey = 'rank' | 'total_points' | 'total_wins' | 'challenge_wins' | 'elo_overall' | 'elo_average';

type OverrideRow = {
  user_id: string;
  total_points_override: number | null;
  total_wins_override: number | null;
  total_losses_override: number | null;
  elo_overall_override: number | null;
  elo_average_override: number | null;
  [key: string]: number | string | null;
};

export default function RankingTable() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('rank');

  useEffect(() => {
    loadRankings();
  }, []);

  async function loadRankings() {
    setLoading(true);

    const [
      { data: users, error: usersError },
      { data: fights, error: fightsError },
      { data: challenges, error: challengesError },
      { data: challengeMatches, error: challengeMatchesError },
      { data: overrides, error: overridesError },
      { data: adjustments, error: adjustmentsError },
    ] = await Promise.all([
      supabase.from('users').select('id, username'),
      supabase.from('fight_logs').select('player1, player2, winner, pvp_type, created_at').eq('is_confirmed', true).eq('rejected', false),
      supabase.from('challenges').select('challenger, challenged, winner, status').eq('status', 'completed'),
      supabase.from('challenge_matches').select('winner, pvp_type, created_at, challenge:challenges!challenge_matches_challenge_id_fkey(challenger, challenged)'),
      supabase.from('user_admin_overrides').select('*'),
      supabase.from('admin_user_adjustments').select('*'),
    ]);

    if (usersError || fightsError || challengesError || challengeMatchesError || overridesError || adjustmentsError || !users) {
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
        elo_overall: 1000,
        elo_average: 1000,
        elo_by_type: Object.fromEntries(PVP_TYPES.map((t) => [t, 1000])) as Record<(typeof PVP_TYPES)[number], number>,
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
      const loserId = challenge.winner === challenge.challenger ? challenge.challenged : challenge.challenger;
      const loser = stats.get(loserId);
      if (!winner || !loser) return;

      winner.challenge_wins += 1;
      winner.total_wins += 1;
      winner.total_points += calcChallengePoints(true);

      loser.challenge_losses += 1;
      loser.total_losses += 1;
      loser.total_points += calcChallengePoints(false);
    });

    const eloEvents: EloEvent[] = [];
    (fights ?? []).forEach((f) => {
      eloEvents.push({
        playerA: f.player1,
        playerB: f.player2,
        winner: f.winner,
        pvp_type: f.pvp_type as (typeof PVP_TYPES)[number],
        created_at: f.created_at,
      });
    });

    (challengeMatches ?? []).forEach((m: any) => {
      const c = m.challenge;
      if (!c?.challenger || !c?.challenged) return;
      eloEvents.push({
        playerA: c.challenger,
        playerB: c.challenged,
        winner: m.winner,
        pvp_type: m.pvp_type as (typeof PVP_TYPES)[number],
        created_at: m.created_at,
      });
    });

    const elo = computeElo(users.map((u) => u.id), eloEvents);

    users.forEach((u) => {
      const p = stats.get(u.id);
      if (!p) return;
      p.elo_overall = elo[u.id]?.overall ?? 1000;
      p.elo_average = elo[u.id]?.average ?? 1000;
      p.elo_by_type = elo[u.id]?.byType ?? p.elo_by_type;
    });

    const overrideMap: Record<string, OverrideRow> = {};
    (overrides as OverrideRow[] | null)?.forEach((row) => {
      overrideMap[row.user_id] = row;
    });

    users.forEach((u) => {
      const p = stats.get(u.id);
      const o = overrideMap[u.id];
      if (!p || !o) return;

      p.total_points = o.total_points_override ?? p.total_points;
      p.total_wins = o.total_wins_override ?? p.total_wins;
      p.total_losses = o.total_losses_override ?? p.total_losses;
      p.elo_overall = o.elo_overall_override ?? p.elo_overall;
      p.elo_average = o.elo_average_override ?? p.elo_average;
      PVP_TYPES.forEach((t) => {
        const key = `elo_${t}_override`;
        const value = o[key];
        if (typeof value === 'number') p.elo_by_type[t] = value;
      });
    });



    const adjustmentByUser: Record<string, any[]> = {};
    (adjustments ?? []).forEach((a: any) => {
      adjustmentByUser[a.user_id] = adjustmentByUser[a.user_id] ?? [];
      adjustmentByUser[a.user_id].push(a);
    });

    users.forEach((u) => {
      const p = stats.get(u.id);
      if (!p) return;
      for (const a of adjustmentByUser[u.id] ?? []) {
        p.total_points += a.points_delta ?? 0;
        p.elo_overall += a.elo_overall_delta ?? 0;
        p.elo_average += a.elo_average_delta ?? 0;
        PVP_TYPES.forEach((t) => {
          p.elo_by_type[t] += a[`elo_${t}_delta`] ?? 0;
        });
      }
    });

    const ranked = [...stats.values()].sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      if (b.elo_overall !== a.elo_overall) return b.elo_overall - a.elo_overall;
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
      <div className="card" style={{ padding: '14px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" type="text" placeholder="Search players…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: '1 1 220px', minWidth: 0 }} />
        <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} style={{ flex: '1 1 220px', minWidth: 0 }}>
          <option value="rank">Sort: Rank</option>
          <option value="total_points">Sort: Total Points</option>
          <option value="elo_overall">Sort: Overall ELO</option>
          <option value="elo_average">Sort: Avg ELO</option>
          <option value="total_wins">Sort: Total Wins</option>
          <option value="challenge_wins">Sort: Challenge Wins</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, minHeight: 40 }}>
          <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--color-muted)', letterSpacing: '0.1em' }}>{filtered.length} PLAYERS</span>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}><span className="font-pixel" style={{ fontSize: '1.5rem' }}>Loading…</span></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <p className="font-pixel" style={{ fontSize: '1.5rem', color: 'var(--color-muted)' }}>No players yet</p>
            <p style={{ color: 'var(--color-muted)', marginTop: 8, fontSize: '0.875rem' }}>Be the first to register and log a fight.</p>
          </div>
        ) : (
          <>
          <div className="mobile-only" style={{ padding: 12, gap: 10 }}>
            {filtered.map((p) => {
              const r = rankLabel(p.rank);
              return (
                <div key={`mobile-${p.id}`} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <Link href={`/profile/${p.username}`} style={{ color: 'var(--color-green)', textDecoration: 'none', fontWeight: 700 }}>{p.username}</Link>
                    <span className="font-mono" style={{ color: r.color, fontWeight: 700 }}>{r.label}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6, fontSize: '0.84rem' }}>
                    <span>Points: <b style={{ color: p.total_points >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{p.total_points >= 0 ? '+' : ''}{p.total_points}</b></span>
                    <span>ELO: <b style={{ color: 'var(--color-gold)' }}>{p.elo_overall}</b></span>
                    <span>W/L: <b>{p.total_wins}/{p.total_losses}</b></span>
                    <span>W/R: <b>{winRate(p.total_wins, p.total_losses)}</b></span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="desktop-only table-wrap">
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
          </>
        )}
      </div>
    </div>
  );
}