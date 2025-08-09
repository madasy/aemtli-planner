// api/src/seed.ts
import { PrismaClient } from "@prisma/client";
import { TASKS } from "./config.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding tasks...");
  for (const t of TASKS) {
    await prisma.task.upsert({
      where: { slug: t.slug },
      update: { title: t.title, cadence: t.cadence, offsetWeeks: t.offsetWeeks ?? 0 },
      create: { slug: t.slug, title: t.title, cadence: t.cadence, offsetWeeks: t.offsetWeeks ?? 0 },
    });
  }
  console.log("✅ Seeding complete!");
}

main().finally(() => prisma.$disconnect());
