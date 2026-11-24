import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { TOOL_NAMES } from '../src/server.js';

const client = new Client({ name: 'public-wrapper-smoke', version: '1.0.0' });
const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../bin/server.js', import.meta.url))],
    stderr: 'pipe',
});
let stderr = '';
transport.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name), TOOL_NAMES);
    for (const [name, args] of [
        ['search_tools', { limit: 2, lang: 'ru' }],
        ['list_filters', { lang: 'en' }],
    ]) {
        const result = await client.callTool({ name, arguments: args });
        assert.notEqual(result.isError, true, result.content?.[0]?.text);
        assert.ok(result.structuredContent);
        if (name === 'search_tools') {
            assert.ok(result.structuredContent.items.length);
            const slug = result.structuredContent.items[0].slug;
            const detail = await client.callTool({ name: 'get_tool', arguments: { slug, lang: 'ru' } });
            assert.notEqual(detail.isError, true);
            assert.equal(detail.structuredContent.slug, slug);
            assert.ok(detail.structuredContent.note);
            assert.equal(detail.structuredContent.installation_instructions, undefined);
            assert.equal(detail.structuredContent.install_snippets, undefined);
            console.log('get_tool: structured output and safety note passed.');
        }
        console.log(`${name}: live stdio-to-HTTPS check passed.`);
    }
    assert.equal(stderr, '', 'Unexpected output on stderr.');
} finally {
    await client.close();
}
