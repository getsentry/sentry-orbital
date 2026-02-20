import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Constants ────────────────────────────────────────────────────────────────

const GLOBE_RADIUS = 1;

// Sentry brand palette (hex → decimal for Three.js)
const SENTRY = {
  purpleDark:   0x36166b,
  purpleMid:    0x6e47ae,
  purpleDeep:   0x4d0a55,
  purpleBright: 0xa737b4,
  purpleNavy:   0x4e2a9a,
  violet:       0x7553ff,
  violetSoft:   0x9e86ff,
  bg:           0x181225,
  pink:         0xff45a8,
  pinkLight:    0xff70bc,
  orange:       0xee8019,
  orangeLight:  0xff9838,
  yellowGold:   0xfdb81b,
  yellow:       0xffd00e,
  green:        0x92dd00,
  greenLight:   0xc0ed49,
  blue:         0x226dfc,
  cyan:         0x3edcff,
  white:        0xf6f6f8,
};

const PLATFORM_COLORS = {
  error:       SENTRY.pink,        // #FF45A8 — most urgent
  span:        SENTRY.cyan,        // #3EDCFF — distributed tracing
  crash:       SENTRY.orangeLight, // #FF9838 — critical
  replay:      SENTRY.violetSoft,  // #9E86FF — session recording
  cron:        SENTRY.green,       // #92DD00 — scheduled jobs
  profile:     SENTRY.blue,        // #226DFC — deep diagnostics
};

const RING_DURATION  = 2200;
const DOT_DURATION   = 14000;
const DISPLAY_RATE   = 80;
const FEED_RATE      = 320;
const STATS_INTERVAL = 1000;
const MAX_FEED       = 14;

// Seer UFO
const UFO_ORBIT_RADIUS = 2.1;  // hover height (globe radius = 1)
const UFO_W = 0.52;            // sprite width in world units
const UFO_H = UFO_W * (566 / 496); // maintain 496×566 aspect ratio

// ── Renderer ─────────────────────────────────────────────────────────────────

const container = document.getElementById('globe-container');
const renderer  = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(SENTRY.bg);
container.appendChild(renderer.domElement);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.z = 2.8;

// ── Stars ────────────────────────────────────────────────────────────────────

{
  const count = 6000;
  const pos   = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 300;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.15, sizeAttenuation: true,
  })));
}

// ── Globe ────────────────────────────────────────────────────────────────────

const loader = new THREE.TextureLoader();

const globe = new THREE.Mesh(
  new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64),
  new THREE.MeshPhongMaterial({
    map:               loader.load('/static/map.png'),
    specular:          new THREE.Color(0x331144),
    shininess:         18,
    emissive:          new THREE.Color(SENTRY.purpleDeep),
    emissiveIntensity: 0.18,
  })
);
scene.add(globe);

// Occluder: back-facing sphere writes depth so markers on the far side
// are correctly hidden behind the globe.
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64),
  new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.BackSide })
));

// ── Atmosphere ───────────────────────────────────────────────────────────────

scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(GLOBE_RADIUS * 1.028, 64, 64),
  new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal   = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vec3  viewDir = normalize(-vPosition);
        float fresnel = 1.0 - max(dot(vNormal, viewDir), 0.0);
        fresnel = pow(fresnel, 3.5);
        // Inner: #7553FF (violet), outer edge: #FF45A8 (pink)
        vec3 innerColor = vec3(0.459, 0.325, 1.0);
        vec3 outerColor = vec3(1.0,   0.271, 0.659);
        vec3 atmColor   = mix(innerColor, outerColor, pow(fresnel, 2.0));
        gl_FragColor    = vec4(atmColor, fresnel * 0.65);
      }
    `,
    blending:    THREE.AdditiveBlending,
    transparent: true,
    depthWrite:  false,
    side:        THREE.FrontSide,
  })
));

// ── Lighting ─────────────────────────────────────────────────────────────────

scene.add(new THREE.AmbientLight(SENTRY.purpleNavy, 2.5));
const sun = new THREE.DirectionalLight(SENTRY.white, 2.8);
sun.position.set(5, 3, 5);
scene.add(sun);

// ── Controls ─────────────────────────────────────────────────────────────────

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping   = true;
controls.dampingFactor   = 0.05;
controls.enablePan       = false;
controls.minDistance     = 1.4;
controls.maxDistance     = 6;
controls.autoRotate      = true;
controls.autoRotateSpeed = 0.35;

let resumeTimer = null;
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  clearTimeout(resumeTimer);
});
controls.addEventListener('end', () => {
  resumeTimer = setTimeout(() => { controls.autoRotate = true; }, 3000);
});

// ── Coordinate helpers ────────────────────────────────────────────────────────

function latLngToVec3(lat, lng, r = GLOBE_RADIUS) {
  const phi   = (90 - lat)  * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

// ── Seer UFO ─────────────────────────────────────────────────────────────────
// Seer is Sentry's AI debugger. It orbits the globe and flies to each new
// error location, beaming down onto it.

const ufoTex = loader.load('/static/seer.png');
const ufoMat = new THREE.SpriteMaterial({
  map:         ufoTex,
  transparent: true,
  depthWrite:  false,
});
const ufo = new THREE.Sprite(ufoMat);
ufo.scale.set(UFO_W, UFO_H, 1);
scene.add(ufo);

// UFO state machine: hidden → fadein → hovering → fadeout → hidden
// Seer appears every 10s, hovers briefly, then fades away.
const UFO_CYCLE_MS  = 10000; // ms between appearances
const UFO_HOVER_MS  =  4000; // ms spent hovering
const UFO_FADE_MS   =  1200; // ms for fade in / fade out

let ufoState       = 'hidden'; // 'hidden' | 'fadein' | 'hovering' | 'fadeout'
let ufoStateStart  = 0;
let ufoNextAppear  = Date.now() + UFO_CYCLE_MS;
const ufoHoverPos  = new THREE.Vector3(UFO_ORBIT_RADIUS, 0.4, 0);
const _ufoNDC      = new THREE.Vector3();
const _globeNDC    = new THREE.Vector3(0, 0, 0);

// Start hidden
ufoMat.opacity = 0;

// Called with the latest error lat/lng so Seer appears above it
let lastErrorLat = 20, lastErrorLng = 0;
function recordError(lat, lng) {
  lastErrorLat = lat;
  lastErrorLng = lng;
}

// ── Markers ───────────────────────────────────────────────────────────────────

const markers = [];
const Z_AXIS  = new THREE.Vector3(0, 0, 1);

function addMarker(lat, lng, platform) {
  const color  = new THREE.Color(PLATFORM_COLORS[platform] ?? SENTRY.violetSoft);
  const pos    = latLngToVec3(lat, lng, GLOBE_RADIUS + 0.005);
  const normal = pos.clone().normalize();
  const quat   = new THREE.Quaternion().setFromUnitVectors(Z_AXIS, normal);
  const now    = Date.now();

  // Three staggered expanding ring waves
  for (let w = 0; w < 3; w++) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.003, 0.012, 48),
      new THREE.MeshBasicMaterial({
        color,
        side:        THREE.DoubleSide,
        transparent: true,
        opacity:     1,
        depthWrite:  false,
      })
    );
    mesh.position.copy(pos);
    mesh.quaternion.copy(quat);
    scene.add(mesh);
    markers.push({
      mesh,
      startTime: now + w * 300,
      duration:  RING_DURATION,
      maxScale:  11 + w * 2.5,
      isDot:     false,
    });
  }

  // Persistent glowing dot
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.007, 20),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity:     0.9,
      depthWrite:  false,
    })
  );
  dot.position.copy(pos);
  dot.quaternion.copy(quat);
  scene.add(dot);
  markers.push({
    mesh:      dot,
    startTime: now,
    duration:  DOT_DURATION,
    maxScale:  1,
    isDot:     true,
  });
}

// ── Stats & feed ──────────────────────────────────────────────────────────────

let totalEvents     = 0;
const eventTimestamps = [];
let lastDisplayTime = 0;
let lastStatsUpdate = 0;
let lastFeedUpdate  = 0;

const elRate   = document.getElementById('events-per-sec');
const elTotal  = document.getElementById('total-events');
const feedList = document.getElementById('feed-list');

function getRate() {
  const cutoff = Date.now() - 5000;
  while (eventTimestamps.length && eventTimestamps[0] < cutoff) eventTimestamps.shift();
  return (eventTimestamps.length / 5).toFixed(1);
}

function addFeedItem(platform, lat, lng) {
  const color  = '#' + (PLATFORM_COLORS[platform] ?? SENTRY.violetSoft).toString(16).padStart(6, '0');
  const latStr = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(1)}°${lng >= 0 ? 'E' : 'W'}`;
  
  const li = document.createElement('li');
  
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = color;
  
  const platformSpan = document.createElement('span');
  platformSpan.className = 'feed-platform';
  platformSpan.textContent = platform;
  
  const locationSpan = document.createElement('span');
  locationSpan.className = 'feed-location';
  locationSpan.textContent = `${latStr} ${lngStr}`;
  
  li.appendChild(dot);
  li.appendChild(platformSpan);
  li.appendChild(locationSpan);
  
  feedList.insertBefore(li, feedList.firstChild);
  while (feedList.children.length > MAX_FEED) feedList.removeChild(feedList.lastChild);
}

