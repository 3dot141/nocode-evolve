// 提交预约：为指定房间的指定时段建预约。
// 机制：filter_link 拿该房每个槽的真实记录(槽_id=关联id / 组合键 / 照片) → 建子表(每槽一行)
//       + 计算日期/区域/时段派生字段 → 套 create 模板 → POST /data/create。
//
// ⚠️ 写操作。只有 SKILL.md 判定"该订"时才调用本脚本。成功返回新记录 id。
// 用法: node jdy-book.mjs --date 2026-07-12 --region 无锡 --room 906 \
//         --slots 09:00:00-09:30:00,09:30:00-10:00:00 --name "周会"
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { evalInPage, cfg } from './jdy-cdp.mjs';

function arg(name, def) { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def; }
const date = arg('date'); const region = arg('region'); const room = arg('room');
const meetingName = arg('name', `${'预约'}-${room}`);
const periodArg = arg('period', ''); const slotsArg = arg('slots', '');
if (!date || !region || !room) { console.error('必须给 --date --region --room'); process.exit(1); }

let slots;
if (slotsArg) slots = slotsArg.split(',').map((s) => s.trim());
else if (periodArg && cfg.periods[periodArg]) slots = cfg.periods[periodArg];
else { console.error('必须给 --period 或 --slots'); process.exit(1); }
const periods = [...new Set(slots.flatMap((s) => Object.keys(cfg.periods).filter((p) => cfg.periods[p].includes(s))))];

// —— 日期/时段派生（观察 create 抓包总结的确定性规则）——
const tsOf = (t) => Date.parse(`${date}T${t}+08:00`);              // "HH:MM:SS" → 毫秒(东八区)
const startOf = (s) => s.split('-')[0]; const endOf = (s) => s.split('-')[1];
const dateMidnightTs = Date.parse(`${date}T00:00:00+08:00`);
const F = cfg.fields; const CF = cfg.createFields;

// 拿 create 模板
const tmpl = JSON.parse(readFileSync(new URL('../references/create.template.json', import.meta.url)));
// 子表单行结构（拿模板第一行做骨架，运行时按槽填充）
const rowSkeleton = JSON.parse(JSON.stringify(tmpl.values[CF.roomSubtable].data[0]));

const filterTmpl = JSON.parse(readFileSync(new URL('../references/filter-link.template.json', import.meta.url)));
filterTmpl.filter.cond = filterTmpl.filter.cond.map((c) => {
  if (c.type === 'datetime') return { ...c, value: [date] };
  if (c.field === F.area) return { ...c, value: [region] };
  if (c.field === F.periodOnBookingForm) return { ...c, value: periods };
  if (c.field === F.timeslot) return { ...c, value: slots };
  if (c.method === 'nin') return { ...c, value: [] };
  return c;
});

