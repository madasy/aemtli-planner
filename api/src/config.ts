export const WEEK_COUNT = 16;

export const PEOPLE_WEEKLY = [
  "Anish", "Cécile", "Nea", "Aubrey", "Johanna", "Karin", "Mimi",
  "Laura", "Silvan", "Silja", "Sven", "Yusuke", "Ronja", "Agnes",
  "Mirjam", "Nelson", "Mishka"
];

export const PEOPLE_BIWEEKLY = [
  "Cécile", "Nea", "Ronja", "Agnes", "Mimi", "Laura", "Silvan", "Mirjam", "Mishka"
];

export const TASKS = [
  { slug: "kueche", title: "Küche", cadence: "weekly" },
  { slug: "esszimmer", title: "Esszimmer / Garten / Eingang / Empfang", cadence: "weekly" },
  { slug: "einkauf", title: "Einkauf (Brot/Butter/Milch/Einkaufsliste)", cadence: "weekly" },
  { slug: "putzraum", title: "Putzraum / Wäschküche / WC & Bühneli / Waschküche / Gang vor Küche", cadence: "weekly" },
  { slug: "abfall", title: "Abfallsacke / Müllcontainer / Strassenrand / Eingänge wischen / Kompost & Aschenbecher leeren", cadence: "weekly" },
  { slug: "entsorgungen", title: "Entsorgungen (Glas/ALU/PET/PE)", cadence: "weekly" },

  { slug: "stube_terrasse", title: "Stube oben / Terrasse", cadence: "biweekly", offsetWeeks: 2 },
  { slug: "treppenhaus", title: "Treppenhäuser saugen & aufnehmen (bis in den Keller)", cadence: "biweekly", offsetWeeks: 1 },
  { slug: "kuehlschrank_backofen", title: "Kühlschrank/Backofen/Dampfabzug reinigen & Filter wechseln", cadence: "biweekly", offsetWeeks: 0 }
];

export const LIMIT_WEEKLY = 1;
export const LIMIT_BIWEEKLY = 1;
