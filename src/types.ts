export interface GPSData {
  time: Date;
  lat: number;
  long: number;
  temp: number;
  location?: string;
}

export interface MapPoint {
  lat: number;
  lng: number;
  temp: number;
  time: Date;
  location?: string;
}
