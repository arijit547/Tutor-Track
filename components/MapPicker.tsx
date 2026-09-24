import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, X, Crosshair } from 'lucide-react';
import { Button } from './Button';
import { getCurrentLocation } from '../services/locationService.browser';

interface MapPickerProps {
  initialLocation?: { latitude: number; longitude: number; address?: string };
  onLocationSelect: (location: { latitude: number; longitude: number; address?: string }) => void;
  onClose: () => void;
}

export const MapPicker: React.FC<MapPickerProps> = ({ initialLocation, onLocationSelect, onClose }) => {
  const [lat, setLat] = useState(initialLocation?.latitude?.toString() || '');
  const [lng, setLng] = useState(initialLocation?.longitude?.toString() || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const useCurrent = async () => {
    setLoading(true);
    try {
      const loc = await getCurrentLocation();
      setLat(loc.latitude.toFixed(6));
      setLng(loc.longitude.toFixed(6));
    } finally { setLoading(false); }
  };

  const valid = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat !== '' && lng !== '';

  return (
    <div className="fixed inset-0 z-[60] bg-[#1f1e35]/55 backdrop-blur-sm grid place-items-center p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-[26px] bg-[#fffefa] border border-white/70 shadow-[0_30px_90px_rgba(31,30,53,.3)]">
        <div className="relative h-48 tt-grid-bg bg-[#eeebdf] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(91,87,166,.11),transparent_48%)]" />
          <div className="absolute inset-0 grid place-items-center"><div className="tt-float h-14 w-14 rounded-[20px] bg-[#34326f] text-[#f4bd68] grid place-items-center shadow-xl"><MapPin className="w-6 h-6" /></div></div>
          <button onClick={onClose} className="absolute right-4 top-4 h-9 w-9 rounded-xl bg-white/85 grid place-items-center text-[#6e6b7c] shadow-sm"><X className="w-4 h-4" /></button>
          <div className="absolute left-4 bottom-4 rounded-full bg-white/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#6c6878]">Location coordinates</div>
        </div>
        <div className="p-5 sm:p-6">
          <h3 className="text-lg font-extrabold tracking-[-.025em] text-[#2d2b43]">Set tuition location</h3>
          <p className="mt-1 text-sm leading-6 text-[#817e8c]">Use your current position or enter the latitude and longitude for the student’s tuition location.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div><label className="block mb-1.5 text-xs font-bold text-[#686575]">Latitude</label><input value={lat} onChange={e => setLat(e.target.value)} placeholder="24.8949" className="w-full rounded-xl border border-[#dcd8d0] bg-[#fbfaf7] px-3.5 py-2.5 text-sm outline-none" /></div>
            <div><label className="block mb-1.5 text-xs font-bold text-[#686575]">Longitude</label><input value={lng} onChange={e => setLng(e.target.value)} placeholder="91.8687" className="w-full rounded-xl border border-[#dcd8d0] bg-[#fbfaf7] px-3.5 py-2.5 text-sm outline-none" /></div>
          </div>
          <button onClick={useCurrent} className="mt-3 w-full rounded-xl border border-[#d7d3de] bg-white px-4 py-3 text-sm font-bold text-[#514d80] inline-flex items-center justify-center gap-2 hover:bg-[#f4f1f8] transition-colors" disabled={loading}><Crosshair className="w-4 h-4" /> {loading ? 'Getting your position…' : 'Use current location'}</button>
          <div className="mt-5 flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={() => onLocationSelect({ latitude: Number(lat), longitude: Number(lng) })} icon={<Navigation className="w-4 h-4" />}>Save location</Button></div>
        </div>
      </div>
    </div>
  );
};
