// @vitest-environment node

import {beforeAll, describe, expect, it} from "@effect/vitest"
import {Effect, Logger, LogLevel} from "effect";
import {SnsService, SnsServiceLive} from "../src/SnsService.js";
import {McpLogService, McpLogServiceLive} from "../src/McpLogService.js";
import {runPromise, runPromiseExit} from "effect/Effect";
import * as fs from "node:fs";
import {DbService, DbServiceLive} from "../src/DbService.js";


describe("Sns", () => {
  beforeAll(async () => {
    return await DbService.initSystemMode().pipe(
      Effect.provide([DbServiceLive, McpLogServiceLive]),
      Effect.runPromise
    )
  });
  it("bsPost単純ポスト", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.bsPost("ポストテスト")
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed({})),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("bsPost画像ポスト", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      const buffer = fs.readFileSync('assets/hotelPict.png');
      return yield* SnsService.bsPost("画像ポストテスト", undefined, {buf: buffer, mime: 'image/png'})
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed({})),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("bsPost画像リプライポスト", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      const buffer = fs.readFileSync('assets/hotelPict.png');
      return yield* SnsService.bsPost("画像ポストテスト", {
        uri: 'at://did:plc:yl63l7eegfz5ddsyjrp66dsc/app.bsky.feed.post/3leg5encxz523',
        cid: 'bafyreifpbccbqu5qghfrz3ahb2vew4qybu2gbir6zcwlhoiikle4untsae'
      }, {buf: buffer, mime: 'image/png'})
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed({})),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("getOwnProfile", async () => {
    //  vitest --run --testNamePattern=getOwnProfile SnsService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.getOwnProfile()
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed({})),
        Effect.catchIf(a => a.toString() === 'Error: no bs handle', e => Effect.succeed({})),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("getAuthorFeed", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.getAuthorFeed("marblebrick.bsky.social", 2)
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed({})),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("getPost", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.getPost("at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.post/3lebyz45tqs2c")
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed({})),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("getFeed", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.getFeed("at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.generator/marble_square25", 2)
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive,DbServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed({})),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromiseExit
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("getNotification", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.getNotification()
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive,DbServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed([])),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("snsReply", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.snsReply("リプライテスト"," test","at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.post/3letmqctays2a-bafyreigqfjn2spwkuqziieuh5xijimyyld7dpbnpajxc7ax5bkokyyxjna")
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive,DbServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed([])),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })

})
