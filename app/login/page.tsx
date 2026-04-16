'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const email = `${username.toLowerCase()}@mcpvp.local`;
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
      router.push('/rankings');
    } catch (err: any) {
      setError('Invalid username or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 56px)', padding: '40px 24px' }}>
      <div className="card animate-in" style={{ width: '100%', maxWidth: 400, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 className="font-pixel glow-green" style={{ fontSize: '2.2rem', color: 'var(--color-green)', marginBottom: 8 }}>
            Login
          </h1>
          <p style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem' }}>
            Welcome back, warrior
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="font-mono" style={{ display: 'block', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>
              Minecraft Username
            </label>
            <input
              className="input"
              type="text"
              placeholder="Steve"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="font-mono" style={{ display: 'block', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>
              Password
            </label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 2 }}>
              <p style={{ color: 'var(--color-red)', fontSize: '0.875rem' }}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: 8, padding: '12px', width: '100%', fontSize: '0.95rem' }}
          >
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.875rem', color: 'var(--color-text-dim)' }}>
          No account?{' '}
          <Link href="/register" style={{ color: 'var(--color-green)', textDecoration: 'none', fontWeight: 600 }}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}