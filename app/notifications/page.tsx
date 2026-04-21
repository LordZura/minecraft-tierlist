import { NotificationList } from '@/components/NotificationList';

export default function NotificationsPage() {
  return (
    <div className="page-shell" style={{ maxWidth: 760 }}>
      <div className="page-header">
        <p className="font-mono page-kicker">
          Inbox
        </p>
        <h1 className="font-pixel page-title" style={{ color: 'var(--color-text)' }}>
          Notifications
        </h1>
      </div>
      <NotificationList />
    </div>
  );
}