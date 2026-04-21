'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setSessionUser } from '@/lib/authSession';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername) {
      setError('Enter a username.');
      return;
    }

    if (!password) {
      setError('Enter a password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.error || 'Could not log in.');
      }

      setSessionUser(payload.user);
      router.push('/rankings');
    } catch (err: any) {
      setError(err?.message || 'Could not log in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 460, margin: '56px auto', padding: '0 18px' }}>
      <div className="card" style={{ padding: 30 }}>
        <h1 className="font-pixel" style={{ fontSize: '2rem', color: 'var(--color-green)', marginBottom: 6 }}>
          Welcome Back
        </h1>
        <p style={{ color: 'var(--color-text-dim)', marginBottom: 18 }}>
          Sign in to continue your climb in the PvP ladder.
        </p>

        <form onSubmit={handleLogin} style={{ display: 'grid', gap: 12 }}>
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
              autoComplete="current-password"
            />
          </label>

          {error && <p style={{ color: 'var(--color-red)', fontSize: '0.875rem', padding: '8px 10px', border: '1px solid rgba(248,113,113,0.32)', borderRadius: 10, background: 'rgba(248,113,113,0.08)' }}>{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4, padding: '11px' }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: '0.9rem', color: 'var(--color-text-dim)' }}>
          Need an account? <Link href="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
