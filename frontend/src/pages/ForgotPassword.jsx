import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { EnvelopeIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { useForgotPassword } from '../hooks/useAuth';
import { forgotPasswordSchema } from '../utils/validators';

export default function ForgotPassword() {
  const form = useForm({ resolver: zodResolver(forgotPasswordSchema) });
  const forgotPassword = useForgotPassword();
  const error = forgotPassword.error?.response?.data?.error || forgotPassword.error?.message;

  const handleSubmit = (values) => {
    forgotPassword.mutate(values);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-10">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-6 shadow-[0_18px_60px_-42px_rgba(15,23,42,0.35)] sm:p-8">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-neutral-950">
          <ChevronLeftIcon className="h-4 w-4" />
          Back to login
        </Link>

        <div className="mt-8">
          <p className="eyebrow">Password Help</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-950">Reset your password</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            Enter your account email and we will send a secure reset link if the account exists.
          </p>
        </div>

        {forgotPassword.isSuccess ? (
          <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">
            Check your inbox for the password reset link. It expires in 30 minutes.
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-6 space-y-5">
            {error ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
                {error}
              </div>
            ) : null}

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Email Address</label>
              <div className="input-icon-wrapper">
                <EnvelopeIcon className="icon-left h-5 w-5 absolute left-3" />
                <input
                  {...form.register('email')}
                  type="email"
                  className="shell-input-rect input-with-icon border-neutral-200/60 bg-white focus:bg-white"
                  placeholder="you@example.com"
                />
              </div>
              {form.formState.errors.email ? (
                <p className="mt-1.5 text-xs font-medium text-rose-500">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={forgotPassword.isPending}
              className="shell-button-primary w-full"
            >
              {forgotPassword.isPending ? 'Sending reset link...' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
