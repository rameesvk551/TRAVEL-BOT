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
    <div className="min-h-dvh bg-[#f8fafc] font-inter selection:bg-indigo-100 selection:text-indigo-900 lg:h-dvh lg:overflow-hidden">
      <div className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row">
        
        {/* Left Side: Form */}
        <section className="bg-[#f8fafc] flex w-full flex-col justify-start px-6 py-6 lg:w-[45%] lg:justify-center lg:px-16 lg:py-4 xl:w-[40%] xl:px-24 xl:py-5">
          <div className="mx-auto w-full max-w-md animate-wizard-in">
            <div className="mb-4 flex flex-col items-center justify-center gap-2 text-center">
              <img
                src={logo}
                alt="Wayon Logo"
                className="h-20 w-40 object-contain transition-transform duration-500 hover:scale-105"
              />
              <span className="text-2xl font-black tracking-tighter text-neutral-900 uppercase">WayOn</span>
            </div>

            <div className="mb-4 text-center text-balance">
              <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
                Join the elite
              </h1>
              <p className="mt-1.5 text-sm text-neutral-500">
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

            <form onSubmit={registerForm.handleSubmit((values) => registerMutation.mutate(values))} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Agency Name</label>
                  <div className="input-icon-wrapper">
                    <BuildingOfficeIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('agencyName')} className="shell-input-rect input-with-icon border-neutral-200/60 bg-white focus:bg-white" placeholder="Elite Travels" />
                  </div>
                  {registerForm.formState.errors.agencyName ? <p className="mt-1 text-xs text-rose-500">{registerForm.formState.errors.agencyName.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Agency Phone</label>
                  <div className="input-icon-wrapper">
                    <PhoneIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('agencyPhone')} className="shell-input-rect input-with-icon border-neutral-200/60 bg-white focus:bg-white" placeholder="+1234567890" />
                  </div>
                  {registerForm.formState.errors.agencyPhone ? <p className="mt-1 text-xs text-rose-500">{registerForm.formState.errors.agencyPhone.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Agency Email</label>
                  <div className="input-icon-wrapper">
                    <EnvelopeIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('agencyEmail')} type="email" className="shell-input-rect input-with-icon border-neutral-200/60 bg-white focus:bg-white" placeholder="hello@agency.com" />
                  </div>
                  {registerForm.formState.errors.agencyEmail ? <p className="mt-1 text-xs text-rose-500">{registerForm.formState.errors.agencyEmail.message}</p> : null}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">WhatsApp Business</label>
                  <div className="input-icon-wrapper">
                    <DevicePhoneMobileIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('whatsappNumber')} className="shell-input-rect input-with-icon border-neutral-200/60 bg-white focus:bg-white" placeholder="+1234567890" />
                  </div>
                  {registerForm.formState.errors.whatsappNumber ? <p className="mt-1 text-xs text-rose-500">{registerForm.formState.errors.whatsappNumber.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Your Name</label>
                  <div className="input-icon-wrapper">
                    <UserIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('agentName')} className="shell-input-rect input-with-icon border-neutral-200/60 bg-white focus:bg-white" placeholder="John Doe" />
                  </div>
                  {registerForm.formState.errors.agentName ? <p className="mt-1 text-xs text-rose-500">{registerForm.agentName.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Your Email</label>
                  <div className="input-icon-wrapper">
                    <EnvelopeIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('agentEmail')} type="email" className="shell-input-rect input-with-icon border-neutral-200/60 bg-white focus:bg-white" placeholder="john@agency.com" />
                  </div>
                  {registerForm.formState.errors.agentEmail ? <p className="mt-1 text-xs text-rose-500">{registerForm.formState.errors.agentEmail.message}</p> : null}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-neutral-400">Password</label>
                  <div className="input-icon-wrapper">
                    <LockClosedIcon className="icon-left h-5 w-5 absolute left-3" />
                    <input {...registerForm.register('agentPassword')} type="password" className="shell-input-rect input-with-icon border-neutral-200/60 bg-white focus:bg-white" placeholder="Minimum 8 characters" />
                  </div>
                  {registerForm.formState.errors.agentPassword ? <p className="mt-1 text-xs text-rose-500">{registerForm.formState.errors.agentPassword.message}</p> : null}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={registerMutation.isPending} 
                className="group mt-4 relative flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-8 py-3.5 text-sm font-bold text-white transition-all hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-70 shadow-lg shadow-neutral-200"
              >
                {registerMutation.isPending ? 'Creating Account...' : (
                  <>
                    Create Executive Account
                    <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-neutral-500">
              Already have an account? <Link to="/login" className="font-bold text-neutral-900 hover:underline">Sign in</Link>
            </p>

            {/* Badge Integration */}
            <div className="mt-4 flex flex-col items-center justify-center gap-1 opacity-90 transition hover:opacity-100">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0668E1] drop-shadow-sm">Meta Official Tech Provider</span>
              <img 
                src={metaBadge} 
                alt="Meta Tech Provider" 
                className="h-14 w-auto mix-blend-multiply" 
                style={{ filter: 'invert(27%) sepia(91%) saturate(2352%) hue-rotate(202deg) brightness(96%) contrast(101%)' }}
              />
            </div>
          </div>
        </section>

        {/* Right Side: Hero Visual */}
        <section className="hidden lg:block lg:flex-1 bg-[#f8fafc] p-4">
          <div className="relative h-full w-full overflow-hidden rounded-[2rem] shadow-2xl">
            <img 
              src="/signup-hero.png" 
              alt="Premium Travel Lounge" 
              className="absolute inset-0 h-full w-full object-cover grayscale-[0.1]" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            

          </div>
        </section>

      </div>
    </div>
  );
}
