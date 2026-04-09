export type OrbitalEvent = {
  lat: number;
  lng: number;
  ts: number;
  platform: string;
};

export type MarkerPoint = {
  id: string;
  lat: number;
  lng: number;
  createdAt: number;
  color: [number, number, number];
};

export type FeedItem = {
  id: string;
  platform: string;
  lat: number;
  lng: number;
  color: [number, number, number];
};
