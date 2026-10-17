import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionStatus } from './connectivity.js';

test('first online load reports preparation until offline shell is ready', () => {
  assert.equal(
    connectionStatus({ online: true, offlineReady: false, offlineError: false }),
    'Online · Offline wird vorbereitet'
  );
});

test('ready service worker reports offline readiness online and offline', () => {
  assert.equal(
    connectionStatus({ online: true, offlineReady: true, offlineError: false }),
    'Online · offline bereit'
  );
  assert.equal(
    connectionStatus({ online: false, offlineReady: true, offlineError: false }),
    'Offline · spielbereit'
  );
});

test('offline without a ready shell does not claim reload safety', () => {
  assert.equal(
    connectionStatus({ online: false, offlineReady: false, offlineError: false }),
    'Offline · Reload nicht abgesichert'
  );
});

test('service worker failure is visible while online', () => {
  assert.equal(
    connectionStatus({ online: true, offlineReady: false, offlineError: true }),
    'Online · Offline-Modus nicht verfügbar'
  );
});
