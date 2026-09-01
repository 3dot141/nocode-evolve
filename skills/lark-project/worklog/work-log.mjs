#!/usr/bin/env node

import fs from 'node:fs';

import {
    allocateWorklog,
    fetchMergedPullRequests,
    getDefaultConfigPath,
    getPullRequestDetails,
    readConfigValues,
    submitWorklog,
} from './work-log-lib.mjs';

const parseArgs = (argv) => {
    const [command, ...tokens] = argv;
    const flags = {};
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (!token.startsWith('--')) throw new Error(`无法识别的参数：${token}`);
        const key = token.slice(2);
        const next = tokens[index + 1];
        if (next !== undefined && !next.startsWith('--')) {
            flags[key] = next;
            index += 1;
        } else {
            flags[key] = true;
        }
    }
    return { command, flags };
};

const requireFlag = (flags, name) => {
    const value = flags[name];
    if (typeof value !== 'string' || value === '') throw new Error(`缺少 --${name}`);
    return value;
};

const readConfig = () => {
    const values = readConfigValues(getDefaultConfigPath());
    return {
        bitbucketBaseUrl: values.BITBUCKET_BASE_URL,
        bitbucketToken: values.BITBUCKET_TOKEN,
        feishuApi: values.FEISHU_WORKLOG_API,
        feishuKey: values.FEISHU_WORKLOG_KEY,
        spaceId: values.FEISHU_SPACE_ID,
        userId: values.FEISHU_USER_ID,
        gWorkObjectId: values.FEISHU_G_WORK_OBJECT_ID,
    };
};

const parseNow = (flags) => {
    if (typeof flags.now !== 'string') return new Date();
    const value = new Date(flags.now);
    if (Number.isNaN(value.getTime())) throw new Error('--now 必须是合法 ISO 时间');
    return value;
};

const printJson = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

const run = async () => {
    const { command, flags } = parseArgs(process.argv.slice(2));
    if (Object.hasOwn(flags, 'config')) throw new Error('配置文件固定为 ~/.config/nocode/work-log.env，不支持 --config');
    if (command === 'fetch') {
        const result = await fetchMergedPullRequests(flags.range ?? 'today', readConfig(), { now: parseNow(flags) });
        printJson(result);
        return;
    }
    if (command === 'details') {
        const result = await getPullRequestDetails(
            {
                project: requireFlag(flags, 'project'),
                repo: requireFlag(flags, 'repo'),
                prId: Number(requireFlag(flags, 'pr')),
            },
            readConfig(),
        );
        printJson(result);
        return;
    }
    if (command === 'allocate') {
        const input = JSON.parse(fs.readFileSync(requireFlag(flags, 'input'), 'utf8'));
        const result = allocateWorklog(input, {
            date: requireFlag(flags, 'date'),
            totalMinutes: Number(requireFlag(flags, 'minutes')),
            now: parseNow(flags),
        });
        printJson(result);
        return;
    }
    if (command === 'submit') {
        const result = await submitWorklog(
            {
                taskCode: requireFlag(flags, 'task-code'),
                minutes: Number(requireFlag(flags, 'minutes')),
                startedAtUtc: requireFlag(flags, 'started-at'),
                description: requireFlag(flags, 'description'),
            },
            readConfig(),
            { execute: flags.execute === true, now: parseNow(flags) },
        );
        printJson(result);
        return;
    }
    throw new Error('命令仅支持 fetch、details、allocate、submit');
};

run().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
