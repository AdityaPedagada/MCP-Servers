import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import cors from 'cors';
import { createFilesystemServer, normalizePath, expandHome } from './lib.js';
import fs from "fs/promises";
import path from "path";

console.error('Starting SSE server...');

// Parse command line arguments for allowed directories
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node sse.js [allowed-directory] [additional-directories...]");
  process.exit(1);
}

// Process allowed directories
const allowedDirectories = await Promise.all(
  args.map(async (dir) => {
    const expanded = expandHome(dir);
    const absolute = path.resolve(expanded);
    try {
      const resolved = await fs.realpath(absolute);
      return normalizePath(resolved);
    } catch (error) {
      return normalizePath(absolute);
    }
  })
);

const app = express();
app.use(cors({
    "origin": "*",
    "methods": "GET,POST",
    "preflightContinue": false,
    "optionsSuccessStatus": 204,
}));

const transports: Map<string, SSEServerTransport> = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
  let transport: SSEServerTransport;
  
  if (req?.query?.sessionId) {
    const sessionId = (req?.query?.sessionId as string);
    transport = transports.get(sessionId) as SSEServerTransport;
    console.error("Client Reconnecting? This shouldn't happen; when client has a sessionId, GET /sse should not be called again.", transport.sessionId);
  } else {
    // Create and store transport for new session
    transport = new SSEServerTransport("/message", res);
    transports.set(transport.sessionId, transport);

    // Create server instance with allowed directories
    const server = createFilesystemServer(allowedDirectories);
    
    // Connect server to transport
    await server.connect(transport);
    console.error("Client Connected: ", transport.sessionId);

    // Handle close of connection
    server.onclose = async () => {
      console.error("Client Disconnected: ", transport.sessionId);
      transports.delete(transport.sessionId);
    };
  }
});

app.post("/message", async (req, res) => {
  const sessionId = (req?.query?.sessionId as string);
  const transport = transports.get(sessionId);
  if (transport) {
    console.error("Client Message from", sessionId);
    await transport.handlePostMessage(req, res);
  } else {
    console.error(`No transport found for sessionId ${sessionId}`)
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.error(`Server is running on port ${PORT}`);
});