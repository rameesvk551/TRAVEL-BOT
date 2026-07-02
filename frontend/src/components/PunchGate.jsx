// FILE: /frontend/src/components/PunchGate.jsx
// Blocks the app behind a mandatory punch-in for HR-tracked employees who
// haven't clocked in yet on a working day. Location is captured on punch.

import toast from 'react-hot-toast';
import { ArrowRightOnRectangleIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import { useMySpace, usePunch } from '../api/hrm';

// Every staff user is treated as an employee and may be forced to punch in.
// Owner/admins are exempt. The server (getMySpace.requiresPunchIn) has the final
// say — it returns false for agencies that don't use HRM — so we only decide
// here whether to bother asking.
function canTrackHrm(agent) {
  if (!agent) return false;
  return agent.role !== 'ADMIN';
}

export default function PunchGate() {
  const agent = useAuthStore((s) => s.agent);
  const logout = useAuthStore((s) => s.logout);
  const eligible = canTrackHrm(agent);
  const { data } = useMySpace({ enabled: eligible });
  const { punchIn } = usePunch();

  if (!eligible || !data?.requiresPunchIn) return null;

  const doPunchIn = () => {
    punchIn.mutate(undefined, {
      onSuccess: () => toast.success('Punched in — have a great day!'),
      onError: (e) => toast.error(e.response?.data?.error || e.message || 'Could not punch in'),
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-900/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
          <MapPinIcon className="h-7 w-7 text-[#00A884]" />
        </div>
        <h2 className="mt-4 text-lg font-bold tracking-tight text-neutral-900">Punch in to continue</h2>
        <p className="mt-1.5 text-sm text-neutral-500">
          You need to clock in before using the app today. We'll record your location with the punch.
        </p>
        <button
          onClick={doPunchIn}
          disabled={punchIn.isPending}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00A884] px-7 py-4 text-base font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-[#019174] active:scale-[0.97] disabled:opacity-60"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          {punchIn.isPending ? 'Recording…' : 'Punch In'}
        </button>
        <button
          onClick={logout}
          className="mt-3 text-xs font-medium text-neutral-400 transition hover:text-neutral-600"
        >
          Sign out instead
        </button>
      </div>
    </div>
  );
}
