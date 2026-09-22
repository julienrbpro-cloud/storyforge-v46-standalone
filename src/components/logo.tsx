export function Mark({ className = "size-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="58" r="30" fill="none" stroke="currentColor" strokeWidth="3" />
      <path
        d="M50 6 C58 18 64 24 64 34 C64 42 58 47 50 47 C42 47 36 42 36 34 C36 24 42 18 50 6Z"
        fill="currentColor"
      />
      <path d="M50 44 L65 68 L50 90 L35 68 Z" fill="currentColor" />
      <path d="M50 54 L58 68 L50 82 L42 68 Z" fill="#0e0c0a" opacity="0.35" />
      <circle cx="50" cy="66" r="3.2" fill="#0e0c0a" />
      <line x1="50" y1="69" x2="50" y2="84" stroke="#0e0c0a" strokeWidth="2" />
    </svg>
  );
}

export function Wordmark({ sub }: { sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="font-display text-[26px] font-semibold leading-none tracking-tight">
        Story<em className="not-italic text-accent">Forge</em>
      </div>
      {sub ? (
        <span className="mt-1.5 block text-[10px] font-medium tracking-[0.18em] text-muted uppercase">
          {sub}
        </span>
      ) : null}
    </div>
  );
}