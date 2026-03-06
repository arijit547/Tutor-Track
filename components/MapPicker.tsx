import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { MapPin, X } from 'lucide-react';

interface MapPickerProps {
  initialLocation?: { latitude: number; longitude: number };
  onLocationSelect: (location: { latitude: number; longitude: number }) => void;
  onClose: () => void;
}

export const MapPicker: React.FC<MapPickerProps> = ({ initialLocation, onLocationSelect, onClose }) => {
  const [selectedLocation, setSelectedLocation] = useState(initialLocation || { latitude: 23.8103, longitude: 90.4125 });
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Leaflet dynamically
    const loadMap = async () => {
      // Add Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Load Leaflet JS
      if (!(window as any).L) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      const L = (window as any).L;
      if (!L || !mapRef.current) return;

      // Initialize map
      const map = L.map(mapRef.current).setView([selectedLocation.latitude, selectedLocation.longitude], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Add marker
      const marker = L.marker([selectedLocation.latitude, selectedLocation.longitude], {
        draggable: true
      }).addTo(map);

      // Update location on marker drag
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setSelectedLocation({ latitude: pos.lat, longitude: pos.lng });
      });

      // Update location on map click
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setSelectedLocation({ latitude: lat, longitude: lng });
      });
    };

    loadMap();
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600" />
            Select Tuition Location
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b bg-slate-50">
          <p className="text-sm text-slate-600">
            Click on the map or drag the marker to select the tuition location
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Selected: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
          </p>
        </div>

        <div ref={mapRef} className="flex-1 min-h-[400px]" />

        <div className="p-4 border-t flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onLocationSelect(selectedLocation)}>
            Confirm Location
          </Button>
        </div>
      </div>
    </div>
  );
};
