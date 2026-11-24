import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, TOOL_NAMES } from '../src/server.js';

const definitions = TOOL_NAMES.map((name) => ({
    name, title: name, description: 'Public read-only tool.',
    inputSchema: { type: 'object', properties: { lang: { type: 'string' } } },
    outputSchema: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] },
}));

async function harness(t, overrides = {}, connect) {
    const calls = [];
    const upstream = {
        listTools: async () => ({ tools: definitions }),
        callTool: async (...args) => {
            calls.push(args);
            return { content: [{ type: 'text', text: 'Public result.' }], structuredContent: { note: 'Review the code before connecting API keys.' } };
        },
        close: async () => {},
        ...overrides,
    };
    const adapter = createServer(connect ?? (async () => upstream));
    const client = new Client({ name: 'wrapper-tests', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await adapter.server.connect(serverTransport);
    await client.connect(clientTransport);
    t.after(async () => { await client.close(); await adapter.close(); });
    return { client, calls };
}

test('only three allowlisted read-only tools and their schemas are advertised', async (t) => {
    const { client } = await harness(t, { listTools: async () => ({ tools: [...definitions, { name: 'admin_delete' }] }) });
    const result = await client.listTools();
    assert.deepEqual(result.tools.map((tool) => tool.name), TOOL_NAMES);
    for (const tool of result.tools) {
        assert.equal(tool.annotations.readOnlyHint, true);
        assert.equal(tool.annotations.destructiveHint, false);
        assert.deepEqual(tool.outputSchema, definitions[0].outputSchema);
    }
});

test('forwards public arguments, structured output and safety note', async (t) => {
    const { client, calls } = await harness(t);
    await client.listTools();
    const result = await client.callTool({ name: 'search_tools', arguments: { lang: 'ru' } });
    assert.equal(result.structuredContent.note, 'Review the code before connecting API keys.');
    assert.deepEqual(calls[0][0], { name: 'search_tools', arguments: { lang: 'ru' } });
    assert.equal(calls[0][2].timeout, 10_000);
});

test('rejects unknown and administrative tools before contacting upstream', async (t) => {
    let connections = 0;
    const { client } = await harness(t, {}, async () => { connections++; throw new Error(); });
    await assert.rejects(client.callTool({ name: 'admin_delete', arguments: {} }), /Unknown tool/);
    assert.equal(connections, 0);
});

test('upstream failures become a safe tool error without internal details', async (t) => {
    const { client } = await harness(t, { callTool: async () => { throw new Error('PRIVATE_INTERNAL_DETAIL'); } });
    const result = await client.callTool({ name: 'get_tool', arguments: { slug: 'test' } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /temporarily unavailable/);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_INTERNAL_DETAIL/);
});

test('upstream not-found and validation errors remain errors', async (t) => {
    const { client } = await harness(t, { callTool: async () => ({ isError: true, content: [{ type: 'text', text: 'Tool not found.' }] }) });
    const result = await client.callTool({ name: 'get_tool', arguments: { slug: 'missing' } });
    assert.equal(result.isError, true);
    assert.equal(result.content[0].text, 'Tool not found.');
});

test('missing or duplicate upstream tools fail clearly', async (t) => {
    const { client } = await harness(t, { listTools: async () => ({ tools: [definitions[0]] }) });
    await assert.rejects(client.listTools(), /temporarily unavailable/);
});

test('failed initial connection is retried on the next request', async (t) => {
    let attempts = 0;
    const upstream = { listTools: async () => ({ tools: definitions }), close: async () => {} };
    const { client } = await harness(t, {}, async () => {
        if (++attempts === 1) throw new Error('PRIVATE_CONNECTION_DETAIL');
        return upstream;
    });
    await assert.rejects(client.listTools(), /temporarily unavailable/);
    assert.equal((await client.listTools()).tools.length, 3);
    assert.equal(attempts, 2);
});
