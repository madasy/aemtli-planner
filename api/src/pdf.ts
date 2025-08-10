import PDFDocument from "pdfkit";
import type { Response } from "express";
import { prisma } from "./db.js";

type Theme = {
  primary: string;
  headerBg: string;
  headerFg: string;
  biweeklyBg: string;
  emptyFg: string;
};

const THEME: Theme = {
  primary: "#333333",
  headerBg: "#EFEFF7",
  headerFg: "#000000",
  biweeklyBg: "#F3EFFE",
  emptyFg: "#9AA0A6",
};

/** Wraps text within a box, vertically centers it based on rendered height. */
function wrapText(
  doc: PDFKit.PDFDocument,
  str: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number,
  color: string,
  align: "left" | "center" = "left"
) {
  doc.fontSize(fontSize).fillColor(color);
  const textHeight = doc.heightOfString(str, { width: w, align });
  const yOffset = Math.max(y + (h - textHeight) / 2, y);
  doc.text(str, x, yOffset, { width: w, align, height: h });
}

/** Single-line “fit” with ellipsis for compact lists (duties). */
function fitText(
  doc: PDFKit.PDFDocument,
  str: string,
  maxWidth: number,
  fontSize: number
): string {
  doc.fontSize(fontSize);
  if (doc.widthOfString(str) <= maxWidth) return str;
  const ell = "…";
  let lo = 0, hi = str.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const s = str.slice(0, mid) + ell;
    if (doc.widthOfString(s) <= maxWidth) lo = mid; else hi = mid - 1;
  }
  return str.slice(0, lo) + ell;
}

