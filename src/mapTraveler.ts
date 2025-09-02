#!/usr/bin/env node

/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import {Layer, Effect, Option, ManagedRuntime, Schema} from "effect";
import {McpService, McpServiceLive} from "./McpService.js";
import {DbServiceLive} from "./DbService.js";
import {ImageServiceLive} from "./ImageService.js";
import {MapServiceLive} from "./MapService.js";
import {RunnerServiceLive} from "./RunnerService.js";
import {SnsServiceLive} from "./SnsService.js";
import {StoryServiceLive} from "./StoryService.js";
import {randomUUID} from 'node:crypto';
import express, {Request, Response} from 'express'
// import session, { SessionData, Store } from "express-session";
// import {LRUCache} from "lru-cache";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {isInitializeRequest} from "@modelcontextprotocol/sdk/types.js";
import {InMemoryEventStore} from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import cors from 'cors';
import {setupAuthServer} from "@modelcontextprotocol/sdk/examples/server/demoInMemoryOAuthProvider.js";
import {OAuthMetadata} from "@modelcontextprotocol/sdk/shared/auth.js";
import {checkResourceAllowed} from "@modelcontextprotocol/sdk/shared/auth-utils.js";
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import {requireBearerAuth} from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import {EnvSmitherySchema} from "./EnvUtils.js";
import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {McpLogServiceLive} from "./McpLogService.js";
import {FetchHttpClient} from "@effect/platform";

/*
// ====== 設定値 ======
const MAX_SESSIONS = 1000;             // 上限セッション数
const SESSION_TTL_MS = 30 * 60 * 1000; // セッション保持時間（例：30分）
const UNIQUE_TTL_MS  = 10 * 60 * 1000; // ユニーク情報の保持時間（例：10分; 0なら無効）
// ====================
*/

//  TODO Smithrey対応のための複数のサービスインスタンスが必要なため、Serviceはsessionごとに新規生成の形にする
// const AppLiveFresh = Layer.mergeAll(McpLogServiceLive, Layer.fresh(McpServiceLive), Layer.fresh(DbServiceLive), Layer.fresh(McpServiceLive), Layer.fresh(ImageServiceLive), Layer.fresh(MapServiceLive), Layer.fresh(RunnerServiceLive), Layer.fresh(SnsServiceLive), Layer.fresh(StoryServiceLive),FetchHttpClient.layer);
const AppLive = Layer.mergeAll(McpLogServiceLive, McpServiceLive, DbServiceLive, McpServiceLive, ImageServiceLive, MapServiceLive, RunnerServiceLive, SnsServiceLive, StoryServiceLive, FetchHttpClient.layer);
const aiRuntime = ManagedRuntime.make(AppLive);
// const aiMultiRuntime = ManagedRuntime.make(AppLiveFresh);

const serverSet = new Map<string, Server>();  //
const transports: { [sessionId: string]: { transport: StreamableHTTPServerTransport; userId: string } } = {};

