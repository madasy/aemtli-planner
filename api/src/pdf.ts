import PDFDocument from "pdfkit";
import type { Response } from "express";
import { prisma } from "./db.js";

// Tailwind-ish colors
const PURPLE_50 = "#FAF5FF";
const GRAY_50   = "#F9FAFB";
const GRAY_100  = "#c9c9c9";
const GRAY_300  = "#D1D5DB";
const GRAY_400  = "#9CA3AF";
const BLACK     = "#000000";

type Theme = {
  primary: string;      // table outline
  headerBg: string;     // week header bg (except first "Task")
  headerFg: string;
  taskNameBg: string;   // left column bg (body)
  emptyBg: string;      // empty cell bg
  emptyFg: string;      // empty cell text
};

const THEME: Theme = {
  primary: "#333333",
  headerBg: PURPLE_50,
  headerFg: BLACK,
  taskNameBg: PURPLE_50,
  emptyBg: PURPLE_50,
  emptyFg: "#6B7280", // gray-500-ish
};

// draw text inside a box (wrap allowed) and vertically center it
function drawTextInBox(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number,
  color: string,
  align: "left" | "center" = "left",
  lineBreak = true
) {
  doc.fontSize(fontSize).fillColor(color);
  const textHeight = doc.heightOfString(text, { width: w, align, lineBreak });
  const yCentered = y + Math.max(0, (h - textHeight) / 2);
  doc.text(text, x, yCentered, { width: w, height: h, align, lineBreak });
}

