import type { StyleSpecification } from 'maplibre-gl';

/**
 * Style de carte clair et épuré (direction artistique minimaliste éditorial).
 * Tuiles raster CARTO « light_all » (libres, sans clé) → les territoires pastel
 * ressortent nettement par-dessus. Remplaçable par un style vectoriel custom ensuite.
 */
export const LIGHT_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'carto-light', type: 'raster', source: 'carto' }],
};

/** Centre par défaut (Paris) tant qu'aucune position GPS n'est disponible. */
export const DEFAULT_CENTER: [number, number] = [2.3522, 48.8566];
export const DEFAULT_ZOOM = 16;
