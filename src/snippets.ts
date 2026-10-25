/** Working MapLibre code for a MapRouter map, in the framework the agent is building with. */

export type Framework = 'html' | 'react' | 'vue' | 'svelte';

export interface Marker {
  lat: number;
  lon: number;
  label?: string | undefined;
}

export interface SnippetOptions {
  framework: Framework;
  style?: string;
  center?: { lat: number; lon: number };
  zoom?: number;
  markers?: Marker[];
  /** Publishable key to inline (html only). Frameworks read it from an env var instead. */
  publishableKey?: string;
  apiUrl?: string;
  /** Name of the env var holding the publishable key, e.g. VITE_MAPROUTER_PUBLISHABLE_KEY. */
  envVar?: string;
}

export const MAPLIBRE_VERSION = '5.9.0';

const ENV_DEFAULTS: Record<
  Exclude<Framework, 'html'>,
  { name: string; read: (name: string) => string }
> = {
  react: { name: 'VITE_MAPROUTER_PUBLISHABLE_KEY', read: (n) => `import.meta.env.${n}` },
  vue: { name: 'VITE_MAPROUTER_PUBLISHABLE_KEY', read: (n) => `import.meta.env.${n}` },
  svelte: { name: 'PUBLIC_MAPROUTER_PUBLISHABLE_KEY', read: (n) => n },
};

function fitBounds(markers: Marker[]): string {
  if (markers.length < 2) return '';
  const lons = markers.map((m) => m.lon);
  const lats = markers.map((m) => m.lat);
  return `  map.fitBounds([[${Math.min(...lons)}, ${Math.min(...lats)}], [${Math.max(...lons)}, ${Math.max(...lats)}]], { padding: 60, maxZoom: 15 });\n`;
}

function markerLines(markers: Marker[], indent: string): string {
  return markers
    .map((m) => {
      const popup = m.label
        ? `.setPopup(new maplibregl.Popup().setText(${JSON.stringify(m.label)}))`
        : '';
      return `${indent}new maplibregl.Marker({ color: '#172238' }).setLngLat([${m.lon}, ${m.lat}])${popup}.addTo(map);`;
    })
    .join('\n');
}

export function mapSnippet(opts: SnippetOptions): {
  code: string;
  filename: string;
  install?: string;
  env?: string;
  notes: string[];
} {
  const style = opts.style ?? 'survey';
  const api = (opts.apiUrl ?? 'https://api.maprouter.dev').replace(/\/$/, '');
  const markers = opts.markers ?? [];
  const first = markers[0];
  const center =
    opts.center ?? (first ? { lat: first.lat, lon: first.lon } : { lat: 51.5074, lon: -0.1278 });
  const zoom = opts.zoom ?? (markers.length === 1 ? 14 : 12);
  const notes = [
    'Keep the attribution control visible: OpenStreetMap data requires "© OpenStreetMap contributors".',
    'Use the publishable (mr_pk_) key here, never the secret key.',
  ];

  if (opts.framework === 'html') {
    const key = opts.publishableKey ?? 'mr_pk_YOUR_PUBLISHABLE_KEY';
    const code = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css" />
    <style>#map { height: 480px; }</style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js"></script>
    <script>
      const map = new maplibregl.Map({
        container: 'map',
        style: '${api}/v1/styles/${style}.json?key=${key}',
        center: [${center.lon}, ${center.lat}],
        zoom: ${zoom},
      });
      map.addControl(new maplibregl.NavigationControl());
${markerLines(markers, '      ')}
${fitBounds(markers).replace(/^ {2}/gm, '      ')}    </script>
  </body>
</html>
`;
    return { code, filename: 'map.html', notes };
  }

  const env = ENV_DEFAULTS[opts.framework];
  const envName = opts.envVar ?? env.name;
  const keyExpr = env.read(envName);
  const body = `  const map = new maplibregl.Map({
    container,
    style: \`${api}/v1/styles/${style}.json?key=\${${keyExpr}}\`,
    center: [${center.lon}, ${center.lat}],
    zoom: ${zoom},
  });
  map.addControl(new maplibregl.NavigationControl());
${markerLines(markers, '  ')}
${fitBounds(markers)}`;
  const install = 'npm install maplibre-gl';
  const envLine = `${envName}=${opts.publishableKey ?? 'mr_pk_YOUR_PUBLISHABLE_KEY'}`;

  if (opts.framework === 'react') {
    const code = `import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MapRouterMap() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
${body.replace(/^/gm, '  ')}
    return () => map.remove();
  }, []);

  return <div ref={ref} style={{ height: 480 }} />;
}
`;
    return { code, filename: 'MapRouterMap.tsx', install, env: envLine, notes };
  }

  if (opts.framework === 'vue') {
    const code = `<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const el = ref<HTMLDivElement>();
let map: maplibregl.Map | undefined;

onMounted(() => {
  const container = el.value!;
${body.replace('  const map = ', '  map = ')}});
onUnmounted(() => map?.remove());
</script>

<template>
  <div ref="el" style="height: 480px" />
</template>
`;
    return { code, filename: 'MapRouterMap.vue', install, env: envLine, notes };
  }

  const code = `<script lang="ts">
  import { onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { ${envName} } from '$env/static/public';

  let container: HTMLDivElement;

  onMount(() => {
${body.replace(/^/gm, '  ')}
    return () => map.remove();
  });
</script>

<div bind:this={container} style="height: 480px"></div>
`;
  return { code, filename: 'MapRouterMap.svelte', install, env: envLine, notes };
}
