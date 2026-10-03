// site/src/lib/live.ts — T7: lógica del indicador "EN VIVO" de YouTube.
//
// LiveBadge.astro monta el markup oculto por defecto; este módulo (bundled
// por Vite hacia dist/_astro/*.js) decide cuándo mostrarlo. Sin
// `PUBLIC_YOUTUBE_API_KEY` en el build no se hace NINGUNA petición: el badge
// permanece oculto y la página no paga coste de runtime.
//
// Cuota YouTube Data API v3 (gratis: 10.000 unidades/día):
//   search.list   → 100 unidades por llamada
//   channels.list →   1 unidad  por llamada (channelId cacheado 24 h en
//                     localStorage; la búsqueda es la llamada cara)
//   300 s → 288 búsquedas/día = 28.800 u → fuera de cuota
//   900 s →  96 búsquedas/día =  9.600 u → dentro de cuota
// El intervalo llega como atributo data-check-interval-seconds, inlineado en
// build desde content/settings/site.json (generado por
// scripts/import-settings.ts — nunca se edita el JSON a mano).

/** Coste en unidades de search.list (YouTube Data API v3). */
export const LIVE_SEARCH_COST_UNITS = 100;
/** Coste en unidades de channels.list (YouTube Data API v3). */
export const CHANNEL_LOOKUP_COST_UNITS = 1;
/** Cuota diaria gratis de YouTube Data API v3. */
export const DAILY_QUOTA_UNITS = 10_000;
/** Intervalo por defecto (y fallback) en segundos: 900 s = 96 búsquedas/día. */
export const LIVE_CHECK_INTERVAL_SECONDS = 900;
/** TTL del caché de channelId en localStorage: 24 h. */
export const CHANNEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Clave localStorage del caché de channelId (solo channelId + timestamp). */
export const CHANNEL_CACHE_KEY = 'prixline:live:channelId';

/** Lógica pura: ¿la respuesta de search.list indica "en vivo"? */
export function shouldShowLive(items: unknown): boolean {
  return Array.isArray(items) && items.length > 0;
}

/** Lógica pura: intervalo saneado desde el atributo data-* inlineado. */
export function resolveCheckIntervalSeconds(
  raw: unknown,
  fallback: number = LIVE_CHECK_INTERVAL_SECONDS,
): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Lógica pura: búsquedas search.list por día a un intervalo dado. */
export function searchesPerDay(intervalSeconds: number): number {
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.floor(86_400 / intervalSeconds);
}

/** Lógica pura: unidades diarias consumidas por search.list a un intervalo. */
export function dailySearchCostUnits(intervalSeconds: number): number {
  return searchesPerDay(intervalSeconds) * LIVE_SEARCH_COST_UNITS;
}

/** Lógica pura: ¿el intervalo cabe en la cuota diaria de 10.000 unidades? */
export function isWithinDailyQuota(intervalSeconds: number): boolean {
  return dailySearchCostUnits(intervalSeconds) <= DAILY_QUOTA_UNITS;
}

/** Lógica pura: ¿hay una clave pública configurada para el build? */
export function liveConfigEnabled(apiKey: unknown): boolean {
  return typeof apiKey === 'string' && apiKey.trim().length > 0;
}

/** Lógica pura: ¿la entrada del caché de channelId sigue vigente (TTL 24 h)? */
export function isChannelCacheFresh(entry: unknown, now: number = Date.now()): boolean {
  if (typeof entry !== 'object' || entry === null) return false;
  const { channelId, fetchedAt } = entry as { channelId?: unknown; fetchedAt?: unknown };
  return (
    typeof channelId === 'string' &&
    channelId.length > 0 &&
    typeof fetchedAt === 'number' &&
    Number.isFinite(fetchedAt) &&
    fetchedAt <= now &&
    now - fetchedAt < CHANNEL_CACHE_TTL_MS
  );
}

interface ChannelCacheEntry {
  channelId: string;
  fetchedAt: number;
}

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// --- Caché localStorage (solo channelId + timestamp; nada sensible) --------

