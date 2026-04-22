'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSessionUser } from '@/lib/authSession';

type EntityKey = 'users' | 'weekly_cycles' | 'weekly_assignments' | 'challenges' | 'alerts' | 'fight_logs' | 'admin_audit';

const ENTITY_LABELS: Record<EntityKey, string> = {
  users: 'Users',
  weekly_cycles: 'Weekly Cycles',
  weekly_assignments: 'Weekly Assignments',
  challenges: 'Challenges',
  alerts: 'Alerts',
  fight_logs: 'Fight Logs',
  admin_audit: 'Audit Logs',
};

export function AdminPanel() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [entity, setEntity] = useState<EntityKey>('weekly_cycles');
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [rawEdits, setRawEdits] = useState('{}');

  useEffect(() => {
    const session = getSessionUser();
    setUserId(session?.id ?? null);
    setIsAdmin(!!session?.is_admin);
    setIsSuperAdmin(!!session?.is_super_admin);
  }, []);

  useEffect(() => {
    if (advancedMode && isSuperAdmin) loadEntity(entity);
  }, [advancedMode, entity, isSuperAdmin]);

  async function callApi(path: string, init?: RequestInit) {
    const res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId ?? '',
        ...(init?.headers ?? {}),
      },
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error ?? 'Request failed');
    return payload;
  }

  async function resetWeeklyNow() {
    if (!confirm('Reset the current weekly cycle now? This cancels unresolved rounds and creates a new cycle immediately.')) return;
    setBusy(true);
    try {
      const payload = await callApi('/api/admin/weekly/reset', {
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'Manual reset from admin panel' }),
      });
      setMessage(`Weekly reset complete. New cycle: ${payload.result.newCycle.id.slice(0, 8)}...`);
      if (advancedMode) await loadEntity('weekly_cycles');
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadEntity(nextEntity: EntityKey) {
    try {
      const payload = await callApi(`/api/admin/advanced/entities?entity=${nextEntity}&limit=100`);
      setRows(payload.rows ?? []);
      setSelected(null);
      setRawEdits('{}');
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  async function saveAdvancedEdit() {
    if (!selected) return;
    let changes: any = null;
    try {
      changes = JSON.parse(rawEdits);
    } catch {
      setMessage('Invalid JSON in edit payload.');
      return;
    }

    setBusy(true);
    try {
      await callApi('/api/admin/advanced/update', {
        method: 'POST',
        body: JSON.stringify({ entity, id: selected.id, changes, reason: reason || 'Advanced update' }),
      });
      setMessage('Advanced update saved.');
      await loadEntity(entity);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: string, payload: Record<string, any> = {}) {
    if (!confirm(`Run advanced action: ${action}?`)) return;
    setBusy(true);
    try {
      await callApi('/api/admin/advanced/action', {
        method: 'POST',
        body: JSON.stringify({ action, ...payload, reason: reason || 'Advanced forced action' }),
      });
      setMessage(`Action ${action} completed.`);
      await loadEntity(entity);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  const preview = useMemo(() => rows.slice(0, 25), [rows]);

  if (!isAdmin) {
    return <div className="card" style={{ padding: 24 }}>Admin access required.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {message && <div className="card" style={{ padding: 10, color: 'var(--color-gold)' }}>{message}</div>}

      <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <h3 className="font-pixel" style={{ fontSize: '1.1rem' }}>Weekly Event Controls</h3>
        <p style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>Dangerous action. Cancels unresolved rounds in the active cycle, preserves history, and starts a brand new cycle now.</p>
        <label style={{ display: 'grid', gap: 6 }}>
          Reason / note (recorded in audit log)
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Stuck state repair" />
        </label>
        <div>
          <button className="btn btn-danger" disabled={busy} onClick={resetWeeklyNow}>Reset Weekly Event Now</button>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 className="font-pixel" style={{ fontSize: '1.1rem' }}>Advanced Mode</h3>
            <button className="btn btn-ghost" onClick={() => setAdvancedMode((v) => !v)}>{advancedMode ? 'Disable' : 'Enable'} Advanced Mode</button>
          </div>
          {advancedMode && (
            <>
              <p style={{ color: 'var(--color-red)', fontSize: '0.84rem' }}>⚠ Advanced mode can directly modify live server state. All actions are audited with before/after payloads and actor identity.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(Object.keys(ENTITY_LABELS) as EntityKey[]).map((k) => (
                  <button key={k} className="btn btn-ghost" onClick={() => setEntity(k)} style={{ borderColor: entity === k ? 'var(--color-gold)' : undefined }}>{ENTITY_LABELS[k]}</button>
                ))}
                <button className="btn btn-primary" onClick={() => loadEntity(entity)}>Refresh</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 8, maxHeight: 360, overflow: 'auto' }}>
                  {preview.map((r) => (
                    <button key={r.id} onClick={() => { setSelected(r); setRawEdits('{}'); }} style={{ width: '100%', textAlign: 'left', background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 8, marginBottom: 6, cursor: 'pointer' }}>
                      <b>{String(r.id).slice(0, 8)}</b> · {r.status ?? r.username ?? r.type ?? 'record'}
                    </button>
                  ))}
                </div>

                <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                  {!selected ? <p style={{ color: 'var(--color-muted)' }}>Select a record to inspect/edit.</p> : (
                    <>
                      <pre style={{ margin: 0, maxHeight: 160, overflow: 'auto', fontSize: 12 }}>{JSON.stringify(selected, null, 2)}</pre>
                      <label style={{ display: 'grid', gap: 4 }}>
                        JSON patch (allowed fields only)
                        <textarea className="input" rows={8} value={rawEdits} onChange={(e) => setRawEdits(e.target.value)} />
                      </label>
                      <button className="btn btn-primary" disabled={busy} onClick={saveAdvancedEdit}>Apply Edit</button>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-danger" disabled={busy} onClick={() => runAction('cancel_weekly_matchup', { assignment_id: selected.id })}>Cancel Matchup</button>
                        <button className="btn btn-ghost" disabled={busy} onClick={() => runAction('resend_alert', { notification_id: selected.id })}>Resend Alert</button>
                        <button className="btn btn-ghost" disabled={busy} onClick={() => runAction('mark_cycle_completed', { cycle_id: selected.id })}>Mark Cycle Completed</button>
                        <button className="btn btn-danger" disabled={busy} onClick={() => runAction('reset_weekly_now')}>Force Reset Weekly</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
