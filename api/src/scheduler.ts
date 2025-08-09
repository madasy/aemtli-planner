import { LIMIT_BIWEEKLY, LIMIT_WEEKLY } from "./config.js";
import { PrismaClient } from "@prisma/client";
import { TASKS } from "./config.js";

export type Person = {
  id: number;
  name: string;
  shame: number;
  activeWeekly: boolean;
  activeBiweekly: boolean;
};

export type Task = {
  id: number;
  slug: string;
  title: string;
  cadence: "weekly" | "biweekly";
  offsetWeeks?: number;
};

export type Slot = {
  taskId: number;
  weekIndex: number;
  personId: number | null;
};

function* cycle<T>(arr: T[]) {
  let i = 0;
  while (true) {
    yield arr[i % arr.length];
    i++;
  }
}

export function nextMonday(from = new Date()): Date {
  const d = new Date(from);
  const day = d.getDay();
  const diff = (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function seedTasks() {
  const prisma = new PrismaClient();
  for (const t of TASKS) {
    await prisma.task.upsert({
      where: { slug: t.slug },
      update: { title: t.title, cadence: t.cadence, offsetWeeks: t.offsetWeeks },
      create: { slug: t.slug, title: t.title, cadence: t.cadence, offsetWeeks: t.offsetWeeks },
    });
  }
  await prisma.$disconnect();
}

export function buildPlan({
  startsOn,
  weeks,
  peopleWeekly,
  peopleBiweekly,
  tasks
}: {
  startsOn: Date;
  weeks: number;
  peopleWeekly: Person[];
  peopleBiweekly: Person[];
  tasks: Task[];
}): Slot[] {
  const slots: Slot[] = [];
  const load = new Map<number, Map<number, number>>();

  const can = (pid: number, w: number, kind: "weekly" | "biweekly") => {
    const m = load.get(w) ?? new Map<number, number>();
    const c = m.get(pid) ?? 0;
    const cap = kind === "weekly" ? LIMIT_WEEKLY : LIMIT_BIWEEKLY;
    return c < cap;
  };
  const bump = (pid: number, w: number) => {
    const m = load.get(w) ?? new Map<number, number>();
    m.set(pid, (m.get(pid) ?? 0) + 1);
    load.set(w, m);
  };

  const wPool = peopleWeekly.filter(p => p.activeWeekly);
  const bPool = peopleBiweekly.filter(p => p.activeBiweekly);
  const wGen = cycle(wPool);
  const bGen = cycle(bPool);

  for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {
    // Weekly
    for (const t of tasks.filter(t => t.cadence === "weekly")) {
      let picked: number | null = null;
      for (let tries = 0; tries < Math.max(1, wPool.length) * 2; tries++) {
        const p = wGen.next().value as Person;
        if (p && can(p.id, weekIndex, "weekly")) {
          picked = p.id;
          break;
        }
      }
      if (picked != null) bump(picked, weekIndex);
      slots.push({ taskId: t.id, weekIndex, personId: picked });
    }

    // Biweekly with offset
    for (const t of tasks.filter(t => t.cadence === "biweekly")) {
      const off = t.offsetWeeks ?? 0;
      const active = weekIndex >= off && ((weekIndex - off) % 2 === 0);

      if (!active) {
        slots.push({ taskId: t.id, weekIndex, personId: null });
        continue;
      }

      let picked: number | null = null;
      for (let tries = 0; tries < Math.max(1, bPool.length) * 2; tries++) {
        const p = bGen.next().value as Person;
        if (p && can(p.id, weekIndex, "biweekly")) {
          picked = p.id;
          break;
        }
      }
      if (picked != null) bump(picked, weekIndex);
      slots.push({ taskId: t.id, weekIndex, personId: picked });
    }
  }

  return slots;
}
