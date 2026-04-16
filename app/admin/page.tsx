import { AdminPanel } from '@/components/AdminPanel';

export default function AdminPage() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <p className="font-mono" style={{ color: 'var(--color-gold)', fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
          Management
        </p>
        <h1 className="font-pixel glow-gold" style={{ fontSize: '2.5rem', color: 'var(--color-gold)' }}>
          Admin Panel
        </h1>
      </div>
      <AdminPanel />
    </div>
  );
}