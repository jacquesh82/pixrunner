import type { InputKind, Position, PositionSource } from './PositionSource.js';

/** Position réelle via l'API Geolocation (GPS natif sur mobile / Capacitor plus tard). */
export class GeolocationSource implements PositionSource {
  readonly kind: InputKind = 'gps';

  private watchId?: number;
  onError?: (message: string) => void;

  start(onPosition: (pos: Position) => void): void {
    if (!('geolocation' in navigator)) {
      this.onError?.('géolocalisation indisponible');
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      (p) => onPosition({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => this.onError?.(`GPS : ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10_000 },
    );
  }

  stop(): void {
    if (this.watchId !== undefined) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = undefined;
    }
  }
}
