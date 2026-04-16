'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const PVP_TYPES = ['crystal','sword','axe','uhc','manhunt','mace','smp','cart','bow'];

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
  pvp_type: string;
  score: string | null;
  created_at: string;
  opponent_username?: string;
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
  opponent_username?: string;
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

  const username =
    Array.isArray(params.username) ? params.username[0] : params.username;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [fights, setFights] = useState<FightLog[]>([]);
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([]);
  const [pvpBreakdown, setPvpBreakdown] =
    useState<Record<string, { wins: number; losses: number }>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'fights' | 'challenges'>('fights');

  useEffect(() => {
    if (username) loadProfile(username);
  }, [username]);

  async function loadProfile(uname: string) {
    setLoading(true);

    try {
      // PROFILE
      const { data: user } = await supabase
        .from('users')
        .select('id, username, created_at')
        .ilike('username', uname)
        .maybeSingle();

      if (!user) {
        setProfile(null);
        return;
      }

      setProfile(user);

      // STATS
      const { data: lb } = await supabase
        .from('leaderboard')
        .select(`
          rank,
          total_points,
          total_wins,
          total_losses,
          fight_wins,
          fight_losses,
          challenge_wins,
          challenge_losses
        `)
        .eq('id', user.id)
        .maybeSingle();

      if (lb) setStats(lb as Stats);

      // FIGHTS
      const { data: fightData } = await supabase
        .from('fight_logs')
        .select(`
          id, player1, player2, winner, pvp_type, score, created_at,
          p1:users!fight_logs_player1_fkey(username),
          p2:users!fight_logs_player2_fkey(username)
        `)
        .or(`player1.eq.${user.id},player2.eq.${user.id}`)
        .eq('is_confirmed', true)
        .order('created_at', { ascending: false })
        .limit(20);

      const enrichedFights: FightLog[] = (fightData ?? []).map((f: any) => ({
        ...f,
        opponent_username:
          f.player1 === user.id ? f.p2?.username : f.p1?.username,
      }));

      setFights(enrichedFights);

      const breakdown: Record<string, { wins: number; losses: number }> = {};

      for (const f of enrichedFights) {
        if (!breakdown[f.pvp_type]) {
          breakdown[f.pvp_type] = { wins: 0, losses: 0 };
        }

        if (f.winner === user.id) breakdown[f.pvp_type].wins++;
        else breakdown[f.pvp_type].losses++;
      }

      setPvpBreakdown(breakdown);

      // CHALLENGES
      const { data: challengeData } = await supabase
        .from('challenges')
        .select(`
          id, challenger, challenged, status, winner,
          challenger_wins, challenged_wins, completed_at,
          ch:users!challenges_challenger_fkey(username),
          cd:users!challenges_challenged_fkey(username)
        `)
        .or(`challenger.eq.${user.id},challenged.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(20);

      const enrichedChallenges: ChallengeRecord[] = (challengeData ?? []).map(
        (c: any) => ({
          ...c,
          opponent_username:
            c.challenger === user.id ? c.cd?.username : c.ch?.username,
        })
      );

      setChallenges(enrichedChallenges);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <p className="font-pixel" style={{ fontSize: '1.5rem' }}>
          Loading…
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <h1 className="font-pixel" style={{ fontSize: '2rem' }}>
          Player Not Found
        </h1>
        <Link href="/rankings">← Back to Rankings</Link>
      </div>
    );
  }

  const winRate = stats
    ? Math.round(
        (stats.total_wins /
          Math.max(stats.total_wins + stats.total_losses, 1)) *
          100
      )
    : 0;

  return null; // (unchanged UI section)
}