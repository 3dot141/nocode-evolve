#!/usr/bin/env node

import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { getDefaultConfigPath, readEnvFile, updateEnvValue } from './work-log-lib.mjs';
import { createWorklogKeyCapture, findChromeExecutable } from './refresh-worklog-key-lib.mjs';

const parseArgs = (argv) => {
    const options = { login: false };
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--login') options.login = true;
        else if (token === '--config') throw new Error('配置文件固定为 ~/.codex/work-log.env，不支持 --config');
        else if (token === '--timeout') {
            const value = argv[index + 1];
            if (!value) throw new Error(`${token} 缺少值`);
            options[token.slice(2)] = value;
            index += 1;
        } else throw new Error(`无法识别的参数：${token}`);
    }
    return options;
};

const getAvailablePort = () =>
    new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            server.close(() => resolve(address.port));
        });
    });

const waitForDebugger = async (port, timeoutMs = 15000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/json/version`);
            if (response.ok) {
                const version = await response.json();
                if (version.webSocketDebuggerUrl) return version.webSocketDebuggerUrl;
            }
        } catch {
            // Chrome may still be starting.
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('Chrome DevTools 启动超时');
};

const openCdp = async (webSocketUrl) => {
    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    let nextId = 0;
    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
    });
    socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        const waiter = message.id && pending.get(message.id);
        if (!waiter) return;
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result);
    });
    const send = (method, params = {}, sessionId) =>
        new Promise((resolve, reject) => {
            const id = (nextId += 1);
            pending.set(id, { resolve, reject });
            socket.send(JSON.stringify({ id, method, params, sessionId }));
        });
    return { socket, send };
};

const captureKey = async (cdp, boardUrl, apiUrl, timeoutMs) => {
    const { socket, send } = cdp;
    const captureWorklogKey = createWorklogKeyCapture(apiUrl);
    let settled = false;
    let resolveKey;
    let rejectKey;
    const keyPromise = new Promise((resolve, reject) => {
        resolveKey = resolve;
        rejectKey = reject;
    });
    const finish = (key) => {
        if (settled) return;
        settled = true;
        resolveKey(key);
    };
    const armSession = async (sessionId) => {
        await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId).catch(() => {});
        await send('Network.enable', {}, sessionId).catch(() => {});
        await send('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => {});
    };

    socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.method === 'Target.attachedToTarget') {
            void armSession(message.params.sessionId);
            return;
        }
        const key = captureWorklogKey(message);
        if (key) finish(key);
    });

    const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        rejectKey(new Error('等待 x-worklog-key 超时；请使用 --login 重新登录飞书'));
    }, timeoutMs);
    try {
        await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
        await send('Target.createTarget', { url: boardUrl });
        return await keyPromise;
    } finally {
        clearTimeout(timer);
    }
};

const run = async () => {
    const options = parseArgs(process.argv.slice(2));
    const configPath = getDefaultConfigPath();
    const values = readEnvFile(configPath);
    const boardUrl = values.FEISHU_WORKLOG_BOARD_URL;
    const apiUrl = values.FEISHU_WORKLOG_API;
    if (!boardUrl || !apiUrl) throw new Error('配置缺少 FEISHU_WORKLOG_BOARD_URL 或 FEISHU_WORKLOG_API');
    if (new URL(boardUrl).protocol !== 'https:' || new URL(apiUrl).protocol !== 'https:') throw new Error('飞书地址必须使用 HTTPS');

    const chrome = findChromeExecutable({ ...process.env, CHROME_PATH: values.CHROME_PATH });
    const profile = values.CHROME_PROFILE_DIR || path.join(os.homedir(), '.codex', 'work-log-chrome');
    const port = await getAvailablePort();
    const args = [
        `--remote-debugging-port=${port}`,
        '--remote-debugging-address=127.0.0.1',
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
    ];
    if (!options.login) args.push('--headless=new', '--window-size=1280,900');
    const chromeProcess = spawn(chrome, args, { stdio: 'ignore', windowsHide: !options.login });
    let cdp;
    try {
        const webSocketUrl = await waitForDebugger(port);
        cdp = await openCdp(webSocketUrl);
        if (options.login) process.stderr.write('请在打开的 Chrome 中登录飞书，脚本会自动继续。\n');
        const seconds = Number(options.timeout ?? (options.login ? 180 : 40));
        if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('--timeout 必须是正数秒数');
        const key = await captureKey(cdp, boardUrl, apiUrl, seconds * 1000);
        updateEnvValue(configPath, 'FEISHU_WORKLOG_KEY', key);
        process.stdout.write('已更新 FEISHU_WORKLOG_KEY。\n');
    } finally {
        if (cdp) {
            await cdp.send('Browser.close').catch(() => {});
            cdp.socket.close();
        }
        if (!chromeProcess.killed) chromeProcess.kill();
    }
};

run().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
