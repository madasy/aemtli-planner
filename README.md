# Ämtli Planner (Starter)

This repository contains the scheduling logic and PDF generation for the **Hacienda Jose Ämtli Plan**.  
It automatically assigns household chores ("Ämtli") fairly across all participants, while respecting:

- Weekly and bi-weekly task cadences
- Personal vacation/unavailability dates
- Exceptions (tasks certain people cannot do)
- "Schämtliliste" — people who should take more tasks than average
- Weekly capacity limits per person
- Balanced distribution across different tasks

## Features

- **Balanced Scheduling**  
  Assignments are evenly spread over the planning period, accounting for vacations and exceptions.

- **Schämtliliste Support**  
  People with a higher "shame count" get proportionally more tasks.

- **Weekly & Bi-Weekly Cadence**  
  Weekly tasks are assigned every week.  
  Bi-weekly tasks follow a **2 weeks ON, 2 weeks OFF** pattern, starting with optional per-task offsets.

- **Fair Rotation**  
  Avoids assigning the same task to the same person too often in a short time.

- **PDF Generation**  
  Creates a printable PDF of the full schedule with adjustable layout, font size, and cell alignment.

---

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

# 4) DB migrieren when schema.prisma angepasst wurde
cd api
npx prisma migrate dev --name add_person_exceptions
npx prisma generate

# 5) API & Web starten (in getrennten Terminals)
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
