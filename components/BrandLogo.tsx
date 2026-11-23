import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  light?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', showWordmark = true, light = false, className = '' }) => {
  const sizes = {
    sm: { box: 'h-9 w-9', title: 'text-[17px]', sub: 'text-[10px]' },
    md: { box: 'h-11 w-11', title: 'text-[20px]', sub: 'text-[11px]' },
    lg: { box: 'h-14 w-14', title: 'text-[25px]', sub: 'text-xs' },
  }[size];

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div className={`${sizes.box} shrink-0 rounded-[10px] ${light ? 'bg-[#e5eee1]' : 'bg-[#e5ece2]'} grid place-items-center`}>
        <svg viewBox="0 0 64 64" className="h-[85%] w-[85%]" aria-hidden="true">
          <path d="M10 21 32 10l22 11-22 11-22-11Z" fill="#285944" />
          <path d="M19.5 29v9c0 7 5.5 12 12.5 12s12.5-5 12.5-12v-9L32 35l-12.5-6Z" fill="#285944" />
          <path d="M52 23v17" stroke="#285944" strokeWidth="3" strokeLinecap="round" />
          <circle cx="52" cy="44" r="3" fill="#285944" />
          <path d="m26 40 4 4 8-9" fill="none" stroke="#eef3e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {showWordmark && (
        <div className="leading-none">
          <div className={`${sizes.title} font-semibold tracking-[-.03em] ${light ? 'text-[#f0f4eb]' : 'text-[#263b2c]'}`}>
            Tutor<span className={light ? 'text-[#b2d1b2]' : 'text-[#39694e]'}>Track</span>
          </div>
          <div className={`${sizes.sub} mt-1.5 font-normal tracking-normal ${light ? 'text-[#b4c9b6]' : 'text-[#89998b]'}`}>Teach · Track · Grow</div>
        </div>
      )}
    </div>
  );
};
