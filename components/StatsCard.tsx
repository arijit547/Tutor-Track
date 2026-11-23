import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  meta: string;
  emphasis?: boolean;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, meta, emphasis = false }) => (
  <div className="tt-card rounded-2xl p-5 sm:p-6 min-h-[140px] flex flex-col justify-between">
    <p className="text-[13px] font-medium text-[#667869]">{title}</p>
    <div className="mt-5">
      <p className={`text-[26px] sm:text-[30px] font-medium leading-none tracking-[-.035em] tabular-nums ${emphasis ? 'text-[#a05442]' : 'text-[#29392e]'}`}>{value}</p>
      <p className="mt-2 text-xs text-[#687769]">{meta}</p>
    </div>
  </div>
);
