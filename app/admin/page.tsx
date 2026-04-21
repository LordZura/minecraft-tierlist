import { AdminPanel } from '@/components/AdminPanel';

export default function AdminPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <p className="font-mono page-kicker" style={{ color: 'var(--color-gold)' }}>
          Management
        </p>
        <h1 className="font-pixel glow-gold page-title" style={{ color: 'var(--color-gold)' }}>
          Admin Panel
        </h1>
      </div>
      <AdminPanel />
    </div>
  );
}