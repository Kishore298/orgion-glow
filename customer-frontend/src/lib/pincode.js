const CACHE_STORAGE_KEY = 'orgion_pincode_cache_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const memoryCache = new Map();

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

function normalizeIndianState(raw) {
  const cleaned = String(raw || '').trim();
  if (!cleaned) return '';
  const lower = cleaned.toLowerCase();
  if (lower === 'pondicherry') return 'Puducherry';
  const matched = INDIAN_STATES.find((s) => s.toLowerCase() === lower);
  return matched || cleaned;
}

function readPersistentCache() {
  try {
    if (typeof window === 'undefined') return {};
    return JSON.parse(localStorage.getItem(CACHE_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writePersistentCache(mapObj) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(mapObj));
  } catch {
    // ignore quota errors
  }
}

export async function lookupIndianPincode(pincode) {
  const cleanPin = String(pincode || '').trim();
  if (!/^[1-9]\d{5}$/.test(cleanPin)) {
    return { ok: false };
  }

  const now = Date.now();
  const mem = memoryCache.get(cleanPin);
  if (mem && now - mem.ts < CACHE_TTL_MS) {
    return { ok: true, city: mem.city, state: mem.state, fromCache: true };
  }

  const disk = readPersistentCache();
  const cachedDisk = disk[cleanPin];
  if (cachedDisk && now - cachedDisk.ts < CACHE_TTL_MS && cachedDisk.state) {
    memoryCache.set(cleanPin, cachedDisk);
    return { ok: true, city: cachedDisk.city, state: cachedDisk.state, fromCache: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const resp = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`, {
      signal: controller.signal,
    });
    if (!resp.ok) return { ok: false };
    const data = await resp.json();
    const postOffice = data?.[0]?.PostOffice?.[0];
    if (!postOffice?.State) return { ok: false };

    const entry = {
      city: String(postOffice.District || postOffice.Division || '').trim(),
      state: normalizeIndianState(postOffice.State),
      ts: now,
    };
    memoryCache.set(cleanPin, entry);
    disk[cleanPin] = entry;
    // Keep cache compact
    const keys = Object.keys(disk);
    if (keys.length > 200) {
      delete disk[keys[0]];
    }
    writePersistentCache(disk);
    return { ok: true, city: entry.city, state: entry.state, fromCache: false };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}
