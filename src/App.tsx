import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapDisplay } from './components/MapDisplay';
import { Legend } from './components/Legend';
import { parseFile, cleanGPSData } from './lib/data-processor';
import { GPSData } from './types';
import { Button, buttonVariants } from './components/ui/button';
import { Slider } from './components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Switch } from './components/ui/switch';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Upload, 
  Thermometer, 
  Map as MapIcon, 
  Clock, 
  ChevronRight,
  Info,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Flame,
  FileText,
  Share2,
  Link as LinkIcon,
  Check,
  Pin,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from './lib/utils';
import LZString from 'lz-string';

const TIMEZONE = 'Asia/Bangkok';

export default function App() {
  const [data, setData] = useState<GPSData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(100); // ms per step
  const [trailHours, setTrailHours] = useState(7);
  const [isPermanentTrail, setIsPermanentTrail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [followMarker, setFollowMarker] = useState(true);
  const [showHighTempLayer, setShowHighTempLayer] = useState(false);
  const [focusedEventIndex, setFocusedEventIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPinned, setIsPinned] = useState(false);

  const exportToHtml = () => {
    if (data.length === 0) return;
    
    const jsonData = JSON.stringify(data);
    const title = fileName ? `TempRoute Viz - ${fileName}` : 'TempRoute Viz Export';
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        #map { height: 100vh; width: 100vw; }
        .info-panel {
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 300px;
        }
        .legend {
            position: absolute;
            bottom: 30px;
            right: 10px;
            z-index: 1000;
            background: white;
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
        }
        .legend-item { display: flex; align-items: center; margin-bottom: 4px; }
        .legend-color { width: 20px; height: 10px; margin-right: 8px; border-radius: 2px; }
    </style>
</head>
<body>
    <div id="map"></div>
    <div class="info-panel">
        <h3 style="margin: 0 0 10px 0;">${title}</h3>
        <p style="font-size: 12px; color: #666; margin: 0;">Total Points: ${data.length}</p>
    </div>
    <div class="legend">
        <div class="legend-item"><div class="legend-color" style="background: #3b82f6;"></div> &lt; 20°C (Cool)</div>
        <div class="legend-item"><div class="legend-color" style="background: rgb(34, 197, 94);"></div> 30°C (Normal)</div>
        <div class="legend-item"><div class="legend-color" style="background: #ef4444;"></div> &gt; 40°C (Hot)</div>
    </div>

    <script>
        const data = ${jsonData};
        const map = L.map('map').setView([data[0].lat, data[0].long], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        function getTempColor(t) {
            if (t < 20) return '#3b82f6';
            if (t >= 40) return '#ef4444';
            if (t < 30) {
                const ratio = (t - 20) / 10;
                const r = Math.floor(59 + (34 - 59) * ratio);
                const g = Math.floor(130 + (197 - 130) * ratio);
                const b = Math.floor(246 + (94 - 246) * ratio);
                return "rgb(" + r + "," + g + "," + b + ")";
            } else {
                const ratio = (t - 30) / 10;
                const r = Math.floor(34 + (239 - 34) * ratio);
                const g = Math.floor(197 + (68 - 197) * ratio);
                const b = Math.floor(94 + (68 - 94) * ratio);
                return "rgb(" + r + "," + g + "," + b + ")";
            }
        }

        const points = data.map(p => [p.lat, p.long]);
        
        // Draw path
        for (let i = 1; i < data.length; i++) {
            L.polyline([
                [data[i-1].lat, data[i-1].long],
                [data[i].lat, data[i].long]
            ], {
                color: getTempColor(data[i].temp),
                weight: 4,
                opacity: 0.8
            }).addTo(map);
        }

        // Add markers for start and end
        L.marker([data[0].lat, data[0].long]).addTo(map).bindPopup('Start Point');
        L.marker([data[data.length-1].lat, data[data.length-1].long]).addTo(map).bindPopup('End Point');

        if (points.length > 0) {
            map.fitBounds(L.polyline(points).getBounds());
        }
    </script>
</body>
</html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ? `${fileName.split('.')[0]}_viz.html` : 'temproute_viz.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const heatEvents = useMemo(() => {
    if (data.length === 0) return [];
    
    const events: {
      points: GPSData[];
      startTime: Date;
      endTime: Date;
      durationMinutes: number;
      minTemp: number;
      maxTemp: number;
      avgTemp: number;
      locations: string[];
    }[] = [];
    
    let currentSequence: GPSData[] = [];
    
    const processSequence = (seq: GPSData[]) => {
      if (seq.length > 1) {
        const start = seq[0].time.getTime();
        const end = seq[seq.length - 1].time.getTime();
        const durationMinutes = (end - start) / (1000 * 60);
        
        if (durationMinutes >= 15) {
          const temps = seq.map(p => p.temp);
          const locations = Array.from(new Set(seq.map(p => p.location).filter(Boolean))) as string[];
          events.push({
            points: [...seq],
            startTime: seq[0].time,
            endTime: seq[seq.length - 1].time,
            durationMinutes,
            minTemp: Math.min(...temps),
            maxTemp: Math.max(...temps),
            avgTemp: temps.reduce((a, b) => a + b, 0) / temps.length,
            locations
          });
        }
      }
    };
    
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      if (p.temp > 30) {
        currentSequence.push(p);
      } else {
        processSequence(currentSequence);
        currentSequence = [];
      }
    }
    processSequence(currentSequence);
    
    return events;
  }, [data]);

  const highTempPoints = useMemo(() => {
    return heatEvents.flatMap(e => e.points);
  }, [heatEvents]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Load shared data from URL
  useEffect(() => {
    const loadFromUrl = () => {
      // Try hash first (supports larger data), then fallback to query params for backward compatibility
      let encodedData = null;
      let encodedName = null;

      if (window.location.hash && window.location.hash.startsWith('#d=')) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        encodedData = hashParams.get('d');
        encodedName = hashParams.get('n');
      } else {
        const queryParams = new URLSearchParams(window.location.search);
        encodedData = queryParams.get('d');
        encodedName = queryParams.get('n');
      }
      
      if (encodedData) {
        try {
          const decompressed = LZString.decompressFromEncodedURIComponent(encodedData);
          if (decompressed) {
            const parsed = JSON.parse(decompressed);
            // Convert string dates back to Date objects and handle shortened keys
            const restored = parsed.map((p: any) => {
              // Handle shortened keys (a: lat, o: long, t: temp, m: time, l: location)
              const lat = p.a !== undefined ? p.a : p.lat;
              const long = p.o !== undefined ? p.o : p.long;
              const temp = p.t !== undefined ? p.t : p.temp;
              const time = p.m !== undefined ? new Date(p.m) : new Date(p.time);
              const location = p.l !== undefined ? p.l : p.location;

              return {
                lat,
                long,
                temp,
                time,
                location
              };
            });
            setData(restored);
            if (encodedName) setFileName(decodeURIComponent(encodedName));
            setCurrentIndex(0);
            setIsPlaying(true);
          }
        } catch (err) {
          console.error("Failed to load shared data", err);
          setError("Failed to load shared data from URL.");
        }
      }
    };

    loadFromUrl();
    // Listen for hash changes if user pastes a new link while app is open
    window.addEventListener('hashchange', loadFromUrl);
    return () => window.removeEventListener('hashchange', loadFromUrl);
  }, []);

  const generateShareLink = () => {
    if (data.length === 0) return;
    
    setIsSharing(true);
    try {
      // Create a much smaller version of data for sharing using short keys and reduced precision
      // a: lat, o: long, t: temp, m: time (timestamp), l: location
      const minimalData = data.map(p => ({
        a: Number(p.lat.toFixed(6)),
        o: Number(p.long.toFixed(6)),
        t: Number(p.temp.toFixed(1)),
        m: p.time.getTime(),
        l: p.location
      }));

      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(minimalData));
      
      const url = new URL(window.location.origin + window.location.pathname);
      const hashParams = new URLSearchParams();
      hashParams.set('d', compressed);
      if (fileName) hashParams.set('n', fileName); // No need to double encode
      
      url.hash = hashParams.toString();
      const finalUrl = url.toString();
      
      if (finalUrl.length > 1000000) {
        setError("Data is extremely large. The link might not work in all browsers.");
      }
      
      navigator.clipboard.writeText(finalUrl);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to generate share link", err);
      setError("Failed to generate share link.");
    } finally {
      setIsSharing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setFileName(file.name);
    try {
      const rawData = await parseFile(file);
      const { cleaned } = cleanGPSData(rawData);
      
      if (cleaned.length === 0) {
        throw new Error("No valid GPS/Temperature data found in file.");
      }
      
      setData(cleaned);
      setCurrentIndex(0);
      setIsPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process file");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isPlaying && data.length > 0 && !isDragging) {
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= data.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, data.length, speed, isDragging]);

  const currentPoint = data[currentIndex];

  return (
    <div className={cn(
      "flex flex-col h-screen font-sans overflow-hidden",
      isDarkMode ? "bg-slate-950 text-slate-50" : "bg-slate-50 text-slate-900"
    )}>
      {/* Header */}
      <header className={cn(
        "h-16 border-b flex items-center px-4 md:px-6 justify-between shrink-0 z-50",
        isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center gap-2 md:gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex"
          >
            <MapIcon className="w-5 h-5" />
          </Button>
          <div className="bg-red-500 p-1.5 md:p-2 rounded-lg hidden xs:block">
            <Thermometer className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-bold tracking-tight">TempRoute Viz</h1>
            <p className={cn(
              "text-[8px] md:text-[10px] uppercase tracking-widest font-semibold",
              isDarkMode ? "text-slate-400" : "text-slate-500"
            )}>GPS Analysis</p>
          </div>
        </div>

        {/* File Name Display - Center */}
        {fileName && (
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full border bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-300">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold truncate max-w-[150px] lg:max-w-[300px]">
              {fileName}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 md:gap-4">
          {data.length > 0 && (
            <Badge variant="secondary" className={cn(
              "hidden lg:flex border transition-colors duration-300",
              isDarkMode ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-600 border-slate-200"
            )}>
              {data.length} Points
            </Badge>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="rounded-full w-8 h-8 md:w-10 md:h-10"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {data.length > 0 && (
            <Button
              variant={shareSuccess ? "default" : "outline"}
              size="sm"
              onClick={generateShareLink}
              disabled={isSharing}
              className={cn(
                "flex items-center gap-2 transition-all h-8 md:h-9 px-2 md:px-3",
                shareSuccess ? "bg-green-500 hover:bg-green-600 border-green-500 text-white" : (isDarkMode ? "border-slate-700 text-slate-300" : "border-slate-200")
              )}
            >
              {shareSuccess ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{shareSuccess ? 'Copied!' : 'Share'}</span>
            </Button>
          )}

          <div className="relative">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label 
              htmlFor="file-upload" 
              className={cn(
                buttonVariants({ variant: isDarkMode ? "outline" : "default", size: "sm" }), 
                "flex items-center gap-2 cursor-pointer transition-all active:scale-95 h-8 md:h-9 px-2 md:px-3",
                isDarkMode ? "border-slate-700 text-slate-200 hover:bg-slate-800" : "bg-slate-900 text-white hover:bg-slate-800"
              )}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">{data.length > 0 ? 'Change' : 'Upload'}</span>
            </label>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Overlay */}
        {isSidebarOpen && !isPinned && (
          <div 
            className="absolute inset-0 bg-black/40 z-[1500] backdrop-blur-[2px] transition-all duration-300" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar Controls */}
        <aside className={cn(
          "h-full border-r overflow-y-auto flex flex-col gap-6 shrink-0 transition-all duration-300 ease-in-out",
          isPinned ? "relative z-20" : "absolute z-[1600] shadow-2xl",
          isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200",
          isSidebarOpen 
            ? "w-72 md:w-80 p-6 translate-x-0 opacity-100" 
            : "w-0 p-0 border-none -translate-x-full opacity-0 overflow-hidden"
        )}>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Controls</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "w-6 h-6 rounded-md transition-colors",
                  isPinned ? "text-red-500 bg-red-500/10" : "text-slate-400 hover:text-slate-600"
                )}
                onClick={() => setIsPinned(!isPinned)}
                title={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
              >
                <Pin className={cn("w-3.5 h-3.5", isPinned && "fill-current")} />
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
          <section>
            <h2 className={cn(
              "text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2",
              isDarkMode ? "text-slate-400" : "text-slate-500"
            )}>
              <Info className="w-3 h-3" />
              Playback Settings
            </h2>
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium">Speed</Label>
                  <span className="text-xs font-mono text-slate-500">{speed || 100}ms</span>
                </div>
                <Slider
                  value={[speed || 100]}
                  min={10}
                  max={1000}
                  step={10}
                  onValueChange={(val) => {
                    const v = Array.isArray(val) ? val[0] : val;
                    if (typeof v === 'number') setSpeed(v);
                  }}
                  disabled={data.length === 0}
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Trail Duration</Label>
                    <div className="flex items-center gap-1 ml-2">
                      <Switch 
                        id="permanent-trail"
                        checked={isPermanentTrail}
                        onCheckedChange={setIsPermanentTrail}
                        className="scale-75"
                        disabled={data.length === 0}
                      />
                      <Label htmlFor="permanent-trail" className="text-[10px] font-bold uppercase text-slate-400 cursor-pointer">Permanent</Label>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-500">{isPermanentTrail ? 'All' : `${trailHours}h`}</span>
                </div>
                {!isPermanentTrail && (
                  <Slider
                    value={[trailHours || 7]}
                    min={1}
                    max={24}
                    step={1}
                    onValueChange={(val) => {
                      const v = Array.isArray(val) ? val[0] : val;
                      if (typeof v === 'number') setTrailHours(v);
                    }}
                    disabled={data.length === 0}
                  />
                )}
              </div>
            </div>
          </section>

          <section>
            <h2 className={cn(
              "text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2",
              isDarkMode ? "text-slate-400" : "text-slate-500"
            )}>
              <MapIcon className="w-3 h-3" />
              Map Options
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                <div className="flex items-center gap-2">
                  {followMarker ? <Eye className="w-4 h-4 text-blue-500" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                  <Label className="text-xs font-medium cursor-pointer" htmlFor="follow-marker">Follow Marker</Label>
                </div>
                <Switch
                  id="follow-marker"
                  checked={followMarker}
                  onCheckedChange={setFollowMarker}
                  disabled={data.length === 0}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                  <div className="flex items-center gap-2">
                    <Flame className={cn("w-4 h-4", showHighTempLayer ? "text-orange-500" : "text-slate-400")} />
                    <div className="flex flex-col">
                      <Label className="text-xs font-medium cursor-pointer" htmlFor="high-temp-layer">Heat Event (&gt;30°C)</Label>
                      <span className="text-[9px] text-slate-500 font-medium">Duration &gt;15 mins</span>
                    </div>
                  </div>
                  <Switch
                    id="high-temp-layer"
                    checked={showHighTempLayer}
                    onCheckedChange={(val) => {
                      setShowHighTempLayer(val);
                      if (!val) setFocusedEventIndex(null);
                    }}
                    disabled={data.length === 0}
                  />
                </div>
                {showHighTempLayer && data.length > 0 && heatEvents.length === 0 && (
                  <div className="px-3 py-2 rounded-md bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 animate-in fade-in slide-in-from-top-1">
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1.5">
                      <Info className="w-3 h-3" />
                      ไม่พบตำแหน่งที่อุณหภูมิเกินเกณฑ์
                    </p>
                  </div>
                )}

                {showHighTempLayer && heatEvents.length > 0 && (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {heatEvents.map((event, idx) => (
                      <button 
                        key={`event-${idx}`}
                        onClick={() => {
                          setFocusedEventIndex(idx);
                          setFollowMarker(false);
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border text-[10px] space-y-2 animate-in fade-in slide-in-from-right-2 transition-all hover:ring-2 hover:ring-orange-500/50",
                          isDarkMode 
                            ? (focusedEventIndex === idx ? "bg-orange-900/20 border-orange-500/50" : "bg-slate-950/50 border-slate-800") 
                            : (focusedEventIndex === idx ? "bg-orange-50 border-orange-200" : "bg-white border-slate-200")
                        )}
                      >
                        <div className="flex justify-between items-center border-b pb-1.5 mb-1.5 border-slate-100 dark:border-slate-800">
                          <div className="flex flex-col">
                            <span className="font-bold text-orange-500 flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              Heat Event #{idx + 1}
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">
                              {formatInTimeZone(event.startTime, TIMEZONE, 'EEEE, dd MMMM yyyy')}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[8px] h-5 px-1.5 border-orange-200 text-orange-600 bg-orange-50/50 dark:bg-orange-900/20 dark:border-orange-800">
                            {Math.round(event.durationMinutes)} mins
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <span className="text-slate-500 uppercase tracking-tighter font-bold">Start</span>
                            <span className="font-mono text-slate-700 dark:text-slate-300">{formatInTimeZone(event.startTime, TIMEZONE, 'HH:mm:ss')}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-slate-500 uppercase tracking-tighter font-bold">End</span>
                            <span className="font-mono text-slate-700 dark:text-slate-300">{formatInTimeZone(event.endTime, TIMEZONE, 'HH:mm:ss')}</span>
                          </div>
                        </div>

                        {event.locations.length > 0 && (
                          <div className="flex flex-col gap-1 pt-1 border-t border-slate-50 dark:border-slate-800/50">
                            <span className="text-slate-500 uppercase tracking-tighter font-bold">Locations</span>
                            <div className="flex flex-wrap gap-1">
                              {event.locations.map((loc, lIdx) => (
                                <span key={lIdx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 truncate max-w-full">
                                  {loc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-50 dark:border-slate-800/50">
                          <div className="flex flex-col items-center p-1 rounded bg-slate-50 dark:bg-slate-900/50">
                            <span className="text-[8px] text-slate-400 uppercase">Min</span>
                            <span className="font-bold text-blue-500">{event.minTemp.toFixed(1)}°</span>
                          </div>
                          <div className="flex flex-col items-center p-1 rounded bg-orange-50 dark:bg-orange-900/20">
                            <span className="text-[8px] text-slate-400 uppercase">Max</span>
                            <span className="font-bold text-red-500">{event.maxTemp.toFixed(1)}°</span>
                          </div>
                          <div className="flex flex-col items-center p-1 rounded bg-slate-50 dark:bg-slate-900/50">
                            <span className="text-[8px] text-slate-400 uppercase">Avg</span>
                            <span className="font-bold text-slate-600 dark:text-slate-300">{event.avgTemp.toFixed(1)}°</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </aside>

        {/* Map Area */}
        <section className={cn(
          "flex-1 relative p-4",
          isDarkMode ? "bg-slate-950" : "bg-slate-100"
        )}>
          {error && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[2000] bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span className="text-sm font-medium">{error}</span>
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-6 w-6 p-0 hover:bg-red-100">×</Button>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 z-[2000] bg-white/60 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                <p className="text-sm font-bold text-slate-900">Processing Data...</p>
              </div>
            </div>
          )}

          {data.length > 0 ? (
            <>
              {/* Current Point Top Bar */}
              <div className={cn(
                "absolute top-4 left-1/2 -translate-x-1/2 z-[1000] backdrop-blur-md px-3 py-2 md:px-6 md:py-3 rounded-full border shadow-xl flex items-center gap-3 md:gap-10 transition-all duration-300 max-w-[95%] md:max-w-none",
                isDarkMode ? "bg-slate-900/90 border-slate-800" : "bg-white/90 border-slate-200"
              )}>
                <div className="flex items-center gap-1.5 md:gap-2">
                  <Clock className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400" />
                  <div className="flex flex-col">
                    <span className="hidden md:block text-[8px] uppercase font-bold text-slate-500 leading-none mb-0.5">Time</span>
                    <span className="text-[10px] md:text-xs font-mono font-bold leading-none">
                      {formatInTimeZone(currentPoint.time, TIMEZONE, 'HH:mm:ss')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 md:gap-2">
                  <Thermometer className={cn(
                    "w-3 h-3 md:w-3.5 md:h-3.5 transition-colors duration-300",
                    currentPoint.temp > 30 ? "text-red-500" : "text-slate-400"
                  )} />
                  <div className="flex flex-col">
                    <span className="hidden md:block text-[8px] uppercase font-bold text-slate-500 leading-none mb-0.5">Temp</span>
                    <span className={cn(
                      "text-[10px] md:text-xs font-bold leading-none transition-colors duration-300",
                      currentPoint.temp > 30 ? "text-red-500" : (isDarkMode ? "text-slate-100" : "text-slate-900")
                    )}>
                      {currentPoint.temp.toFixed(1)}°C
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 md:gap-2 max-w-[80px] sm:max-w-[150px] md:max-w-[300px]">
                  <MapIcon className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-500" />
                  <div className="flex flex-col overflow-hidden">
                    <span className="hidden md:block text-[8px] uppercase font-bold text-slate-500 leading-none mb-0.5">Location</span>
                    <span className="text-[9px] md:text-[10px] font-bold truncate leading-none">
                      {currentPoint.location || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <MapDisplay 
                data={data} 
                currentIndex={currentIndex} 
                trailHours={trailHours} 
                isPermanentTrail={isPermanentTrail}
                followMarker={followMarker}
                showHighTempLayer={showHighTempLayer}
                highTempPoints={highTempPoints}
                focusPoints={focusedEventIndex !== null ? heatEvents[focusedEventIndex]?.points : undefined}
                isDarkMode={isDarkMode}
                resizeTrigger={`${isSidebarOpen}-${isPinned}`}
              />
              <Legend isDarkMode={isDarkMode} />
              
              {/* Timeline Slider Overlay */}
              <div className={cn(
                "absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 w-[90%] md:w-[70%] z-[1000] backdrop-blur-md p-4 md:p-6 rounded-xl md:rounded-2xl border shadow-2xl",
                isDarkMode ? "bg-slate-900/95 border-slate-800" : "bg-white/95 border-slate-200"
              )}>
                <div className="flex flex-col gap-2 md:gap-4">
                  <div className="flex justify-between items-center px-1 md:px-2">
                    <div className="flex flex-col">
                      <span className="text-[8px] md:text-[10px] uppercase tracking-widest font-bold text-slate-400">Current Time</span>
                      <div key={`time-${currentIndex}`} className={cn(
                        "flex items-baseline gap-1 md:gap-2 transition-colors duration-300",
                        currentPoint && currentPoint.temp > 30 ? "text-red-500" : (isDarkMode ? "text-slate-300" : "text-slate-600")
                      )}>
                        <span className="text-[10px] md:text-xs font-bold">
                          {currentPoint ? formatInTimeZone(currentPoint.time, TIMEZONE, 'dd/MM') : '--/--'}
                        </span>
                        <span className="text-xs md:text-sm font-mono font-bold">
                          {currentPoint ? formatInTimeZone(currentPoint.time, TIMEZONE, 'HH:mm:ss') : '--:--:--'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] md:text-[10px] uppercase tracking-widest font-bold text-slate-400">Progress</span>
                      <span key={`progress-${currentIndex}`} className="text-xs md:text-sm font-mono font-bold">
                        {Math.round((currentIndex / (data.length - 1)) * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentIndex(0)}
                        disabled={data.length === 0}
                        className={cn(
                          "rounded-full w-8 h-8 md:w-10 md:h-10 shrink-0",
                          isDarkMode ? "border-slate-700 hover:bg-slate-800" : "border-slate-200"
                        )}
                      >
                        <RotateCcw className="w-3 h-3 md:w-4 md:h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant={isPlaying ? "outline" : "default"}
                        className={cn(
                          "w-8 h-8 md:w-10 md:h-10 rounded-full shadow-md transition-all shrink-0",
                          !isPlaying ? 'bg-red-500 hover:bg-red-600 text-white' : (isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200')
                        )}
                        onClick={() => setIsPlaying(!isPlaying)}
                        disabled={data.length === 0}
                      >
                        {isPlaying ? <Pause className="w-3 h-3 md:w-4 md:h-4" /> : <Play className="w-3 h-3 md:w-4 md:h-4 fill-current" />}
                      </Button>
                    </div>
                    <Slider
                      value={[currentIndex]}
                      min={0}
                      max={data.length - 1}
                      step={1}
                      onValueChange={(val) => {
                        const v = Array.isArray(val) ? val[0] : val;
                        if (typeof v === 'number') {
                          setCurrentIndex(v);
                        }
                      }}
                      onPointerDown={() => {
                        setIsDragging(true);
                        setIsPlaying(false);
                      }}
                      onPointerUp={() => setIsDragging(false)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className={cn(
              "w-full h-full flex items-center justify-center rounded-xl border",
              isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}>
              <div className="max-w-md text-center">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
                  isDarkMode ? "bg-slate-800" : "bg-slate-50"
                )}>
                  <MapIcon className="w-10 h-10 text-slate-200" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Ready to Visualize</h2>
                <p className="text-slate-500 mb-8">
                  Upload your GPS and temperature data (.csv or .xlsx) to see an animated route analysis with historical trails.
                </p>
                <div className="flex flex-col gap-3 items-center">
                  <label 
                    htmlFor="file-upload" 
                    className={cn(
                      buttonVariants({ size: "lg" }), 
                      "px-8 bg-slate-900 cursor-pointer text-white"
                    )}
                  >
                    Select File
                  </label>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Supported: CSV, Excel</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
