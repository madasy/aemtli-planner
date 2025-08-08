'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

export default function Admin() {
  const api = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
  const [data, setData] = useState<any>(null);

  useEffect(()=>{
    axios.get(api + "/api/plan/current").then(r=> setData(r.data));
  },[]);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Admin – Draft (Demo)</h1>
      <p className="mb-4 text-sm text-gray-600">Drag&Drop folgt – aktuell Read‑only Preview. ICS kannst du pro Person via API abrufen: <code>/api/ics/:personId</code>.</p>
      <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
