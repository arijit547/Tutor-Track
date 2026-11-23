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
    <div className="fixed inset-0 z-[60] bg-[#293c30]/55 backdrop-blur-sm grid place-items-center p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-[#fdfefb] border border-white/70 shadow-[0_14px_48px_rgba(19,39,26,.16)]">
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-5 bg-[#eff4ed] border-b border-[#e0e8dd]">
          <div className="flex items-center gap-3"><span className="h-10 w-10 rounded-lg grid place-items-center bg-[#deeadf] text-[#285944]"><MapPin size={19} strokeWidth={1.6} /></span><div><p className="text-sm font-semibold text-[#263b2c]">Tuition location</p><p className="mt-0.5 text-xs text-[#738576]">Latitude and longitude</p></div></div>
          <button onClick={onClose} aria-label="Close location picker" className="h-9 w-9 grid place-items-center rounded-lg hover:bg-[#e2ebe0] text-[#667b6a] transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5 sm:p-6">
          <h3 className="text-lg font-medium tracking-[-.025em] text-[#293e30]">Set tuition location</h3>
          <p className="mt-1 text-sm leading-6 text-[#817e8c]">Use your current position or enter the latitude and longitude for the student’s tuition location.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div><label className="block mb-1.5 text-xs font-bold text-[#576a5b]">Latitude</label><input value={lat} onChange={e => setLat(e.target.value)} placeholder="24.8949" className="w-full rounded-xl border border-[#dce3da] bg-[#fafbf8] px-3.5 py-2.5 text-sm outline-none" /></div>
            <div><label className="block mb-1.5 text-xs font-bold text-[#576a5b]">Longitude</label><input value={lng} onChange={e => setLng(e.target.value)} placeholder="91.8687" className="w-full rounded-xl border border-[#dce3da] bg-[#fafbf8] px-3.5 py-2.5 text-sm outline-none" /></div>
          </div>
          <button onClick={useCurrent} className="mt-3 w-full rounded-xl border border-[#c2d0c1] bg-white px-4 py-3 text-sm font-bold text-[#35644b] inline-flex items-center justify-center gap-2 hover:bg-[#eef3eb] transition-colors" disabled={loading}><Crosshair className="w-4 h-4" /> {loading ? 'Getting your position…' : 'Use current location'}</button>
          <div className="mt-5 flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={() => onLocationSelect({ latitude: Number(lat), longitude: Number(lng) })} icon={<Navigation className="w-4 h-4" />}>Save location</Button></div>
        </div>
      </div>
    </div>
  );
};
