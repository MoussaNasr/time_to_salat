import { Methods } from './prayerTimes.js';

const METHOD_KEY = 'tts:method';
const COORDS_KEY = 'tts:coords';
const FONT_KEY = 'tts:fontStyle';
const NOTIFY_KEY = 'tts:notify';
const NOTIFY_MIN_KEY = 'tts:notifyMin';

function getStoredMethod() { return localStorage.getItem(METHOD_KEY) || 'MWL'; }
function getStoredCoords() {
  const raw = localStorage.getItem(COORDS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function populate() {
  const methodSel = document.getElementById('method');
  const fontSel = document.getElementById('fontStyle');
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
  fontSel.value = localStorage.getItem(FONT_KEY) || 'mono';

  const coords = getStoredCoords();
  if (coords) { latEl.value = coords.lat; lonEl.value = coords.lon; }
}

function wire() {
  const saveBtn = document.getElementById('save');
  const notifyEl = document.getElementById('notifyEnable');
  const notifyMinEl = document.getElementById('notifyMinutes');
  const locBtn = document.getElementById('useLocation');
  const methodSel = document.getElementById('method');
  const fontSel = document.getElementById('fontStyle');
  const latEl = document.getElementById('lat');
  const lonEl = document.getElementById('lon');
  const cityEl = document.getElementById('city');
  const findBtn = document.getElementById('findCity');
  const cityStatus = document.getElementById('cityStatus');

  saveBtn.addEventListener('click', () => {
    localStorage.setItem(METHOD_KEY, methodSel.value);
  localStorage.setItem(FONT_KEY, fontSel.value);
    localStorage.setItem(NOTIFY_KEY, notifyEl.checked ? '1' : '0');
    localStorage.setItem(NOTIFY_MIN_KEY, String(parseInt(notifyMinEl.value || '0', 10)));
    const lat = parseFloat(latEl.value);
    const lon = parseFloat(lonEl.value);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lon }));
    }
    window.location.href = './index.html';
  });

  // Populate notification controls
  const notifyStored = localStorage.getItem(NOTIFY_KEY) === '1';
  notifyEl.checked = notifyStored;
  notifyMinEl.value = localStorage.getItem(NOTIFY_MIN_KEY) || '10';

  notifyEl.addEventListener('change', async () => {
    if (notifyEl.checked) {
      if (!('Notification' in window)) { alert('Notifications not supported in this browser'); notifyEl.checked = false; return; }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { alert('Notification permission denied'); notifyEl.checked = false; }
    }
  });

  locBtn.addEventListener('click', () => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      latEl.value = latitude.toFixed(6);
      lonEl.value = longitude.toFixed(6);
    });
  });

  findBtn.addEventListener('click', async () => {
    const q = cityEl.value && cityEl.value.trim();
    if (!q) { cityStatus.textContent = 'Type a city name first.'; return; }
    cityStatus.textContent = 'Searching...';
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'time-to-salat/1.0 (your-email@example.com)' } });
      const data = await res.json();
      if (data && data.length) {
        const place = data[0];
        latEl.value = parseFloat(place.lat).toFixed(6);
        lonEl.value = parseFloat(place.lon).toFixed(6);
        cityStatus.textContent = `Found: ${place.display_name}`;
      } else {
        cityStatus.textContent = 'No results found.';
      }
    } catch (err) {
      cityStatus.textContent = 'Lookup failed.';
    }
  });
}

// Apply font CSS vars immediately on settings page
function applyFontStyle(value) {
  const root = document.documentElement;
  const mono = "ClockMono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  const digital = "'Orbitron', ui-sans-serif, system-ui, sans-serif";
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const serif = "Georgia, 'Times New Roman', Times, serif";
  let fam = mono;
  if (value === 'sans') fam = sans;
  if (value === 'serif') fam = serif;
  root.style.setProperty('--font-body', fam);
  root.style.setProperty('--font-clock', fam);
}

applyFontStyle(localStorage.getItem(FONT_KEY) || 'mono');

populate();
wire();
