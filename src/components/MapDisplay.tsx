import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { GPSData } from '../types';
import { getTempColor } from '../lib/data-processor';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from '../lib/utils';

const TIMEZONE = 'Asia/Bangkok';

// Fix for default marker icons in Leaflet + Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapDisplayProps {
  data: GPSData[];
  currentIndex: number;
  trailHours: number;
  isPermanentTrail: boolean;
  followMarker: boolean;
  showHighTempLayer: boolean;
  highTempPoints: GPSData[];
  focusPoints?: GPSData[];
  isDarkMode: boolean;
}

const MapAutoCenter: React.FC<{ center: [number, number]; enabled: boolean }> = ({ center, enabled }) => {
  const map = useMap();
  useEffect(() => {
    if (enabled) {
      map.setView(center);
    }
  }, [center, map, enabled]);
  return null;
};

const MapFocus: React.FC<{ points?: GPSData[] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.long]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [points, map]);
  return null;
};

export const MapDisplay: React.FC<MapDisplayProps> = ({ 
  data, 
  currentIndex, 
  trailHours, 
  isPermanentTrail,
  followMarker, 
  showHighTempLayer,
  highTempPoints,
  focusPoints,
  isDarkMode 
}) => {
  const currentPoint = data[currentIndex];
  
  const trailPoints = useMemo(() => {
    if (!currentPoint) return [];
    
    if (isPermanentTrail) {
      return data.slice(0, currentIndex + 1);
    }

    const endTime = currentPoint.time.getTime();
    const startTime = endTime - trailHours * 60 * 60 * 1000;
    
    return data.filter(p => {
      const t = p.time.getTime();
      return t >= startTime && t <= endTime;
    });
  }, [data, currentIndex, trailHours, isPermanentTrail]);

  if (!data.length) return null;

  const center: [number, number] = currentPoint 
    ? [currentPoint.lat, currentPoint.long] 
    : [data[0].lat, data[0].long];

  return (
    <div className={cn(
      "relative w-full h-full rounded-xl overflow-hidden border shadow-inner",
      isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"
    )}>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution={isDarkMode 
            ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
          url={isDarkMode
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
        />
        
        {/* High Temp Layer (Background) */}
        {showHighTempLayer && highTempPoints.length > 0 && (
          <>
            {highTempPoints.map((p, i) => (
              <CircleMarker
                key={`high-temp-${i}`}
                center={[p.lat, p.long]}
                radius={8}
                pathOptions={{
                  fillColor: '#FF4500',
                  color: '#FFD700',
                  weight: 1,
                  fillOpacity: 0.3,
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-orange-600">High Temp Alert (&gt;30°C)</p>
                    <p>Temp: {p.temp.toFixed(1)}°C</p>
                    <p>Time: {formatInTimeZone(p.time, TIMEZONE, 'HH:mm:ss')}</p>
                    <p>Date: {formatInTimeZone(p.time, TIMEZONE, 'dd/MM/yyyy')}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </>
        )}

        {/* Trail Markers & Lines */}
        {trailPoints.length > 0 && (
          <>
            {trailPoints.map((p, i) => {
              // Draw line to previous point
              const line = i > 0 ? (
                <Polyline
                  key={`trail-line-${i}`}
                  positions={[
                    [trailPoints[i-1].lat, trailPoints[i-1].long],
                    [p.lat, p.long]
                  ]}
                  pathOptions={{
                    color: getTempColor(p.temp),
                    weight: 4,
                    opacity: 0.6,
                    lineCap: 'round'
                  }}
                />
              ) : null;

              return (
                <React.Fragment key={`trail-group-${i}`}>
                  {line}
                  <CircleMarker
                    center={[p.lat, p.long]}
                    radius={4}
                    pathOptions={{
                      fillColor: getTempColor(p.temp),
                      color: isDarkMode ? '#FFF' : '#000',
                      weight: 1,
                      fillOpacity: 0.8
                    }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-slate-900 dark:text-slate-100 border-b pb-1 mb-1">
                          {p.location || 'Point Detail'}
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          <span className="text-slate-500 dark:text-slate-400">Date:</span>
                          <span className="font-medium dark:text-slate-200">{formatInTimeZone(p.time, TIMEZONE, 'dd/MM/yyyy')}</span>
                          <span className="text-slate-500 dark:text-slate-400">Time:</span>
                          <span className="font-medium dark:text-slate-200">{formatInTimeZone(p.time, TIMEZONE, 'HH:mm:ss')}</span>
                          <span className="text-slate-500 dark:text-slate-400">Temp:</span>
                          <span className="font-medium text-red-500">{p.temp.toFixed(1)}°C</span>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                </React.Fragment>
              );
            })}
          </>
        )}

        {/* Current Position Marker */}
        {currentPoint && (
          <CircleMarker
            center={[currentPoint.lat, currentPoint.long]}
            radius={10}
            pathOptions={{
              fillColor: getTempColor(currentPoint.temp),
              color: '#FFF',
              weight: 3,
              fillOpacity: 1
            }}
          >
            <Popup>
              <div className="text-sm space-y-1">
                <p className="font-bold text-red-600 border-b pb-1 mb-1 flex items-center gap-1">
                  <span>🔥</span> Latest Position
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span className="text-slate-500 dark:text-slate-400">Date:</span>
                  <span className="font-medium dark:text-slate-200">{formatInTimeZone(currentPoint.time, TIMEZONE, 'dd/MM/yyyy')}</span>
                  <span className="text-slate-500 dark:text-slate-400">Time:</span>
                  <span className="font-medium dark:text-slate-200">{formatInTimeZone(currentPoint.time, TIMEZONE, 'HH:mm:ss')}</span>
                  <span className="text-slate-500 dark:text-slate-400">Temp:</span>
                  <span className="font-medium text-red-500">{currentPoint.temp.toFixed(1)}°C</span>
                  <span className="text-slate-500 dark:text-slate-400">Location:</span>
                  <span className="font-medium dark:text-slate-200 truncate max-w-[100px]">{currentPoint.location || 'N/A'}</span>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )}

        <MapAutoCenter center={center} enabled={followMarker} />
        <MapFocus points={focusPoints} />
      </MapContainer>
    </div>
  );
};
