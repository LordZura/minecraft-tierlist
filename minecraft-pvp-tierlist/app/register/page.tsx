// Register form: username, password, optional avatar
// On submit, call Supabase Auth signup with metadata for username
// On success, insert profile to users table with UUID

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    // Lowercase and validate username
    const { data, error } = await supabase.auth.signUp({
      email: `${username}@example.com`,
      password: password,
      options: { data: { username: username.toLowerCase() } }
    });
    // After signup, populate "users" profile table
    // Handle redirect...
  }

  return (
    <form className="space-y-4" onSubmit={handleRegister}>
      <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Minecraft Username" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
      <button type="submit">Register</button>
    </form>
  );
}