import fs from 'node:fs';
import path from 'node:path';

export const createWorklogRequestMatcher = (apiUrl) => {
    const expected = new URL(apiUrl);
    const normalizePath = (value) => (value === '/' ? value : value.replace(/\/+$/u, ''));
    const expectedPath = normalizePath(expected.pathname);
    return (requestUrl) => {
        try {
            const candidate = new URL(requestUrl);
            const pathMatches = normalizePath(candidate.pathname) === expectedPath;
            return candidate.protocol === 'https:' && candidate.origin === expected.origin && pathMatches && !candidate.pathname.includes('/login');
        } catch {
            return false;
        }
    };
};

export const extractWorklogKey = (headers) => {
    for (const [name, value] of Object.entries(headers ?? {})) {
        if (name.toLowerCase() === 'x-worklog-key' && typeof value === 'string' && value !== '') return value;
    }
    return null;
};

export const createWorklogKeyCapture = (apiUrl) => {
    const isAllowedRequest = createWorklogRequestMatcher(apiUrl);
    const requests = new Map();

    return (message) => {
        if (message?.method !== 'Network.requestWillBeSent' && message?.method !== 'Network.requestWillBeSentExtraInfo') return null;
        const requestId = message.params?.requestId;
        if (!requestId) return null;

        const requestKey = `${message.sessionId ?? ''}:${requestId}`;
        const request = requests.get(requestKey) ?? {};
        if (message.method === 'Network.requestWillBeSent') {
            request.url = message.params?.request?.url ?? message.params?.documentURL ?? '';
            request.headers = message.params?.request?.headers;
            request.hasRequest = true;
        } else {
            request.extraHeaders = message.params?.headers;
            request.hasExtraInfo = true;
        }
        requests.set(requestKey, request);

        const key = extractWorklogKey(request.extraHeaders) ?? extractWorklogKey(request.headers);
        if (request.url && key && isAllowedRequest(request.url)) {
            requests.delete(requestKey);
            return key;
        }
        if (request.hasRequest && request.hasExtraInfo) requests.delete(requestKey);
        return null;
    };
};

export const findChromeExecutable = (env = process.env, exists = fs.existsSync) => {
    const candidates = [
        env.CHROME_PATH,
        env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        env.PROGRAMFILES && path.join(env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        env['PROGRAMFILES(X86)'] && path.join(env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
    ].filter(Boolean);
    const executable = candidates.find((candidate) => exists(candidate));
    if (!executable) throw new Error('未找到 Chrome；可在 work-log.env 中配置 CHROME_PATH');
    return executable;
};