// ── SSE stream ────────────────────────────────────────────────────────────────

const source = new EventSource('/stream');

source.onmessage = (e) => {
  const [lat, lng, , platform] = JSON.parse(e.data);
  const now = Date.now();

  totalEvents++;
  eventTimestamps.push(now);

  if (now - lastDisplayTime >= DISPLAY_RATE) {
    lastDisplayTime = now;
    addMarker(lat, lng, platform);
    if (platform === 'error') {
      recordError(lat, lng);
    }
  }

  if (now - lastFeedUpdate >= FEED_RATE) {
    lastFeedUpdate = now;
    addFeedItem(platform, lat, lng);
  }
};

source.onerror = () => console.error('[Sentry Live] Stream disconnected');

// ── Platform legend ───────────────────────────────────────────────────────────

const legend = document.getElementById('platform-legend');
[...Object.entries(PLATFORM_COLORS), ['other', SENTRY.violetSoft]].forEach(([name, hex]) => {
  const color = '#' + hex.toString(16).padStart(6, '0');
  const el = document.createElement('div');
  el.className = 'legend-item';
  el.innerHTML = `<span class="dot" style="background:${color}"></span>${name}`;
  legend.appendChild(el);
});

// ── Resize ────────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Animation loop ────────────────────────────────────────────────────────────

function animate() {
  requestAnimationFrame(animate);

  const now = Date.now();

  // ── Seer UFO state machine ───────────────────────────────────
  if (ufoState === 'hidden') {
    if (now >= ufoNextAppear) {
      // Position Seer above the most recent error, slightly offset from globe
      const dir = latLngToVec3(lastErrorLat, lastErrorLng).normalize();
      ufoHoverPos.copy(dir).multiplyScalar(UFO_ORBIT_RADIUS);
      ufo.position.copy(ufoHoverPos);
      ufoState      = 'fadein';
      ufoStateStart = now;
    }
  } else if (ufoState === 'fadein') {
    const t = Math.min((now - ufoStateStart) / UFO_FADE_MS, 1);
    ufoMat.opacity = t;
    if (t >= 1) { ufoState = 'hovering'; ufoStateStart = now; }
  } else if (ufoState === 'hovering') {
    if (now - ufoStateStart >= UFO_HOVER_MS) {
      ufoState = 'fadeout'; ufoStateStart = now;
    }
  } else if (ufoState === 'fadeout') {
    const t = Math.min((now - ufoStateStart) / UFO_FADE_MS, 1);
    ufoMat.opacity = 1 - t;
    if (t >= 1) {
      ufoState      = 'hidden';
      ufoMat.opacity = 0;
      ufoNextAppear  = now + UFO_CYCLE_MS;
    }
  }

  // Gentle float when visible — very slow sine bob along the hover direction
  if (ufoState !== 'hidden') {
    const bob = Math.sin(now * 0.0004) * 0.05;
    ufo.position.copy(ufoHoverPos).addScaledVector(ufoHoverPos.clone().normalize(), bob);
  }

  // Rotate sprite so the tractor beam aims at the globe center
  _ufoNDC.copy(ufo.position).project(camera);
  _globeNDC.set(0, 0, 0).project(camera);
  const dx = _globeNDC.x - _ufoNDC.x;
  const dy = _globeNDC.y - _ufoNDC.y;
  ufoMat.rotation = Math.atan2(dx, -dy);

  // ── Markers ─────────────────────────────────────────────────
  for (let i = markers.length - 1; i >= 0; i--) {
    const m = markers[i];
    if (now < m.startTime) continue;

    const progress = (now - m.startTime) / m.duration;

    if (progress >= 1) {
      scene.remove(m.mesh);
      m.mesh.geometry.dispose();
      m.mesh.material.dispose();
      markers.splice(i, 1);
      continue;
    }

    if (m.isDot) {
      m.mesh.material.opacity = 0.9 * (1 - Math.pow(progress, 1.8));
    } else {
      const ease = 1 - Math.pow(1 - progress, 2.5);
      m.mesh.scale.setScalar(ease * m.maxScale);
      m.mesh.material.opacity = (1 - progress) * 0.8;
    }
  }

  // ── Stats ────────────────────────────────────────────────────
  if (now - lastStatsUpdate >= STATS_INTERVAL) {
    lastStatsUpdate     = now;
    elRate.textContent  = getRate();
    elTotal.textContent = totalEvents.toLocaleString();
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
