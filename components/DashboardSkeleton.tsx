import React from 'react';

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6 sm:space-y-8" aria-label="Loading dashboard">
    <div className="h-60 rounded-2xl tt-skeleton" />
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[140px] rounded-2xl tt-skeleton" />)}
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_.65fr] gap-4">
      <div className="h-72 rounded-2xl tt-skeleton" />
      <div className="h-72 rounded-2xl tt-skeleton" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 rounded-2xl tt-skeleton" />)}
    </div>
  </div>
);
