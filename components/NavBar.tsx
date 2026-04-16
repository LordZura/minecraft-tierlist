'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

const NAV_LINKS = [
  { href: '/rankings',    label: 'Rankings'  },
  { href: '/fight-log',   label: 'Fight Log' },
  { href: '/challenges',  label: 'Challenge' },
  { href: '/notifications', label: 'Alerts'  },
];

export function NavBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]       = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin]   = useState(false);
  const [unread, setUnread]     = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      if (data.user) loadProfile(data.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else { setUsername(null); setIsAdmin(false); setUnread(0); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('username, is_admin')
      .eq('id', userId)
      .single();
    if (data) {
      setUsername(data.username);
      setIsAdmin(data.is_admin);
    }

    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    setUnread(count ?? 0);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      style={{
        background: 'rgba(8,12,8,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 56, gap: 32 }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span
            className="font-pixel glow-green"
            style={{ fontSize: '1.5rem', color: 'var(--color-green)', letterSpacing: '0.1em' }}
          >
            ⚔ MC<span style={{ color: 'var(--color-gold)' }}>PvP</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: 'flex', gap: 4, flex: 1 }} className="hidden sm:flex">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: 2,
                fontSize: '0.875rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-body)',
                position: 'relative',
                color: isActive(link.href) ? 'var(--color-green)' : 'var(--color-text-dim)',
                background: isActive(link.href) ? 'rgba(74,222,128,0.08)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              {link.label}
              {link.href === '/notifications' && unread > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  background: 'var(--color-red)', color: '#fff',
                  fontSize: '0.6rem', borderRadius: '50%',
                  width: 14, height: 14, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Auth section */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {user ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  style={{
                    textDecoration: 'none',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.1em',
                    color: 'var(--color-gold)',
                    textTransform: 'uppercase',
                    padding: '4px 10px',
                    border: '1px solid rgba(251,191,36,0.3)',
                    borderRadius: 2,
                  }}
                >
                  Admin
                </Link>
              )}
              <Link
                href={`/profile/${username}`}
                style={{
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {username ?? '...'}
              </Link>
              <button
                onClick={handleLogout}
                className="btn btn-ghost"
                style={{ padding: '4px 12px', fontSize: '0.75rem' }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost" style={{ padding: '6px 16px', textDecoration: 'none', fontSize: '0.8rem' }}>
                Login
              </Link>
              <Link href="/register" className="btn btn-primary" style={{ padding: '6px 16px', textDecoration: 'none', fontSize: '0.8rem' }}>
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
