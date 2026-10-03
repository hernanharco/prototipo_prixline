// site/src/lib/live.test.mjs — T7. Pruebas `node --test` (sin dependencias)
// sobre la lógica pura del indicador "EN VIVO". No existe framework de
// testing en site/: este archivo usa solo node:test + node:assert. Node
// (>= 23.6, instalado: v26.10.0) importa `./live.ts` con type stripping
// nativo, sin flags. `astro check` no lo revisa (allowJs sin checkJs en
// astro/tsconfigs/base.json), así que no añade tipos ni dependencias.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LIVE_CHECK_INTERVAL_SECONDS,
  dailySearchCostUnits,
  isChannelCacheFresh,
  isWithinDailyQuota,
  liveConfigEnabled,
  resolveCheckIntervalSeconds,
  searchesPerDay,
  shouldShowLive,
} from './live.ts';

describe('shouldShowLive', () => {
  it('es true solo con items de búsqueda no vacíos', () => {
    assert.equal(shouldShowLive([{ id: 'video-1' }]), true);
    assert.equal(shouldShowLive([{}]), true);
  });
  it('es false con lista vacía (transmisión terminada)', () => {
    assert.equal(shouldShowLive([]), false);
  });
  it('es false con valores no-array o malformados', () => {
    assert.equal(shouldShowLive(undefined), false);
    assert.equal(shouldShowLive(null), false);
    assert.equal(shouldShowLive({ items: [] }), false);
    assert.equal(shouldShowLive('live'), false);
  });
});

describe('resolveCheckIntervalSeconds', () => {
  it('acepta el intervalo inlineado desde site.json', () => {
    assert.equal(resolveCheckIntervalSeconds('900'), 900);
    assert.equal(resolveCheckIntervalSeconds(900), 900);
  });
  it('usa el fallback 900 ante valores inválidos, ausentes o no positivos', () => {
    assert.equal(resolveCheckIntervalSeconds(undefined), LIVE_CHECK_INTERVAL_SECONDS);
    assert.equal(resolveCheckIntervalSeconds(null), LIVE_CHECK_INTERVAL_SECONDS);
    assert.equal(resolveCheckIntervalSeconds(''), LIVE_CHECK_INTERVAL_SECONDS);
    assert.equal(resolveCheckIntervalSeconds('abc'), LIVE_CHECK_INTERVAL_SECONDS);
    assert.equal(resolveCheckIntervalSeconds(0), LIVE_CHECK_INTERVAL_SECONDS);
    assert.equal(resolveCheckIntervalSeconds(-300), LIVE_CHECK_INTERVAL_SECONDS);
  });
  it('redondea hacia abajo valores fraccionarios', () => {
    assert.equal(resolveCheckIntervalSeconds(950.7), 950);
  });
});

describe('cuota YouTube (search.list = 100 u, límite 10.000 u/día)', () => {
  it('el intervalo del generador (900 s) cabe en cuota', () => {
    assert.equal(LIVE_CHECK_INTERVAL_SECONDS, 900);
    assert.equal(searchesPerDay(900), 96);
    assert.equal(dailySearchCostUnits(900), 9600);
    assert.equal(isWithinDailyQuota(900), true);
  });
  it('el intervalo antiguo (300 s) excede la cuota diaria', () => {
    assert.equal(searchesPerDay(300), 288);
    assert.equal(dailySearchCostUnits(300), 28800);
    assert.equal(isWithinDailyQuota(300), false);
  });
  it('intervalos no positivos o no finitos nunca son válidos', () => {
    assert.equal(isWithinDailyQuota(0), false);
    assert.equal(isWithinDailyQuota(-300), false);
    assert.equal(isWithinDailyQuota(Number.NaN), false);
  });
});

describe('caché de channelId (TTL 24 h en localStorage)', () => {
  const now = 1_760_000_000_000;
  const ttl = 24 * 60 * 60 * 1000;
  it('acepta una entrada fresca válida', () => {
    assert.equal(isChannelCacheFresh({ channelId: 'UC_x', fetchedAt: now - 1000 }, now), true);
  });
  it('rechaza entradas caducadas o con antigüedad igual al TTL', () => {
    assert.equal(isChannelCacheFresh({ channelId: 'UC_x', fetchedAt: now - ttl }, now), false);
    assert.equal(isChannelCacheFresh({ channelId: 'UC_x', fetchedAt: now - ttl - 1 }, now), false);
  });
  it('rechaza entradas malformadas o con fetchedAt futuro', () => {
    assert.equal(isChannelCacheFresh(null, now), false);
    assert.equal(isChannelCacheFresh(undefined, now), false);
    assert.equal(isChannelCacheFresh({ fetchedAt: now }, now), false);
    assert.equal(isChannelCacheFresh({ channelId: '', fetchedAt: now }, now), false);
    assert.equal(isChannelCacheFresh({ channelId: 'UC_x', fetchedAt: 'ayer' }, now), false);
    assert.equal(isChannelCacheFresh({ channelId: 'UC_x', fetchedAt: now + 60_000 }, now), false);
  });
});

describe('liveConfigEnabled (sin clave → cero peticiones)', () => {
  it('distingue configurado vs no configurado', () => {
    assert.equal(liveConfigEnabled(undefined), false);
    assert.equal(liveConfigEnabled(null), false);
    assert.equal(liveConfigEnabled(''), false);
    assert.equal(liveConfigEnabled('   '), false);
    assert.equal(liveConfigEnabled('dummy-key-for-build-test'), true);
  });
});
