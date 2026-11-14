// Dotted globe centred over the Indian Ocean, with arcs flying out from Sri Lanka.
// Pure SVG, computed at render time (orthographic projection).
const R = 200, CX = 220, CY = 220;
const LAT0 = 12 * Math.PI / 180, LON0 = 62 * Math.PI / 180;

function project(lat, lon) {
  const p = lat * Math.PI / 180, l = lon * Math.PI / 180;
  const cosc = Math.sin(LAT0) * Math.sin(p) + Math.cos(LAT0) * Math.cos(p) * Math.cos(l - LON0);
  const x = R * Math.cos(p) * Math.sin(l - LON0);
  const y = R * (Math.cos(LAT0) * Math.sin(p) - Math.sin(LAT0) * Math.cos(p) * Math.cos(l - LON0));
  return { x: CX + x, y: CY - y, front: cosc };
}

const HOME = { name: 'Colombo', lat: 6.9, lon: 79.9 };
export const PLACES = [
  { name: 'London', lat: 51.5, lon: -0.1 },
  { name: 'Dubai', lat: 25.2, lon: 55.3 },
  { name: 'Singapore', lat: 1.3, lon: 103.8 },
  { name: 'Melbourne', lat: -37.8, lon: 145 },
  { name: 'Tokyo', lat: 35.7, lon: 139.7 },
  { name: 'Nairobi', lat: -1.3, lon: 36.8 },
];

function dots() {
  const out = [];
  for (let lat = -84; lat <= 84; lat += 6) {
    const ring = Math.max(1, Math.round(60 * Math.cos(lat * Math.PI / 180)));
    for (let i = 0; i < ring; i++) {
      const lon = -180 + (360 / ring) * i + (lat % 12 ? 3 : 0);
      const d = project(lat, lon);
      if (d.front > 0.04) out.push(d);
    }
  }
  return out;
}

function arc(a, b) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = mx - CX, dy = my - CY, len = Math.hypot(dx, dy) || 1;
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const lift = 30 + dist * 0.35;
  const cx = mx + (dx / len) * lift, cy = my + (dy / len) * lift - dist * 0.12;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export default function Globe() {
  const pts = dots();
  const home = project(HOME.lat, HOME.lon);
  return (
    <svg className="lp-globe" viewBox="0 0 440 440" role="img" aria-label="A dotted globe with arcs from Sri Lanka to cities around the world">
      <defs>
        <radialGradient id="gl-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={R + 14} fill="url(#gl-glow)" />
      <circle cx={CX} cy={CY} r={R} className="gl-edge" />
      <g className="gl-dots">
        {pts.map((d, i) => <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={1.3 + d.front * 0.7} opacity={(0.18 + d.front * 0.62).toFixed(2)} />)}
      </g>
      <g className="gl-arcs">
        {PLACES.map((p, i) => {
          const b = project(p.lat, p.lon);
          const d = arc(home, b);
          return (
            <g key={p.name} style={{ '--i': i }}>
              <path d={d} pathLength="1" className="gl-arc" />
              <circle r="3.2" className="gl-pulse">
                <animateMotion dur={`${3.2 + i * 0.4}s`} begin={`${i * 0.5}s`} repeatCount="indefinite" path={d} />
              </circle>
              <circle cx={b.x.toFixed(1)} cy={b.y.toFixed(1)} r="3.6" className="gl-city" />
            </g>
          );
        })}
      </g>
      <circle cx={home.x.toFixed(1)} cy={home.y.toFixed(1)} r="11" className="gl-home-ring" />
      <circle cx={home.x.toFixed(1)} cy={home.y.toFixed(1)} r="5" className="gl-home" />
    </svg>
  );
}
