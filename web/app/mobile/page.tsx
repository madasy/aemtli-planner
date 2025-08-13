'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';

type Task = { id: number; slug: string; title: string; cadence: 'weekly' | 'biweekly' };
type Slot = { taskId: number; weekIndex: number; personId: number | null };
type Person = { id: number; name: string };

export default function MobilePlan() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<number | undefined>();
  const [week, setWeek] = useState(0);
  const api = process.env.NEXT_PUBLIC_API_BASE || "/_api";
  
  useEffect(() => {
    axios
      .get('/_api/plan/current')
      .then((r) => {
        setData(r.data);
        const ppl: Person[] = r.data.people ?? [];
        if (ppl.length) setSelected(ppl[0].id);

        // Default auf aktuelle Woche
        const startsOn: string | undefined = r.data?.startsOn;
        if (startsOn) {
          const start = new Date(startsOn);
          if (!Number.isNaN(start.getTime())) {
            const diff = Date.now() - start.getTime();
            const idx = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
            if (idx >= 0 && idx < 16) setWeek(idx);
          }
        }
      })
      .catch((err) => {
        setData({ empty: true });
      });
  }, [api]);

  if (!data) return <main className="p-4">Lade Plan…</main>;

  if (data.empty) {
    return (
      <main className="p-4 space-y-4">
        <TopBar api={api} people={[]} selected={selected} setSelected={setSelected} />
        <div className="rounded border p-3 text-sm text-gray-700">
          Kein veröffentlichter Plan. Bitte im <a className="underline" href="/admin">Admin</a> „Generate“ & „Publish“ drücken.
        </div>
      </main>
    );
  }

  const {
    tasks,
    slots,
    startsOn,
    people = [] as Person[],
  } = data as {
    tasks: Task[];
    slots: Slot[];
    startsOn: string;
    people: Person[];
  };

  const start = startsOn ? new Date(startsOn) : null;

  function monday(w: number) {
    if (!start) return null;
    const d = new Date(start);
    d.setDate(d.getDate() + w * 7);
    return d;
  }

  function fmt(d: Date | null) {
    return d ? new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit' }).format(d) : '??.??';
  }

  function nameById(id: number | null) {
    if (id == null) return '— frei —';
    const p = (people as Person[]).find((x) => x.id === id);
    return p ? p.name : '—';
  }

  // Aufgaben für die aktuelle Woche
  const currentWeek = Math.min(15, Math.max(0, week));
  const weekly = (tasks as Task[]).filter((t) => t.cadence === 'weekly');
  const biweekly = (tasks as Task[]).filter((t) => t.cadence === 'biweekly');

  function slotFor(tid: number, w: number) {
    return (slots as Slot[]).find((s) => s.taskId === tid && s.weekIndex === w) || null;
  }

  return (
    <main className="p-4 space-y-4">
      <TopBar api={api} people={people} selected={selected} setSelected={setSelected} />

      {/* Week picker */}
      <div className="flex items-center gap-2">
        <button
          className="border rounded px-2 py-1 text-sm disabled:opacity-40"
          onClick={() => setWeek((w) => Math.max(0, w - 1))}
          disabled={currentWeek === 0}
        >
          ◀︎
        </button>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={currentWeek}
          onChange={(e) => setWeek(Number(e.target.value))}
        >
          {Array.from({ length: 16 }, (_, i) => (
            <option key={i} value={i}>
              Woche {i + 1} ({fmt(monday(i))})
            </option>
          ))}
        </select>
        <button
          className="border rounded px-2 py-1 text-sm disabled:opacity-40"
          onClick={() => setWeek((w) => Math.min(15, w + 1))}
          disabled={currentWeek === 15}
        >
          ▶︎
        </button>
      </div>

      {/* Aufgaben-Liste kompakt */}
      <section className="rounded border divide-y bg-white shadow-sm">
        <div className="px-3 py-2 text-sm font-semibold bg-gray-50 sticky top-0 z-10">
          Aufgaben für Woche {currentWeek + 1} ({fmt(monday(currentWeek))})
        </div>
        {[...weekly, ...biweekly].map((t) => {
          const s = slotFor(t.id, currentWeek);
          const empty = !s?.personId;
          return (
            <div key={t.id} className="flex items-center justify-between px-3 py-2">
              <div className="flex-1 text-sm text-gray-800 truncate">{t.title}</div>
              <div className={`ml-2 text-xs px-2 py-1 rounded ${empty ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-800 font-medium'}`}>
                {nameById(s?.personId ?? null)}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}

/* ---------- TopBar nur mit ICS + PDF ---------- */

function TopBar({
  api,
  people,
  selected,
  setSelected,
}: {
  api: string;
  people: Person[];
  selected: number | undefined;
  setSelected: (id: number) => void;
}) {
  return (
    
    <div className="flex flex-wrap items-center gap-2 mb-2">
         <h1 className="table-title m-0 text-lg font-semibold text-gray-800">Ämtliplan - Hacienda Jose</h1>
         
      {/* ICS */}
      <div className="flex items-center gap-2 border border-gray-300 rounded px-2 py-1 bg-white">
        <label htmlFor="ics-person" className="text-sm whitespace-nowrap">Kalender:</label>
        <select
          id="ics-person"
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          value={selected ?? 0}
          onChange={(e) => setSelected(Number(e.target.value))}
        >
          <option value={0} disabled>Person…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          className={`text-sm px-2 py-1 rounded ${!selected ? 'bg-gray-200 text-gray-500' : 'bg-blue-500 text-white'}`}
          onClick={() => selected && (window.location.href = `/_api/ics/${selected}`)}
          disabled={!selected}
        >
          Export
        </button>
      </div>
      

      {/* PDF */}
      <button
        className="text-sm px-3 py-1 rounded border border-gray-300 bg-white"
        onClick={() => window.open(`/_api/plan/pdf`, "_blank")}
      >
        PDF Download
      </button>
    </div>
  );
}