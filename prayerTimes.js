// Minimal prayer times calculator (approximate) with multiple methods
// Uses simplified solar position formulas sufficient for daily schedules.
// Methods supported: MWL, UmmAlQura, Egypt, Karachi, ISNA

export const Methods = {
  MWL: { name: 'Muslim World League', fajrAngle: 18, isha: { type: 'angle', value: 17 } },
  UmmAlQura: { name: 'Umm al-Qura, Makkah', fajrAngle: 18.5, isha: { type: 'interval', value: 90 } },
  Egypt: { name: 'Egyptian General Authority', fajrAngle: 19.5, isha: { type: 'angle', value: 17.5 } },
  Karachi: { name: 'Uni. of Islamic Sciences, Karachi', fajrAngle: 18, isha: { type: 'angle', value: 18 } },
  ISNA: { name: 'Islamic Society of North America', fajrAngle: 15, isha: { type: 'angle', value: 15 } },
};

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function toHoursMinutes(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function equationOfTimeMinutes(N) {
  // Approximate equation of time in minutes
  const B = 2 * Math.PI * (N - 81) / 364;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

function solarDeclinationRad(N) {
  // Approximate declination in radians
  const deg = 23.45 * Math.sin((2 * Math.PI / 365) * (284 + N));
  return deg * DEG2RAD;
}

function hourAngleForAltitude(latRad, decRad, altRad) {
  // cos(H) = (sin(h) - sin(phi) sin(dec)) / (cos(phi) cos(dec))
  const cosH = (Math.sin(altRad) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad));
  const c = clamp(cosH, -1, 1);
  return Math.acos(c); // radians, positive
}

function solarNoonLocalHours(date, longitude) {
  // Local solar noon in local clock hours
  const N = dayOfYear(date);
  const tz = -date.getTimezoneOffset() / 60; // hours east of UTC
  const eot = equationOfTimeMinutes(N);
  // 12:00 local + (longitude/15) adjustment inverted + EOT correction
  // Standard: solarNoon = 12 + tz - (longitude/15) - EOT/60
  return 12 + tz - (longitude / 15) - (eot / 60);
}

function timeFromNoon(date, noonHours, deltaHours) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const ms = (noonHours + deltaHours) * 3600 * 1000;
  return new Date(d.getTime() + ms);
}

function computeDayTimes(date, lat, lon, methodKey = 'MWL', asrFactor = 1) {
  const method = Methods[methodKey] || Methods.MWL;
  const latRad = lat * DEG2RAD;
  const N = dayOfYear(date);
  const dec = solarDeclinationRad(N);
  const noon = solarNoonLocalHours(date, lon);

  // Altitudes (radians)
  const altSunrise = (-0.833) * DEG2RAD; // includes refraction & radius
  const altFajr = (-method.fajrAngle) * DEG2RAD;

  // Hour angles
  const H_sunrise = hourAngleForAltitude(latRad, dec, altSunrise); // radians
  const H_fajr = hourAngleForAltitude(latRad, dec, altFajr);

  // Sunrise/Sunset times
  const sunrise = timeFromNoon(date, noon, -(H_sunrise * RAD2DEG) / 15);
  const sunset = timeFromNoon(date, noon, +(H_sunrise * RAD2DEG) / 15);

  // Fajr
  const fajr = timeFromNoon(date, noon, -(H_fajr * RAD2DEG) / 15);

  // Isha (angle or interval)
  let isha;
  if (method.isha.type === 'angle') {
    const altIsha = (-method.isha.value) * DEG2RAD;
    const H_isha = hourAngleForAltitude(latRad, dec, altIsha);
    isha = timeFromNoon(date, noon, +(H_isha * RAD2DEG) / 15);
  } else {
    // interval in minutes after Maghrib
    isha = new Date(sunset.getTime() + method.isha.value * 60 * 1000);
  }

  // Dhuhr ~ solar noon
  const dhuhr = timeFromNoon(date, noon, 0);

  // Asr: shadow length factor n = 1 (Shafi) or 2 (Hanafi)
  const n = asrFactor;
  const angle = Math.atan(1 / (n + Math.tan(Math.abs(latRad - dec)))); // altitude
  const H_asr = hourAngleForAltitude(latRad, dec, angle);
  const asr = timeFromNoon(date, noon, +(H_asr * RAD2DEG) / 15);

  const maghrib = sunset;

  return { fajr, sunrise, dhuhr, asr, maghrib, isha };
}

export function getPrayerTimes(date, lat, lon, methodKey) {
  return computeDayTimes(date, lat, lon, methodKey);
}

export function getNextPrayer(now, times) {
  const order = [
    ['Fajr', times.fajr],
    ['Shuruk', times.sunrise],
    ['Dhuhr', times.dhuhr],
    ['Asr', times.asr],
    ['Maghrib', times.maghrib],
    ['Isha', times.isha],
  ];
  for (const [name, t] of order) {
    if (now < t) return { name, time: t };
  }
  // Next is tomorrow's Fajr
  return { name: 'Fajr', time: null, nextDay: true };
}

export function pad(n) { return String(n).padStart(2, '0'); }

export function formatHM(date) { return toHoursMinutes(date); }

export const PrayerOrder = ['Fajr','Shuruk','Dhuhr','Asr','Maghrib','Isha'];

export function getIntervalForPrayer(now, todayTimes, tomorrowTimes, nextName) {
  // Returns [startDate, endDate] for the interval that leads up to nextName
  const mapToday = {
  Fajr: todayTimes.fajr, Shuruk: todayTimes.sunrise, Dhuhr: todayTimes.dhuhr, Asr: todayTimes.asr,
  Maghrib: todayTimes.maghrib, Isha: todayTimes.isha,
  };
  const mapTomorrow = {
  Fajr: tomorrowTimes?.fajr, Shuruk: tomorrowTimes?.sunrise, Dhuhr: tomorrowTimes?.dhuhr, Asr: tomorrowTimes?.asr,
  Maghrib: tomorrowTimes?.maghrib, Isha: tomorrowTimes?.isha,
  };
  const idx = PrayerOrder.indexOf(nextName);
  const prevName = PrayerOrder[(idx - 1 + PrayerOrder.length) % PrayerOrder.length];
  let start = mapToday[prevName];
  let end = mapToday[nextName];
  if (!end) end = mapTomorrow[nextName];
  // For Fajr next, previous is Isha (previous day)
  if (nextName === 'Fajr') {
    start = mapToday.Isha; // today’s Isha leading to tomorrow’s Fajr
  }
  return [start, end];
}
