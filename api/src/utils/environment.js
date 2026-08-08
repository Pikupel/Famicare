export function isHostedRuntime() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_ENVIRONMENT_NAME ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_PUBLIC_DOMAIN
  );
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || isHostedRuntime();
}

export function isUnsafeRegistrationAllowed() {
  return process.env.ALLOW_UNVERIFIED_REGISTRATION === 'true' && !isProductionRuntime();
}
