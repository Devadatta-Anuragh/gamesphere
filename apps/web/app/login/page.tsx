'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/primitives';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim());
      router.replace('/dashboard');
    } catch {
      setError('Login failed — username must be 3–20 chars (letters/digits/_).');
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-7 shadow-glow">
        <div className="mb-1 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand/15 font-mono text-brand">
            GS
          </div>
          <span className="text-lg font-semibold">GameSphere</span>
        </div>
        <p className="mb-6 font-mono text-xs uppercase tracking-widest text-muted">
          real-money ludo · ops console
        </p>

        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs text-muted">Username</label>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. ada_01"
            className="w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button type="submit" disabled={busy || username.trim().length < 3} className="w-full">
            {busy ? <Spinner /> : 'Enter'}
          </Button>
        </form>
        <p className="mt-4 text-center text-[11px] text-muted">
          New username? An account + ₦500 signup bonus is created instantly.
        </p>
      </div>
    </div>
  );
}