function readChannelCache(): ChannelCacheEntry | null {
  try {
    const raw = localStorage.getItem(CHANNEL_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isChannelCacheFresh(parsed) ? (parsed as ChannelCacheEntry) : null;
  } catch {
    return null; // localStorage bloqueado o JSON corrupto → tratar como miss
  }
}

function writeChannelCache(channelId: string): void {
  try {
    const entry: ChannelCacheEntry = { channelId, fetchedAt: Date.now() };
    localStorage.setItem(CHANNEL_CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* almacenamiento no disponible: se re-resolverá cada vez (1 u/llamada) */
  }
}

// --- Resolución y polling ---------------------------------------------------

/** channels.list?forHandle= → channelId (1 unidad; cacheado 24 h). */
async function resolveChannelId(
  handle: string,
  apiKey: string,
  fetchFn: typeof fetch,
  signal: AbortSignal,
): Promise<string | null> {
  const cached = readChannelCache();
  if (cached) return cached.channelId;
  const url =
    `${YOUTUBE_API_BASE}/channels?part=id&forHandle=${encodeURIComponent(handle)}` +
    `&key=${encodeURIComponent(apiKey)}`;
  const res = await fetchFn(url, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: Array<{ id?: unknown }> };
  const channelId = data.items?.[0]?.id;
  if (typeof channelId !== 'string' || channelId.length === 0) return null;
  writeChannelCache(channelId);
  return channelId;
}

/** search.list?eventType=live → ¿el canal está emitiendo? (100 unidades). */
async function pollIsLive(
  channelId: string,
  apiKey: string,
  fetchFn: typeof fetch,
  signal: AbortSignal,
): Promise<boolean> {
  const url =
    `${YOUTUBE_API_BASE}/search?part=snippet&eventType=live&type=video` +
    `&channelId=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetchFn(url, { signal });
  if (!res.ok) return false; // error API → badge oculto (nunca romper la página)
  const data = (await res.json()) as { items?: unknown };
  return shouldShowLive(data.items);
}

export interface InitLiveBadgeOptions {
  /** Clave pública inlined por Vite desde PUBLIC_YOUTUBE_API_KEY. */
  apiKey?: string | undefined;
  /** Inyección para tests; por defecto fetch del navegador. */
  fetchFn?: typeof fetch | undefined;
}

/**
 * Arranca el indicador sobre el nodo [data-live-badge] de LiveBadge.astro.
 * Sin clave configurada no hace absolutamente nada (cero fetch, badge oculto).
 */
export function initLiveBadge(root: HTMLElement, options: InitLiveBadgeOptions = {}): void {
  if (!liveConfigEnabled(options.apiKey)) return; // sin clave: no-op total
  const apiKey = (options.apiKey ?? '').trim();
  const handle = root.getAttribute('data-handle') ?? '';
  if (handle.length === 0) return;
  const intervalSeconds = resolveCheckIntervalSeconds(
    root.getAttribute('data-check-interval-seconds'),
  );
  const fetchFn: typeof fetch =
    options.fetchFn ?? ((input, init) => globalThis.fetch(input, init));

  const applyLive = (live: boolean): void => {
    root.hidden = !live;
    root.setAttribute('data-state', live ? 'live' : 'off');
  };

  let controller: AbortController | null = null;

  const poll = async (): Promise<void> => {
    controller?.abort(); // cancela el poll anterior si aún está en vuelo
    controller = new AbortController();
    try {
      const channelId = await resolveChannelId(handle, apiKey, fetchFn, controller.signal);
      if (!channelId) {
        applyLive(false);
        return;
      }
      applyLive(await pollIsLive(channelId, apiKey, fetchFn, controller.signal));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      applyLive(false); // error de red/API → badge oculto, la página no se rompe
    }
  };

  void poll(); // primera comprobación inmediata
  setInterval(() => {
    void poll();
  }, intervalSeconds * 1000);
}
