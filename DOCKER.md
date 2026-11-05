# Run Evident with Docker

Requires Docker Engine with Linux containers and Docker Compose v2 or newer.
On Windows, start Docker Desktop and select Linux containers first.
Run all commands from the repository root.

## Existing MongoDB / Atlas (default)

Keep your existing `server/.env`. If it does not exist, copy
`server/.env.example` to `server/.env` and configure it first:

- `MONGODB_URI`: reachable MongoDB URI (Atlas works unchanged). `localhost`
  inside the API container refers to that container. For a database running on
  your Docker Desktop host, use `host.docker.internal` instead of `localhost`.
- `JWT_SECRET`: a long random secret; do not use the example value.
- `AI_PROVIDER`, `GROQ_API_KEY`, and `GEMINI_API_KEY`: as described in [SETUP.md](SETUP.md).
  Gemini embeddings are required even when generation uses Groq.

Atlas must allow the machine's outbound public IP. No database data is seeded
or deleted automatically.

```sh
docker compose up --build -d --wait
```

Open http://localhost:8080. API docs: http://localhost:8080/docs.
Database health: http://localhost:8080/api/health (`db` should be `ok`).
The `ai_configured` field checks that keys exist, not that they are accepted.

## Optional local MongoDB

This starts a separate, initially empty database and overrides only the API's
database URI. Your existing environment file and Atlas data are unchanged.
Configure the JWT secret and AI keys in `server/.env` as above.

```sh
docker compose -f compose.yaml -f compose.local.yaml up --build -d --wait
```

Use the same `-f compose.yaml -f compose.local.yaml` options for subsequent
Compose commands in this mode. MongoDB data persists in the `mongo_data` named
volume. MongoDB has no host port and this local development database has no
authentication. Do not use it as an internet-facing database.

## Operations

```sh
docker compose ps
docker compose logs --tail=100 api web
docker compose exec api python -m scripts.check_connections
docker compose down
```

`down` preserves named volumes. Adding `--volumes` deletes local database data.
After changing `server/.env`, run `docker compose up -d` to recreate the API
with the new environment; a simple restart does not reload Compose variables.
For source changes, rerun `docker compose up --build -d --wait`.

Optional AI connectivity check (makes real provider requests):

```sh
docker compose exec api python -m scripts.check_connections --ai
```

Optional demo seed (writes to the configured database and calls AI providers;
use a development database):

```sh
docker compose exec api python -m seed.seed --apply
```

Generated seed PDFs stay inside the API container. Copy them out if needed:
`docker compose cp api:/app/seed/pdfs ./demo-pdfs`.

## Configuration and deployment

- Only the web port is published, bound to `127.0.0.1` by default. Set
  `WEB_PORT` in your shell to change port 8080. For public hosting, configure
  HTTPS and the port binding explicitly for your deployment.
- The frontend is a production Vite build served by nginx. It calls `/api` on
  its own origin, so no Docker hostname or fixed localhost URL reaches browsers.
  The local `client/.env` is intentionally excluded from the build.
- Backend credentials are injected at runtime using `server/.env`. Both image
  contexts exclude environment files, dependency folders, and caches.
- API and web processes run as non-root users. The API health check verifies
  MongoDB connectivity before Compose starts the frontend.
- nginx permits 6 MB request bodies for the app's default 5 MB file limit. If
  you increase `MAX_UPLOAD_MB`, increase `client_max_body_size` in
  [client/nginx.conf](client/nginx.conf) with room for multipart overhead and rebuild.
- Python dependencies retain the version ranges from the existing
  [requirements.txt](server/requirements.txt); builds may resolve newer versions.
  The frontend uses `npm ci` with the existing lockfile.
