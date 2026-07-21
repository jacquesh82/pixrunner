import { Geolocation } from '@capacitor/geolocation';
import type { InputKind, Position, PositionSource } from './PositionSource.js';

/**
 * Position réelle via le plugin Capacitor Geolocation : GPS natif + gestion des
 * permissions sur Android, et repli automatique sur l'API web du navigateur.
 */
export class GeolocationSource implements PositionSource {
  readonly kind: InputKind = 'gps';

  private watchId?: string;
  onError?: (message: string) => void;

  start(onPosition: (pos: Position) => void): void {
    void this.begin(onPosition);
  }

  private async begin(onPosition: (pos: Position) => void): Promise<void> {
    try {
      await Geolocation.requestPermissions();
      this.watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10_000 },
        (position, err) => {
          if (err || !position) {
            this.onError?.(`GPS : ${err?.message ?? 'indisponible'}`);
            return;
          }
          onPosition({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
      );
    } catch (e) {
      this.onError?.(`GPS : ${(e as Error).message}`);
    }
  }

  stop(): void {
    if (this.watchId !== undefined) {
      void Geolocation.clearWatch({ id: this.watchId });
      this.watchId = undefined;
    }
  }
}
