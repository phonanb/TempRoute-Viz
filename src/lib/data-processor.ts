import { parse } from 'papaparse';
import * as XLSX from 'xlsx';
import { GPSData } from '../types';

export const cleanGPSData = (data: any[]): { cleaned: GPSData[], locationCol: string | null } => {
  const colMap: Record<string, string> = {};
  const originalCols = Object.keys(data[0] || {});
  
  originalCols.forEach(c => {
    const lc = c.toLowerCase();
    if (lc.includes('time') || lc.includes('date')) colMap['time'] = c;
    else if (lc.includes('lat')) colMap['lat'] = c;
    else if (lc.includes('long') || lc.includes('lng')) colMap['long'] = c;
    else if (lc.includes('temp')) colMap['temp'] = c;
  });

  const locationCol = originalCols.find(c => {
    const lc = c.toLowerCase();
    return lc.includes('location') || lc.includes('place') || lc.includes('address') || lc.includes('site') || lc.includes('point');
  }) || null;

  const cleaned: GPSData[] = data
    .map(row => {
      const timeVal = row[colMap['time']];
      let time: Date | null = null;
      
      if (timeVal instanceof Date) {
        time = timeVal;
      } else if (typeof timeVal === 'string') {
        const parsed = new Date(timeVal);
        if (!isNaN(parsed.getTime())) {
          time = parsed;
        } else {
          const timeMatch = timeVal.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
          if (timeMatch) {
            const now = new Date();
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
            time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);
          }
        }
      } else if (typeof timeVal === 'number') {
        if (timeVal > 40000 && timeVal < 60000) {
          time = new Date((timeVal - 25569) * 86400 * 1000);
        } else {
          time = new Date(timeVal);
        }
      }

      const lat = parseFloat(row[colMap['lat']]);
      const long = parseFloat(row[colMap['long']]);
      const temp = parseFloat(row[colMap['temp']]);
      const location = locationCol ? row[locationCol] : undefined;

      return { time: time || new Date(0), lat, long, temp, location };
    })
    .filter(row => 
      !isNaN(row.time.getTime()) && 
      !isNaN(row.lat) && 
      !isNaN(row.long) && 
      !isNaN(row.temp)
    )
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  return { cleaned, locationCol };
};

export const parseFile = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    if (file.name.endsWith('.csv')) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (err) => reject(err)
        });
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData);
      };
      reader.readAsArrayBuffer(file);
    }
  });
};

export const getTempColor = (t: number): string => {
  if (isNaN(t)) return '#808080'; // Grey
  if (t < 20) return '#3b82f6';   // Blue
  if (t >= 40) return '#ef4444';  // Red
  
  if (t < 30) {
    // 20 to 30: Blue to Green
    const ratio = (t - 20) / 10;
    const r = Math.floor(59 + (34 - 59) * ratio);
    const g = Math.floor(130 + (197 - 130) * ratio);
    const b = Math.floor(246 + (94 - 246) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // 30 to 40: Green to Red
    const ratio = (t - 30) / 10;
    const r = Math.floor(34 + (239 - 34) * ratio);
    const g = Math.floor(197 + (68 - 197) * ratio);
    const b = Math.floor(94 + (68 - 94) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  }
};
