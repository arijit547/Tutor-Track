import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, trend, trendUp }) => (
  <div className="tt-card tt-card-hover rounded-[20px] p-5 min-h-[152px] flex flex-col justify-between">
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm font-semibold text-[#777588]">{title}</p>
      <div className="h-10 w-10 rounded-[13px] grid place-items-center bg-[#f0eef8] text-[#55518f]">{icon}</div>
    </div>
    <div>
      <p className="text-[1.65rem] sm:text-[1.8rem] font-extrabold tracking-[-.045em] text-[#25243c] leading-none">{value}</p>
      {trend && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className={`font-bold ${trendUp ? 'text-[#2d805b]' : 'text-[#b35549]'}`}>{trend}</span>
          <span className="text-[#a09ead]">status</span>
        </div>
      )}
    </div>
  </div>
);
