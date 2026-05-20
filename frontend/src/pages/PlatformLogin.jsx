import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { platformApi } from '../api/platformApi';
import { usePlatformAuthStore } from '../store/platformAuthStore';

export default function PlatformLogin() {
  const navigate = useNavigate();
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const setAuth = usePlatformAuthStore((state) => state.setAuth);
  const [form, setForm] = useState({ email: '', password: '' });

  const loginMutation = useMutation({
    mutationFn: platformApi.login,
    onSuccess: (result) => {
      setAuth(result.data);
      navigate('/platform');
    },
  });

  if (accessToken) return <Navigate to="/platform" replace />;

  return (
    <div className="min-h-dvh bg-neutral-950 text-white">
      <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1fr_420px]">
        <section className="max-w-2xl">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-white text-neutral-950">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.24em] text-neutral-400">WAYON Platform Control</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            SaaS admin cockpit
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-300">
            Monitor every agency, WhatsApp connection, active customer, team login state, failed message, and overdue follow-up from one protected console.
          </p>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-white/10 bg-white p-5 text-neutral-950 shadow-2xl sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-neutral-950 text-white">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Platform login</h2>
              <p className="text-sm text-neutral-500">Separate from agency user accounts.</p>
            </div>
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              loginMutation.mutate(form);
            }}
          >
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="shell-input-rect bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="shell-input-rect bg-white"
              />
            </label>

            {loginMutation.isError ? (
              <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {loginMutation.error?.response?.data?.error || 'Unable to log in.'}
              </div>
            ) : null}

            <button type="submit" disabled={loginMutation.isPending} className="shell-button-primary w-full">
              {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
