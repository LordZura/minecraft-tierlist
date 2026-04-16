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
      if (!res.ok) throw new Error(payload?.error || 'Could not create account.');

      setSessionUser(payload.user);
      router.push('/rankings');
    } catch (err: any) {
      setError(err?.message || 'Could not create account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '48px auto', padding: 16 }}>
      <h1>Register</h1>
      <p>Create your account</p>

      <form onSubmit={handleRegister} style={{ display: 'grid', gap: 12 }}>
        <label>
          Username
          <input className="input" type="text" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" />
        </label>

        <label>
          Password
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
        </label>

        <label>
          Confirm password
          <input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
        </label>

        {error && <p style={{ color: 'var(--color-red)' }}>{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Already have an account? <Link href="/login">Login</Link>
      </p>
    </div>
  );
}
