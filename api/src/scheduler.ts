import { LIMIT_BIWEEKLY, LIMIT_WEEKLY } from "./config.js";
import { PrismaClient } from "@prisma/client";
import { TASKS } from "./config.js";

export type Person = {
  id: number;
  name: string;
  shame: number;
  activeWeekly: boolean;
  activeBiweekly: boolean;
  // optional: if you added exceptions in DB
  exceptions?: string[];
};

export type Task = {
  id: number;
  slug: string;
  title: string;
  cadence: "weekly" | "biweekly";
  offsetWeeks?: number; // for biweekly start offset
};

export type Slot = { taskId: number; weekIndex: number; personId: number | null };

function* cycle<T>(arr: T[]) {
  let i = 0;
  while (true) {
    yield arr[i % Math.max(1, arr.length)];
    i++;
  }
}

export function buildPlan({
  startsOn,
  weeks,
  peopleWeekly,
  peopleBiweekly,
  tasks,
}: {
  startsOn: Date;
  weeks: number;
  peopleWeekly: Person[];
  peopleBiweekly: Person[];
  tasks: Task[];
}): Slot[] {
  const slots: Slot[] = [];

  // per-week load tracking: weekIndex -> (personId -> count)
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

  const weeklyTasks   = tasks.filter(t => t.cadence === "weekly");
  const biweeklyTasks = tasks.filter(t => t.cadence === "biweekly");

  const wPool = peopleWeekly.filter(p => p.activeWeekly);
  const bPool = peopleBiweekly.filter(p => p.activeBiweekly);

  const wGen = cycle(wPool);
  const bGen = cycle(bPool);

  // ---------- WEEKLY ----------
  for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {
    for (const t of weeklyTasks) {
      let picked: number | null = null;

      // try a few times to find a candidate under cap & not excepted
      const triesMax = Math.max(1, wPool.length) * 2;
      for (let tries = 0; tries < triesMax; tries++) {
        const p = wGen.next().value as Person;
        if (!p) continue;
        if (p.exceptions?.includes?.(t.slug)) continue;
        if (can(p.id, weekIndex, "weekly")) {
          picked = p.id;
          break;
        }
      }

      if (picked != null) bump(picked, weekIndex);
      slots.push({ taskId: t.id, weekIndex, personId: picked });
    }
  }

  // ---------- BIWEEKLY: 2 ON, 2 OFF with offset ----------
  // For each biweekly task, create a calendar with exactly one cell per week
  const BI_ON = 2;
  const BI_OFF = 2;
  const BI_CYCLE = BI_ON + BI_OFF; // 4

  for (const t of biweeklyTasks) {
    const off = t.offsetWeeks ?? 0;
    // per-task calendar
    const cal: (number | null)[] = Array.from({ length: weeks }, () => null);

    // step through blocks of 4 weeks starting at `off`
    for (let start = off; start < weeks; start += BI_CYCLE) {
      // this ON block is weeks [start, start+1]
      const w0 = start;
      const w1 = start + 1;

      if (w0 >= weeks) break; // nothing to fill

      // pick one person for both weeks in the ON block
      let picked: number | null = null;

      // Prefer someone who fits BOTH weeks (cap check) and not excepted
      const triesMax = Math.max(1, bPool.length) * 3;
      for (let tries = 0; tries < triesMax; tries++) {
        const p = bGen.next().value as Person;
        if (!p) continue;
        if (p.exceptions?.includes?.(t.slug)) continue;

        const okW0 = can(p.id, w0, "biweekly");
        const okW1 = w1 < weeks ? can(p.id, w1, "biweekly") : true;

        if (okW0 && okW1) {
          picked = p.id;
          break;
        }
      }

      // Fallback: if none fits both, try someone who fits the first week at least
      if (picked == null) {
        const triesMax2 = Math.max(1, bPool.length) * 2;
        for (let tries = 0; tries < triesMax2; tries++) {
          const p = bGen.next().value as Person;
          if (!p) continue;
          if (p.exceptions?.includes?.(t.slug)) continue;
          if (can(p.id, w0, "biweekly")) {
            picked = p.id;
            break;
          }
        }
      }

      // Paint ON block with same person (if picked)
      if (picked != null) {
        cal[w0] = picked;
        bump(picked, w0);
        if (w1 < weeks) {
          cal[w1] = picked;
          bump(picked, w1);
        }
      }
      // OFF block (start+2, start+3) remains null in cal
    }

    // emit exactly one slot per week for this task
    for (let w = 0; w < weeks; w++) {
      slots.push({ taskId: t.id, weekIndex: w, personId: cal[w] });
    }
  }

  return slots;
}
