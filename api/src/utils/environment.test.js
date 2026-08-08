import test from 'node:test';
import assert from 'node:assert/strict';
import { isProductionRuntime, isUnsafeRegistrationAllowed } from './environment.js';

test('Railway runtime is treated as production even without NODE_ENV', () => {
  const oldRailway = process.env.RAILWAY_ENVIRONMENT;
  const oldNodeEnv = process.env.NODE_ENV;
  const oldBypass = process.env.ALLOW_UNVERIFIED_REGISTRATION;
  delete process.env.NODE_ENV;
  process.env.RAILWAY_ENVIRONMENT = 'production-id';
  process.env.ALLOW_UNVERIFIED_REGISTRATION = 'true';
  try {
    assert.equal(isProductionRuntime(), true);
    assert.equal(isUnsafeRegistrationAllowed(), false);
  } finally {
    if (oldRailway === undefined) delete process.env.RAILWAY_ENVIRONMENT; else process.env.RAILWAY_ENVIRONMENT = oldRailway;
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv;
    if (oldBypass === undefined) delete process.env.ALLOW_UNVERIFIED_REGISTRATION; else process.env.ALLOW_UNVERIFIED_REGISTRATION = oldBypass;
  }
});
