'use client';

import React, { useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';

type Task = { id: number; slug: string; title: string; cadence: 'weekly' | 'biweekly' };
type Slot = { taskId: number; weekIndex: number; personId: number | null };
type Person = { id: number; name: string };
type Duty = { id: number; kind: 'FIXED' | 'HONOR'; label: string; assignees: string; order: number };


export default function Plan() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<number | undefined>();
  const api = process.env.NEXT_PUBLIC_API_BASE || "/_api";

  useEffect(() => {
    axios
      .get('/_api/plan/current')
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
  }, [api]);

  if (!data) return <div>Lade Plan…</div>;

  if (data.empty) {
    return (
      <div className="p-4">
        Kein veröffentlichter Plan. Bitte im <a className="underline" href="/admin">Admin</a> „Generate“ & „Publish“ drücken.
      </div>
    );
  }

  const {
    tasks,
    slots,
    startsOn,
    people = [] as Person[],
    duties = [] as Duty[], // will be empty if API doesn’t provide; sections hide automatically
  } = data as {
    tasks: Task[];
    slots: Slot[];
    startsOn: string;
    people: Person[];
    duties?: Duty[];
  };

  const start = startsOn ? new Date(startsOn) : null;

  const weekly = (tasks as Task[]).filter((t) => t.cadence === 'weekly');
  const biweekly = (tasks as Task[]).filter((t) => t.cadence === 'biweekly');

  function monday(week: number): Date {
    const d = new Date(start as Date);
    d.setDate(d.getDate() + week * 7);
    return d;
  }

  function fmt(d: Date) {
    return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit' }).format(d);
  }

  function nameById(id: number | null) {
    if (id == null) return '';
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

  // Weekly row: simple 1-cell per week
  const WeeklyRow = (t: Task) => (
    <tr key={t.id}>
      <td className="cell-task">{t.title}</td>
      {Array.from({ length: 16 }, (_, week) => {
        const slot = (slots as Slot[]).find((s) => s.taskId === t.id && s.weekIndex === week);
        const personId = slot?.personId ?? null;
        const isEmpty = personId === null;
        const cls = `cell ${isEmpty ? 'cell-off' : ''}`;
        return (
          <td key={week} className={cls}>
            {nameById(personId)}
          </td>
        );
      })}
    </tr>
  );

  // Bi-weekly row: merge two-week ON pairs into one TD with colSpan=2 when same person
  const BiweeklyRow = (t: Task) => {
    const cells: React.ReactNode[] = [];
    for (let week = 0; week < 16; ) {
      const a0 = (slots as Slot[]).find((s) => s.taskId === t.id && s.weekIndex === week) || null;
      const a1 = week + 1 < 16 ? (slots as Slot[]).find((s) => s.taskId === t.id && s.weekIndex === week + 1) || null : null;

      const p0 = a0?.personId ?? null;
      const p1 = a1?.personId ?? null;

      const same = p0 === p1; // merge when same (including both null)
      const colSpan = same ? 2 : 1;

      const cls = `cell cell-biweekly ${p0 == null ? 'cell-off' : ''}`;

      cells.push(
        <td key={`${t.id}-${week}`} className={cls} colSpan={colSpan}>
          {nameById(p0)}
        </td>
      );

      week += same ? 2 : 1;
    }

    return (
      <tr key={t.id}>
        <td className="cell-task">{t.title}</td>
        {cells}
      </tr>
    );
  };

  const fixedDuties = duties.filter((d) => d.kind === 'FIXED').sort((a, b) => a.order - b.order);
  const honorDuties = duties.filter((d) => d.kind === 'HONOR').sort((a, b) => a.order - b.order);

  return (
    <>
      {/* print helpers */}
   <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .table-sticky thead th { position: static !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>



      {/* Top bar */}
      <div className="no-print flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h1 className="table-title m-0 text-lg font-semibold text-gray-800">Ämtliplan - Hacienda Jose</h1>

        <div className="flex items-center gap-4 flex-wrap"> {/* Increased gap for better spacing */}
    {/* Calendar export group */}
    <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-2 shadow-sm bg-white">
      <label htmlFor="ics-person-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">
        Kalender-Export (ICS):
      </label>
      <select
        id="ics-person-select"
        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
        value={selected}
        onChange={(e) => setSelected(Number(e.target.value))}
        title="Wähle eine Person für den ICS-Export"
      >
        <option value={0} disabled>Person auswählen</option> {/* Added a disabled placeholder option */}
        {(people as Person[]).map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      {/* ICS Export button */}
      <button
        className={`inline-flex items-center gap-1 border rounded-md px-3 py-1 text-sm font-medium 
                    ${selected === 0 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600 transition duration-150 ease-in-out'}`}
        onClick={() => selected !== 0 && (window.location.href = `/_api/ics/${selected}`)}
        disabled={selected === 0} // Disable button if no person is selected (value 0)
        title={selected === 0 ? "Bitte zuerst eine Person auswählen" : "ICS-Datei für die ausgewählte Person herunterladen"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h.01M12 11h.01M15 11h.01M7 15h.01M11 15h.01M15 15h.01M17 17H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2z" />
        </svg>
        Export
      </button>
    </div>

 {/* PDF Download */}
    <button
      className="inline-flex items-center gap-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium bg-white hover:bg-gray-100 shadow-sm transition duration-150 ease-in-out"
      onClick={() => window.open(`/_api/plan/pdf`, "_blank")}
      title="Den aktuellen Ämtliplan als PDF herunterladen"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2M19 12V5a2 2 0 00-2-2H7a2 2 0 00-2 2v7h14z" />
      </svg>
      PDF
    </button>

       {/* Admin link with a small house icon */}
    <a 
      href="/admin" 
      title="Zum Admin-Bereich wechseln" 
      className="inline-flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium bg-white hover:bg-gray-100 shadow-sm transition duration-150 ease-in-out"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Zm0-10.5V4m0 16v-1M4.93 4.93l.71.71M18.36 18.36l-.71-.71M4 12H3m18 0h-1M4.93 19.07l.71-.71M18.36 5.64l-.71.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Admin
    </a>
  </div>
</div>
      {/* Grid */}
      <div className="overflow-x-auto print-duties">
        <table className="min-w-full border border-gray-400 text-sm table-sticky">
          {Header}
          <tbody>
            {weekly.map((t) => WeeklyRow(t))}
            <tr><td colSpan={17} className="separator" /></tr>
            {biweekly.map((t) => BiweeklyRow(t))}
          </tbody>
        </table>
      </div>

      {/* Duties sections (render only if provided) */}
      {(fixedDuties.length > 0 || honorDuties.length > 0) && (
  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 print-duties">

    {fixedDuties.length > 0 && (
      <div className="print-fixed">
        <h2 className="text-base font-semibold mb-2">Feste Ämtli</h2>
        <table className="min-w-full border text-sm">
          <tbody>
            {fixedDuties.map((d) => (
              <tr key={d.id}>
                <td className="border px-2 py-1 w-1/2 border-gray-400 px-3 py-2 text-left font-medium bg-gray-50">{d.label}</td>
                <td className="border px-2 py-1 border-gray-300 px-3 py-2 text-center whitespace-nowrap">{d.assignees}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {honorDuties.length > 0 && (
      <div className="print-honor">
        <h2 className="text-base font-semibold mb-2">Ehren Ämtli</h2>
        <table className="min-w-full border text-sm">
          <tbody>
            {honorDuties.map((d) => (
              <tr key={d.id}>
                <td className="border px-2 py-1 w-1/2 border-gray-400 px-3 py-2 text-left font-medium bg-gray-50">{d.label}</td>
                <td className="border px-2 py-1 border-gray-300 px-3 py-2 text-center whitespace-nowrap">{d.assignees}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

  </div>
)}

    </>
  );
}