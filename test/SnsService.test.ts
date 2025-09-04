// @vitest-environment node

import {describe, expect, it} from "@effect/vitest"
import {Effect, Layer, Logger, LogLevel, ManagedRuntime, Option} from "effect";
import {SnsService, SnsServiceLive} from "../src/SnsService.js";
import {McpLogService, McpLogServiceLive} from "../src/McpLogService.js";
import * as fs from "node:fs";
import {DbService, DbServiceLive} from "../src/DbService.js";

const AppLive = Layer.mergeAll(McpLogServiceLive, DbServiceLive, SnsServiceLive)
const aiRuntime = ManagedRuntime.make(AppLive);


describe("Sns", () => {
  // beforeAll(async () => {
  //   return await DbService.initSystemMode().pipe(
  //     Effect.provide([DbServiceLive, McpLogServiceLive]),
  //     Effect.runPromise
  //   )
  // });
  it("bsPost単純ポスト", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      // yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* SnsService.bsPost("ポストテスト")
    }).pipe(
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed({})),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("bsPost画像ポスト", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      // yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      const buffer = fs.readFileSync('assets/hotelPict.png');
      return yield* SnsService.bsPost("画像ポストテスト", undefined, {buf: buffer, mime: 'image/png'})
    }).pipe(
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed({})),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("bsPost画像リプライポスト", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      // yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      const buffer = fs.readFileSync('assets/hotelPict.png');
      return yield* SnsService.bsPost("画像ポストテスト", {
        uri: 'at://did:plc:yl63l7eegfz5ddsyjrp66dsc/app.bsky.feed.post/3leg5encxz523',
        cid: 'bafyreifpbccbqu5qghfrz3ahb2vew4qybu2gbir6zcwlhoiikle4untsae'
      }, {buf: buffer, mime: 'image/png'})
    }).pipe(
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed({})),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("getOwnProfile", async () => {
    //  vitest --run --testNamePattern=getOwnProfile SnsService.test.ts
    const res = await Effect.gen(function* () {
      // yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* SnsService.getOwnProfile()
    }).pipe(
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed({})),
        Effect.catchIf(a => a.toString() === 'Error: no bs handle', e => Effect.succeed({})),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("getAuthorFeed", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      // yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* SnsService.getAuthorFeed("marblebrick.bsky.social", 2)
    }).pipe(
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed({})),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("getPost", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      // yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* SnsService.getPost("at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.post/3lebyz45tqs2c")
    }).pipe(
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed({})),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("getFeed", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      // yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* SnsService.getFeed("at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.generator/marble_square25", 2)
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed({})),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("searchPosts", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      // yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* SnsService.searchPosts("#AIイラスト", 2)
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed({})),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("getNotification", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      // yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* SnsService.getNotification()
    }).pipe(
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString())),
        Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed([])),
        Effect.tap(a => McpLogService.log(a)),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("snsReply", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      // yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* SnsService.snsReply("リプライテスト"," test","at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.post/3letmqctays2a-bafyreigqfjn2spwkuqziieuh5xijimyyld7dpbnpajxc7ax5bkokyyxjna")
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed([])),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("addLike", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      // yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* SnsService.addLike("at://did:plc:yl63l7eegfz5ddsyjrp66dsc/app.bsky.feed.post/3leg5encxz523-bafyreifpbccbqu5qghfrz3ahb2vew4qybu2gbir6zcwlhoiikle4untsae")
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed(1)),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBe(1)
  })

})
