'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

type Task = { id: number; slug: string; title: string; cadence: 'weekly' | 'biweekly' };
type Slot = { taskId: number; weekIndex: number; personId: number | null };
type Person = { id: number; name: string };

export default function Plan() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<number | undefined>();
  const api = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  useEffect(() => {
    axios
      .get(api + '/api/plan/current')
      .then((r) => {
        setData(r.data);
        const ppl: Person[] = r.data.people ?? [];
        if (ppl.length) setSelected(ppl[0].id);
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          setData({ empty: true });
        } else {
          console.error(err);
        }
      });
  }, []);

  if (!data) return <div>Lade Plan…</div>;

  if (!data || data.empty) {
    return (
      <div className="p-4">
        Kein veröffentlichter Plan. Bitte im <a className="underline" href="/admin">Admin</a> „Generate“ & „Publish“ drücken.
      </div>
    );
  }

  const { tasks, slots, startsOn, people = [] as Person[] } = data as {
    tasks: Task[];
    slots: Slot[];
    startsOn: string;
    people: Person[];
  };

  const start = startsOn ? new Date(startsOn) : null;

  const weekly = (tasks as Task[]).filter((t) => t.cadence === 'weekly');
  const biweekly = (tasks as Task[]).filter((t) => t.cadence === 'biweekly');

  function monday(week: number): Date {
    // Only call this when start is non-null; guard at call sites
    const d = new Date(start as Date);
    d.setDate(d.getDate() + week * 7);
    return d;
  }

  function fmt(d: Date) {
    return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit' }).format(d);
  }

  function nameById(id: number | null) {
    if (id == null) return '— frei —';
    const p = (people as Person[]).find((x) => x.id === id);
    return p ? p.name : '—';
  }

  const Header = (
    <thead>
      <tr>
        <th className="cell-task">Task</th>
        {Array.from({ length: 16 }, (_, i) => (
          <th key={i} className="cell week-head">
            {start ? fmt(monday(i)) : '??.??'}
          </th>
        ))}
      </tr>
    </thead>
  );

  const Row = (t: Task, isBiweekly: boolean) => (
    <tr key={t.id}>
      <td className="cell-task">{t.title}</td>
      {Array.from({ length: 16 }, (_, week) => {
        const slot = (slots as Slot[]).find((s) => s.taskId === t.id && s.weekIndex === week);
        const personId = slot?.personId ?? null;
        const isEmpty = personId === null;
        const cls = `cell ${isBiweekly ? 'cell-biweekly' : ''} ${isEmpty ? 'cell-off' : ''}`;
        return (
          <td key={week} className={cls}>
            {nameById(personId)}
          </td>
        );
      })}
    </tr>
  );

  return (
    <div className="mt-2">
      <h1 className="table-title">Ämtliplan - Hacienda Jose</h1>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-400 text-sm table-sticky">
          {Header}
          <tbody>
            {weekly.map((t) => Row(t, false))}
            <tr>
              <td colSpan={17} className="separator" />
            </tr>
            {biweekly.map((t) => Row(t, true))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <label className="text-sm">Calendar Export</label>
        <select
          className="border rounded px-2 py-1"
          value={selected}
          onChange={(e) => setSelected(Number(e.target.value))}
        >
          {(people as Person[]).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="border rounded px-3 py-1"
          onClick={() => selected && (window.location.href = `${api}/api/ics/${selected}`)}
        >
          Download
        </button>
      </div>
    </div>
  );
}
