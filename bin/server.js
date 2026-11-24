#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, ENDPOINT, VERSION } from '../src/server.js';

const args = process.argv.slice(2);
if (args.length) {
    if (args.length === 1 && args[0] === '--version') {
        process.stdout.write(`${VERSION}\n`);
    } else if (args.length === 1 && args[0] === '--help') {
        process.stdout.write(`Cryptonisation AI Tools MCP ${VERSION}\nRun without arguments for stdio. Public upstream: ${ENDPOINT}\nNo API key is required.\n`);
    } else {
        process.stderr.write('Unsupported arguments. Use --help.\n');
        process.exitCode = 1;
    }
} else {
    const adapter = createServer(async () => {
        const client = new Client({ name: 'cryptonisation-public-wrapper', version: VERSION });
        const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT), {
            fetch: (url, options) => fetch(url, {
                ...options,
                redirect: 'error',
                signal: AbortSignal.any([
                    options?.signal ?? new AbortController().signal,
                    AbortSignal.timeout(10_000),
                ]),
            }),
        });
        try {
            await client.connect(transport, { timeout: 10_000 });
            return client;
        } catch {
            await client.close().catch(() => {});
            throw new Error('Public MCP connection failed.');
        }
    });

    let closing = false;
    async function close() {
        if (closing) return;
        closing = true;
        await adapter.close().catch(() => {});
    }
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, () => { void close(); });
    }
    process.stdin.once('end', () => { void close(); });
    try {
        await adapter.server.connect(new StdioServerTransport());
    } catch {
        process.stderr.write('Could not start the MCP stdio transport.\n');
        await close();
        process.exitCode = 1;
    }
}
