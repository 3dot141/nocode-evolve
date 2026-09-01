import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const lib = await import('./refresh-worklog-key-lib.mjs');
const cliPath = fileURLToPath(new URL('./refresh-worklog-key.mjs', import.meta.url));

test('accepts keys only from the configured authenticated worklog endpoint', () => {
    const isAllowed = lib.createWorklogRequestMatcher('https://worklog.example.com/api/worklogs');

    assert.equal(isAllowed('https://worklog.example.com/api/worklogs?space_id=1'), true);
    assert.equal(isAllowed('https://worklog.example.com/api/worklogs/child'), false);
    assert.equal(isAllowed('https://worklog.example.com/login'), false);
    assert.equal(isAllowed('https://worklog.example.com/api/other'), false);
    assert.equal(isAllowed('https://attacker.example.com/api/worklogs'), false);
});

test('extracts the worklog key case-insensitively without exposing other headers', () => {
    assert.equal(lib.extractWorklogKey({ Accept: 'application/json', 'X-Worklog-Key': 'secret-key' }), 'secret-key');
    assert.equal(lib.extractWorklogKey({ Accept: 'application/json' }), null);
});

test('captures a key when the request URL arrives before extra headers', () => {
    const capture = lib.createWorklogKeyCapture('https://worklog.example.com/api/worklogs');

    assert.equal(
        capture({
            method: 'Network.requestWillBeSent',
            sessionId: 'session-1',
            params: { requestId: 'request-1', request: { url: 'https://worklog.example.com/api/worklogs', headers: {} } },
        }),
        null,
    );
    assert.equal(
        capture({
            method: 'Network.requestWillBeSentExtraInfo',
            sessionId: 'session-1',
            params: { requestId: 'request-1', headers: { 'X-Worklog-Key': 'secret-key' } },
        }),
        'secret-key',
    );
});

test('captures a key when extra headers arrive before the request URL', () => {
    const capture = lib.createWorklogKeyCapture('https://worklog.example.com/api/worklogs');

    assert.equal(
        capture({
            method: 'Network.requestWillBeSentExtraInfo',
            sessionId: 'session-1',
            params: { requestId: 'request-1', headers: { 'X-Worklog-Key': 'secret-key' } },
        }),
        null,
    );
    assert.equal(
        capture({
            method: 'Network.requestWillBeSent',
            sessionId: 'session-1',
            params: { requestId: 'request-1', request: { url: 'https://worklog.example.com/api/worklogs', headers: {} } },
        }),
        'secret-key',
    );
});

test('selects the first existing Chrome executable and honors CHROME_PATH', () => {
    const existing = new Set(['C:\\custom\\chrome.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe']);
    const exists = (candidate) => existing.has(candidate);

    assert.equal(
        lib.findChromeExecutable(
            { CHROME_PATH: 'C:\\custom\\chrome.exe', PROGRAMFILES: 'C:\\Program Files' },
            exists,
        ),
        'C:\\custom\\chrome.exe',
    );
    assert.equal(
        lib.findChromeExecutable({ PROGRAMFILES: 'C:\\Program Files' }, exists),
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    );
});

test('refresh command rejects overriding the canonical credential path', () => {
    const result = spawnSync(process.execPath, [cliPath, '--config', 'repo-local.env'], { encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /配置文件固定为 ~\/\.config\/nocode\/work-log\.env/);
});
