import assert from 'node:assert/strict';
import test from 'node:test';

import {
    allocateWorklog,
    buildWorklogPayload,
    getShanghaiDateRange,
    parseEnv,
} from './work-log-lib.mjs';

test('allocates a full Shanghai workday in 15-minute units and excludes lunch', () => {
    const entries = allocateWorklog(
        [
            {
                taskCode: 'f-6772916146',
                description: '修复联动问题',
                mergedAt: '2026-08-28T02:00:00.000Z',
                weight: 200,
            },
            {
                taskCode: 'g-6622627363',
                description: '删除冗余代码',
                mergedAt: '2026-08-28T08:00:00.000Z',
                weight: 360,
            },
        ],
        {
            date: '2026-08-28',
            now: new Date('2026-08-28T12:15:00.000Z'),
            totalMinutes: 540,
        },
    );

    assert.deepEqual(
        entries.map((entry) => ({
            taskCode: entry.taskCode,
            minutes: entry.minutes,
            localRange: entry.localRange,
            startedAtUtc: entry.startedAtUtc,
        })),
        [
            {
                taskCode: 'f-6772916146',
                minutes: 195,
                localRange: '09:00-12:00、13:30-13:45',
                startedAtUtc: '2026-08-28T01:00:00.000Z',
            },
            {
                taskCode: 'g-6622627363',
                minutes: 345,
                localRange: '13:45-19:30',
                startedAtUtc: '2026-08-28T05:45:00.000Z',
            },
        ],
    );
});

test('rounds the current-day end anchor down to a 15-minute boundary', () => {
    const [entry] = allocateWorklog(
        [
            {
                taskCode: 'f-6772916146',
                description: '修复联动问题',
                mergedAt: '2026-08-28T01:30:00.000Z',
                weight: 1,
            },
        ],
        {
            date: '2026-08-28',
            now: new Date('2026-08-28T02:07:00.000Z'),
            totalMinutes: 60,
        },
    );

    assert.equal(entry.localRange, '09:00-10:00');
    assert.equal(entry.startedAtUtc, '2026-08-28T01:00:00.000Z');
});

test('requires an explicit total duration in the allocation API', () => {
    assert.throws(
        () =>
            allocateWorklog(
                [
                    {
                        taskCode: 'f-6772916146',
                        description: '修复联动问题',
                        mergedAt: '2026-08-28T02:00:00.000Z',
                        weight: 1,
                    },
                ],
                {
                    date: '2026-08-28',
                    now: new Date('2026-08-28T12:15:00.000Z'),
                },
            ),
        /总工时/,
    );
});

test('starts at 13:30 when an allocation begins exactly after lunch', () => {
    const [entry] = allocateWorklog(
        [
            {
                taskCode: 'f-6772916146',
                description: '修复联动问题',
                mergedAt: '2026-08-28T02:00:00.000Z',
                weight: 1,
            },
        ],
        {
            date: '2026-08-28',
            now: new Date('2026-08-28T12:15:00.000Z'),
            totalMinutes: 360,
        },
    );

    assert.equal(entry.localRange, '13:30-19:30');
    assert.equal(entry.startedAtUtc, '2026-08-28T05:30:00.000Z');
});

test('rejects impossible calendar dates instead of normalizing them', () => {
    assert.throws(
        () =>
            allocateWorklog(
                [
                    {
                        taskCode: 'f-6772916146',
                        description: '修复联动问题',
                        mergedAt: '2026-02-28T01:00:00.000Z',
                        weight: 1,
                    },
                ],
                {
                    date: '2026-02-30',
                    now: new Date('2026-03-05T12:00:00.000Z'),
                    totalMinutes: 60,
                },
            ),
        /无效日期/,
    );

    assert.throws(
        () =>
            buildWorklogPayload(
                {
                    taskCode: 'f-6772916146',
                    minutes: 60,
                    startedAtUtc: '2026-02-30T01:00:00.000Z',
                    description: '修复联动问题',
                },
                {
                    gWorkObjectId: 'custom-object',
                    spaceId: 'space-id',
                    userId: 'user-id',
                },
                new Date('2026-03-05T12:00:00.000Z'),
            ),
        /无效 UTC 时间/,
    );
});

test('builds a JSON-safe and HTML-safe Feishu payload', () => {
    const description = '修复 <b>联动</b> & "引用"';
    const payload = buildWorklogPayload(
        {
            taskCode: 'g-6622627363',
            minutes: 345,
            startedAtUtc: '2026-08-28T05:45:00.000Z',
            description,
        },
        {
            gWorkObjectId: '67da6360e9d810fd8008b7a4',
            spaceId: 'space-id',
            userId: 'user-id',
        },
        new Date('2026-08-28T12:15:00.000Z'),
    );

    const doc = JSON.parse(payload.work_description.doc);

    assert.equal(payload.work_item_id, 6622627363);
    assert.equal(payload.work_object_id, '67da6360e9d810fd8008b7a4');
    assert.equal(payload.work_description.doc_text, description);
    assert.equal(doc['0'].ops[0].insert, `${description}\n`);
    assert.match(payload.work_description.doc_html, /&lt;b&gt;联动&lt;\/b&gt; &amp; &quot;引用&quot;/);
    assert.doesNotMatch(payload.work_description.doc_html, /<b>/);
});

test('does not require the g work object id for f tasks', () => {
    const payload = buildWorklogPayload(
        {
            taskCode: 'f-6772916146',
            minutes: 60,
            startedAtUtc: '2026-08-28T01:00:00.000Z',
            description: '修复联动问题',
        },
        {
            spaceId: 'space-id',
            userId: 'user-id',
        },
        new Date('2026-08-28T12:15:00.000Z'),
    );

    assert.equal(payload.work_object_id, 'issue');
});

test('rejects unsupported task prefixes and future start times', () => {
    const config = {
        gWorkObjectId: 'custom-object',
        spaceId: 'space-id',
        userId: 'user-id',
    };

    assert.throws(
        () =>
            buildWorklogPayload(
                {
                    taskCode: 'x-123',
                    minutes: 15,
                    startedAtUtc: '2026-08-28T01:00:00.000Z',
                    description: '任务',
                },
                config,
                new Date('2026-08-28T12:15:00.000Z'),
            ),
        /仅支持 f、g、m/,
    );

    assert.throws(
        () =>
            buildWorklogPayload(
                {
                    taskCode: 'f-123',
                    minutes: 15,
                    startedAtUtc: '2026-08-29T01:00:00.000Z',
                    description: '任务',
                },
                config,
                new Date('2026-08-28T12:15:00.000Z'),
            ),
        /未来时间/,
    );
});

test('parses quoted dotenv values without evaluating shell syntax', () => {
    const values = parseEnv(`
# comment
BITBUCKET_BASE_URL=https://code.example.com
BITBUCKET_TOKEN="token=a b"
FEISHU_SPACE_ID='space-1'
EMPTY=
`);

    assert.deepEqual(values, {
        BITBUCKET_BASE_URL: 'https://code.example.com',
        BITBUCKET_TOKEN: 'token=a b',
        FEISHU_SPACE_ID: 'space-1',
        EMPTY: '',
    });
});

test('uses Asia/Shanghai calendar boundaries for Bitbucket filters', () => {
    const range = getShanghaiDateRange('today', new Date('2026-08-28T12:15:00.000Z'));

    assert.equal(range.start.toISOString(), '2026-08-27T16:00:00.000Z');
    assert.equal(range.end.toISOString(), '2026-08-28T15:59:59.999Z');
});
