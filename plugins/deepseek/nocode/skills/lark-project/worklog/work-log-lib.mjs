import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SHANGHAI_OFFSET_HOURS = 8;
const SLOT_MINUTES = 15;
const WORK_SEGMENTS = [
    { start: 9 * 60, end: 12 * 60 },
    { start: 13 * 60 + 30, end: 19 * 60 + 30 },
];
const UTC_START_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/;
const TASK_CODE_PATTERN = /^([fgm])-(\d+)$/i;

const requireText = (value, name) => {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${name} 不能为空`);
    }
    return value.trim();
};

const parseDateParts = (date) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) throw new Error(`日期格式错误：${date}`);
    const parts = match.slice(1).map(Number);
    const [year, month, day] = parts;
    const roundTrip = new Date(Date.UTC(year, month - 1, day));
    if (roundTrip.getUTCFullYear() !== year || roundTrip.getUTCMonth() !== month - 1 || roundTrip.getUTCDate() !== day) {
        throw new Error(`无效日期：${date}`);
    }
    return parts;
};

const getShanghaiParts = (value) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(value);
    return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
};

const formatDate = (parts) =>
    `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;

const addCalendarDays = (date, days) => {
    const [year, month, day] = parseDateParts(date);
    const value = new Date(Date.UTC(year, month - 1, day + days));
    return value.toISOString().slice(0, 10);
};

const shanghaiClockToUtc = (date, clockMinutes) => {
    const [year, month, day] = parseDateParts(date);
    const hours = Math.floor(clockMinutes / 60);
    const minutes = clockMinutes % 60;
    return new Date(Date.UTC(year, month - 1, day, hours - SHANGHAI_OFFSET_HOURS, minutes));
};

const formatClock = (clockMinutes) => {
    const hours = Math.floor(clockMinutes / 60);
    const minutes = clockMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const workOffsetToClock = (offset) => {
    const morningMinutes = WORK_SEGMENTS[0].end - WORK_SEGMENTS[0].start;
    if (offset < morningMinutes) return WORK_SEGMENTS[0].start + offset;
    return WORK_SEGMENTS[1].start + offset - morningMinutes;
};

const formatWorkRange = (startOffset, endOffset) => {
    const ranges = [];
    let segmentOffset = 0;
    for (const segment of WORK_SEGMENTS) {
        const segmentMinutes = segment.end - segment.start;
        const segmentEndOffset = segmentOffset + segmentMinutes;
        const visibleStart = Math.max(startOffset, segmentOffset);
        const visibleEnd = Math.min(endOffset, segmentEndOffset);
        if (visibleStart < visibleEnd) {
            const startClock = segment.start + visibleStart - segmentOffset;
            const endClock = segment.start + visibleEnd - segmentOffset;
            ranges.push(`${formatClock(startClock)}-${formatClock(endClock)}`);
        }
        segmentOffset = segmentEndOffset;
    }
    return ranges.join('、');
};

const clockToWorkOffset = (clockMinutes) => {
    if (clockMinutes <= WORK_SEGMENTS[0].start) return 0;
    if (clockMinutes <= WORK_SEGMENTS[0].end) return clockMinutes - WORK_SEGMENTS[0].start;
    const morningMinutes = WORK_SEGMENTS[0].end - WORK_SEGMENTS[0].start;
    if (clockMinutes <= WORK_SEGMENTS[1].start) return morningMinutes;
    return morningMinutes + Math.min(clockMinutes, WORK_SEGMENTS[1].end) - WORK_SEGMENTS[1].start;
};

const allocateSlots = (items, totalSlots) => {
    if (items.length > totalSlots) throw new Error('任务数量超过可分配的 15 分钟时间片');
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (!(totalWeight > 0)) throw new Error('任务权重总和必须大于 0');

    const remainingSlots = totalSlots - items.length;
    const allocations = items.map((item, index) => {
        const rawExtra = (remainingSlots * item.weight) / totalWeight;
        return { index, slots: 1 + Math.floor(rawExtra), remainder: rawExtra % 1 };
    });
    const assigned = allocations.reduce((sum, item) => sum + item.slots, 0);
    const order = [...allocations].sort((left, right) => right.remainder - left.remainder || left.index - right.index);
    for (let index = 0; index < totalSlots - assigned; index += 1) order[index].slots += 1;
    return allocations.sort((left, right) => left.index - right.index).map((item) => item.slots);
};

export const allocateWorklog = (items, options) => {
    if (!Array.isArray(items) || items.length === 0) throw new Error('至少需要一个任务');
    const date = requireText(options?.date, 'date');
    parseDateParts(date);
    const now = options?.now instanceof Date ? options.now : new Date();
    const totalMinutes = options?.totalMinutes;
    if (!Number.isInteger(totalMinutes) || totalMinutes <= 0 || totalMinutes % SLOT_MINUTES !== 0) {
        throw new Error('总工时必须是正数且为 15 分钟的倍数');
    }

    const nowParts = getShanghaiParts(now);
    const today = formatDate(nowParts);
    if (date > today) throw new Error('不能为未来日期分配工时');
    const rawAnchorClock = date < today ? WORK_SEGMENTS[1].end : Math.min(nowParts.hour * 60 + nowParts.minute, WORK_SEGMENTS[1].end);
    const anchorClock = Math.floor(rawAnchorClock / SLOT_MINUTES) * SLOT_MINUTES;
    const anchorOffset = clockToWorkOffset(anchorClock);
    if (totalMinutes > anchorOffset) throw new Error('目标工时超过当前结束锚点前的可用工作时间');

    const normalized = items
        .map((item, index) => ({
            ...item,
            index,
            taskCode: requireText(item.taskCode, 'taskCode').replace(/^#/, ''),
            description: requireText(item.description, 'description'),
            weight: Number(item.weight),
        }))
        .sort((left, right) => Date.parse(left.mergedAt) - Date.parse(right.mergedAt) || left.index - right.index);
    if (normalized.some((item) => !Number.isFinite(item.weight) || item.weight <= 0)) {
        throw new Error('每个任务的权重必须大于 0');
    }

    const slots = allocateSlots(normalized, totalMinutes / SLOT_MINUTES);
    let cursor = anchorOffset - totalMinutes;
    return normalized.map((item, index) => {
        const minutes = slots[index] * SLOT_MINUTES;
        const startClock = workOffsetToClock(cursor);
        const localRange = formatWorkRange(cursor, cursor + minutes);
        cursor += minutes;
        return {
            taskCode: item.taskCode,
            description: item.description,
            minutes,
            localRange,
            startedAtUtc: shanghaiClockToUtc(date, startClock).toISOString(),
        };
    });
};

const escapeHtml = (value) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export const buildWorklogPayload = (entry, config, now = new Date()) => {
    const taskCode = requireText(entry?.taskCode, 'taskCode').replace(/^#/, '');
    const match = TASK_CODE_PATTERN.exec(taskCode);
    if (!match) throw new Error('任务编号仅支持 f、g、m 前缀，例如 f-6772916146');
    const minutes = Number(entry.minutes);
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 540 || minutes % SLOT_MINUTES !== 0) {
        throw new Error('工时必须为 1 到 540 之间的 15 分钟倍数');
    }
    const startedAtUtc = requireText(entry.startedAtUtc, 'startedAtUtc');
    if (!UTC_START_PATTERN.test(startedAtUtc)) throw new Error('开始时间必须是精确到分钟的 UTC ISO 字符串');
    const startedAt = Date.parse(startedAtUtc);
    if (Number.isNaN(startedAt) || new Date(startedAt).toISOString() !== startedAtUtc) throw new Error('无效 UTC 时间');
    if (startedAt > now.getTime()) throw new Error('开始时间不能是未来时间');

    const description = requireText(entry.description, 'description');
    const prefix = match[1].toLowerCase();
    const workItemId = Number(match[2]);
    if (!Number.isSafeInteger(workItemId)) throw new Error('任务编号超出安全整数范围');
    const workObjectId = prefix === 'f' ? 'issue' : prefix === 'm' ? 'story' : requireText(config?.gWorkObjectId, 'FEISHU_G_WORK_OBJECT_ID');
    const doc = {
        0: {
            ops: [{ insert: `${description}\n` }],
            zoneId: '0',
            zoneType: 'Z',
        },
    };

    return {
        work_item_id: workItemId,
        work_object_id: workObjectId,
        space_id: requireText(config?.spaceId, 'FEISHU_SPACE_ID'),
        time_spent: minutes,
        date_started: startedAtUtc,
        work_description: {
            doc: JSON.stringify(doc),
            doc_html: `<div class="ace-line" data-node="true" dir="auto"><span data-string="true" data-leaf="true">${escapeHtml(description)}</span><span data-string="true" data-enter="true" data-leaf="true"></span></div>`,
            doc_text: description,
            is_empty: false,
        },
        user_id: requireText(config?.userId, 'FEISHU_USER_ID'),
        work_item_name: description,
    };
};

export const parseEnv = (text) => {
    const values = {};
    for (const rawLine of text.split(/\r?\n/u)) {
        const line = rawLine.trim();
        if (line === '' || line.startsWith('#')) continue;
        const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
        if (!match) throw new Error(`无法解析配置行：${rawLine}`);
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        values[match[1]] = value;
    }
    return values;
};

export const getShanghaiDateRange = (filter, now = new Date()) => {
    const today = formatDate(getShanghaiParts(now));
    const startDate = filter === 'today' ? today : filter === 'yesterday' ? addCalendarDays(today, -1) : filter === 'week' ? addCalendarDays(today, -6) : null;
    if (!startDate) throw new Error('日期范围仅支持 today、yesterday、week');
    const endDate = filter === 'yesterday' ? startDate : today;
    const start = shanghaiClockToUtc(startDate, 0);
    const end = new Date(shanghaiClockToUtc(addCalendarDays(endDate, 1), 0).getTime() - 1);
    return { start, end };
};

const getHttpsUrl = (value, name) => {
    const url = new URL(requireText(value, name));
    if (url.protocol !== 'https:') throw new Error(`${name} 必须使用 HTTPS`);
    return url;
};

const fetchJson = async (url, options, fetchImpl) => {
    const response = await fetchImpl(url, options);
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body}`);
    }
    return response.json();
};

export const fetchMergedPullRequests = async (filter, config, options = {}) => {
    const baseUrl = getHttpsUrl(config?.bitbucketBaseUrl, 'BITBUCKET_BASE_URL');
    const token = requireText(config?.bitbucketToken, 'BITBUCKET_TOKEN');
    const fetchImpl = options.fetchImpl ?? fetch;
    const range = getShanghaiDateRange(filter, options.now ?? new Date());
    const values = [];
    let start = null;

    do {
        const url = new URL('/rest/api/1.0/dashboard/pull-requests', baseUrl);
        url.searchParams.set('state', 'MERGED');
        url.searchParams.set('role', 'AUTHOR');
        url.searchParams.set('limit', '100');
        if (start !== null) url.searchParams.set('start', String(start));
        const page = await fetchJson(
            url,
            { headers: { accept: 'application/json', authorization: `Bearer ${token}` } },
            fetchImpl,
        );
        values.push(...(page.values ?? []));
        start = page.isLastPage ? null : page.nextPageStart;
        if (start === undefined) throw new Error('Bitbucket 分页响应缺少 nextPageStart');
    } while (start !== null);

    return values
        .map((pullRequest) => ({ pullRequest, mergedTimestamp: pullRequest.closedDate ?? pullRequest.updatedDate }))
        .filter(
            ({ mergedTimestamp }) =>
                Number.isFinite(mergedTimestamp) && mergedTimestamp >= range.start.getTime() && mergedTimestamp <= range.end.getTime(),
        )
        .map(({ pullRequest, mergedTimestamp }) => ({
            id: pullRequest.id,
            title: pullRequest.title,
            project: pullRequest.toRef?.repository?.project?.key,
            repo: pullRequest.toRef?.repository?.slug,
            mergedAt: new Date(mergedTimestamp).toISOString(),
            link: pullRequest.links?.self?.[0]?.href,
        }));
};

export const getPullRequestDetails = async (pullRequest, config, options = {}) => {
    const baseUrl = getHttpsUrl(config?.bitbucketBaseUrl, 'BITBUCKET_BASE_URL');
    const token = requireText(config?.bitbucketToken, 'BITBUCKET_TOKEN');
    const fetchImpl = options.fetchImpl ?? fetch;
    const project = encodeURIComponent(requireText(pullRequest?.project, 'project'));
    const repo = encodeURIComponent(requireText(pullRequest?.repo, 'repo'));
    const prId = Number(pullRequest?.prId);
    if (!Number.isSafeInteger(prId) || prId <= 0) throw new Error('prId 必须是正整数');
    const resource = `/rest/api/1.0/projects/${project}/repos/${repo}/pull-requests/${prId}`;
    const requestOptions = { headers: { accept: 'application/json', authorization: `Bearer ${token}` } };
    const [info, diff] = await Promise.all([
        fetchJson(new URL(resource, baseUrl), requestOptions, fetchImpl),
        fetchJson(new URL(`${resource}/diff?withComments=false`, baseUrl), requestOptions, fetchImpl),
    ]);

    let linesAdded = 0;
    let linesRemoved = 0;
    for (const fileDiff of diff.diffs ?? []) {
        for (const hunk of fileDiff.hunks ?? []) {
            for (const segment of hunk.segments ?? []) {
                if (segment.type === 'ADDED') linesAdded += segment.lines?.length ?? 0;
                if (segment.type === 'REMOVED') linesRemoved += segment.lines?.length ?? 0;
            }
        }
    }
    const taskCodes = [...info.title.matchAll(/#([fgm]-\d+)/giu)].map((match) => match[1].toLowerCase());
    return {
        id: info.id,
        title: info.title,
        taskCodes: [...new Set(taskCodes)],
        linesAdded,
        linesRemoved,
        totalChanges: linesAdded + linesRemoved,
    };
};

export const submitWorklog = async (entry, config, options = {}) => {
    const now = options.now ?? new Date();
    const payload = buildWorklogPayload(entry, config, now);
    if (options.execute !== true) return { executed: false, payload };

    const url = getHttpsUrl(config?.feishuApi, 'FEISHU_WORKLOG_API');
    const key = requireText(config?.feishuKey, 'FEISHU_WORKLOG_KEY');
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            'x-worklog-key': key,
        },
        body: JSON.stringify(payload),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`工时提交失败（HTTP ${response.status}）：${body}`);
    return { executed: true, status: response.status, body };
};

export const getDefaultConfigPath = () => path.join(os.homedir(), '.codex', 'work-log.env');

export const readEnvFile = (filePath = getDefaultConfigPath()) => parseEnv(fs.readFileSync(filePath, 'utf8'));

export const updateEnvValue = (filePath, key, value) => {
    const source = fs.readFileSync(filePath, 'utf8');
    const lines = source.split(/\r?\n/u);
    const nextLine = `${key}=${value}`;
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) lines[index] = nextLine;
    else lines.push(nextLine);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
};
