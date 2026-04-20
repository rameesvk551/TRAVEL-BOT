import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { 
  EnvelopeIcon, 
  LockClosedIcon, 
  BuildingOfficeIcon, 
  PhoneIcon, 
  UserIcon,
  DevicePhoneMobileIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { useRegister } from '../hooks/useAuth';
import { registerSchema } from '../utils/validators';
import logo from '../assets/logo.png';
import metaBadge from '../assets/meta_tech_provider_badge.png';

export default function Signup() {
  const registerMutation = useRegister();
  const registerForm = useForm({ resolver: zodResolver(registerSchema) });

  const error = registerMutation.error?.response?.data?.error;

  return (
    <div className="min-h-screen bg-white font-inter selection:bg-indigo-100 selection:text-indigo-900">
      <div className="flex min-h-screen flex-col lg:flex-row">
        
        {/* Left Side: Form */}
        <section className="mesh-gradient-bg flex w-full flex-col justify-center px-6 py-12 lg:w-[45%] lg:px-16 xl:w-[40%] xl:px-24">
          <div className="mx-auto w-full max-w-md animate-wizard-in">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 shadow-xl overflow-hidden p-2">
                <img src={logo} alt="Wayon Logo" className="h-full w-full object-contain brightness-0 invert" />
              </div>
              <span className="text-xl font-bold tracking-tight text-neutral-900">WayOn</span>
            </div>

            <div className="mb-8">
              <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
                Join the elite
              </h1>
              <p className="mt-3 text-neutral-500">
                Start managing your luxury travel agency with WayOn.
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

            <form onSubmit={registerForm.handleSubmit((values) => registerMutation.mutate(values))} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Agency Name</label>
                  <div className="input-icon-wrapper">
                    <BuildingOfficeIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('agencyName')} className="shell-input-rect input-with-icon border-neutral-200/60 bg-white/50 focus:bg-white" placeholder="Elite Travels" />
                  </div>
                  {registerForm.formState.errors.agencyName ? <p className="mt-1 text-xs text-rose-500">{registerForm.formState.errors.agencyName.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Agency Phone</label>
                  <div className="input-icon-wrapper">
                    <PhoneIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('agencyPhone')} className="shell-input-rect input-with-icon border-neutral-200/60 bg-white/50 focus:bg-white" placeholder="+1234567890" />
                  </div>
                  {registerForm.formState.errors.agencyPhone ? <p className="mt-1 text-xs text-rose-500">{registerForm.formState.errors.agencyPhone.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Agency Email</label>
                  <div className="input-icon-wrapper">
                    <EnvelopeIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('agencyEmail')} type="email" className="shell-input-rect input-with-icon border-neutral-200/60 bg-white/50 focus:bg-white" placeholder="hello@agency.com" />
                  </div>
                  {registerForm.formState.errors.agencyEmail ? <p className="mt-1 text-xs text-rose-500">{registerForm.formState.errors.agencyEmail.message}</p> : null}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">WhatsApp Business</label>
                  <div className="input-icon-wrapper">
                    <DevicePhoneMobileIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('whatsappNumber')} className="shell-input-rect input-with-icon border-neutral-200/60 bg-white/50 focus:bg-white" placeholder="+1234567890" />
                  </div>
                  {registerForm.formState.errors.whatsappNumber ? <p className="mt-1 text-xs text-rose-500">{registerForm.formState.errors.whatsappNumber.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Your Name</label>
                  <div className="input-icon-wrapper">
                    <UserIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('agentName')} className="shell-input-rect input-with-icon border-neutral-200/60 bg-white/50 focus:bg-white" placeholder="John Doe" />
                  </div>
                  {registerForm.formState.errors.agentName ? <p className="mt-1 text-xs text-rose-500">{registerForm.agentName.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Your Email</label>
                  <div className="input-icon-wrapper">
                    <EnvelopeIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('agentEmail')} type="email" className="shell-input-rect input-with-icon border-neutral-200/60 bg-white/50 focus:bg-white" placeholder="john@agency.com" />
                  </div>
                  {registerForm.formState.errors.agentEmail ? <p className="mt-1 text-xs text-rose-500">{registerForm.formState.errors.agentEmail.message}</p> : null}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Password</label>
                  <div className="input-icon-wrapper">
                    <LockClosedIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('agentPassword')} type="password" className="shell-input-rect input-with-icon border-neutral-200/60 bg-white/50 focus:bg-white" placeholder="Minimum 8 characters" />
                  </div>
                  {registerForm.formState.errors.agentPassword ? <p className="mt-1 text-xs text-rose-500">{registerForm.formState.errors.agentPassword.message}</p> : null}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={registerMutation.isPending} 
                className="group mt-6 relative flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-70 shadow-lg shadow-neutral-200"
              >
                {registerMutation.isPending ? 'Creating Account...' : (
                  <>
                    Create Executive Account
                    <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-neutral-500">
              Already have an account? <Link to="/login" className="font-bold text-neutral-900 hover:underline">Sign in</Link>
            </p>

            {/* Badge Integration */}
            <div className="mt-12 flex flex-col items-center justify-center gap-2 opacity-80 transition hover:opacity-100">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Official Partner</span>
              <img src={metaBadge} alt="Meta Tech Provider" className="h-10 w-auto grayscale contrast-125" />
            </div>
          </div>
        </section>

        {/* Right Side: Hero Visual */}
        <section className="hidden lg:block lg:flex-1 bg-white p-4">
          <div className="relative h-full w-full overflow-hidden rounded-[2rem] shadow-2xl">
            <img 
              src="/signup-hero.png" 
              alt="Premium Travel Lounge" 
              className="absolute inset-0 h-full w-full object-cover grayscale-[0.1]" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            
            <div className="absolute bottom-16 left-16 right-16 animate-page-in">
              <div className="inline-flex glass-panel rounded-full px-4 py-1.5 mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-white/90">
                Join the Network
              </div>
              <h2 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
                Expand your agency <br/> beyond horizons.
              </h2>
              <p className="text-lg text-neutral-200 max-w-lg font-medium leading-relaxed">
                Unlock the tools used by the world's leading travel concierges to deliver unforgettable experiences.
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
