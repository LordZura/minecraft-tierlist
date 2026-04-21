'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setSessionUser } from '@/lib/authSession';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername) {
      setError('Enter a username.');
      return;
    }

    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setError('Username can only contain lowercase letters, numbers, and underscores.');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.error || 'Could not create account.');
      }

      setSessionUser(payload.user);
      router.push('/rankings');
    } catch (err: any) {
      setError(err?.message || 'Could not create account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell" style={{ maxWidth: 520, paddingTop: 'clamp(20px, 7vw, 56px)' }}>
      <div className="card" style={{ padding: 'clamp(18px, 4vw, 30px)' }}>
        <h1 className="font-pixel" style={{ fontSize: 'clamp(1.6rem, 7vw, 2rem)', color: 'var(--color-green)', marginBottom: 6 }}>
          Create Account
        </h1>
        <p style={{ color: 'var(--color-text-dim)', marginBottom: 18 }}>
          Join the ladder and start logging your PvP matches.
        </p>

        <form onSubmit={handleRegister} style={{ display: 'grid', gap: 12 }}>
          <label>
            Username
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </label>

          <label>
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </label>

          <label>
            Confirm password
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </label>

          {error && <p style={{ color: 'var(--color-red)', fontSize: '0.875rem', padding: '8px 10px', border: '1px solid rgba(248,113,113,0.32)', borderRadius: 10, background: 'rgba(248,113,113,0.08)' }}>{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4, padding: '11px' }}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: '0.9rem', color: 'var(--color-text-dim)' }}>
          Already have an account? <Link href="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
