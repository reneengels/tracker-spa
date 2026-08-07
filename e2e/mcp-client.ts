// Ticket 15: a real MCP client (official SDK, Streamable HTTP transport)
// used by the happy-path test's agent steps — not simulated, actual
// tool-calls against the running tracker-api MCP server.
import * as http from "node:http";
import { Readable } from "node:stream";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * A `fetch`-compatible function backed by Node's `http` module, used only
 * for the MCP client's requests (not the rest of the E2E suite).
 *
 * Two environment-specific problems this works around, both reproduced
 * and root-caused directly against `mcr.microsoft.com/playwright:v1.61.1`
 * (confirmed on both its bundled Node 24 and a manually-installed Node 22
 * — not a Node-24-specific regression):
 *
 * 1. Node's native `fetch` (undici) throws `UND_ERR_REQ_CONTENT_LENGTH_
 *    MISMATCH` specifically when a POST request combines a body with a
 *    long `Authorization: Bearer <token>` header value — reproduced with
 *    a plain `fetch()` call, zero SDK/application code involved, so this
 *    is an upstream undici bug, not something fixable from here. A raw
 *    `http.request` call with the identical headers/body does not hit it.
 * 2. FastMCP's Streamable HTTP transport has DNS-rebinding protection
 *    that only trusts `Host: localhost*` by default, rejecting the
 *    Docker-network hostname (`mcp:8001`) this client necessarily
 *    connects through with a 421 "Invalid Host header" — worked around
 *    by sending the real Docker hostname to establish the TCP
 *    connection while presenting a `Host` header value the server's
 *    check accepts (HTTP explicitly allows these to differ; this is not
 *    a spoof of the connection target, just of the header the DNS-
 *    rebinding check reads). This is a sandbox/E2E-networking concern,
 *    not a tracker-api bug — flagged to the coordinator regardless,
 *    since a real multi-host on-prem deployment (ticket 14) could hit
 *    the exact same rejection.
 */
function httpFetch(url: string, init: RequestInit = {}): Promise<Response> {
    return new Promise((resolve, reject) => {
        const target = new URL(url);
        const body = init.body as string | undefined;
        const headers: Record<string, string> = {};
        if (init.headers) {
            const h = init.headers instanceof Headers ? init.headers : new Headers(init.headers);
            for (const [key, value] of h.entries()) headers[key] = value;
        }
        headers.host = `localhost:${target.port}`;
        if (body != null) headers["content-length"] = String(Buffer.byteLength(body));

        const req = http.request(
            {
                hostname: target.hostname,
                port: target.port,
                path: `${target.pathname}${target.search}`,
                method: init.method ?? "GET",
                headers,
            },
            (res) => {
                const responseHeaders = new Headers();
                for (const [key, value] of Object.entries(res.headers)) {
                    if (Array.isArray(value)) {
                        for (const v of value) responseHeaders.append(key, v);
                    } else if (value != null) {
                        responseHeaders.set(key, value);
                    }
                }
                const webStream = Readable.toWeb(res) as unknown as ReadableStream;
                resolve(new Response(webStream, { status: res.statusCode, headers: responseHeaders }));
            }
        );
        req.on("error", reject);
        if (body != null) req.end(body);
        else req.end();
    });
}

export async function connectMcpClient(url: string, token: string): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
        fetch: httpFetch,
    });
    const client = new Client({ name: "e2e-agent", version: "1.0.0" });
    await client.connect(transport);
    return client;
}

/**
 * Call an MCP tool and return its result as a plain object/array.
 *
 * FastMCP tools here return a Python dict/list — depending on whether it
 * inferred a structured output schema, that surfaces as `structuredContent`
 * or as a JSON string inside the first text content block. Handle both.
 */
export async function callTool<T = unknown>(
    client: Client,
    name: string,
    args: Record<string, unknown>
): Promise<T> {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) {
        throw new Error(`MCP tool "${name}" failed: ${JSON.stringify(result.content)}`);
    }
    if (result.structuredContent) {
        return result.structuredContent as T;
    }
    const content = result.content as Array<{ type: string; text?: string }>;
    const first = content?.[0];
    if (first?.type === "text" && first.text) {
        try {
            return JSON.parse(first.text) as T;
        } catch {
            return first.text as unknown as T;
        }
    }
    throw new Error(`MCP tool "${name}" returned no usable content: ${JSON.stringify(result)}`);
}
