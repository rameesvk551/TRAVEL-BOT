import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GlobeAltIcon } from '@heroicons/react/24/outline';
import { useLogin, useRegister } from '../hooks/useAuth';
import { loginSchema, registerSchema } from '../utils/validators';

export default function Login() {
  const [mode, setMode] = useState('login');
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const loginForm = useForm({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm({ resolver: zodResolver(registerSchema) });

  const error = loginMutation.error?.response?.data?.error || registerMutation.error?.response?.data?.error;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(13,106,95,0.16),transparent_28%),linear-gradient(180deg,#f7f9fc_0%,#eef2f8_100%)] px-4 py-12">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="px-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-[24px] bg-[radial-gradient(circle_at_top,#45c3b4,#0d1b3e)] text-white shadow-[0_22px_48px_-26px_rgba(13,106,95,0.75)]">
            <GlobeAltIcon className="h-8 w-8" />
          </div>
          <p className="eyebrow mt-8">Travel CRM</p>
          <h1 className="mt-3 text-balance text-5xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">
            Run your concierge desk with a calmer interface.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-slate-500">
            Manage WhatsApp enquiries, quotes, departures, payments, and client follow-up from one bright, editorial workspace designed for travel teams.
          </p>
        </section>

        <section className="shell-panel mx-auto w-full max-w-xl p-8 sm:p-10">
          <div className="flex rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${mode === 'register' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
            >
              Register
            </button>
          </div>

          {error ? (
            <div className="mt-6 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          {mode === 'login' ? (
            <form onSubmit={loginForm.handleSubmit((values) => loginMutation.mutate(values))} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
                <input {...loginForm.register('email')} type="email" className="shell-input-rect" placeholder="you@agency.com" />
                {loginForm.formState.errors.email ? <p className="mt-2 text-xs text-rose-700">{loginForm.formState.errors.email.message}</p> : null}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
                <input {...loginForm.register('password')} type="password" className="shell-input-rect" placeholder="••••••••" />
                {loginForm.formState.errors.password ? <p className="mt-2 text-xs text-rose-700">{loginForm.formState.errors.password.message}</p> : null}
              </label>

              <button type="submit" disabled={loginMutation.isPending} className="shell-button-primary w-full">
                {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={registerForm.handleSubmit((values) => registerMutation.mutate(values))} className="mt-8 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Agency Name</span>
                  <input {...registerForm.register('agencyName')} className="shell-input-rect" placeholder="Fluid Concierge" />
                  {registerForm.formState.errors.agencyName ? <p className="mt-2 text-xs text-rose-700">{registerForm.formState.errors.agencyName.message}</p> : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Agency Phone</span>
                  <input {...registerForm.register('agencyPhone')} className="shell-input-rect" placeholder="+919876543210" />
                  {registerForm.formState.errors.agencyPhone ? <p className="mt-2 text-xs text-rose-700">{registerForm.formState.errors.agencyPhone.message}</p> : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Agency Email</span>
                  <input {...registerForm.register('agencyEmail')} type="email" className="shell-input-rect" placeholder="hello@agency.com" />
                  {registerForm.formState.errors.agencyEmail ? <p className="mt-2 text-xs text-rose-700">{registerForm.formState.errors.agencyEmail.message}</p> : null}
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">WhatsApp Business Number</span>
                  <input {...registerForm.register('whatsappNumber')} className="shell-input-rect" placeholder="+919876543210" />
                  {registerForm.formState.errors.whatsappNumber ? <p className="mt-2 text-xs text-rose-700">{registerForm.formState.errors.whatsappNumber.message}</p> : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Your Name</span>
                  <input {...registerForm.register('agentName')} className="shell-input-rect" placeholder="Lead Curator" />
                  {registerForm.formState.errors.agentName ? <p className="mt-2 text-xs text-rose-700">{registerForm.formState.errors.agentName.message}</p> : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Your Email</span>
                  <input {...registerForm.register('agentEmail')} type="email" className="shell-input-rect" placeholder="curator@agency.com" />
                  {registerForm.formState.errors.agentEmail ? <p className="mt-2 text-xs text-rose-700">{registerForm.formState.errors.agentEmail.message}</p> : null}
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
                  <input {...registerForm.register('agentPassword')} type="password" className="shell-input-rect" placeholder="Minimum 8 characters" />
                  {registerForm.formState.errors.agentPassword ? <p className="mt-2 text-xs text-rose-700">{registerForm.formState.errors.agentPassword.message}</p> : null}
                </label>
              </div>

              <button type="submit" disabled={registerMutation.isPending} className="shell-button-primary w-full">
                {registerMutation.isPending ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
