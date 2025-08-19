import { Methods, getPrayerTimes, getNextPrayer, pad, formatHM, getIntervalForPrayer } from './prayerTimes.js';

const METHOD_KEY = 'tts:method';
const COORDS_KEY = 'tts:coords';
const FONT_KEY = 'tts:fontStyle';
let wakeLockObj = null;

function swapBgFg(durationMs = 1000) {
  try {
    const root = document.documentElement;
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim() || '#000';
    const fg = getComputedStyle(root).getPropertyValue('--fg').trim() || '#fff';
    root.style.setProperty('--bg', fg);
    root.style.setProperty('--fg', bg);
    setTimeout(() => {
      root.style.setProperty('--bg', bg);
      root.style.setProperty('--fg', fg);
    }, durationMs);
  } catch (e) {}
}

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
  // If <= 1 minute left, display MM:SS in the main large element (seconds same size)
  if (msLeft <= 60 * 1000) {
    const total = Math.max(0, Math.floor(msLeft / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    hmEl.textContent = `${pad(m)}:${pad(s)}`;
    secEl.style.display = 'none';
  } else {
    hmEl.textContent = msToHM(msLeft);
    secEl.style.display = 'none';
  }
  nextEl.textContent = targetTime ? `at ${formatHM(targetTime)}` : '—';

  // Progress bar from start->end
  if (interval && interval[0] && interval[1]) {
    const [start, end] = interval;
    const total = end.getTime() - start.getTime();
    if (total <= 0) {
      bar.style.setProperty('--p', '0%');
    } else {
      const done = Date.now() - start.getTime();
      const p = Math.max(0, Math.min(1, done / total));
      bar.style.setProperty('--p', `${(p * 100).toFixed(2)}%`);
    }
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
  // Apply font choice early
  (function() {
    const val = localStorage.getItem(FONT_KEY) || 'mono';
    const root = document.documentElement;
  const mono = "ClockMono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  const digital = "'Orbitron', ui-sans-serif, system-ui, sans-serif";
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const serif = "Georgia, 'Times New Roman', Times, serif";
  let fam = mono;
  if (val === 'digital') fam = digital;
  if (val === 'sans') fam = sans;
  if (val === 'serif') fam = serif;
    root.style.setProperty('--font-body', fam);
    root.style.setProperty('--font-clock', fam);
  })();
  // Apply stored background color
  (function(){
    try {
      const bg = localStorage.getItem('tts:bgColor');
      if (bg) {
        const fg = (function(hex){
          const c = hex.replace('#','');
          const r = parseInt(c.substring(0,2),16);
          const g = parseInt(c.substring(2,4),16);
          const b = parseInt(c.substring(4,6),16);
          const yiq = (r*299 + g*587 + b*114)/1000;
          return (yiq >= 128) ? '#000' : '#fff';
        })(bg);
        document.documentElement.style.setProperty('--bg', bg);
        document.documentElement.style.setProperty('--fg', fg);
      }
    } catch(e){}
  })();
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

  // Notification scheduling
  let notifyTimer = null;
  async function scheduleNotification(nextName, target) {
    // Clear previous
    if (notifyTimer) { clearTimeout(notifyTimer); notifyTimer = null; }
    try {
      const enabled = localStorage.getItem('tts:notify') === '1';
      const minBefore = parseInt(localStorage.getItem('tts:notifyMin') || '10', 10);
      if (!enabled || isNaN(minBefore) || minBefore < 0) return;
      const notifyAt = new Date(target.getTime() - minBefore * 60 * 1000);
      const now = new Date();
      const ms = notifyAt.getTime() - now.getTime();
      if (ms <= 0) return; // in the past
      // Message service worker to permission-check registration
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        notifyTimer = setTimeout(() => {
          navigator.serviceWorker.controller.postMessage({ type: 'show-notification', title: `Upcoming: ${nextName}`, body: `in ${minBefore} minutes` });
        }, ms);
      } else {
        // fallback to Notification API if SW not active
        notifyTimer = setTimeout(() => {
          if (Notification.permission === 'granted') {
            new Notification(`Upcoming: ${nextName}`, { body: `in ${minBefore} minutes` });
          }
        }, ms);
      }
    } catch (e) {}
  }

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
    let interval;
    if (next.name === 'Fajr') {
      // If the target Fajr is on the next day, use yesterday's Isha as the interval start.
      const isNextDay = (target.getDate() !== now.getDate() || target.getMonth() !== now.getMonth() || target.getFullYear() !== now.getFullYear());
      if (isNextDay) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const timesYesterday = getPrayerTimes(yesterday, coords.lat, coords.lon, method);
        interval = [timesYesterday.isha, target];
      } else {
        interval = getIntervalForPrayer(now, timesToday, timesTomorrow, next.name);
      }
    } else {
      interval = getIntervalForPrayer(now, timesToday, timesTomorrow, next.name);
    }
    render(next.name, target, diff, interval);
  // schedule notification for this next prayer
  scheduleNotification(next.name, target);
    // blink 10 minutes before (one-shot per target)
    try {
      const blinkMin = 10;
      const nowMs = Date.now();
      const blinkAt = target.getTime() - blinkMin * 60 * 1000;
      if (!window._ttsLastBlinkTarget) window._ttsLastBlinkTarget = 0;
      const doBlink = () => {
        if (window._ttsLastBlinkTarget === target.getTime()) return;
        window._ttsLastBlinkTarget = target.getTime();
        swapBgFg(1000);
      };
      if (blinkAt > nowMs && blinkAt - nowMs < 1000*1.1) {
        doBlink();
      } else if (blinkAt <= nowMs && nowMs - blinkAt < 1000*60) {
        doBlink();
      }
    } catch (e) {}
  }

  tick();
  setInterval(tick, 1000);
}

// Start
boot();
