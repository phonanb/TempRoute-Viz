import React from 'react';
import { cn } from '../lib/utils';

interface LegendProps {
  isDarkMode?: boolean;
}

export const Legend: React.FC<LegendProps> = ({ isDarkMode }) => {
  return (
    <div className={cn(
      "absolute bottom-8 left-8 z-[1000] backdrop-blur-sm p-4 rounded-lg border shadow-xl pointer-events-auto min-w-[200px]",
      isDarkMode 
        ? "bg-slate-900/90 border-slate-800 text-slate-100" 
        : "bg-white/90 border-slate-200 text-slate-900"
    )}>
      <h3 className="text-sm font-semibold mb-3">Temperature Legend</h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
          <span className={cn("text-xs", isDarkMode ? "text-slate-300" : "text-slate-600")}>40°C+ (Red)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#f97316]" />
          <span className={cn("text-xs", isDarkMode ? "text-slate-300" : "text-slate-600")}>30-39°C (Orange)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
          <span className={cn("text-xs", isDarkMode ? "text-slate-300" : "text-slate-600")}>20-29°C (Green)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
          <span className={cn("text-xs", isDarkMode ? "text-slate-300" : "text-slate-600")}>&lt;20°C (Blue)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#808080]" />
          <span className={cn("text-xs", isDarkMode ? "text-slate-300" : "text-slate-600")}>N/A (Grey)</span>
        </div>
      </div>
    </div>
  );
};
