'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { getSupabaseFriendlyError } from '@/lib/supabaseError';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const validateUsername = (u: string) => /^[a-zA-Z0-9_]{3,16}$/.test(u);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!validateUsername(username)) {
      setError('Username must be 3–16 characters: letters, numbers, underscores only.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Check username availability
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .ilike('username', username)
        .single();

      if (existing) {
        setError('That username is already taken.');
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: `${username.toLowerCase()}@mcpvp.local`,
        password,
        options: {
          data: { username: username.toLowerCase() },
        },
      });

      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('Registration failed.');

      // Profile is created by trigger; redirect
      router.push('/rankings');
    } catch (err: any) {
      setError(getSupabaseFriendlyError(err, 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 56px)', padding: '40px 24px' }}>
      <div className="card animate-in" style={{ width: '100%', maxWidth: 420, padding: 40 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 className="font-pixel glow-green" style={{ fontSize: '2.2rem', color: 'var(--color-green)', marginBottom: 8 }}>
            Register
          </h1>
          <p style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem' }}>
            Create your PvP identity
          </p>
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 4 }}>
              3–16 chars · letters, numbers, underscores
            </p>
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
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="font-mono" style={{ display: 'block', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>
              Confirm Password
            </label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
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
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.875rem', color: 'var(--color-text-dim)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--color-green)', textDecoration: 'none', fontWeight: 600 }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}