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
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { cn } from './lib/utils';

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
      "flex flex-col h-screen font-sans",
      isDarkMode ? "bg-slate-950 text-slate-50" : "bg-slate-50 text-slate-900"
    )}>
      {/* Header */}
      <header className={cn(
        "h-16 border-b flex items-center px-6 justify-between shrink-0 z-10",
        isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center gap-3">
          <div className="bg-red-500 p-2 rounded-lg">
            <Thermometer className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">TempRoute Viz</h1>
            <p className={cn(
              "text-[10px] uppercase tracking-widest font-semibold",
              isDarkMode ? "text-slate-400" : "text-slate-500"
            )}>Animated GPS Analysis</p>
          </div>
        </div>

        {fileName && (
          <div className={cn(
            "hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full border border-dashed animate-in fade-in slide-in-from-top-2",
            isDarkMode ? "border-slate-700 bg-slate-800/50 text-slate-400" : "border-slate-300 bg-slate-50 text-slate-500"
          )}>
            <FileText className="w-3.5 h-3.5" />
            <span className="text-xs font-medium truncate max-w-[200px]">{fileName}</span>
          </div>
        )}

        <div className="flex items-center gap-4">
          {data.length > 0 && (
            <Badge variant="secondary" className={cn(
              "border transition-colors duration-300",
              isDarkMode ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-600 border-slate-200"
            )}>
              {data.length} Data Points
            </Badge>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="rounded-full"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

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
                "flex items-center gap-2 cursor-pointer transition-all active:scale-95",
                isDarkMode ? "border-slate-700 text-slate-200 hover:bg-slate-800" : "bg-slate-900 text-white hover:bg-slate-800"
              )}
            >
              <Upload className="w-4 h-4" />
              {data.length > 0 ? 'Change File' : 'Upload Data'}
            </label>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar Controls */}
        <aside className={cn(
          "w-80 border-r overflow-y-auto p-6 flex flex-col gap-6 shrink-0",
          isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <section>
            <h2 className={cn(
              "text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2",
              isDarkMode ? "text-slate-400" : "text-slate-500"
            )}>
              <Info className="w-3 h-3" />
              Playback Controls
            </h2>
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentIndex(0)}
                  disabled={data.length === 0}
                  className={cn(
                    "rounded-full",
                    isDarkMode ? "border-slate-700 hover:bg-slate-800" : ""
                  )}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  size="lg"
                  variant={isPlaying ? "outline" : "default"}
                  className={cn(
                    "w-16 h-16 rounded-full shadow-lg transition-all",
                    !isPlaying ? 'bg-red-500 hover:bg-red-600' : (isDarkMode ? 'border-slate-700 hover:bg-slate-800' : '')
                  )}
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={data.length === 0}
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
                </Button>
                <div className="w-10" /> {/* Spacer */}
              </div>

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
                              {format(event.startTime, 'EEEE, dd MMMM yyyy')}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[8px] h-5 px-1.5 border-orange-200 text-orange-600 bg-orange-50/50 dark:bg-orange-900/20 dark:border-orange-800">
                            {Math.round(event.durationMinutes)} mins
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <span className="text-slate-500 uppercase tracking-tighter font-bold">Start</span>
                            <span className="font-mono text-slate-700 dark:text-slate-300">{format(event.startTime, 'HH:mm:ss')}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-slate-500 uppercase tracking-tighter font-bold">End</span>
                            <span className="font-mono text-slate-700 dark:text-slate-300">{format(event.endTime, 'HH:mm:ss')}</span>
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

          <section className="mt-auto">
            {currentPoint ? (
              <Card className={cn(
                "border shadow-sm",
                isDarkMode ? "bg-slate-950/50 border-slate-800" : "bg-slate-50/50 border-slate-200"
              )}>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <MapIcon className="w-4 h-4 text-slate-400" />
                    Current Point
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <div className={cn(
                    "flex justify-between items-center py-2 border-b",
                    isDarkMode ? "border-slate-800" : "border-slate-100"
                  )}>
                    <span className="text-xs text-slate-500">Time</span>
                    <span className="text-xs font-mono font-bold">{format(currentPoint.time, 'HH:mm:ss')}</span>
                  </div>
                  <div className={cn(
                    "flex justify-between items-center py-2 border-b",
                    isDarkMode ? "border-slate-800" : "border-slate-100"
                  )}>
                    <span className="text-xs text-slate-500">Temp</span>
                    <span className="text-sm font-bold text-red-500">{currentPoint.temp.toFixed(1)}°C</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs text-slate-500">Location</span>
                    <span className="text-[10px] font-medium text-right max-w-[120px] truncate">
                      {currentPoint.location || 'N/A'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className={cn(
                "text-center p-8 border-2 border-dashed rounded-xl transition-colors duration-300",
                isDarkMode ? "border-slate-800" : "border-slate-200"
              )}>
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-xs text-slate-400 font-medium">Upload a file to start visualization</p>
              </div>
            )}
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
              />
              <Legend isDarkMode={isDarkMode} />
              
              {/* Timeline Slider Overlay */}
              <div className={cn(
                "absolute bottom-8 left-1/2 -translate-x-1/2 w-[70%] z-[1000] backdrop-blur-md p-6 rounded-2xl border shadow-2xl",
                isDarkMode ? "bg-slate-900/95 border-slate-800" : "bg-white/95 border-slate-200"
              )}>
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center px-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Current Time</span>
                      <div key={`time-${currentIndex}`} className="flex items-baseline gap-2 text-red-500">
                        <span className="text-xs font-bold">
                          {currentPoint ? format(currentPoint.time, 'dd/MM') : '--/--'}
                        </span>
                        <span className="text-sm font-mono font-bold">
                          {currentPoint ? format(currentPoint.time, 'HH:mm:ss') : '--:--:--'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Progress</span>
                      <span key={`progress-${currentIndex}`} className="text-sm font-mono font-bold">
                        {Math.round((currentIndex / (data.length - 1)) * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-mono font-bold text-slate-400 w-16">
                      {format(data[0].time, 'HH:mm')}
                    </span>
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
                    <span className="text-[10px] font-mono font-bold text-slate-400 w-16 text-right">
                      {format(data[data.length - 1].time, 'HH:mm')}
                    </span>
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
