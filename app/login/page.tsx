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
    <div style={{ maxWidth: 420, margin: '48px auto', padding: 16 }}>
      <h1>Login</h1>
      <p>Sign in to your account</p>

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

        {error && <p style={{ color: 'var(--color-red)' }}>{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Need an account? <Link href="/register">Register</Link>
      </p>
    </div>
  );
}