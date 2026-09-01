import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('./work-log.mjs', import.meta.url));

const runCli = (args, env = process.env) => spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8', env });

test('allocate command emits deterministic UTC starts and Shanghai ranges', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-work-log-'));
    const inputPath = path.join(directory, 'entries.json');
    fs.writeFileSync(
        inputPath,
        JSON.stringify([
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
        ]),
        'utf8',
    );

    const result = runCli([
        'allocate',
        '--input',
        inputPath,
        '--date',
        '2026-08-28',
        '--minutes',
        '540',
        '--now',
        '2026-08-28T12:15:00.000Z',
    ]);

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(
        output.map((entry) => [entry.taskCode, entry.minutes, entry.localRange, entry.startedAtUtc]),
        [
            ['f-6772916146', 195, '09:00-12:00、13:30-13:45', '2026-08-28T01:00:00.000Z'],
            ['g-6622627363', 345, '13:45-19:30', '2026-08-28T05:45:00.000Z'],
        ],
    );
});

test('allocate command requires an explicit total duration', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-work-log-'));
    const inputPath = path.join(directory, 'entries.json');
    fs.writeFileSync(
        inputPath,
        JSON.stringify([
            {
                taskCode: 'f-6772916146',
                description: '修复联动问题',
                mergedAt: '2026-08-28T02:00:00.000Z',
                weight: 1,
            },
        ]),
        'utf8',
    );

    const result = runCli([
        'allocate',
        '--input',
        inputPath,
        '--date',
        '2026-08-28',
        '--now',
        '2026-08-28T12:15:00.000Z',
    ]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /--minutes/);
});

test('submit command defaults to a secret-free dry run', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-work-log-'));
    const configDirectory = path.join(directory, '.config', 'nocode');
    const configPath = path.join(configDirectory, 'work-log.env');
    fs.mkdirSync(configDirectory, { recursive: true });
    fs.writeFileSync(
        configPath,
        [
            'FEISHU_WORKLOG_API=https://worklog.example.com/api/worklogs',
            'FEISHU_WORKLOG_KEY=daily-secret',
            'FEISHU_SPACE_ID=space-id',
            'FEISHU_USER_ID=user-id',
            'FEISHU_G_WORK_OBJECT_ID=custom-object',
        ].join('\n'),
        'utf8',
    );

    const result = runCli(
        [
            'submit',
            '--task-code',
            'f-6772916146',
            '--minutes',
            '195',
            '--started-at',
            '2026-08-28T01:00:00.000Z',
            '--description',
            '修复联动问题',
            '--now',
            '2026-08-28T12:15:00.000Z',
        ],
        { ...process.env, HOME: directory, USERPROFILE: directory },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).executed, false);
    assert.doesNotMatch(result.stdout, /daily-secret/);
});

test('rejects overriding the canonical credential path', () => {
    const result = runCli(['fetch', '--config', 'repo-local.env']);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /配置文件固定为 ~\/\.config\/nocode\/work-log\.env/);
});
