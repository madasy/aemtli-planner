import { LIMIT_BIWEEKLY, LIMIT_WEEKLY } from "./config.js";

export type Person = {
  id: number;
  name: string;
  shame: number;               // or use shameCount on objects coming in
  activeWeekly: boolean;
  activeBiweekly: boolean;
  exceptions?: string[];       // slugs to skip
  // Optional: array of date ranges a person is unavailable (YYYY-MM-DD)
  // Not typed strictly to avoid breaking older callers; cast at runtime.
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

  // ---- helpers ----
// Monday of a given weekIndex (used by isAvailable)
const weekMonday = (startsOn: Date, w: number) => {
  const d = new Date(startsOn);
  d.setDate(d.getDate() + w * 7);
  d.setHours(0, 0, 0, 0);
  return d;
};

function isAvailable(p: Person, startsOn: Date, weekIdx: number) {
  const blocks = (p as any).unavailable as Array<{ from: string; to: string }> | undefined;
  if (!blocks?.length) return true;
  const day = weekMonday(startsOn, weekIdx).getTime();
  for (const b of blocks) {
    const from = new Date(`${b.from}T00:00:00`).getTime();
    const to = new Date(`${b.to}T23:59:59`).getTime();
    if (day >= from && day <= to) return false;
  }
  return true;
}

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

  const weeklyTasks = tasks.filter((t) => t.cadence === "weekly");
  const biweeklyTasks = tasks.filter((t) => t.cadence === "biweekly");

  const wPool = peopleWeekly.filter((p) => p.activeWeekly);
  const bPool = peopleBiweekly.filter((p) => p.activeBiweekly);

  const wGen = cycle(wPool);
  const bGen = cycle(bPool);

  // Track fairness: how many weekly assignments we’ve given each person (for 16 weeks)
  const weeklyAssignedSoFar = new Map<number, number>(); // personId -> count
  const incWeeklyAssigned = (pid: number) =>
    weeklyAssignedSoFar.set(pid, (weeklyAssignedSoFar.get(pid) ?? 0) + 1);
  const getWeeklyAssigned = (pid: number) => weeklyAssignedSoFar.get(pid) ?? 0;

  // Track fairness for biweekly ON-blocks: personId -> number of ON-blocks
  const biBlocksTaken = new Map<number, number>();
  const incBiBlocks = (pid: number) =>
    biBlocksTaken.set(pid, (biBlocksTaken.get(pid) ?? 0) + 1);
  const getBiBlocks = (pid: number) => biBlocksTaken.get(pid) ?? 0;

// simple rotating cursor so ties don’t always start at index 0
let biCursor = 0;

  // before weekly loop, compute quotas
const totalWeeklySlots = weeklyTasks.length * weeks;
const weeklyPoolSize = Math.max(1, wPool.length);
const avgWeekly = Math.round(totalWeeklySlots / weeklyPoolSize);

const quota = new Map<number, number>();
for (const p of wPool) {
  const shame = Math.max(0, (p as any).shame ?? (p as any).shameCount ?? 0);
  quota.set(p.id, avgWeekly + shame);
}

  // ---------- WEEKLY ----------
  for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {
    for (const t of weeklyTasks) {
      // choose the best candidate:
      // - not excepted for this task
      // - available this week
      // - under weekly cap for this week
      // - minimize score = assignedSoFar / (1 + shame)
      let picked: number | null = null;
      let bestScore = Number.POSITIVE_INFINITY;

      // Look at each candidate roughly once, but use the generator to vary start point (tie-breaker).
      for (let tries = 0; tries < Math.max(1, wPool.length); tries++) {
        const p = wGen.next().value as Person;
        if (!p) continue;
        if (p.exceptions?.includes?.(t.slug)) continue;
        if (!isAvailable(p, startsOn, weekIndex)) continue;
        if (!can(p.id, weekIndex, "weekly")) continue;

        const shame = (p as any).shame ?? (p as any).shameCount ?? 0;
        const assigned = getWeeklyAssigned(p.id);
        const q = quota.get(p.id) ?? avgWeekly;
        // lower score ⇒ picked first; people below quota are strongly preferred
        const score = assigned / Math.max(1, q);
        
        if (score < bestScore) {
          bestScore = score;
          picked = p.id;
        }
      }

      if (picked != null) {
        bump(picked, weekIndex);
        incWeeklyAssigned(picked);
      }
      slots.push({ taskId: t.id, weekIndex, personId: picked });
    }
  }

  // ---------- BIWEEKLY: 2 ON, 2 OFF with offset ----------


  // ---------- BIWEEKLY: 2 ON, 2 OFF with per-task offset ----------
// We fill an exact calendar of length `weeks` per task. ON blocks are 2 weeks,
// OFF blocks are 2 weeks. The same person must do both weeks in an ON block.
const BI_ON = 2;
const BI_OFF = 2;
const BI_CYCLE = BI_ON + BI_OFF; // 4



for (const t of biweeklyTasks) {
  const off = t.offsetWeeks ?? 0;
  const cal: (number | null)[] = Array.from({ length: weeks }, () => null);

  // Walk blocks starting at 'off': [on,on,off,off] repeating
  for (let startIdx = off; startIdx < weeks; startIdx += BI_CYCLE) {
    const w0 = startIdx;
    const w1 = startIdx + 1;
    if (w0 >= weeks) break;

    // pick one person for this ON block (both weeks)
    let bestPid: number | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    if (bPool.length > 0) {
      for (let i = 0; i < bPool.length; i++) {
        const p = bPool[(biCursor + i) % bPool.length];

        // skip if person is not allowed for this task
        if (p.exceptions?.includes?.(t.slug)) continue;

        // availability: must be available both weeks of the ON pair
        if (!isAvailable(p, startsOn, w0)) continue;
        if (w1 < weeks && !isAvailable(p, startsOn, w1)) continue;

        // weekly capacity caps
        if (!can(p.id, w0, "biweekly")) continue;
        if (w1 < weeks && !can(p.id, w1, "biweekly")) continue;

        // fairness score: fewer blocks taken wins; tie is broken by cursor order
        const score = getBiBlocks(p.id);
        if (score < bestScore) {
          bestScore = score;
          bestPid = p.id;
        }
      }
      // rotate cursor so next block doesn’t always begin at same person
      biCursor = (biCursor + 1) % Math.max(1, bPool.length);
    }

    // assign picked person to the 2-week ON block
    if (bestPid != null) {
      cal[w0] = bestPid;
      bump(bestPid, w0);
      if (w1 < weeks) {
        cal[w1] = bestPid;
        bump(bestPid, w1);
      }
      // count this as ONE ON-block for fairness
      incBiBlocks(bestPid);
    }
    // the OFF half (w0+2, w0+3) stays null
  }

  // emit one slot per week for this bi-weekly task
  for (let w = 0; w < weeks; w++) {
    slots.push({ taskId: t.id, weekIndex: w, personId: cal[w] });
  }
}


  return slots;
}
