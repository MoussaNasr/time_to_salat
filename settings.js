import { Methods } from './prayerTimes.js';

const METHOD_KEY = 'tts:method';
const COORDS_KEY = 'tts:coords';

function getStoredMethod() { return localStorage.getItem(METHOD_KEY) || 'MWL'; }
function getStoredCoords() {
  const raw = localStorage.getItem(COORDS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function populate() {
  const methodSel = document.getElementById('method');
  const latEl = document.getElementById('lat');
  const lonEl = document.getElementById('lon');

  // Populate methods
  methodSel.innerHTML = '';
  Object.entries(Methods).forEach(([key, m]) => {
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = m.name;
    methodSel.appendChild(opt);
  });

  methodSel.value = getStoredMethod();

  const coords = getStoredCoords();
  if (coords) { latEl.value = coords.lat; lonEl.value = coords.lon; }
}

function wire() {
  const saveBtn = document.getElementById('save');
  const locBtn = document.getElementById('useLocation');
  const methodSel = document.getElementById('method');
  const latEl = document.getElementById('lat');
  const lonEl = document.getElementById('lon');

  saveBtn.addEventListener('click', () => {
    localStorage.setItem(METHOD_KEY, methodSel.value);
    const lat = parseFloat(latEl.value);
    const lon = parseFloat(lonEl.value);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lon }));
    }
    window.location.href = './index.html';
  });

  locBtn.addEventListener('click', () => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      latEl.value = latitude.toFixed(6);
      lonEl.value = longitude.toFixed(6);
    });
  });
}

populate();
wire();
