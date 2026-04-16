import { NotificationList } from '@/components/NotificationList';

export default function NotificationsPage() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <p className="font-mono" style={{ color: 'var(--color-green)', fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
          Inbox
        </p>
        <h1 className="font-pixel" style={{ fontSize: '2.5rem', color: 'var(--color-text)' }}>
          Notifications
        </h1>
      </div>
      <NotificationList />
    </div>
  );
}