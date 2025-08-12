import { LIMIT_BIWEEKLY, LIMIT_WEEKLY } from "./config.js";

export type Person = {
  id: number;
  name: string;
  shame: number;               // or shameCount on incoming objects
  activeWeekly: boolean;
  activeBiweekly: boolean;
  exceptions?: string[];
  // optional: unavailable [{from:'YYYY-MM-DD', to:'YYYY-MM-DD'}]
  // unavailable?: Array<{ from: string; to: string }>;
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
  while (true) { yield arr[i % Math.max(1, arr.length)]; i++; }
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

  // ---------- helpers ----------
  const weekMonday = (base: Date, w: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + w * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  function isAvailable(p: Person, base: Date, weekIdx: number) {
    const blocks = (p as any).unavailable as Array<{ from: string; to: string }> | undefined;
    if (!blocks?.length) return true;
    const day = weekMonday(base, weekIdx).getTime();
    for (const b of blocks) {
      const from = new Date(`${b.from}T00:00:00`).getTime();
      const to   = new Date(`${b.to}T23:59:59`).getTime();
      if (day >= from && day <= to) return false;
    }
    return true;
  }

  // per-week capacity: weekIndex -> (personId -> count)
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

  // ---------- QUOTAS ----------
  // WEEKLY quota: base average + shame
  const totalWeeklySlots = weeklyTasks.length * weeks;
  const baseWeeklyAvg = Math.round(totalWeeklySlots / Math.max(1, wPool.length));

  const weeklyQuota = new Map<number, number>();
  for (const p of wPool) {
    const shame = Math.max(0, (p as any).shame ?? (p as any).shameCount ?? 0);
    weeklyQuota.set(p.id, baseWeeklyAvg + shame);
  }

  // BIWEEKLY quota by ON-blocks (2-week assignments)
  // Count total ON-blocks across all biweekly tasks, considering the 2-on/2-off cycle.
  const BI_ON = 2, BI_OFF = 2, BI_CYCLE = BI_ON + BI_OFF; // 4
  let totalOnBlocks = 0;
  for (const t of biweeklyTasks) {
    const off = t.offsetWeeks ?? 0;
    for (let i = off; i < weeks; i += BI_CYCLE) {
      if (i < weeks) totalOnBlocks++; // one ON-block starting at i
    }
  }
  const baseBlockAvg = Math.round(totalOnBlocks / Math.max(1, bPool.length));

  const biQuota = new Map<number, number>();
  for (const p of bPool) {
    const shame = Math.max(0, (p as any).shame ?? (p as any).shameCount ?? 0);
    // give shame full weight here as well (can be tuned later)
    biQuota.set(p.id, baseBlockAvg + shame);
  }

  // ---------- WEEKLY (balanced with quotas) ----------
  const totalWeeklyAssigned = new Map<number, number>(); // personId -> count
  const incTotalWeekly = (pid:number) => totalWeeklyAssigned.set(pid, (totalWeeklyAssigned.get(pid) ?? 0) + 1);
  const getTotalWeekly = (pid:number) => totalWeeklyAssigned.get(pid) ?? 0;

  // per-task per-person counts (spread people across different weekly tasks)
  const perTaskCounts = new Map<number, Map<number, number>>(); // taskId -> (personId -> count)
  const incPerTask = (tid:number, pid:number) => {
    const m = perTaskCounts.get(tid) ?? new Map<number, number>();
    m.set(pid, (m.get(pid) ?? 0) + 1);
    perTaskCounts.set(tid, m);
  };
  const getPerTask = (tid:number, pid:number) => (perTaskCounts.get(tid)?.get(pid) ?? 0);

  // last week a person did a specific task (avoid immediate repeats)
  const lastWeekOnTask = new Map<number, Map<number, number>>(); // taskId -> (personId -> lastWeek)
  const setLastWeek = (tid:number, pid:number, wk:number) => {
    const m = lastWeekOnTask.get(tid) ?? new Map<number, number>();
    m.set(pid, wk);
    lastWeekOnTask.set(tid, m);
  };
  const getLastWeek = (tid:number, pid:number) => (lastWeekOnTask.get(tid)?.get(pid) ?? -999);

  const seedFor = (taskIndex:number, weekIndex:number) => (taskIndex*7 + weekIndex*3);

  for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {
    for (let ti = 0; ti < weeklyTasks.length; ti++) {
      const t = weeklyTasks[ti];

      const candidates = wPool.filter(p =>
        !p.exceptions?.includes?.(t.slug) &&
        isAvailable(p, startsOn, weekIndex) &&
        can(p.id, weekIndex, "weekly")
      );

      if (!candidates.length) {
        slots.push({ taskId: t.id, weekIndex, personId: null });
        continue;
      }

      const rotated = [...candidates];
      const rot = seedFor(ti, weekIndex) % rotated.length;
      rotated.push(...rotated.splice(0, rot));

      let bestPid: number | null = null;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const p of rotated) {
        const quota = Math.max(1, weeklyQuota.get(p.id) ?? baseWeeklyAvg);
        const total  = getTotalWeekly(p.id);
        const ratio  = total / quota; // key balancing term (lower is better)

        const perTask = getPerTask(t.id, p.id);
        const last = getLastWeek(t.id, p.id);
        const since = weekIndex - last;
        const MIN_GAP = 3;
        const recentPenalty =
          last < 0 ? 0 :
          (since <= 1 ? 6 : since <= 2 ? 3 : since < MIN_GAP ? 1 : 0);

        // weight ratio strongly so we stick to quotas
        const score = ratio * 10 + perTask * 2 + recentPenalty;

        if (score < bestScore) {
          bestScore = score;
          bestPid = p.id;
        }
      }

      if (bestPid != null) {
        bump(bestPid, weekIndex);
        incTotalWeekly(bestPid);
        incPerTask(t.id, bestPid);
        setLastWeek(t.id, bestPid, weekIndex);
      }

      slots.push({ taskId: t.id, weekIndex, personId: bestPid ?? null });
    }
  }

  // ---------- BIWEEKLY: 2 ON, 2 OFF with per-task offset, balanced by quotas ----------
  const biBlocksTaken = new Map<number, number>(); // personId -> #ON-blocks taken
  const incBiBlocks = (pid:number) => biBlocksTaken.set(pid, (biBlocksTaken.get(pid) ?? 0) + 1);
  const getBiBlocks = (pid:number) => biBlocksTaken.get(pid) ?? 0;

  let biCursor = 0;

  for (const t of biweeklyTasks) {
    const off = t.offsetWeeks ?? 0;
    const cal: (number | null)[] = Array.from({ length: weeks }, () => null);

    for (let startIdx = off; startIdx < weeks; startIdx += BI_CYCLE) {
      const w0 = startIdx;
      const w1 = startIdx + 1;
      if (w0 >= weeks) break;

      let bestPid: number | null = null;
      let bestScore = Number.POSITIVE_INFINITY;

      if (bPool.length > 0) {
        for (let i = 0; i < bPool.length; i++) {
          const p = bPool[(biCursor + i) % bPool.length];
          if (p.exceptions?.includes?.(t.slug)) continue;

          // availability both weeks of the ON pair
          if (!isAvailable(p, startsOn, w0)) continue;
          if (w1 < weeks && !isAvailable(p, startsOn, w1)) continue;

          // per-week caps
          if (!can(p.id, w0, "biweekly")) continue;
          if (w1 < weeks && !can(p.id, w1, "biweekly")) continue;

          const quota = Math.max(1, biQuota.get(p.id) ?? baseBlockAvg);
          const taken = getBiBlocks(p.id);
          const ratio = taken / quota; // lower ⇒ needs more blocks

          // gentle rotation to break ties
          const tieBreak = i * 0.001;

          const score = ratio * 10 + tieBreak;
          if (score < bestScore) { bestScore = score; bestPid = p.id; }
        }
        biCursor = (biCursor + 1) % Math.max(1, bPool.length);
      }

      if (bestPid != null) {
        cal[w0] = bestPid; bump(bestPid, w0);
        if (w1 < weeks) { cal[w1] = bestPid; bump(bestPid, w1); }
        incBiBlocks(bestPid); // count once per ON-block
      }
      // OFF part remains null
    }

    for (let w = 0; w < weeks; w++) {
      slots.push({ taskId: t.id, weekIndex: w, personId: cal[w] });
    }
  }

  return slots;
}
