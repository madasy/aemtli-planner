'use client';

import { useEffect, useMemo, useState } from 'react';

type Task = { id:number; slug:string; title:string; cadence:'weekly'|'biweekly' };
type Slot = { taskId:number; weekIndex:number; personId:number|null };
type Person = { id:number; name:string };

type PublicPlanResponse = {
  empty?: boolean;
  startsOn: string | null;
  weeks: number;
  tasks: Task[];
  slots: Slot[];
  people: Person[];
};

export default function Plan() {
  const api = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PublicPlanResponse>({
    empty: true, startsOn: null, weeks: 16, tasks: [], slots: [], people: []
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${api}/api/plan/current`, { cache: 'no-store' });
        const d: PublicPlanResponse = await r.json();
        if (alive) setData(d);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [api]);

  if (loading) return <div>Lade…</div>;
  if (data.empty || !data.startsOn) return <div>Kein veröffentlichter Plan.</div>;

  const { startsOn, weeks, tasks, slots, people } = data;

  const personName = (id:number|null) =>
    id==null ? '— frei —' : (people.find(p=>p.id===id)?.name ?? '—');

  // quick [taskId][week] -> slot
  const cell = useMemo(() => {
    const map = new Map<number, Map<number, Slot>>();
    for (const s of slots) {
      const m = map.get(s.taskId) ?? new Map<number, Slot>();
      m.set(s.weekIndex, s);
      map.set(s.taskId, m);
    }
    return (taskId:number, week:number) => map.get(taskId)?.get(week) || null;
  }, [slots]);

  const weeklyTasks   = tasks.filter(t=>t.cadence==='weekly');
  const biweeklyTasks = tasks.filter(t=>t.cadence==='biweekly');

  const mondayLabel = (week:number) => {
    const start = new Date(startsOn);
    start.setDate(start.getDate() + week*7);
    return new Intl.DateTimeFormat('de-CH', { day:'2-digit', month:'2-digit' }).format(start);
  };

  return (
    <div className="overflow-auto">
      <table className="min-w-full border text-sm table-sticky">
        <thead>
          <tr>
            <th className="cell-task">Task</th>
            {Array.from({length: weeks}, (_,i)=>(
              <th key={i} className="cell">{mondayLabel(i)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* weekly – 1:1 cells */}
          {weeklyTasks.map(t=>(
            <tr key={t.id}>
              <td className="cell-task">{t.title}</td>
              {Array.from({length: weeks}, (_,week)=>{
                const s = cell(t.id, week);
                const label = personName(s?.personId ?? null);
                return (
                  <td key={week} className="cell">{label}</td>
                );
              })}
            </tr>
          ))}

          <tr><td colSpan={weeks+1} className="separator" /></tr>

          {/* bi-weekly – merge adjacent equals */}
          {biweeklyTasks.map(t=>(
            <tr key={t.id}>
              <td className="cell-task">{t.title}</td>
              {(() => {
                const tds: React.ReactNode[] = [];
                for (let week = 0; week < weeks; ) {
                  const a0 = cell(t.id, week);
                  const a1 = week + 1 < weeks ? cell(t.id, week + 1) : null;

                  const same =
                    a1 !== null &&
                    (a0?.personId ?? null) === (a1?.personId ?? null);

                  const renderLabel = (s: Slot | null) =>
                    personName(s?.personId ?? null);

                  if (same) {
                    tds.push(
                      <td
                        key={`b-${t.id}-${week}`}
                        className="cell cell-biweekly"
                        colSpan={2}
                      >
                        {renderLabel(a0)}
                      </td>
                    );
                    week += 2;
                  } else {
                    tds.push(
                      <td
                        key={`b-${t.id}-${week}`}
                        className="cell cell-biweekly"
                      >
                        {renderLabel(a0)}
                      </td>
                    );
                    week += 1;
                  }
                }
                return tds;
              })()}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
