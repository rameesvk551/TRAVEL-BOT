import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { 
  EnvelopeIcon, 
  LockClosedIcon, 
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { useLogin } from '../hooks/useAuth';
import { loginSchema } from '../utils/validators';

import metaBadge from '../assets/meta_tech_provider_badge.png';

export default function Login() {
  const loginMutation = useLogin();
  const loginForm = useForm({ resolver: zodResolver(loginSchema) });

  const error = loginMutation.error?.response?.data?.error;

  return (
    <div className="min-h-screen bg-[#f8fafc] font-inter selection:bg-indigo-100 selection:text-indigo-900">
      <div className="flex min-h-screen flex-col lg:flex-row">
        
        {/* Left Side: Form */}
        <section className="bg-[#f8fafc] flex w-full flex-col justify-center px-6 py-12 lg:w-[45%] lg:px-16 xl:w-[40%] xl:px-24">
          <div className="mx-auto w-full max-w-md animate-wizard-in">
            <div className="mb-12 flex flex-col items-center justify-center gap-4 text-center">
              <span className="text-3xl font-black tracking-tighter text-neutral-900 uppercase">WayOn</span>
            </div>

            <div className="mb-8 text-center text-balance">
              <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
                Welcome back
              </h1>
              <p className="mt-3 text-neutral-500">
                Access your premium travel concierge dashboard.
              </p>
            </div>

            {error ? (
              <div className="mb-6 animate-shake rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-sm text-rose-600 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                  {error}
                </div>
              </div>
            ) : null}

            <form onSubmit={loginForm.handleSubmit((values) => loginMutation.mutate(values))} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Email Address</label>
                <div className="input-icon-wrapper">
                  <EnvelopeIcon className="icon-left h-5 w-5 absolute left-3" />
                  <input 
                    {...loginForm.register('email')} 
                    type="email" 
                    className="shell-input-rect input-with-icon border-neutral-200/60 bg-white focus:bg-white" 
                    placeholder="alex@concierge.com" 
                  />
                </div>
                {loginForm.formState.errors.email ? <p className="mt-1.5 text-xs font-medium text-rose-500">{loginForm.formState.errors.email.message}</p> : null}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">Password</label>
                  <button type="button" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition">Forgot?</button>
                </div>
                <div className="input-icon-wrapper">
                  <LockClosedIcon className="icon-left h-5 w-5 absolute left-3" />
                  <input 
                    {...loginForm.register('password')} 
                    type="password" 
                    className="shell-input-rect input-with-icon border-neutral-200/60 bg-white focus:bg-white" 
                    placeholder="••••••••" 
                  />
                </div>
                {loginForm.formState.errors.password ? <p className="mt-1.5 text-xs font-medium text-rose-500">{loginForm.formState.errors.password.message}</p> : null}
              </div>

              <button 
                type="submit" 
                disabled={loginMutation.isPending} 
                className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-70 shadow-lg shadow-neutral-200"
              >
                {loginMutation.isPending ? 'Authenticating...' : (
                  <>
                    Sign In to Dashboard
                    <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-neutral-500">
              Don't have an account? <Link to="/signup" className="font-bold text-neutral-900 hover:underline">Join the elite</Link>
            </p>

            <p className="mt-3 text-center text-sm text-neutral-500">
              Need a quick client walkthrough? <Link to="/brochure" className="font-bold text-neutral-900 hover:underline">Open brochure</Link>
            </p>

            {/* Badge Integration */}
            <div className="mt-12 flex flex-col items-center justify-center gap-2 opacity-90 transition hover:opacity-100">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0668E1] drop-shadow-sm">Meta Official Tech Provider</span>
              <img 
                src={metaBadge} 
                alt="Meta Tech Provider" 
                className="h-20 w-auto mix-blend-multiply" 
                style={{ filter: 'invert(27%) sepia(91%) saturate(2352%) hue-rotate(202deg) brightness(96%) contrast(101%)' }}
              />
            </div>
          </div>
        </section>

        {/* Right Side: Hero Visual */}
        <section className="hidden lg:block lg:flex-1 bg-[#f8fafc] p-4">
          <div className="relative h-full w-full overflow-hidden rounded-[2rem] shadow-2xl">
            <img 
              src="/login-hero.jpg" 
              alt="Premium Travel Workspace" 
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover grayscale-[0.1]" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            

          </div>
        </section>

      </div>
    </div>
  );
}