const result = await evalInPage(`async (H) => {
  // 1) 拿该房各槽的真实空闲记录
  const fr = await fetch('/_/data_process/data/filter_link', { method: 'POST', headers: H, credentials: 'include', body: JSON.stringify(${JSON.stringify(filterTmpl)}) });
  const fj = await fr.json();
  if (fr.status !== 200) return { __err: 'filter_link', status: fr.status, msg: fj.msg };
  const want = ${JSON.stringify(slots)};
  const rows = (fj.dataList || []).filter((x) => x[${JSON.stringify(F.name)}] === ${JSON.stringify(room)} && want.includes(x[${JSON.stringify(F.timeslot)}]));
  const gotSlots = rows.map((x) => x[${JSON.stringify(F.timeslot)}]);
  const missing = want.filter((s) => !gotSlots.includes(s));
  if (missing.length) return { __err: 'not_free', room: ${JSON.stringify(room)}, missingSlots: missing, freeSlots: gotSlots };

  // 2) 建子表：每槽一行（关联 id = 该槽记录 _id；组合键/照片/起止时间戳按槽填）
  const rowSkel = ${JSON.stringify(rowSkeleton)};
  const subRows = want.map((slot) => {
    const rec = rows.find((x) => x[${JSON.stringify(F.timeslot)}] === slot);
    const r = JSON.parse(JSON.stringify(rowSkel));
    r[${JSON.stringify(CF.subRelationId)}] = { data: { id: rec._id } };
    r[${JSON.stringify(CF.subRoomName)}] = { data: ${JSON.stringify(room)} };
    r[${JSON.stringify(CF.subSlot)}] = { data: slot };
    r[${JSON.stringify(CF.subCompositeKey)}] = { data: ${JSON.stringify(room)} + '@' + ${JSON.stringify(date)} + '@' + slot };
    if (rec[${JSON.stringify(F.photo)}]) r[${JSON.stringify(CF.subPhoto)}] = { data: rec[${JSON.stringify(F.photo)}] };
    return r;
  });

  // 3) 套模板 + 顶层派生字段替换
  const cr = ${JSON.stringify(tmpl)};
  const v = cr.values;
  v[${JSON.stringify(CF.dateTs)}].data = ${dateMidnightTs};
  v[${JSON.stringify(CF.regionArr)}].data = [${JSON.stringify(region)}];
  v[${JSON.stringify(CF.periodArr)}].data = ${JSON.stringify(periods)};
  v[${JSON.stringify(CF.slotsArr)}].data = want;
  v[${JSON.stringify(CF.meetingName)}].data = ${JSON.stringify(meetingName)};
  v[${JSON.stringify(CF.roomSubtable)}].data = subRows;
  v[${JSON.stringify(CF.derivedSlotsCsv)}].data = want.join(',');
  v[${JSON.stringify(CF.derivedSlotsArr)}].data = want;
  v[${JSON.stringify(CF.derivedRegionPeriodSlots)}].data = ${JSON.stringify(region)} + ${JSON.stringify(periods.join(''))} + want.join(',');
  v[${JSON.stringify(CF.derivedRoomName)}].data = ${JSON.stringify(room)};
  v[${JSON.stringify(CF.derivedStartStr)}].data = ${JSON.stringify(date + ' ')} + want[0].split('-')[0];
  v[${JSON.stringify(CF.derivedEndStr)}].data = ${JSON.stringify(date + ' ')} + want[want.length - 1].split('-')[1];
  v[${JSON.stringify(CF.derivedFilterJson)}].data = JSON.stringify({ rel: 'and', cond: [
    { field: 'date', type: 'text', method: 'eq', value: [${JSON.stringify(date)}] },
    { field: 'time', type: 'text', method: 'in', value: want },
    { field: 'key2', type: 'text', method: 'not_empty' } ] });
  // 子表起止时间戳（每行）——补齐（rowSkeleton 里可能是旧值）
  cr.values[${JSON.stringify(CF.roomSubtable)}].data.forEach((r, i) => {
    const slot = want[i];
    r[${JSON.stringify(CF.subStartTs)}] = { data: Date.parse(${JSON.stringify(date)} + 'T' + slot.split('-')[0] + '+08:00') };
    r[${JSON.stringify(CF.subEndTs)}] = { data: Date.parse(${JSON.stringify(date)} + 'T' + slot.split('-')[1] + '+08:00') };
  });
  cr.dataOpId = ${JSON.stringify(randomUUID())};

  // 4) POST create
  const r = await fetch('/_/data_process/data/create', { method: 'POST', headers: H, credentials: 'include', body: JSON.stringify(cr) });
  let j; try { j = await r.json(); } catch { j = { raw: (await r.text()).slice(0, 300) }; }
  return { status: r.status, check_code: j.check_code, msg: j.check_msg || j.msg, newId: j.data && j.data._id, bookedSlots: want };
}`);

if (result.__err) { console.error(`预约失败[${result.__err}]: ${JSON.stringify(result)}`); process.exit(1); }
if (result.check_code !== 0) { console.error(`create 未成功: status=${result.status} msg=${result.msg || ''}`); process.exit(1); }
console.log(JSON.stringify({ ok: true, region, room, date, slots: result.bookedSlots, meetingName, recordId: result.newId }, null, 2));
