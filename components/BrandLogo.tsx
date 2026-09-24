import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  light?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showWordmark = true,
  light = false,
  className = '',
}) => {
  const sizes = {
    sm: { box: 'h-9 w-9', title: 'text-lg', sub: 'text-[9px]' },
    md: { box: 'h-11 w-11', title: 'text-xl', sub: 'text-[10px]' },
    lg: { box: 'h-14 w-14', title: 'text-2xl', sub: 'text-[11px]' },
  }[size];

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className={`${sizes.box} relative shrink-0 rounded-[15px] bg-[#25245c] shadow-[0_8px_24px_rgba(37,36,92,.22)] overflow-hidden`}>
        <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="tt-mark" x1="13" x2="51" y1="10" y2="54" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F7C873" />
              <stop offset="1" stopColor="#F0A85B" />
            </linearGradient>
          </defs>
          <path d="M13 18.5 32 9l19 9.5-19 9.7-19-9.7Z" fill="url(#tt-mark)"/>
          <path d="M19.5 25.2v10.1c0 6.6 5.5 11.9 12.5 11.9s12.5-5.3 12.5-11.9V25.2L32 31.4l-12.5-6.2Z" fill="#FFF9EB"/>
          <path d="M48.5 21.3v16.4" stroke="#F7C873" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="48.5" cy="41" r="3.2" fill="#F7C873"/>
          <path d="M27.2 38.6 30.8 42l7-7" fill="none" stroke="#25245c" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {showWordmark && (
        <div className="leading-none">
          <div className={`${sizes.title} font-extrabold tracking-[-0.035em] ${light ? 'text-white' : 'text-[#23233d]'}`}>
            Tutor<span className={light ? 'text-[#f6c66d]' : 'text-[#5b57a6]'}>Track</span>
          </div>
          <div className={`${sizes.sub} mt-1.5 font-semibold uppercase tracking-[0.19em] ${light ? 'text-white/55' : 'text-[#8b8a9b]'}`}>
            Teach · Track · Grow
          </div>
        </div>
      )}
    </div>
  );
};
