'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

type Task = { id:number; slug:string; title:string; cadence:'weekly'|'biweekly' };
type Slot = { taskId:number; week:number; personId:number|null };
type Person = { id:number; name:string };

export default function Plan() {
  const [data, setData] = useState<any>(null);
  const api = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

  useEffect(()=>{
    axios.get(api + "/api/plan/current").then(r=> setData(r.data));
  },[]);

  if(!data) return <div>Lade Plan…</div>;

  const { tasks, slots, startsOn, peopleWeekly, peopleBiweekly } = data;
  const start = new Date(startsOn);

  function monday(week:number) {
    const d = new Date(start); d.setDate(d.getDate() + week*7); return d;
  }
  function fmt(d:Date) {
    return new Intl.DateTimeFormat('de-CH', { day:'2-digit', month:'2-digit' }).format(d);
  }
  const people = [...peopleWeekly, ...peopleBiweekly] as Person[];

  function nameById(id:number|null) {
    if(id==null) return '— frei —';
    const p = people.find(x=>x.id===id);
    return p ? p.name : '—';
  }

  return (
    <div className="mt-4 overflow-auto">
      <table className="min-w-full border text-sm">
        <thead>
          <tr>
            <th className="border px-2 py-1 text-left">Task</th>
            {Array.from({length:16}, (_,i)=>(
              <th key={i} className="border px-2 py-1 text-center">{fmt(monday(i))}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t:Task)=>(
            <tr key={t.id}>
              <td className="border px-2 py-1">{t.title}</td>
              {Array.from({length:16}, (_,week)=>(
                <td key={week} className="border px-2 py-1 text-center">
                  {nameById(slots.find((s:Slot)=>s.taskId===t.id && s.week===week)?.personId ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
