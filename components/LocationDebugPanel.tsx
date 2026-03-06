import React, { useState, useEffect } from 'react';
import { Student } from '../types';
import { getCurrentLocation } from '../services/locationService.browser';
import { MapPin, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface LocationDebugPanelProps {
  students: Student[];
  isTracking: boolean;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export const LocationDebugPanel: React.FC<LocationDebugPanelProps> = ({ students, isTracking }) => {
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);

  const refreshLocation = async () => {
    setLoading(true);
    setError(null);
    try {
      const loc = await getCurrentLocation();
      setCurrentLocation(loc);
    } catch (err: any) {
      setError(err.message || 'Failed to get location');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isTracking) {
      refreshLocation();
      const interval = setInterval(refreshLocation, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [isTracking]);

  const studentsWithLocation = students.filter(s => s.location && s.active);

  return (
    <div className="bg-slate-900 text-white p-4 rounded-lg space-y-3 text-xs font-mono">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Location Debug Panel
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={refreshLocation}
          disabled={loading}
          icon={<RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      <div className="space-y-2">
        <div className="bg-slate-800 p-2 rounded">
          <div className="text-slate-400">Tracking Status:</div>
          <div className={isTracking ? 'text-green-400' : 'text-red-400'}>
            {isTracking ? '✓ ACTIVE' : '✗ INACTIVE'}
          </div>
        </div>

        <div className="bg-slate-800 p-2 rounded">
          <div className="text-slate-400">Your Current Location:</div>
          {loading && <div className="text-yellow-400">Loading...</div>}
          {error && <div className="text-red-400">{error}</div>}
          {currentLocation && (
            <div className="text-green-400">
              {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
            </div>
          )}
          {!currentLocation && !loading && !error && (
            <div className="text-slate-500">Not available</div>
          )}
        </div>

        <div className="bg-slate-800 p-2 rounded">
          <div className="text-slate-400 mb-2">Students with Location ({studentsWithLocation.length}):</div>
          {studentsWithLocation.length === 0 && (
            <div className="text-slate-500">No students have location set</div>
          )}
          {studentsWithLocation.map(student => {
            const distance = currentLocation
              ? calculateDistance(
                  currentLocation.latitude,
                  currentLocation.longitude,
                  student.location!.latitude,
                  student.location!.longitude
                )
              : null;

            const isNearby = distance !== null && distance <= 100;

            return (
              <div key={student.id} className="mb-2 pb-2 border-b border-slate-700 last:border-0">
                <div className="font-semibold">{student.name}</div>
                <div className="text-slate-400">
                  Location: {student.location!.latitude.toFixed(6)}, {student.location!.longitude.toFixed(6)}
                </div>
                {distance !== null && (
                  <div className={isNearby ? 'text-green-400 font-bold' : 'text-slate-400'}>
                    Distance: {distance.toFixed(0)}m {isNearby && '✓ WITHIN RANGE'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-slate-800 p-2 rounded text-slate-400">
          <div className="mb-1">Detection Rules (TEST MODE):</div>
          <div>• Distance threshold: 100m</div>
          <div>• Time threshold: 2 minutes ⚡</div>
          <div>• Check interval: 10 seconds ⚡</div>
          <div className="mt-2 text-yellow-400 text-xs">
            ⚠️ Stay within 100m for 2 minutes to trigger detection
          </div>
        </div>

        {studentsWithLocation.length > 0 && currentLocation && (
          <div className="bg-green-900 p-2 rounded">
            <div className="text-green-300 font-semibold mb-1">Quick Test:</div>
            <div className="text-xs text-green-200">
              {studentsWithLocation.some(s => {
                const distance = calculateDistance(
                  currentLocation.latitude,
                  currentLocation.longitude,
                  s.location!.latitude,
                  s.location!.longitude
                );
                return distance <= 100;
              }) ? (
                '✓ You are within range! Wait 2 minutes for auto-detection.'
              ) : (
                '✗ Move closer to a student location (within 100m).'
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
