// FILE: /frontend/src/components/AgentAvatar.jsx

export default function AgentAvatar({ name, isOnline, size = 'md' }) {
  const initial = name?.charAt(0)?.toUpperCase() || '?';
  const sizeMap = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-lg',
  };

  return (
    <div className="relative inline-block">
      <div
        className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-semibold`}
      >
        {initial}
      </div>
      {isOnline !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-900 ${
            isOnline ? 'bg-green-400' : 'bg-surface-500'
          }`}
        />
      )}
    </div>
  );
}