/*
// ---- Session 型拡張 ----
declare module "express-session" {
  interface SessionData {
    unique?: {
      userId: string;
      createdAt: number;
      transport: StreamableHTTPServerTransport;
      [key: string]: any;
    };
    uniqueExpiredAt?: number;
  }
}

// LRU で上限＆TTLを管理する Store ラッパ
class CappedStore extends Store {
  private store: Store;
  private lru: LRUCache<string, boolean>;

  constructor(store: Store, max: number, ttl: number) {
    super();

    this.store = store;
    this.lru = new LRUCache<string, boolean>({
      max,
      ttl,
      ttlAutopurge: true,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      dispose: (value, sid) => {
        this.store.destroy(sid, () => {});
      },
    });
  }

  get = (sid: string, callback: (err: any, session?: SessionData | null) => void): void => {
    this.store.get(sid, (err, sess) => {
      if (!err && sess) this.lru.set(sid, true, { ttl: SESSION_TTL_MS });
      callback(err, sess);
    });
  };

  set = (sid: string, session: SessionData, callback?: (err?: any) => void): void => {
    this.lru.set(sid, true, { ttl: SESSION_TTL_MS });
    this.store.set(sid, session, callback || (() => {}));
  };

  touch = (sid: string, session: SessionData, callback?: () => void): void => {
    this.lru.set(sid, true, { ttl: SESSION_TTL_MS });
    if (typeof (this.store as any).touch === "function") {
      (this.store as any).touch(sid, session, callback || (() => {}));
    } else {
      this.store.set(sid, session, callback || (() => {}));
    }
  };

  destroy = (sid: string, callback?: (err?: any) => void): void => {
    this.lru.delete(sid);
    this.store.destroy(sid, callback || (() => {}));
    //  TODO serverを破棄する sessionは保持しておく
  };

  length = (callback: (err: any, length?: number) => void): void => {
    if (typeof (this.store as any).length === "function") {
      (this.store as any).length(callback);
    } else {
      callback(null, this.lru.size);
    }
  };
}
*/

export class AnswerError extends Error {
  readonly _tag = "AnswerError"

  constructor(message: string) {
    super(message);
    this.name = "AnswerError";
    Object.setPrototypeOf(this, AnswerError.prototype);
  }
}

//  from https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/examples/server/simpleStreamableHttp.ts
//  and https://smithery.ai/docs/migrations/typescript-custom-container
const MCP_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8081;
const AUTH_PORT = process.env.MCP_AUTH_PORT ? parseInt(process.env.MCP_AUTH_PORT, 10) : 3001;

async function makeServer(smitheryConfig: Option.Option<any>) {
  const AppLiveFresh = Layer.mergeAll(McpLogServiceLive, Layer.fresh(McpServiceLive), Layer.fresh(DbServiceLive), Layer.fresh(ImageServiceLive), Layer.fresh(MapServiceLive), Layer.fresh(RunnerServiceLive), Layer.fresh(SnsServiceLive), Layer.fresh(StoryServiceLive), FetchHttpClient.layer);
  const aiMultiRuntime = ManagedRuntime.make(AppLiveFresh);
  return await McpService.run(aiMultiRuntime, smitheryConfig).pipe(aiMultiRuntime.runPromise)
}

