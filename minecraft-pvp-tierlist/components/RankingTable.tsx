import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function RankingTable() {
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('leaderboard').select('*').then(({ data }) => setPlayers(data ?? []));
  }, []);

  return (
    <table className="min-w-full table-auto bg-white shadow rounded">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Total Points</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p, i) => (
          <tr key={p.username}>
            <td>{i + 1}</td>
            <td>{p.username}</td>
            <td>{p.total_points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}