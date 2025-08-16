import { Methods, getPrayerTimes, getNextPrayer, pad, formatHM, getIntervalForPrayer } from './prayerTimes.js';

const METHOD_KEY = 'tts:method';
const COORDS_KEY = 'tts:coords';
let wakeLockObj = null;

function getStoredMethod() {
  return localStorage.getItem(METHOD_KEY) || 'MWL';
}

function getStoredCoords() {
  const raw = localStorage.getItem(COORDS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function requestLocation() {
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        localStorage.setItem(COORDS_KEY, JSON.stringify({ lat: latitude, lon: longitude }));
        resolve({ lat: latitude, lon: longitude });
      },
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 10 * 60 * 1000, timeout: 10000 }
    );
  });
}

async function ensureWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLockObj = await navigator.wakeLock.request('screen');
      wakeLockObj.addEventListener('release', () => { wakeLockObj = null; });
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && !wakeLockObj) {
          try { wakeLockObj = await navigator.wakeLock.request('screen'); } catch {}
        }
      });
    }
  } catch {}
}

function msToHM(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${pad(h)}:${pad(m)}`;
}
function secondsPart(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const s = total % 60;
  return `:${pad(s)}`;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(24,0,0,0);
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  return d;
}

function tomorrow(date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

function render(prayerName, targetTime, msLeft, interval) {
  const nameEl = document.getElementById('prayerName');
  const hmEl = document.getElementById('hm');
  const secEl = document.getElementById('sec');
  const nextEl = document.getElementById('nextTime');
  const bar = document.getElementById('progressBar');

  nameEl.textContent = prayerName ? `Next: ${prayerName}` : '—';
  hmEl.textContent = msToHM(msLeft);
  const showSeconds = msLeft <= 60 * 1000;
  if (showSeconds) {
    secEl.style.display = 'inline';
    secEl.textContent = secondsPart(msLeft);
  } else {
    secEl.style.display = 'none';
  }
  nextEl.textContent = targetTime ? `at ${formatHM(targetTime)}` : '—';

  // Progress bar from start->end
  if (interval && interval[0] && interval[1]) {
    const [start, end] = interval;
    const total = end - start;
    const done = Date.now() - start.getTime();
    const p = Math.max(0, Math.min(1, done / total));
    bar.style.setProperty('--p', `${(p * 100).toFixed(2)}%`);
  } else {
    bar.style.setProperty('--p', '0%');
  }
}

function findNext(now, coords, method) {
  const timesToday = getPrayerTimes(now, coords.lat, coords.lon, method);
  let next = getNextPrayer(now, timesToday);
  let target = next.time;
  if (next.nextDay || !target) {
    const tmr = tomorrow(now);
    const timesTomorrow = getPrayerTimes(tmr, coords.lat, coords.lon, method);
    next = { name: 'Fajr', time: timesTomorrow.fajr };
    target = timesTomorrow.fajr;
  }
  return { next, target };
}

async function boot() {
  const method = getStoredMethod();
  let coords = getStoredCoords();
  if (!coords) {
    coords = await requestLocation();
  }
  if (!coords) {
    // Fallback: Mecca coords
    coords = { lat: 21.3891, lon: 39.8579 };
  }

  await ensureWakeLock();

  function tick() {
    const now = new Date();
    const timesToday = getPrayerTimes(now, coords.lat, coords.lon, method);
    let nextObj = getNextPrayer(now, timesToday);
    let next = nextObj;
    let target = next.time;
    let timesTomorrow = null;
    if (next.nextDay || !target) {
      const tmr = tomorrow(now);
      timesTomorrow = getPrayerTimes(tmr, coords.lat, coords.lon, method);
      target = timesTomorrow.fajr;
      next = { name: 'Fajr', time: target };
    }
    const diff = target - now;
    const interval = getIntervalForPrayer(now, timesToday, timesTomorrow, next.name);
    render(next.name, target, diff, interval);
  }

  tick();
  setInterval(tick, 1000);
}

// Start
boot();
