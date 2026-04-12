// FILE: /frontend/src/pages/Login.jsx

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLogin, useRegister } from '../hooks/useAuth';
import { loginSchema, registerSchema } from '../utils/validators';
import { GlobeAltIcon } from '@heroicons/react/24/outline';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const loginForm = useForm({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm({ resolver: zodResolver(registerSchema) });

  const error = loginMutation.error?.response?.data?.error || registerMutation.error?.response?.data?.error;

  const onLogin = (data) => loginMutation.mutate(data);
  const onRegister = (data) => registerMutation.mutate(data);

  return (
    <div className="min-h-screen gradient-dark flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-brand mb-4 shadow-lg shadow-brand-500/20">
            <GlobeAltIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">TravelBot</h1>
          <p className="text-surface-400 text-sm">WhatsApp automation for travel agencies</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          {/* Tab toggle */}
          <div className="flex bg-surface-800/50 rounded-xl p-1 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === 'login' ? 'bg-brand-600 text-white shadow' : 'text-surface-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === 'register' ? 'bg-brand-600 text-white shadow' : 'text-surface-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <div>
                <label className="block text-sm text-surface-300 mb-1.5">Email</label>
                <input {...loginForm.register('email')} type="email" className="input-field" placeholder="you@agency.com" />
                {loginForm.formState.errors.email && (
                  <p className="text-xs text-red-400 mt-1">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-surface-300 mb-1.5">Password</label>
                <input {...loginForm.register('password')} type="password" className="input-field" placeholder="••••••••" />
                {loginForm.formState.errors.password && (
                  <p className="text-xs text-red-400 mt-1">{loginForm.formState.errors.password.message}</p>
                )}
              </div>
              <button type="submit" disabled={loginMutation.isPending} className="btn-primary w-full glow-brand">
                {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm text-surface-300 mb-1.5">Agency Name</label>
                  <input {...registerForm.register('agencyName')} className="input-field" placeholder="Kerala Tours" />
                  {registerForm.formState.errors.agencyName && (
                    <p className="text-xs text-red-400 mt-1">{registerForm.formState.errors.agencyName.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-surface-300 mb-1.5">Agency Phone</label>
                  <input {...registerForm.register('agencyPhone')} className="input-field" placeholder="+919876543210" />
                  {registerForm.formState.errors.agencyPhone && (
                    <p className="text-xs text-red-400 mt-1">{registerForm.formState.errors.agencyPhone.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-surface-300 mb-1.5">Agency Email</label>
                  <input {...registerForm.register('agencyEmail')} type="email" className="input-field" placeholder="info@agency.com" />
                  {registerForm.formState.errors.agencyEmail && (
                    <p className="text-xs text-red-400 mt-1">{registerForm.formState.errors.agencyEmail.message}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-surface-300 mb-1.5">WhatsApp Business Number</label>
                  <input {...registerForm.register('whatsappNumber')} className="input-field" placeholder="+919876543210" />
                  {registerForm.formState.errors.whatsappNumber && (
                    <p className="text-xs text-red-400 mt-1">{registerForm.formState.errors.whatsappNumber.message}</p>
                  )}
                </div>
                <div className="col-span-2 border-t border-surface-700/50 pt-4 mt-2">
                  <p className="text-xs text-surface-500 mb-3">Admin Account</p>
                </div>
                <div>
                  <label className="block text-sm text-surface-300 mb-1.5">Your Name</label>
                  <input {...registerForm.register('agentName')} className="input-field" placeholder="John Doe" />
                  {registerForm.formState.errors.agentName && (
                    <p className="text-xs text-red-400 mt-1">{registerForm.formState.errors.agentName.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-surface-300 mb-1.5">Your Email</label>
                  <input {...registerForm.register('agentEmail')} type="email" className="input-field" placeholder="you@email.com" />
                  {registerForm.formState.errors.agentEmail && (
                    <p className="text-xs text-red-400 mt-1">{registerForm.formState.errors.agentEmail.message}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-surface-300 mb-1.5">Password</label>
                  <input {...registerForm.register('agentPassword')} type="password" className="input-field" placeholder="Minimum 8 characters" />
                  {registerForm.formState.errors.agentPassword && (
                    <p className="text-xs text-red-400 mt-1">{registerForm.formState.errors.agentPassword.message}</p>
                  )}
                </div>
              </div>
              <button type="submit" disabled={registerMutation.isPending} className="btn-primary w-full glow-brand">
                {registerMutation.isPending ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-surface-500 mt-6">
          © 2026 TravelBot. WhatsApp automation for travel agencies.
        </p>
      </div>
    </div>
  );
}