function setupHttp() {

// Check for OAuth flag
  const useOAuth = false // process.argv.includes('--oauth');
  const strictOAuth = false // process.argv.includes('--oauth-strict');

  const app = express();
  app.use(express.json());

// Allow CORS all domains, expose the Mcp-Session-Id header
  app.use(cors({
    origin: '*', // Allow all origins
    exposedHeaders: ['Mcp-Session-Id', 'mcp-protocol-version'],
    allowedHeaders: ['Content-Type', 'mcp-session-id'],
  }));

/*
  const baseStore = new session.MemoryStore();
  const cappedStore = new CappedStore(baseStore, MAX_SESSIONS, SESSION_TTL_MS);
  app.use(
    session({
      secret: "change-me",  //  TODO
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: { maxAge: SESSION_TTL_MS },
      store: cappedStore,
    })
  );
  // ---- ユニーク情報 TTL 管理ミドルウェア ----
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (!UNIQUE_TTL_MS) return next();
    if (!req.session) return next();

    const now = Date.now();
    const u = req.session.unique;

    if (!u) return next();

    const createdAt = u.createdAt ?? 0;
    if (now - createdAt > UNIQUE_TTL_MS) {
      delete req.session.unique;
      req.session.uniqueExpiredAt = now;
    }
    next();
  });
*/

// Set up OAuth if enabled
  let authMiddleware = null;
  if (useOAuth) {
    // Create auth middleware for MCP endpoints
    const mcpServerUrl = new URL(`http://localhost:${MCP_PORT}/mcp`);
    const authServerUrl = new URL(`http://localhost:${AUTH_PORT}`);

    const oauthMetadata: OAuthMetadata = setupAuthServer({authServerUrl, mcpServerUrl, strictResource: strictOAuth});

    const tokenVerifier = {
      verifyAccessToken: async (token: string) => {
        const endpoint = oauthMetadata.introspection_endpoint;

        if (!endpoint) {
          throw new Error('No token verification endpoint available in metadata');
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: token
          }).toString()
        });


        if (!response.ok) {
          throw new Error(`Invalid or expired token: ${await response.text()}`);
        }

        const data = await response.json();

        if (strictOAuth) {
          if (!data.aud) {
            throw new Error(`Resource Indicator (RFC8707) missing`);
          }
          if (!checkResourceAllowed({requestedResource: data.aud, configuredResource: mcpServerUrl})) {
            throw new Error(`Expected resource indicator ${mcpServerUrl}, got: ${data.aud}`);
          }
        }

        // Convert the response to AuthInfo format
        return {
          token,
          clientId: data.client_id,
          scopes: data.scope ? data.scope.split(' ') : [],
          expiresAt: data.exp,
        };
      }
    }
    // Add metadata routes to the main MCP server
    app.use(mcpAuthMetadataRouter({
      oauthMetadata,
      resourceServerUrl: mcpServerUrl,
      scopesSupported: ['mcp:tools', 'mcp:resources'],
      resourceName: 'map-traveler-mcp Server',
    }));

    authMiddleware = requireBearerAuth({
      verifier: tokenVerifier,
      requiredScopes: [],
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
    });
  }

  function parseConfig(req: Request) {
    const configParam = req.query.config as string;
    console.log('configParam:',configParam)
    if (configParam) {
      return JSON.parse(Buffer.from(configParam, 'base64').toString());
    }
    return {};
  }

// Map to store transports by session ID
  //const transports: { [sessionId: string]: { transport: StreamableHTTPServerTransport; server: Server } } = {};

  /*
  TODO 現時点のユーザ識別の考え方
   MT_TURSO_URL が指定されている場合、この文字列をユーザIDかつdbContext指定とする
   MT_TURSO_URL が指定されていない場合、sessionIdをユーザIDとし、dbは1つのオンメモリdbContextの中でuserIdでデータを分ける
  TODO
   将来oauthやきちんとしたログイン認証を入れることがあれば、そのときはreq.auth.clientIdをユーザIDとし、dbは1つのdbContext(環境変数で指定された1つのローカルsqliteや一つのTurso_Url)でuserIdで分けるようにするかもしれない。しかし今は考えない
   */
