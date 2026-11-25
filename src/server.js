import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';

export const VERSION = '1.0.0';
export const ENDPOINT = 'https://aitools.cryptonisation.pro/mcp';
export const TOOL_NAMES = Object.freeze(['search_tools', 'get_tool', 'list_filters']);
const TIMEOUT = 10_000;
const UNAVAILABLE = 'The public catalog is temporarily unavailable. Please try again later.';

/** Transport adapter only: no database, credentials, admin API or site implementation. */
export function createServer(connectUpstream) {
    let upstreamPromise;

    async function upstream() {
        if (!upstreamPromise) {
            upstreamPromise = Promise.resolve().then(connectUpstream).catch(() => {
                upstreamPromise = undefined;
                throw new Error(UNAVAILABLE);
            });
        }
        return upstreamPromise;
    }

    const server = new Server(
        { name: 'cryptonisation-ai-tools', version: VERSION },
        {
            capabilities: { tools: {} },
            instructions: 'Search and read public crypto AI tool cards only. Access levels are not a safety guarantee. Review the tool code before connecting API keys.',
        },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        try {
            const client = await upstream();
            const result = await client.listTools({}, { timeout: TIMEOUT });
            const tools = TOOL_NAMES.map((name) => {
                const matches = result.tools.filter((tool) => tool.name === name);
                if (matches.length !== 1) {
                    throw new Error(UNAVAILABLE);
                }
                const tool = matches[0];
                return {
                    name,
                    title: tool.title,
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                    ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
                    annotations: {
                        readOnlyHint: true,
                        destructiveHint: false,
                        idempotentHint: true,
                        openWorldHint: false,
                    },
                };
            });
            return { tools };
        } catch {
            throw new McpError(ErrorCode.InternalError, UNAVAILABLE);
        }
    });

    server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
        if (!TOOL_NAMES.includes(request.params.name)) {
            throw new McpError(ErrorCode.InvalidParams, 'Unknown tool. Use tools/list.');
        }
        try {
            const client = await upstream();
            const result = await client.callTool(
                { name: request.params.name, arguments: request.params.arguments ?? {} },
                undefined,
                { timeout: TIMEOUT, signal: extra.signal },
            );
            return {
                content: result.content,
                ...(result.structuredContent ? { structuredContent: result.structuredContent } : {}),
                ...(result.isError !== undefined ? { isError: result.isError } : {}),
            };
        } catch {
            return { isError: true, content: [{ type: 'text', text: UNAVAILABLE }] };
        }
    });

    return {
        server,
        async close() {
            await server.close();
            if (upstreamPromise) {
                const client = await upstreamPromise.catch(() => undefined);
                await client?.close();
            }
        },
    };
}
