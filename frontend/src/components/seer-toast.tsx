type SeerToastProps = {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose: () => void;
};

export function SeerToast({
  title,
  description,
  action,
  onClose,
}: SeerToastProps) {
  return (
    <div className="relative w-[calc(100vw-1.6rem)] overflow-hidden rounded-xl border border-[#a889ff]/45 bg-[linear-gradient(180deg,rgba(18,12,32,0.96),rgba(12,8,22,0.96))] text-[#ece8fa] shadow-[0_24px_72px_rgba(7,4,14,0.8)] backdrop-blur-xl sm:w-[372px]">
      <button
        type="button"
        aria-label="Close Seer toast"
        className="absolute top-2 left-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/20 bg-black/20 text-sm leading-none text-[#efe9ff] transition hover:border-white/35 hover:bg-black/35"
        onClick={onClose}
      >
        ×
      </button>

      <img src="/seer-banner.svg" alt="Seer" className="block h-[88px] w-full object-cover" />

      <div className="p-3.5">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#b896ff] shadow-[0_0_0_4px_rgba(184,150,255,0.2)]" />
          <span className="text-[0.67rem] font-semibold tracking-[0.13em] text-[#ddcffd] uppercase">
            {title}
          </span>
        </div>

        <p className="m-0 text-[0.83rem] leading-relaxed text-[#e7defb]">
          {description}
        </p>

        {action && (
          <button
            type="button"
            className="mt-3 h-9 w-full rounded-md border border-[#b896ff]/50 bg-[#b896ff]/18 px-3 text-xs font-semibold tracking-[0.01em] text-[#faf7ff] transition hover:border-[#c7abff]/65 hover:bg-[#b896ff]/28"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
