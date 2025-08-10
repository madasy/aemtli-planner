import { LIMIT_BIWEEKLY, LIMIT_WEEKLY } from "./config.js";

export type Person = {
  id: number;
  name: string;
  shame: number;               // or use shameCount on objects coming in
  activeWeekly: boolean;
  activeBiweekly: boolean;
  exceptions?: string[];       // slugs to skip
  // optional: unavailable date ranges: [{from:'YYYY-MM-DD', to:'YYYY-MM-DD'}]
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

  const wGen = cycle(wPool); // used only to vary tie order
  const bGen = cycle(bPool);

  // ---------- WEEKLY (balanced across tasks & people) ----------
  // totals across all weekly tasks
  const totalWeeklyAssigned = new Map<number, number>(); // personId -> count
  const incTotalWeekly = (pid:number) => totalWeeklyAssigned.set(pid, (totalWeeklyAssigned.get(pid) ?? 0) + 1);
  const getTotalWeekly = (pid:number) => totalWeeklyAssigned.get(pid) ?? 0;

  // per-task per-person counts
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

  // deterministic rotation so ties don’t always pick the same person
  const seedFor = (taskIndex:number, weekIndex:number) => (taskIndex*7 + weekIndex*3);

  for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {
    for (let ti = 0; ti < weeklyTasks.length; ti++) {
      const t = weeklyTasks[ti];

      // candidate pool
      const candidates = wPool.filter(p =>
        !p.exceptions?.includes?.(t.slug) &&
        isAvailable(p, startsOn, weekIndex) &&
        can(p.id, weekIndex, "weekly")
      );

      if (!candidates.length) {
        slots.push({ taskId: t.id, weekIndex, personId: null });
        continue;
      }

      // rotate evaluation order
      const rotated = [...candidates];
      const rot = seedFor(ti, weekIndex) % rotated.length;
      rotated.push(...rotated.splice(0, rot));

      // score: lower is better
      //  - global balance weighted by shame/shameCount
      //  - avoid giving the same task repeatedly to the same person
      //  - avoid very recent repeats (min-gap preference)
      const MIN_GAP = 3;
      let bestPid: number | null = null;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const p of rotated) {
        const shame = Math.max(0, (p as any).shame ?? (p as any).shameCount ?? 0);
        const total = getTotalWeekly(p.id);
        const perTask = getPerTask(t.id, p.id);
        const last = getLastWeek(t.id, p.id);
        const since = weekIndex - last;

        const recentPenalty =
          last < 0 ? 0 :
          (since <= 1 ? 6 : since <= 2 ? 3 : since < MIN_GAP ? 1 : 0);

        const score =
          (total / (1 + shame)) * 2 +   // global balance (Schämtliliste bumps load)
          perTask * 3 +                  // spread people across different tasks
          recentPenalty;                 // avoid immediate repeats

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

  // ---------- BIWEEKLY: 2 ON, 2 OFF with per-task offset ----------
  const BI_ON = 2;
  const BI_OFF = 2;
  const BI_CYCLE = BI_ON + BI_OFF; // 4

  // fairness for biweekly ON-blocks: personId -> #blocks taken
  const biBlocksTaken = new Map<number, number>();
  const incBiBlocks = (pid:number) => biBlocksTaken.set(pid, (biBlocksTaken.get(pid) ?? 0) + 1);
  const getBiBlocks = (pid:number) => biBlocksTaken.get(pid) ?? 0;

  // rotating cursor so ties don’t start at the same person
  let biCursor = 0;

  for (const t of biweeklyTasks) {
    const off = t.offsetWeeks ?? 0;
    const cal: (number | null)[] = Array.from({ length: weeks }, () => null);

    // walk blocks: [on,on,off,off] repeating
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
          if (!isAvailable(p, startsOn, w0)) continue;
          if (w1 < weeks && !isAvailable(p, startsOn, w1)) continue;
          if (!can(p.id, w0, "biweekly")) continue;
          if (w1 < weeks && !can(p.id, w1, "biweekly")) continue;

          const score = getBiBlocks(p.id);
          if (score < bestScore) {
            bestScore = score;
            bestPid = p.id;
          }
        }
        biCursor = (biCursor + 1) % Math.max(1, bPool.length);
      }

      if (bestPid != null) {
        cal[w0] = bestPid;
        bump(bestPid, w0);
        if (w1 < weeks) {
          cal[w1] = bestPid;
          bump(bestPid, w1);
        }
        incBiBlocks(bestPid); // count once per ON-block
      }
      // OFF part remains null
    }

    // emit one slot per week for this bi-weekly task
    for (let w = 0; w < weeks; w++) {
      slots.push({ taskId: t.id, weekIndex: w, personId: cal[w] });
    }
  }

  return slots;
}
