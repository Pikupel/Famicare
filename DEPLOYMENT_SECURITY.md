# Famicare production security checklist

## Railway API

- Keep the API at one replica while application records use the `app_state` snapshot. Do not enable horizontal replicas until all writes use normalized PostgreSQL tables.
- Set every variable shown in `api/.env.example`; never copy placeholder values.
- `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` and all admin secrets are mandatory.
- Remove `ALLOW_UNVERIFIED_REGISTRATION` or set it to `false`. Railway is treated as production even if `NODE_ENV` is accidentally missing.
- Configure the Railway health check path as `/api/v1/ping`. It returns `503` when PostgreSQL or the scheduler is unhealthy.

## RevenueCat

- Use the Famicare user UUID as RevenueCat App User ID.
- Create a webhook for `https://YOUR_API/api/v1/webhooks/revenuecat`.
- Configure both a fixed Authorization header and HMAC signing in RevenueCat. Put the exact Authorization header value and signing secret in the matching Railway variables.
- Set a secret RevenueCat server API key with customer read permission. Never expose this key through an `EXPO_PUBLIC_` variable.
- Select production events for the production Railway service and sandbox events for a separate staging service.

## Git history incident

`api/db.json` exists in old commits in the GitHub-connected repository. A local metadata-only audit confirmed 41 phone records, 26 profiles, and health/medication collections. No PIN hash, plaintext PIN, or push token was detected in that historical revision. The personal and health data must still be treated as exposed.

1. Preserve the current working tree and create a verified backup before rewriting history.
2. Audit the historical file locally without printing its values into CI logs.
3. Force PIN reset and revoke sessions for any real users found in the file. Rotate any secret found there.
4. In a fresh maintenance clone, run `git filter-repo --path api/db.json --invert-paths`.
5. Verify with `git rev-list --all --objects` that the path and blob are gone, then force-push all affected branches and tags.
6. Every collaborator must discard old clones and clone again.

History rewriting must not be run from a dirty working tree or before coordinating the force-push.
