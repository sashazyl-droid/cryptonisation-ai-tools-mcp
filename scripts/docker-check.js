import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { TOOL_NAMES } from '../src/server.js';

const image = process.argv[2] ?? 'cryptonisation-ai-tools-mcp:2485-local';
const client = new Client({ name: 'docker-wrapper-check', version: '1.0.0' });
const transport = new StdioClientTransport({
    command: 'docker',
    args: ['run', '--rm', '-i', '--read-only', '--cap-drop=ALL', image],
    stderr: 'pipe',
});
let stderr = '';
transport.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
try {
    await client.connect(transport, { timeout: 30_000 });
    assert.equal(client.getServerVersion().name, 'cryptonisation-ai-tools');
    const tools = await client.listTools({}, { timeout: 30_000 });
    assert.deepEqual(tools.tools.map((tool) => tool.name), TOOL_NAMES);
    console.log('Container initialized; exactly three public read-only tools advertised.');
    const search = await client.callTool({ name: 'search_tools', arguments: { limit: 2, lang: 'ru' } });
    assert.notEqual(search.isError, true, search.content?.[0]?.text);
    assert.ok(search.structuredContent.items.length);
    const slug = search.structuredContent.items[0].slug;
    console.log(`search_tools: ${search.structuredContent.items.length} items returned.`);
    const detail = await client.callTool({ name: 'get_tool', arguments: { slug, lang: 'ru' } });
    assert.notEqual(detail.isError, true, detail.content?.[0]?.text);
    assert.equal(detail.structuredContent.slug, slug);
    assert.ok(detail.structuredContent.note);
    assert.equal(detail.structuredContent.installation_instructions, undefined);
    console.log('get_tool: public card and safety note returned.');
    const filters = await client.callTool({ name: 'list_filters', arguments: { lang: 'en' } });
    assert.notEqual(filters.isError, true, filters.content?.[0]?.text);
    assert.ok(filters.structuredContent.types.length);
    console.log('list_filters: public dictionaries returned.');
    await assert.rejects(client.callTool({ name: 'admin_delete', arguments: {} }), /Unknown tool/);
    assert.equal(stderr, '', 'Unexpected stderr output.');
    console.log('Administrative methods rejected; stdout contains only MCP protocol.');
} finally {
    await client.close();
}
