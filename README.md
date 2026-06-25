# Atrium — Monorepo

> **Everything, under one roof.**

Monorepo for the Atrium platform.

- **Backend:** .NET / C# (ASP.NET Core minimal API) — `backend/Atrium.Api`
- **Frontend:** React + TypeScript (Vite) — `frontend`
- **CI:** GitHub Actions on the self-hosted **Spark** runner → builds images → pushes to the local registry `localhost:5000`
- **Deploy:** the app joins the existing `atrium` Docker network on Spark and reaches Postgres / Valkey / OpenSearch / MinIO by service name.

```
atrium/
├── .github/workflows/ci.yml      # build + push + (optional) redeploy on Spark
├── backend/
│   └── Atrium.Api/               # ASP.NET Core API (health, ready, /api/info)
│       ├── Program.cs
│       ├── Atrium.Api.csproj
│       ├── appsettings.json
│       └── Dockerfile
├── frontend/                     # Vite + React + TS (calls /api/info)
│   ├── src/{main.tsx,App.tsx}
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── nginx.conf
│   └── Dockerfile
├── infra/app/
│   ├── docker-compose.yml        # runs the built images on the `atrium` network
│   └── .env.example
└── .gitignore
```

## Prerequisites (already done on Spark)
- The single-server stack is up: Postgres, Valkey, OpenSearch, MinIO, registry, monitoring — all on the `atrium` Docker network.
- The self-hosted runner **spark** is online with the `docker` label.

## How CI works
On every push to `main`, the **spark** runner:
1. Builds `localhost:5000/atrium-api` and `localhost:5000/atrium-web`, tagged with the commit short-SHA **and** `latest`.
2. Pushes both to the local registry (plain HTTP — Docker allows `localhost`).
3. **deploy job** copies `infra/app/docker-compose.yml` to `/opt/atrium/app/` and runs `docker compose pull && up -d` — so `main` auto-deploys on Spark.

## One-time setup on Spark
```bash
sudo mkdir -p /opt/atrium/app && sudo chown $USER /opt/atrium/app
# create the app's secrets (MUST match /opt/atrium/stack/.env):
cat > /opt/atrium/app/.env <<ENV
POSTGRES_PASSWORD=<same as stack>
REDIS_PASSWORD=<same as stack>
MINIO_PASSWORD=<same as stack>
ENV
chmod 600 /opt/atrium/app/.env
```

## Verify the skeleton (after first CI run)
```bash
# from your laptop, tunnel to the API:
ssh -L 8080:127.0.0.1:8080 ops@<SPARK_IP>
# then:
curl http://localhost:8080/health     # {"status":"healthy"}
curl http://localhost:8080/ready       # {"status":"ready","db":"reachable"}  <-- proves DB connectivity
curl http://localhost:8080/api/info     # name + tagline + version
```

## Local dev (your laptop)
```bash
# backend
cd backend/Atrium.Api && dotnet run        # http://localhost:8080
# frontend (separate terminal)
cd frontend && npm install && npm run dev    # http://localhost:5173, proxies /api -> :8080
```

## Notes
- Targets **.NET 8 (LTS)**. Bump the `<TargetFramework>` and Docker image tags to a newer LTS (e.g. `10.0`) if you prefer.
- Frontend is a minimal placeholder that proves frontend↔backend wiring. Drop the Atrium tile-builder app in here next.
- Once you commit a `package-lock.json`, switch the frontend Dockerfile from `npm install` to `npm ci`.