// MCP POST endpoint with optional auth
  const mcpPostHandler = async (req: Request, res: Response) => {
    console.log('Post Request:',req);
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId) {
      console.log(`Received MCP request for session: ${sessionId}`);
    } else {
      console.log('Request body:', req.body);
    }

    if (useOAuth && req.auth) {
      console.log('Authenticated user:', req.auth);
    }
    try {
      // Parse configuration (only if you added configuration handling in Step 2)
      const rawConfig = parseConfig ? parseConfig(req) : {};
      // Validate and parse configuration (only if you added configSchema in Step 2)
      console.log('rawConfig:',rawConfig)
      const smitheryConfig = Schema.decodeUnknownOption(EnvSmitherySchema)({
        MT_GOOGLE_MAP_KEY: rawConfig?.MT_GOOGLE_MAP_KEY || undefined,
        MT_TURSO_URL: rawConfig?.MT_TURSO_URL || undefined,
        MT_TURSO_TOKEN: rawConfig?.MT_TURSO_TOKEN || undefined,
        MT_BS_ID: rawConfig?.MT_BS_ID || undefined,
        MT_BS_PASS: rawConfig?.MT_BS_PASS || undefined,
        MT_BS_HANDLE: rawConfig?.MT_BS_HANDLE || undefined,
        MT_FILTER_TOOLS: rawConfig?.MT_FILTER_TOOLS || undefined,
        MT_MOVE_MODE: rawConfig?.MT_MOVE_MODE || undefined,
        MT_FEED_TAG: rawConfig?.MT_FEED_TAG || undefined,
      });
      console.log('smitheryConfig:',smitheryConfig)

      let transport: StreamableHTTPServerTransport | undefined;
      let session: { transport: StreamableHTTPServerTransport; userId: string } | undefined = undefined;
      console.log('transports:',transports)
      console.log('serverSet len:',serverSet.size,Object.keys(serverSet))
      let server:Server | undefined = undefined;
      if (sessionId && transports[sessionId]) {
        // if (sessionId && req.session.unique?.transport && req.session.unique.userId === userId) {
        // Reuse existing transport
        session = transports[sessionId];
        transport = session.transport;
        // const userId = session.userId;
        server = serverSet.get(session.userId)
        console.log('server1:',server)
        // transport = req.session.unique.transport;
        if (!server) {
          //  sessionIdはあるけどserverがない->serverがタイムアウトして消失している->セッションそのままでseverとsessionデータを再初期化
          //  TODO MT_TURSO_URLあるならdbで初期化 ないなら匿名ユーザとして新規起動になるがエラーとしたほうがよいのか?
          const userId = Option.getOrNull(smitheryConfig)?.MT_TURSO_URL || sessionId;
          server = await makeServer(smitheryConfig);
          console.log('server2:',server)
          serverSet.set(userId,server)
        }
        // transport.server.setSmitheryConfig(smitheryConfig);
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request
        const newServer = await makeServer(smitheryConfig);
        server = newServer;
        const eventStore = new InMemoryEventStore();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          eventStore, // Enable resumability
          onsessioninitialized: (sessionId) => {
            // Store the transport by session ID when session is initialized
            // This avoids race conditions where requests might come in before the session is stored
            console.log(`Session initialized with ID: ${sessionId}`);
            const userId = Option.getOrNull(smitheryConfig)?.MT_TURSO_URL || sessionId;
            transports[sessionId] = {transport, userId};
            console.log('server3:',newServer)
            serverSet.set(userId,newServer)
/*
            if (!req.session.unique) {
              req.session.unique = {
                userId: Option.getOrNull(smitheryConfig)?.MT_TURSO_URL || sessionId, // TURSO指定があればMT_TURSO_URLをUserIdにする 指定がなければsessionIdをUserIdとする
                createdAt: Date.now(),
                transport,
                // server,
              };
            }
*/
          },
        })

        // Set up onclose handler to clean up transport when closed
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            console.log(`Transport closed for session ${sid}, removing from transports map`);
            // const userId = Option.getOrNull(smitheryConfig)?.MT_TURSO_URL || sid;
            serverSet.delete(transports[sid].userId);
            delete transports[sid];
          }
