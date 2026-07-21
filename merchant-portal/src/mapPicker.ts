import maplibregl from 'maplibre-gl';
import type { GeoJSONSource, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cellToBoundary, latLngToCell } from 'h3-js';
import { H3_RESOLUTION } from '@pixirunner/protocol';

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
};

/** Carte de ciblage : cliquer une cellule H3 l'ajoute/retire de la sélection. */
export class MapCellPicker {
  private map: maplibregl.Map;
  private selected = new Set<string>();

  constructor(container: HTMLElement) {
    this.map = new maplibregl.Map({
      container,
      style: STYLE,
      center: [2.3522, 48.8566],
      zoom: 15,
    });
    this.map.on('load', () => {
      this.map.addSource('cells', { type: 'geojson', data: this.toGeoJSON() });
      this.map.addLayer({
        id: 'cells-fill',
        type: 'fill',
        source: 'cells',
        paint: { 'fill-color': '#4a86ff', 'fill-opacity': 0.35 },
      });
      this.map.addLayer({
        id: 'cells-line',
        type: 'line',
        source: 'cells',
        paint: { 'line-color': '#4a86ff', 'line-width': 1.5 },
      });
    });
    this.map.on('click', (e) => this.toggle(e.lngLat.lat, e.lngLat.lng));
  }

  private toggle(lat: number, lng: number): void {
    const cell = latLngToCell(lat, lng, H3_RESOLUTION);
    if (this.selected.has(cell)) this.selected.delete(cell);
    else this.selected.add(cell);
    const src = this.map.getSource('cells') as GeoJSONSource | undefined;
    src?.setData(this.toGeoJSON());
  }

  cells(): string[] {
    return [...this.selected];
  }

  clear(): void {
    this.selected.clear();
    (this.map.getSource('cells') as GeoJSONSource | undefined)?.setData(this.toGeoJSON());
  }

  private toGeoJSON(): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: [...this.selected].map((cell) => ({
        type: 'Feature',
        properties: { cell },
        geometry: {
          type: 'Polygon',
          coordinates: [cellToBoundary(cell, true) as GeoJSON.Position[]],
        },
      })),
    };
  }
}
