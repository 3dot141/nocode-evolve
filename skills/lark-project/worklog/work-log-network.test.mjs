import assert from 'node:assert/strict';
import test from 'node:test';

const lib = await import('./work-log-lib.mjs');

const jsonResponse = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
});

test('fetches every Bitbucket page and filters by Shanghai calendar day', async () => {
    const urls = [];
    const fetchImpl = async (url, options) => {
        urls.push({ url: String(url), options });
        const start = new URL(url).searchParams.get('start');
        if (start === null) {
            return jsonResponse({
                isLastPage: false,
                nextPageStart: 100,
                values: [
                    {
                        id: 123,
                        title: '修复联动问题 #f-6772916146',
                        state: 'MERGED',
                        closedDate: Date.parse('2026-08-28T02:00:00.000Z'),
                        updatedDate: Date.parse('2026-08-28T16:05:00.000Z'),
                        toRef: { repository: { project: { key: 'FX' }, slug: 'agents' } },
                        links: { self: [{ href: 'https://code.example.com/pr/123' }] },
                    },
                ],
            });
        }
        return jsonResponse({
            isLastPage: true,
            values: [
                {
                    id: 124,
                    title: '删除冗余代码 #g-6622627363',
                    state: 'MERGED',
                    updatedDate: Date.parse('2026-08-28T15:59:59.000Z'),
                    toRef: { repository: { project: { key: 'FX' }, slug: 'agents' } },
                    links: { self: [{ href: 'https://code.example.com/pr/124' }] },
                },
                {
                    id: 125,
                    title: '第二天的 PR',
                    state: 'MERGED',
                    closedDate: Date.parse('2026-08-28T16:00:00.000Z'),
                    updatedDate: Date.parse('2026-08-28T15:00:00.000Z'),
                    toRef: { repository: { project: { key: 'FX' }, slug: 'agents' } },
                    links: { self: [{ href: 'https://code.example.com/pr/125' }] },
                },
            ],
        });
    };

    const pullRequests = await lib.fetchMergedPullRequests(
        'today',
        { bitbucketBaseUrl: 'https://code.example.com', bitbucketToken: 'secret' },
        { fetchImpl, now: new Date('2026-08-28T12:15:00.000Z') },
    );

    assert.deepEqual(
        pullRequests.map((pullRequest) => pullRequest.id),
        [123, 124],
    );
    assert.equal(pullRequests[0].mergedAt, '2026-08-28T02:00:00.000Z');
    assert.equal(urls.length, 2);
    assert.equal(new URL(urls[1].url).searchParams.get('start'), '100');
    assert.equal(urls[0].options.headers.authorization, 'Bearer secret');
});

test('derives task codes and changed lines from Bitbucket PR details', async () => {
    const fetchImpl = async (url) => {
        if (String(url).endsWith('/diff?withComments=false')) {
            return jsonResponse({
                diffs: [
                    {
                        hunks: [
                            {
                                segments: [
                                    { type: 'ADDED', lines: [{}, {}] },
                                    { type: 'REMOVED', lines: [{}] },
                                    { type: 'CONTEXT', lines: [{}, {}] },
                                ],
                            },
                        ],
                    },
                ],
            });
        }
        return jsonResponse({ id: 123, title: '修复联动 #f-6772916146 #g-6622627363' });
    };

    const details = await lib.getPullRequestDetails(
        { project: 'FX', repo: 'agents', prId: 123 },
        { bitbucketBaseUrl: 'https://code.example.com', bitbucketToken: 'secret' },
        { fetchImpl },
    );

    assert.deepEqual(details.taskCodes, ['f-6772916146', 'g-6622627363']);
    assert.equal(details.linesAdded, 2);
    assert.equal(details.linesRemoved, 1);
    assert.equal(details.totalChanges, 3);
});

test('keeps submit as a dry run until execute is explicitly enabled', async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
        requests.push({ url: String(url), options });
        return jsonResponse({ id: 'worklog-1' }, 201);
    };
    const entry = {
        taskCode: 'f-6772916146',
        minutes: 195,
        startedAtUtc: '2026-08-28T01:00:00.000Z',
        description: '修复联动问题',
    };
    const config = {
        feishuApi: 'https://worklog.example.com/api/worklogs',
        feishuKey: 'daily-secret',
        gWorkObjectId: 'custom-object',
        spaceId: 'space-id',
        userId: 'user-id',
    };

    const preview = await lib.submitWorklog(entry, config, {
        execute: false,
        fetchImpl,
        now: new Date('2026-08-28T12:15:00.000Z'),
    });
    assert.equal(preview.executed, false);
    assert.equal(requests.length, 0);

    const result = await lib.submitWorklog(entry, config, {
        execute: true,
        fetchImpl,
        now: new Date('2026-08-28T12:15:00.000Z'),
    });
    assert.equal(result.executed, true);
    assert.equal(result.status, 201);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].options.headers['x-worklog-key'], 'daily-secret');
    assert.equal(JSON.parse(requests[0].options.body).work_item_id, 6772916146);
});