// shrink font-size down to minFs so text fits targetWidth
function fitTextToWidth(
  doc: PDFKit.PDFDocument,
  text: string,
  targetWidth: number,
  startFs: number,
  minFs: number
) {
  const prev = (doc as any)._fontSize ?? startFs;
  let fs = startFs;
  while (fs > minFs) {
    doc.fontSize(fs);
    const w = doc.widthOfString(text);
    if (w <= targetWidth) break;
    fs -= 0.5;
  }
  doc.fontSize(prev);
  return fs;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export async function renderPlanPdf(res: Response) {
  // Data
  const plan = await prisma.plan.findFirst({
    where: { status: "published" },
    orderBy: { startsOn: "desc" },
  });
  if (!plan) { res.status(404).send("No published plan"); return; }

  const [tasks, assignments, people, duties] = await Promise.all([
    prisma.task.findMany({ orderBy: { id: "asc" } }),
    prisma.assignment.findMany({ where: { planId: plan.id }, orderBy: [{ taskId: "asc" }, { weekIndex: "asc" }] }),
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

  // PDF doc
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
  const usableH = doc.page.height - doc.page.margins.top  - doc.page.margins.bottom;

  const WEEKS         = 16;
  const HEADER_H      = 28;     // a bit taller for air
  const ROW_H         = 26;     // table row height (more air)
  const DUTY_ROW_H    = 18;     // smaller duty rows
  const TASKCOL_MIN   = 95;
  const CELL_MIN_W    = 34;
  const CELL_PAD      = 12;
  const BASE_CELL_FS  = 9;
  const MIN_CELL_FS   = 8;
  const TITLE_FS      = 14;
  const HEADER_FS     = 9;
  const DUTY_HEAD_FS  = 11;
  const DUTY_TEXT_FS  = 8;

  // longest assigned name (for single-line fit)
  let longestName = "";
  for (const a of assignments) {
    if (a.personId != null) {
      const n = personName(a.personId);
      if (n.length > longestName.length) longestName = n;
    }
  }
  if (!longestName) longestName = "Johanna";

  // Auto-fit: reduce task column then font
  let taskColW = 130;
  let cellW    = (usableW - taskColW) / WEEKS;
  let cellFs   = BASE_CELL_FS;

  const fitsLongest = () => {
    const prev = (doc as any)._fontSize ?? cellFs;
    doc.fontSize(cellFs);
    const ok = doc.widthOfString(longestName) <= (cellW - CELL_PAD);
    doc.fontSize(prev);
    return ok;
  };

  while (!fitsLongest() && taskColW > TASKCOL_MIN) {
    const nextTaskW = Math.max(TASKCOL_MIN, taskColW - 5);
    const nextCellW = (usableW - nextTaskW) / WEEKS;
    if (nextCellW < CELL_MIN_W) break;
    taskColW = nextTaskW;
    cellW    = nextCellW;
  }
  while (!fitsLongest() && cellFs > MIN_CELL_FS) cellFs -= 0.5;
  if (cellW < CELL_MIN_W) {
    cellW    = CELL_MIN_W;
    taskColW = usableW - WEEKS * cellW;
  }

  // Title
  doc.fontSize(TITLE_FS).fillColor(BLACK).text("ÄMTLIPLAN – HACIENDA JOSE", left, top);
  let y = top + 18;

  // Header: left "Task" white; week headers purple
  doc.rect(left, y, taskColW, HEADER_H).strokeColor(THEME.primary).lineWidth(0.6).stroke();
  drawTextInBox(doc, "Task", left + 7, y, taskColW - 14, HEADER_H, HEADER_FS, THEME.headerFg, "left");

  doc.save();
  doc.rect(left + taskColW, y, cellW * WEEKS, HEADER_H).fill(THEME.headerBg);
  doc.restore();

  for (let w = 0; w < WEEKS; w++) {
    const x = left + taskColW + cellW * w;
    drawTextInBox(doc, monday(w), x + 6, y, cellW - 12, HEADER_H, HEADER_FS, THEME.headerFg, "left");
    doc.rect(x, y, cellW, HEADER_H).strokeColor(THEME.primary).lineWidth(0.6).stroke();
  }
  y += HEADER_H;

  // WEEKLY rows
  for (const t of weekly) {
    // task cell bg purple
    doc.rect(left, y, taskColW, ROW_H).fillAndStroke(THEME.taskNameBg, THEME.primary);
    drawTextInBox(doc, t.title, left + 6, y, taskColW - 12, ROW_H, cellFs, BLACK, "left", true);

    for (let w = 0; w < WEEKS; w++) {
      const x   = left + taskColW + cellW * w;
      const a   = cellFor(t.id, w);
      const pid = a?.personId ?? null;
      const label = personName(pid);

      if (pid == null) { // bg only when empty
        doc.save();
        doc.rect(x, y, cellW, ROW_H).fill(THEME.emptyBg);
        doc.restore();
      }
      doc.rect(x, y, cellW, ROW_H).strokeColor(THEME.primary).lineWidth(0.4).stroke();

      const fs = clamp(fitTextToWidth(doc, label, cellW - CELL_PAD, cellFs, MIN_CELL_FS), MIN_CELL_FS, cellFs);
      drawTextInBox(doc, label || "", x + 6, y, cellW - 12, ROW_H, fs, pid == null ? THEME.emptyFg : BLACK, "left");
    }
    y += ROW_H;
  }

  // separator
  y += 4;
  doc.moveTo(left, y).lineTo(left + taskColW + cellW * WEEKS, y).lineWidth(1).strokeColor(THEME.primary).stroke();
  y += 6;

  // BIWEEKLY rows (merge contiguous equal assignee)
  for (const t of biweekly) {
    doc.rect(left, y, taskColW, ROW_H).fillAndStroke(THEME.taskNameBg, THEME.primary);
    drawTextInBox(doc, t.title, left + 6, y, taskColW - 12, ROW_H, cellFs, BLACK, "left", true);

    let w = 0;
    while (w < WEEKS) {
      const a0 = cellFor(t.id, w);
      const a1 = w + 1 < WEEKS ? cellFor(t.id, w + 1) : null;
      const same = !!(a0 && a1 && a0.personId != null && a1.personId === a0.personId);
      const span = same ? 2 : 1;

      const x   = left + taskColW + cellW * w;
      const pid = a0?.personId ?? null;
      const label = personName(pid);

      if (pid == null) {
        doc.save();
        doc.rect(x, y, cellW * span, ROW_H).fill(THEME.emptyBg);
        doc.restore();
      }
      doc.rect(x, y, cellW * span, ROW_H).strokeColor(THEME.primary).lineWidth(0.4).stroke();

      const fs = clamp(fitTextToWidth(doc, label, cellW * span - CELL_PAD, cellFs, MIN_CELL_FS), MIN_CELL_FS, cellFs);
      drawTextInBox(doc, label || "", x + 6, y, cellW * span - 12, ROW_H, fs, pid == null ? THEME.emptyFg : BLACK, "center");

      w += span;
    }
    y += ROW_H;
  }

  // ---- Duties (Fixed / Honor) aligned to bottom ----
  const fixed = duties.filter((d:any)=>d.kind==='FIXED').sort((a:any,b:any)=>a.order-b.order);
  const honor = duties.filter((d:any)=>d.kind==='HONOR').sort((a:any,b:any)=>a.order-b.order);

  const gap    = 20;
  const tableWidth = taskColW + cellW * WEEKS;
  const blockW = (tableWidth - gap) / 2;
  const leftX  = left;
  const rightX = left + blockW + gap;

  // compute how much height we need for the duties and push to bottom
  const headsH     = 14; // space for "Feste Ämtli"/"Ehren Ämtli" headings
  const fixedH     = fixed.length * DUTY_ROW_H;
  const honorH     = honor.length * DUTY_ROW_H;
  const dutiesH    = Math.max(fixedH, honorH) + headsH;

  const bottomY = top + usableH; // printable bottom
  const dutyStartY = Math.max(y + 10, bottomY - dutiesH); // keep a little gap after table
  y = dutyStartY;

  function drawDutyBlock(x: number, title: string, rows: any[]) {
    doc.fillColor(BLACK).fontSize(DUTY_HEAD_FS).text(title, x, y);
    let ry = y + headsH;
    for (const d of rows) {
      const labelW     = blockW * 0.55;
      const assigneesW = blockW * 0.45;

      // label cell (bg gray-50, border gray-400, left)
      doc.save();
      doc.rect(x, ry, labelW, DUTY_ROW_H).fill(GRAY_100).strokeColor(GRAY_400).lineWidth(0.5).stroke();
      doc.restore();
      drawTextInBox(doc, String(d.label || ""), x + 8, ry, labelW - 16, DUTY_ROW_H, DUTY_TEXT_FS, BLACK, "left");

      // assignees cell (center, border gray-300)
      const ax = x + labelW;
      doc.rect(ax, ry, assigneesW, DUTY_ROW_H).fill(GRAY_50).strokeColor(GRAY_300).lineWidth(0.5).stroke();
      drawTextInBox(doc, String(d.assignees || ""), ax + 8, ry, assigneesW - 16, DUTY_ROW_H, DUTY_TEXT_FS, BLACK, "center");

      ry += DUTY_ROW_H;
    }
  }

  drawDutyBlock(leftX,  "Feste Ämtli", fixed);
  drawDutyBlock(rightX, "Ehren Ämtli", honor);

  doc.end();
}
