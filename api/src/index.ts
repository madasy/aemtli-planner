import express from "express";
import cors from "cors";
import { buildPlan, nextMonday, seedTasks } from "./scheduler.js";
import { WEEK_COUNT, PEOPLE_WEEKLY, PEOPLE_BIWEEKLY, LIMIT_WEEKLY, LIMIT_BIWEEKLY } from "./config.js";
import { createEvents } from "ics";

const app = express();
app.use(cors());
app.use(express.json());

// In‑Memory IDs
const peopleWeekly = PEOPLE_WEEKLY.map((name, idx)=>({ id: idx+1, name, shame:0, activeWeekly:true, activeBiweekly: false }));
const peopleBiweekly = PEOPLE_BIWEEKLY.map((name, idx)=>({ id: idx+101, name, shame:0, activeWeekly:false, activeBiweekly: true }));
const tasks = seedTasks();

// current plan (regenerates on each run; in prod: persist + publish)
app.get("/api/plan/current", (_req, res) => {
  const start = nextMonday();
  const slots = buildPlan({ startsOn: start, weeks: WEEK_COUNT, peopleWeekly, peopleBiweekly, tasks });
  res.json({ startsOn: start, weeks: WEEK_COUNT, tasks, peopleWeekly, peopleBiweekly, slots });
});

// ICS for person
app.get("/api/ics/:personId", (req, res) => {
  const personId = parseInt(req.params.personId, 10);
  const start = nextMonday();
  const slots = buildPlan({ startsOn: start, weeks: WEEK_COUNT, peopleWeekly, peopleBiweekly, tasks });
  const personSlots = slots.filter(s => s.personId === personId);
  const person = [...peopleWeekly, ...peopleBiweekly].find(p=>p.id===personId);

  const startTime = process.env.ICS_START_TIME || "18:00";
  const [hh, mm] = startTime.split(":").map(x=>parseInt(x,10));

  const events = personSlots.map(s => {
    const monday = new Date(start);
    monday.setDate(monday.getDate() + 7*s.week);
    const task = tasks.find(t=>t.id===s.taskId)!;
    return {
      uid: `assign-${s.taskId}-${s.week}-${personId}@aemtli`,
      title: `Ämtli – ${task.title}`,
      start: [monday.getFullYear(), monday.getMonth()+1, monday.getDate(), hh, mm||0],
      end: [monday.getFullYear(), monday.getMonth()+1, monday.getDate(), (hh+1)%24, mm||0],
      description: `Woche ${s.week+1} von 16`
    };
  });

  const { error, value } = createEvents(events);
  if (error) {
    res.status(500).send(String(error));
    return;
  }
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${person?.name || "user"}-aemtli.ics"`);
  res.send(value);
});

app.get("/", (_req, res)=>res.send("Ämtli API OK"));

const port = process.env.PORT || 4000;
app.listen(port, ()=> console.log(`API listening on :${port} (weekly cap=${LIMIT_WEEKLY}, biweekly cap=${LIMIT_BIWEEKLY})`));
