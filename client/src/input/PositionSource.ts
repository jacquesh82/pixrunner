/** Abstraction de source de position : le jeu ne connaît que des positions monde. */

export interface Position {
  lat: number;
  lng: number;
}

export type InputKind = 'keyboard' | 'gps';

export interface PositionSource {
  readonly kind: InputKind;
  start(onPosition: (pos: Position) => void): void;
  stop(): void;
}
