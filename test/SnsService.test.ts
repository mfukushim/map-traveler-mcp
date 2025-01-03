// @vitest-environment node

import {describe, expect, it} from "@effect/vitest"
import {Effect, Logger, LogLevel} from "effect";
import {SnsService, SnsServiceLive} from "../src/SnsService.js";
import {McpLogService, McpLogServiceLive} from "../src/McpLogService.js";
import {runPromise} from "effect/Effect";
import * as fs from "node:fs";
import {DbServiceLive} from "../src/DbService.js";


describe("Sns", () => {
  it("should pass", () => {
    expect(true).toBe(true)
  })
  it("bsPost単純ポスト", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.bsPost("ポストテスト")
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    console.log(res)
  })
  it("bsPost画像ポスト", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      const buffer = fs.readFileSync('tools/test/makeHotelPict.jpg');
      return yield* SnsService.bsPost("画像ポストテスト", undefined, {buf: buffer, mime: 'image/png'})
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    console.log(res)
  })
  it("bsPost画像リプライポスト", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      const buffer = fs.readFileSync('tools/test/makeHotelPict.jpg');
      return yield* SnsService.bsPost("画像ポストテスト", {
        uri: 'at://did:plc:yl63l7eegfz5ddsyjrp66dsc/app.bsky.feed.post/3leg5encxz523',
        cid: 'bafyreifpbccbqu5qghfrz3ahb2vew4qybu2gbir6zcwlhoiikle4untsae'
      }, {buf: buffer, mime: 'image/png'})
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    console.log(res)
  })
  it("getOwnProfile", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.getOwnProfile()
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    console.log(res)
  })
  it("getAuthorFeed", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.getAuthorFeed("marblebrick.bsky.social", 2)
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    console.log(res)
  })
  it("getPost", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.getPost("at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.post/3lebyz45tqs2c")
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    console.log(res)
  })
  it("getFeed", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.getFeed("at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.generator/marble_square25", 2)
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    console.log(res)
  })
  it("getNotification", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.getNotification()
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    console.log(res)
    expect(res).toBeInstanceOf(Array)
  })
  it("snsReply", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* SnsService.snsReply("リプライテスト"," test","at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.post/3letmqctays2a,bafyreigqfjn2spwkuqziieuh5xijimyyld7dpbnpajxc7ax5bkokyyxjna")
    }).pipe(
        Effect.provide([SnsServiceLive, McpLogServiceLive,DbServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    console.log(res)
    expect(res).toBeInstanceOf(Array)
  })

})
