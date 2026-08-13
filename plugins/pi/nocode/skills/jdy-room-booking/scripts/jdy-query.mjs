// 查空闲会议室：按 日期 × 区域 × 时段，调 filter_link（模板改值，不改结构），
// 分页取全，按房间聚合 → 输出"在要求时间全空的房间"（带容量）。
//
// 用法: node jdy-query.mjs --date 2026-07-12 --regions 无锡,南京 --period 下午
//       node jdy-query.mjs --date 2026-07-12 --regions 无锡 --slots 14:00:00-14:30:00,14:30:00-15:00:00
import { readFileSync } from 'node:fs';
import { evalInPage, cfg } from './jdy-cdp.mjs';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const date = arg('date', todayLocal());
const regions = arg('regions', cfg.regions.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const periodArg = arg('period', '');
const slotsArg = arg('slots', '');

// 解析目标时段：--slots 优先，否则 --period 展开为该段全部半小时槽
let slots;
if (slotsArg) slots = slotsArg.split(',').map((s) => s.trim());
else if (periodArg && cfg.periods[periodArg]) slots = cfg.periods[periodArg];
else { console.error('必须给 --period（上午/下午/晚上）或 --slots'); process.exit(1); }

// 目标槽所属的时段段（filter 里 period 条件要跟 timeslot 一致）
const periods = [...new Set(slots.flatMap((s) => Object.keys(cfg.periods).filter((p) => cfg.periods[p].includes(s))))];

// 拿模板，按值替换 filter.cond（结构一字不改；nin 置空以不误排除）
const tmpl = JSON.parse(readFileSync(new URL('../references/filter-link.template.json', import.meta.url)));
tmpl.filter.cond = tmpl.filter.cond.map((c) => {
  if (c.type === 'datetime') return { ...c, value: [date] };
  if (c.field === cfg.fields.area) return { ...c, value: regions };
  if (c.field === cfg.fields.periodOnBookingForm) return { ...c, value: periods };
  if (c.field === cfg.fields.timeslot) return { ...c, value: slots };
  if (c.method === 'nin') return { ...c, value: [] };
  return c;
});

const F = cfg.fields;
const rows = await evalInPage(`async (H) => {
  const base = ${JSON.stringify(tmpl)};
  const all = [];
  let skip = 0;
  for (let page = 0; page < 20; page++) {           // 分页取全（上限 20 页兜底）
    const body = { ...base, skip, limit: 100 };
    const r = await fetch('/_/data_process/data/filter_link', { method: 'POST', headers: H, credentials: 'include', body: JSON.stringify(body) });
    const j = await r.json();
    if (r.status !== 200) return { __httpError: r.status, msg: j.msg };
    const d = j.dataList || [];
    all.push(...d);
    if (d.length < 100) break;
    skip += 100;
  }
  return all;
}`);

if (rows.__httpError) {
  console.error(`filter_link 失败 ${rows.__httpError}: ${rows.msg || ''}`);
  process.exit(1);
}

// 按房间聚合：每房收集其在目标槽里空闲的槽 + 容量/区域/地点
const byRoom = new Map();
for (const r of rows) {
  const name = r[F.name];
  if (!byRoom.has(name)) byRoom.set(name, { name, region: r[F.area], place: r[F.place], capacity: Number(r[F.capacity]) || 0, freeSlots: new Set() });
  byRoom.get(name).freeSlots.add(r[F.timeslot]);
}
const want = new Set(slots);
const rooms = [...byRoom.values()].map((x) => ({
  name: x.name, region: x.region, place: x.place, capacity: x.capacity,
  freeSlots: [...x.freeSlots].filter((s) => want.has(s)).sort(),
  fullyFree: slots.every((s) => x.freeSlots.has(s))
}));
const fullyFree = rooms.filter((x) => x.fullyFree).sort((a, b) => b.capacity - a.capacity);

console.log(JSON.stringify({ date, regions, slots, totalRoomsSeen: rooms.length, fullyFreeCount: fullyFree.length, fullyFreeRooms: fullyFree, partialRooms: rooms.filter((x) => !x.fullyFree) }, null, 2));
