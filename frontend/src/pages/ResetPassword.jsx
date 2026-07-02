import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeftIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { useResetPassword } from '../hooks/useAuth';
import { resetPasswordSchema } from '../utils/validators';
import { displayText } from '../utils/displayText';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const form = useForm({ resolver: zodResolver(resetPasswordSchema) });
  const resetPassword = useResetPassword();
  const error = displayText(resetPassword.error?.response?.data?.error || resetPassword.error?.message, '');

  const handleSubmit = (values) => {
    resetPassword.mutate({ token, password: values.password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-10">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-6 shadow-[0_18px_60px_-42px_rgba(15,23,42,0.35)] sm:p-8">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-neutral-950">
          <ChevronLeftIcon className="h-4 w-4" />
          Back to login
        </Link>

        <div className="mt-8">
          <p className="eyebrow">Account Security</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-950">Create new password</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            Choose a strong password with at least 8 characters.
          </p>
        </div>

        {!token ? (
          <div className="mt-6 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm leading-6 text-rose-600">
            This reset link is missing a token. Request a new password reset link.
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-6 space-y-5">
            {error ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
                {error}
              </div>
            ) : null}

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">New Password</label>
              <div className="input-icon-wrapper">
                <LockClosedIcon className="icon-left h-5 w-5 absolute left-3" />
                <input
                  {...form.register('password')}
                  type="password"
                  className="shell-input-rect input-with-icon border-neutral-200/60 bg-white focus:bg-white"
                  placeholder="Minimum 8 characters"
                />
              </div>
              {form.formState.errors.password ? (
                <p className="mt-1.5 text-xs font-medium text-rose-500">{form.formState.errors.password.message}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Confirm Password</label>
              <div className="input-icon-wrapper">
                <LockClosedIcon className="icon-left h-5 w-5 absolute left-3" />
                <input
                  {...form.register('confirmPassword')}
                  type="password"
                  className="shell-input-rect input-with-icon border-neutral-200/60 bg-white focus:bg-white"
                  placeholder="Repeat new password"
                />
              </div>
              {form.formState.errors.confirmPassword ? (
                <p className="mt-1.5 text-xs font-medium text-rose-500">{form.formState.errors.confirmPassword.message}</p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={resetPassword.isPending}
              className="shell-button-primary w-full"
            >
              {resetPassword.isPending ? 'Resetting password...' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
