import React from 'react';
import { Student } from '../types';
import { MapPin, Radio } from 'lucide-react';

export const LocationDebugPanel: React.FC<{ students: Student[]; isTracking: boolean }> = ({ students, isTracking }) => {
  const configured = students.filter(s => s.location);
  return (
    <div className="rounded-[18px] border border-[#d9e9df] bg-[#f1f8f4] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
      <div className="flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-white text-[#42805f] grid place-items-center"><Radio className={`w-4 h-4 ${isTracking ? 'animate-pulse' : ''}`} /></div><div><p className="text-sm font-bold text-[#315d47]">Auto-session location tracking is on</p><p className="text-xs text-[#668373] mt-0.5">{configured.length} student location{configured.length === 1 ? '' : 's'} configured · browser location stays on this device</p></div></div>
      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4c735e]"><MapPin className="w-3.5 h-3.5" /> 150m detection radius</div>
    </div>
  );
};
