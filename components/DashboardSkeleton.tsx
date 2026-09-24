import React from 'react';

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-7" aria-label="Loading dashboard">
    <div className="h-40 rounded-[28px] tt-skeleton" />
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[152px] rounded-[20px] tt-skeleton" />)}
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_.65fr] gap-4">
      <div className="h-72 rounded-[24px] tt-skeleton" />
      <div className="h-72 rounded-[24px] tt-skeleton" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 rounded-[22px] tt-skeleton" />)}
    </div>
  </div>
);
