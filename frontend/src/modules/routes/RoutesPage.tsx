import { useEffect, useMemo, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { useBackTarget } from '../../shared/layout/TopBarContext';
import 'leaflet/dist/leaflet.css';
import './RoutesPage.css';

// ── DATOS MOCK ──
// TODO(real-data): GET /api/routes (KPIs, visitas, clientes del día)
// TODO(real-data): apuntar tiles y routing a servidores propios en producción

const KPI = [
  { label: 'Clientes ruta', value: '12' },
  { label: 'Visitas', value: '8' },
  { label: 'Sin visitar', value: '4' },
  { label: 'Pedidos', value: '0' },
  { label: 'Eficacia rutero', value: '66,67%' },
  { label: 'Novedades', value: '9' },
  { label: 'Presupuesto', value: '$56.000.000', span: true },
  { label: 'Cumplimiento', value: '9,00%' },
];

const RESUME_BARS = [
  { label: 'Mes', value: 56_000_000, pct: 100 },
  { label: 'Pedidos', value: 4_000_000, pct: 22 },
  { label: 'Dropsize', value: 44_000, pct: 8 },
];

const CURRENT_LOCATION = { name: 'Ubicación actual', lat: 5.0319, lng: -75.461 };

interface RouteClient {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
}

const MOCK_CLIENTS: RouteClient[] = [
  { id: '1', name: 'Depósitos El Porvenir', address: 'Calle 48 #22-35', city: 'Manizales', lat: 5.0695, lng: -75.5065 },
  { id: '2', name: 'Grescerámica S.A.S.', address: 'Cra 21 #73-21', city: 'Manizales', lat: 5.0665, lng: -75.4995 },
  { id: '3', name: 'Ferretería La Ye', address: 'Cra 22 No. 48C-06', city: 'Manizales', lat: 5.053, lng: -75.5095 },
];

// CARTO raster basemaps ahora exigen API key y muestran watermark; usamos OSM
// como alternativa libre sin clave para desarrollo/demostración.
// TODO(real-data): configurar tile provider propio o API key de CARTO en producción.
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function formatMoneyCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function RouteMap({ selected }: { selected: Record<string, boolean> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const [leaflet, setLeaflet] = useState<typeof Leaflet | null>(null);

  useEffect(() => {
    let mounted = true;
    import('leaflet').then((L) => {
      if (mounted) setLeaflet(L);
    });
    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!leaflet || !containerRef.current) return;

    const L = leaflet;
    const map = L.map(containerRef.current).setView([CURRENT_LOCATION.lat, CURRENT_LOCATION.lng], 13);
    mapRef.current = map;

    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIB, maxZoom: 19 }).addTo(map);

    // Leaflet necesita recalcular tamaño cuando se monta en un tab condicional.
    setTimeout(() => map.invalidateSize(), 80);

    const activeClients = MOCK_CLIENTS.filter((c) => selected[c.id]);
    const points = [CURRENT_LOCATION, ...activeClients];

    const currentIcon = L.divIcon({
      className: '',
      html: '<div class="route-marker-current"></div>',
      iconSize: [24, 24],
    });
    L.marker([CURRENT_LOCATION.lat, CURRENT_LOCATION.lng], { icon: currentIcon })
      .addTo(map)
      .bindTooltip(CURRENT_LOCATION.name, { direction: 'top' });

    activeClients.forEach((c) => {
      const icon = L.divIcon({
        className: '',
        html: '<div class="route-marker-client"></div>',
        iconSize: [24, 24],
      });
      L.marker([c.lat, c.lng], { icon })
        .addTo(map)
        .bindTooltip(`${c.name}<br>${c.address}`, { direction: 'top' });
    });

    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });

      const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
      fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`)
        .then((res) => res.json())
        .then((data) => {
          if (mapRef.current !== map) return;
          const geom = data?.routes?.[0]?.geometry?.coordinates;
          if (geom && Array.isArray(geom)) {
            const latlngs = geom.map((c: [number, number]) => [c[1], c[0]]);
            L.polyline(latlngs as Leaflet.LatLngExpression[], { color: '#1565C0', weight: 5, opacity: 0.85 }).addTo(map);
          } else {
            throw new Error('Sin geometría');
          }
        })
        .catch(() => {
          if (mapRef.current !== map) return;
          // Fallback: línea dashed entre los puntos
          L.polyline(
            points.map((p) => [p.lat, p.lng]) as Leaflet.LatLngExpression[],
            { color: '#1565C0', weight: 4, opacity: 0.7, dashArray: '8 8' }
          ).addTo(map);
        });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leaflet, selected]);

  return (
    <div
      ref={containerRef}
      className="route-map"
      aria-label="Mapa de rutas"
    />
  );
}

export function RoutesPage() {
  const [view, setView] = useState<'dashboard' | 'detail'>('dashboard');
  const [period, setPeriod] = useState<'Día' | 'Mes'>('Mes');
  const [tab, setTab] = useState<'Clientes' | 'Mapa'>('Clientes');
  // En el dashboard la salida es la ruta; en el detalle la vista ya tiene su
  // propio botón "volver" en el hero porque ese salto es interno (setView), no
  // una navegación de router, y no se puede expresar como destino de ruta.
  useBackTarget(view === 'dashboard' ? '/home' : null);
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MOCK_CLIENTS.map((c) => [c.id, true]))
  );

  const selectedCount = useMemo(() => MOCK_CLIENTS.filter((c) => selected[c.id]).length, [selected]);

  if (view === 'dashboard') {
    return (
      <div className="s2">
        <div className="s2-head">
          <h1 className="page-title">Rutero</h1>
        </div>

        <div className="s2-body routes-body">
          <div className="routes-kpi">
            {KPI.map((k) => (
              <div key={k.label} className={`routes-kpi-card ${k.span ? 'span-2' : ''}`}>
                <b>{k.value}</b>
                <span>{k.label}</span>
              </div>
            ))}
          </div>

          <div className="routes-segmented">
            {(['Día', 'Mes'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={p === period ? 'on' : ''}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="routes-resume">
            <div className="hsec">Resumen</div>
            {RESUME_BARS.map((b) => (
              <div key={b.label} className="routes-bar-row">
                <div className="routes-bar-label">
                  <span>{b.label}</span>
                  <b>{formatMoneyCompact(b.value)}</b>
                </div>
                <div className="routes-bar-track">
                  <div className="routes-bar-fill" style={{ width: `${b.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="routes-fab" onClick={() => setView('detail')}>
            Ver rutas y clientes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="s2 routes-page">
      <div className="s2-head">
        <div className="s2-top">
          <button type="button" className="cback" onClick={() => setView('dashboard')} aria-label="Volver">
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="org-chip"><span className="org-dot" />Rutero</div>
        </div>
        <h1 className="page-title">Rutas y clientes</h1>
      </div>

      <div className="s2-body routes-detail-body">
        <div className="routes-tabs">
          {(['Clientes', 'Mapa'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={t === tab ? 'on' : ''}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Clientes' && (
          <div className="routes-clients">
            {MOCK_CLIENTS.map((c) => (
              <div key={c.id} className="routes-client-card">
                <div className="routes-client-info">
                  <div className="routes-client-name">{c.name}</div>
                  <div className="routes-client-address">{c.address}, {c.city}</div>
                </div>
                <button
                  type="button"
                  className={`routes-toggle ${selected[c.id] ? 'on' : ''}`}
                  onClick={() => setSelected((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                  aria-label={selected[c.id] ? 'Desmarcar' : 'Marcar'}
                >
                  <span />
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'Mapa' && (
          <div className="routes-map-wrap">
            <RouteMap selected={selected} />
            <div className="routes-map-badge">{selectedCount} clientes en ruta</div>
          </div>
        )}
      </div>
    </div>
  );
}