export async function renderPlanPdf(res: Response) {
  const plan = await prisma.plan.findFirst({
    where: { status: "published" },
    orderBy: { startsOn: "desc" },
  });
  if (!plan) { res.status(404).send("No published plan"); return; }

  const [tasks, assignments, people, duties] = await Promise.all([
    prisma.task.findMany({ orderBy: { id: "asc" } }),
    prisma.assignment.findMany({
      where: { planId: plan.id },
      orderBy: [{ taskId: "asc" }, { weekIndex: "asc" }],
    }),
    prisma.person.findMany({ orderBy: { name: "asc" } }),
    prisma.duty.findMany({ orderBy: [{ kind: "asc" }, { order: "asc" }] }).catch(() => [] as any[]),
  ]);

  const personName = (id: number | null) =>
    id == null ? "" : (people.find(p => p.id === id)?.name ?? "—");

  const weekly   = tasks.filter(t => t.cadence === "weekly");
  const biweekly = tasks.filter(t => t.cadence === "biweekly");
  const cellFor  = (tid:number,w:number) =>
    assignments.find(a => a.taskId===tid && a.weekIndex===w) || null;

  const monday = (w:number) => {
    const d = new Date(plan.startsOn);
    d.setDate(d.getDate() + w*7);
    return new Intl.DateTimeFormat("de-CH", { day:"2-digit", month:"2-digit" }).format(d);
  };

  // PDF
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 22, right: 22, bottom: 24, left: 22 },
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="aemtli-plan.pdf"`);
  doc.pipe(res);

  // Metrics
  const left    = doc.page.margins.left;
  const top     = doc.page.margins.top;
  const usableW = doc.page.width  - doc.page.margins.left - doc.page.margins.right;

  const WEEKS   = 16;
  let taskColW  = 130;
  let cellW     = (usableW - taskColW) / WEEKS;
  if (cellW < 36) {
    taskColW = Math.max(105, usableW - 36 * WEEKS);
    cellW    = (usableW - taskColW) / WEEKS;
  }

  const TITLE_FS   = 14;
  const HEADER_FS  = 9;
  const CELL_FS    = 9;

  const headerH = 26;
  const BASE_ROW_H = 22;
  const VPAD = 4; // extra vertical padding used when expanding rows
  const TASK_INNER_W = taskColW - 12;
  const CELL_INNER_W = (wSpan:number) => cellW * wSpan - 12;

  // helpers to measure height
  const hTask = (s:string) => {
    doc.fontSize(CELL_FS);
    return Math.ceil(doc.heightOfString(s, { width: TASK_INNER_W }));
  };
  const hCell = (s:string, span=1, align:"left"|"center"="left") => {
    doc.fontSize(CELL_FS);
    return Math.ceil(doc.heightOfString(s, { width: CELL_INNER_W(span), align }));
  };

  const cellTextColor = (pid:number|null) => pid==null ? THEME.emptyFg : "#000";

  let y = top;

  // Title
  doc.fontSize(TITLE_FS).fillColor("#000").text("ÄMTLIPLAN – HACIENDA JOSE", left, y);
  y += 16;

  // Header
  doc.save();
  doc.rect(left, y, usableW, headerH).fill(THEME.headerBg);
  doc.restore();
  wrapText(doc, "Task", left + 7, y, taskColW - 14, headerH, HEADER_FS, THEME.headerFg, "left");
  for (let w = 0; w < WEEKS; w++) {
    const x = left + taskColW + cellW * w;
    wrapText(doc, monday(w), x + 6, y, cellW - 12, headerH, HEADER_FS, THEME.headerFg, "left");
  }
  doc.strokeColor(THEME.primary).lineWidth(0.6).rect(left, y, usableW, headerH).stroke();
  y += headerH;

  // ----------- Weekly rows (dynamic height) -----------
  for (const t of weekly) {
    // measure required height
    let rowH = hTask(t.title);
    for (let w = 0; w < WEEKS; w++) {
      const a = cellFor(t.id, w);
      const pid = a?.personId ?? null;
      rowH = Math.max(rowH, hCell(personName(pid)));
    }
    rowH = Math.max(BASE_ROW_H, rowH + VPAD*2);

    // draw row
    doc.strokeColor(THEME.primary).lineWidth(0.5).rect(left, y, taskColW, rowH).stroke();
    wrapText(doc, t.title, left + 6, y, TASK_INNER_W, rowH, CELL_FS, "#000", "left");

    for (let w = 0; w < WEEKS; w++) {
      const x = left + taskColW + cellW * w;
      const a = cellFor(t.id, w);
      const pid = a?.personId ?? null;
      wrapText(doc, personName(pid), x + 6, y, CELL_INNER_W(1), rowH, CELL_FS, cellTextColor(pid), "left");
      doc.strokeColor(THEME.primary).lineWidth(0.4).rect(x, y, cellW, rowH).stroke();
    }
    y += rowH;
  }

  // Separator
  y += 3;
  doc.moveTo(left, y).lineTo(left + usableW, y).lineWidth(1).strokeColor(THEME.primary).stroke();
  y += 5;

  // ----------- Bi-weekly rows (dynamic height, merged spans, centered) -----------
  for (const t of biweekly) {
    // measure
    let rowH = hTask(t.title);
    let wIdx = 0;
    while (wIdx < WEEKS) {
      const a0 = cellFor(t.id, wIdx);
      const a1 = wIdx + 1 < WEEKS ? cellFor(t.id, wIdx + 1) : null;
      const merge = !!(a0 && a1 && a0.personId != null && a1.personId === a0.personId);
      const span  = merge ? 2 : 1;
      const pid   = a0?.personId ?? null;
      rowH = Math.max(rowH, hCell(personName(pid), span, "center"));
      wIdx += span;
    }
    rowH = Math.max(BASE_ROW_H, rowH + VPAD*2);

    // draw
    doc.strokeColor(THEME.primary).lineWidth(0.5).rect(left, y, taskColW, rowH).stroke();
    wrapText(doc, t.title, left + 6, y, TASK_INNER_W, rowH, CELL_FS, "#000", "left");

    let w = 0;
    while (w < WEEKS) {
      const a0 = cellFor(t.id, w);
      const a1 = w + 1 < WEEKS ? cellFor(t.id, w + 1) : null;
      const merge = !!(a0 && a1 && a0.personId != null && a1.personId === a0.personId);
      const span  = merge ? 2 : 1;
      const x     = left + taskColW + cellW * w;
      const pid   = a0?.personId ?? null;

      doc.save();
      doc.rect(x, y, cellW * span, rowH).fill(THEME.biweeklyBg);
      doc.restore();
      doc.strokeColor(THEME.primary).lineWidth(0.4).rect(x, y, cellW * span, rowH).stroke();

      wrapText(doc, personName(pid), x + 6, y, CELL_INNER_W(span), rowH, CELL_FS, cellTextColor(pid), "center");
      w += span;
    }
    y += rowH;
  }

  // ----------- Feste / Ehren Ämtli -----------
  y += 12;
  const fixed = duties.filter((d:any)=>d.kind==='FIXED');
  const honor = duties.filter((d:any)=>d.kind==='HONOR');

  const blockGap = 20;
  const blockW   = (usableW - blockGap) / 2;

  doc.fillColor("#000").fontSize(11).text("Feste Ämtli", left, y);
  let by = y + 14;
  doc.fontSize(9);
  for (const d of fixed) {
    const l = fitText(doc, d.label || "", blockW * 0.55, 9);
    const r = fitText(doc, d.assignees || "", blockW * 0.4, 9);
    doc.text(l, left, by, { width: blockW * 0.55 });
    doc.text(r, left + blockW * 0.58, by, { width: blockW * 0.4 });
    by += 12;
  }

  const rightX = left + blockW + blockGap;
  doc.fillColor("#000").fontSize(11).text("Ehren Ämtli", rightX, y);
  by = y + 14;
  doc.fontSize(9);
  for (const d of honor) {
    const l = fitText(doc, d.label || "", blockW * 0.55, 9);
    const r = fitText(doc, d.assignees || "", blockW * 0.4, 9);
    doc.text(l, rightX, by, { width: blockW * 0.55 });
    doc.text(r, rightX + blockW * 0.58, by, { width: blockW * 0.4 });
    by += 12;
  }

  doc.end();
}
