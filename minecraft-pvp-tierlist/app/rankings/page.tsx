import RankingTable from '@/components/RankingTable';

export default function RankingsPage() {
  return (
    <main className="p-8 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Rankings</h1>
      <RankingTable />
    </main>
  );
}