/*
          if (sid && req.session.unique) {
            console.error(`Transport closed for session ${sid}, removing from transports map`);
            //  TODO セッションデータを破棄する serverも破棄する
            const key = Option.getOrNull(smitheryConfig)?.MT_TURSO_URL || sid;
            // const server = serverSet.get(key);
            //
            serverSet.delete(key);
            // delete transports[sid];
          }
*/
        };

        // Connect the transport to the MCP server BEFORE handling the request
        // so responses can flow back through the same transport
        await server.connect(transport);

        await transport.handleRequest(req, res, req.body);
        return; // Already handled
      } else {
        // Invalid request - no session ID or not initialization request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      // Handle the request with existing transport - no need to reconnect
      // The existing transport is already connected to the server
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.log('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  };

// Set up routes with conditional auth middleware
  if (useOAuth && authMiddleware) {
    app.post('/mcp', authMiddleware, mcpPostHandler);
  } else {
    app.post('/mcp', mcpPostHandler);
  }


// Handle GET requests for SSE streams (using built-in support from StreamableHTTP)
  const mcpGetHandler = async (req: Request, res: Response) => {
    console.log('Get Request:',req);
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      // if (!sessionId || !(req.session.unique?.transport)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    const transport = transports[sessionId].transport;

    if (useOAuth && req.auth) {
      console.log('Authenticated SSE connection from user:', req.auth);
    }

    // Check for Last-Event-ID header for resumability
    const lastEventId = req.headers['last-event-id'] as string | undefined;
    if (lastEventId) {
      console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
    } else {
      console.log(`Establishing new SSE stream for session ${sessionId}`);
    }

    // const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  };

// Set up GET route with conditional auth middleware
  if (useOAuth && authMiddleware) {
    app.get('/mcp', authMiddleware, mcpGetHandler);
  } else {
    app.get('/mcp', mcpGetHandler);
  }

// Handle DELETE requests for session termination (according to MCP spec)
  const mcpDeleteHandler = async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      // if (!sessionId || !(req.session.unique?.transport)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    const transport = transports[sessionId].transport;

    console.log(`Received session termination request for session ${sessionId}`);

    try {
      // const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    } catch (error) {
      console.log('Error handling session termination:', error);
      if (!res.headersSent) {
        res.status(500).send('Error processing session termination');
      }
    }
  };

// Set up DELETE route with conditional auth middleware
  if (useOAuth && authMiddleware) {
    app.delete('/mcp', authMiddleware, mcpDeleteHandler);
  } else {
    app.delete('/mcp', mcpDeleteHandler);
  }

  app.listen(MCP_PORT, (error) => {
    if (error) {
      console.log('Failed to start server:', error);
      process.exit(1);
    }
    console.log(`MCP Streamable HTTP Server listening on port ${MCP_PORT}`);
  });

// Handle server shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down server...');

    // Close all active transports to properly clean up resources
    serverSet.clear() //  TODO
    // for (const sessionId in transports) {
    //   try {
    //     console.error(`Closing transport for session ${sessionId}`);
    //     await transports[sessionId].transport.close();
    //     delete transports[sessionId];
    //   } catch (error) {
    //     console.error(`Error closing transport for session ${sessionId}:`, error);
    //   }
    // }
    console.log('Server shutdown complete');
    process.exit(0);
  });

  return app;
}

// const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
//   Layer.provide(AppLive),
//   Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
// )
//
// Layer.launch(HttpLive).pipe(
//   NodeRuntime.runMain
// )

async function main() {
  await Effect.gen(function* () {
    const transport = process.env.TRANSPORT || 'stdio';

    if (transport === 'http') {
      // Run in HTTP mode
      const app = setupHttp()
      app.listen(MCP_PORT, () => {
        console.error(`MCP HTTP Server listening on port ${MCP_PORT}`);
      });
    } else {
      // Create server with configuration
      const server = yield* McpService.run(aiRuntime, Option.none())

      // Start receiving messages on stdin and sending messages on stdout
      const stdioTransport = new StdioServerTransport();
      yield* Effect.tryPromise({
        try: signal => server.connect(stdioTransport),
        catch: error => {
          console.error('err:', error)
          return Effect.fail(new Error(`${error}`))
        }
      })
      console.error("MCP Server running in stdio mode");
    }
  }).pipe(aiRuntime.runPromise)//.pipe(Effect.provide(AppLive)) //.pipe(aiRuntime.runPromise)
  // await McpService.run(AppLive,Option.none()).pipe(aiRuntime.runPromise)
  // await Effect.runPromise(Effect.gen(function* () {
  //   yield* McpService.run()
  // }).pipe(Effect.provide([McpServiceLive]),))

  // const ex = await Effect.runPromiseExit(p)
  // console.error('exit:',ex)
  // return ex
  // return await Effect.runFork(p).pipe(Effect.runPromise)
}

main().catch((error) => {
  //  MCPではconsole出力はエラーになるっぽい
  console.error("Server error:", error);
});
