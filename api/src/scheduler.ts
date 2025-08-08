import { addDays } from "date-fns";
import { LIMIT_BIWEEKLY, LIMIT_WEEKLY, TASKS, WEEK_COUNT } from "./config.js";

export type Person = { id:number; name:string; shame:number; activeWeekly:boolean; activeBiweekly:boolean };
export type Task = { id:number; slug:string; title:string; cadence:'weekly'|'biweekly'; offsetWeeks?: number };
export type Slot = { taskId:number; week:number; personId:number|null };

export function nextMonday(from = new Date()): Date {
  const d = new Date(from);
  const day = d.getDay(); // 0=So,1=Mo
  const diff = (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

export function mondayOfWeek(startMonday: Date, weekIndex: number): Date {
  const d = new Date(startMonday);
  d.setDate(d.getDate() + 7*weekIndex);
  return d;
}

function* infinite<T>(arr: T[]) {
  let i = 0;
  while (true) {
    yield arr[i % arr.length];
    i++;
  }
}

export function buildPlan({ startsOn, weeks, peopleWeekly, peopleBiweekly, tasks }:{ 
  startsOn: Date; weeks: number; peopleWeekly: Person[]; peopleBiweekly: Person[]; tasks: Task[];
}): Slot[] {
  const slots: Slot[] = [];
  const perWeekLoad = new Map<number, Map<number, number>>(); // week -> personId -> count

  function canAssign(personId:number, week:number, kind:'weekly'|'biweekly') {
    const map = perWeekLoad.get(week) ?? new Map<number,number>();
    const count = map.get(personId) ?? 0;
    const cap = kind === 'weekly' ? LIMIT_WEEKLY : LIMIT_BIWEEKLY;
    return count < cap;
  }
  function bump(personId:number, week:number) {
    const map = perWeekLoad.get(week) ?? new Map<number,number>();
    const val = map.get(personId) ?? 0;
    map.set(personId, val+1);
    perWeekLoad.set(week, map);
  }

  const weeklyGen = infinite(peopleWeekly);
  const biweeklyGen = infinite(peopleBiweekly);

  for (let week=0; week<weeks; week++) {
    for (const t of tasks.filter(t=>t.cadence==='weekly')) {
      // pick next weekly respecting cap
      let picked: number | null = null;
      for (let i=0;i<peopleWeekly.length*2;i++) {
        const p = weeklyGen.next().value as Person;
        if (canAssign(p.id, week, 'weekly')) { picked = p.id; break; }
      }
      if (picked==null) continue;
      bump(picked, week);
      slots.push({ taskId: t.id, week, personId: picked });
    }
    // biweekly with offset
    for (const t of tasks.filter(t=>t.cadence==='biweekly')) {
      const off = (t as any).offsetWeeks ?? 0;
      if (week < off || ((week - off) % 2) !== 0) {
        slots.push({ taskId: t.id, week, personId: null }); // off week
        continue;
      }
      let picked: number | null = null;
      for (let i=0;i<peopleBiweekly.length*2;i++) {
        const p = biweeklyGen.next().value as Person;
        if (canAssign(p.id, week, 'biweekly')) { picked = p.id; break; }
      }
      if (picked==null) { slots.push({ taskId: t.id, week, personId: null }); continue; }
      bump(picked, week);
      slots.push({ taskId: t.id, week, personId: picked });
    }
  }
  return slots;
}

export function seedTasks(): Task[] {
  return TASKS.map((t, i) => ({ id: i+1, slug: t.slug, title: t.title, cadence: t.cadence as any, offsetWeeks: (t as any).offsetWeeks ?? 0 }));
}
