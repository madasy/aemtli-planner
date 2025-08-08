# Ämtli Planner (Starter)

Starter-Repo für 16‑Wochen-Ämtli-Planer mit Next.js (Web) + Express (API) + Prisma + PostgreSQL + Drag&Drop + ICS-Export.

## Features (Starter)
- 16‑Wochen Rolling-Plan (Start = nächster Montag)
- Wöchentliche & zweiwöchentliche Tasks (individuelle Offsets)
- Limit: max 1 Weekly + max 1 Biweekly pro Person/Woche
- Schämtli-Zähler (Penalty) als Datenmodell + Platzhalterlogik
- Public Read‑only View (web), Admin-Portal (web) – UI skeleton mit Drag&Drop-Platzhaltern
- ICS-Export pro Person via API (`/api/ics/:personId?plan=...`)

> Dies ist ein **Starter**: die Grundlogik, Routen, Datenmodell und UI-Skelette sind vorhanden; Details kannst du iterativ ergänzen.

## Quickstart (Docker)
```bash
cp .env.example .env
# Werte in .env anpassen
docker compose up --build
```

- Web (Next.js): http://localhost:3000
- API (Express): http://localhost:4000
- Postgres: localhost:5432

## Lokale Entwicklung (ohne Docker)
```bash
# 1) ENV anlegen
cp .env.example .env

# 2) Dependencies installieren & Prisma generieren
cd api && npm i && npm run build
cd ../web && npm i

# 3) DB migrieren (erstmalig)
cd ..
npm i -g prisma
prisma migrate dev --schema=./prisma/schema.prisma

# 4) API & Web starten (in getrennten Terminals)
cd api && npm run dev
# neues Terminal
cd web && npm run dev
```

## GitHub Push (nachdem du das Repo erstellt hast)
```bash
# im Ordner mit den Dateien:
git init
git add .
git commit -m "feat: aemtli-planner starter"
git branch -M main
git remote add origin https://github.com/<DEIN_USERNAME>/aemtli-planner.git
git push -u origin main
```

## Konfiguration
- `.env`: `DATABASE_URL`, `NEXTAUTH_SECRET` (oder beliebiger random String), `ADMIN_USERNAMES`, `ICS_START_TIME=18:00`
- Biweekly-Offsets sind im API-Config (`api/src/config.ts`) hinterlegt.

## Lizenz
MIT
