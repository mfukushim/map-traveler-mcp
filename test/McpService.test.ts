// @vitest-environment node

import {describe, expect, it,beforeAll} from "@effect/vitest"
import {Effect, Logger, LogLevel} from "effect";
import {McpService, McpServiceLive} from "../src/McpService.js";
import {FetchHttpClient} from "@effect/platform";
import {runPromise} from "effect/Effect";
import * as fs from "node:fs";
import {McpLogService, McpLogServiceLive} from "../src/McpLogService.js";
import {DbService, DbServiceLive} from "../src/DbService.js";
import {StoryServiceLive} from "../src/StoryService.js";
import {AnswerError} from "../src/index.js";


describe("Mcp", () => {
  beforeAll(async () => {
    return await DbService.initSystemMode().pipe(
      Effect.provide([DbServiceLive,McpLogServiceLive]),
      Effect.runPromise
    )
  });

  it("should pass", () => {
    expect(true).toBe(true)
  })
  it("run", async () => {
    //  TODO なぜかintelliJ経由で実行するとコマンドを見つけられない。。 コマンドラインからだと使える。。。  vitest --run --testNamePattern=run McpService.test.ts
    await McpService.run().pipe(
        Effect.provide([McpServiceLive, DbServiceLive]),
        Effect.provide([StoryServiceLive, McpServiceLive, FetchHttpClient.layer, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        // Effect.tapError(e => Effect.logError(e.toString())),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
      )
  })
  it("tips", async () => {
    //  TODO なぜかintelliJ経由で実行するとコマンドを見つけられない。。 コマンドラインからだと使える。。。  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    await Effect.gen(function* () {
      return yield* McpService.tips()  //
    }).pipe(
      Effect.provide([StoryServiceLive, McpServiceLive, FetchHttpClient.layer, McpLogServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      // Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      runPromise
    )
  })
  it("setLanguage", async () => {
    //  TODO なぜかintelliJ経由で実行するとコマンドを見つけられない。。 コマンドラインからだと使える。。。  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    await Effect.gen(function* () {
      return yield* McpService.setPersonMode('second_person')  //
    }).pipe(
      Effect.provide([McpServiceLive, FetchHttpClient.layer,DbServiceLive,McpLogServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      runPromise
    )
  })
  it("setTravelerInfo", async () => {
    //  TODO なぜかintelliJ経由で実行するとコマンドを見つけられない。。 コマンドラインからだと使える。。。  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    await Effect.gen(function* () {
      return yield* McpService.setTravelerInfo('name is mi')
    }).pipe(
      Effect.provide([DbServiceLive, McpServiceLive, FetchHttpClient.layer]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      // Effect.tapError(e => McpLogService.logError(e).pipe(Effect.provide(McpLogServiceLive))),
      // Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      runPromise
    )
  })
  it("getCurrentLocationInfo追加なし", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.getCurrentLocationInfo(false, false, true)
    }).pipe(
      Effect.provide([McpServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => {
        if (e instanceof AnswerError) {
          console.log('ans')
        }
        return McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive));
      }),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      runPromise
    )
    console.log(res)
  })
  it("getCurrentLocationInfoすべて", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    await Effect.gen(function* () {
      return yield* McpService.getCurrentLocationInfo(true, true, true)
    }).pipe(
      Effect.provide([McpServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => {
        a.content.filter(b => b.type === 'text')
          .forEach((c, i) =>
            McpLogService.log(c.text))
        a.content.filter(b => b.type === 'image')
          .forEach((c, i) =>
            fs.writeFileSync(`tools/test/getCurrentImage${i}.png`, Buffer.from(c.data!, "base64")))

        return Effect.log(a);
      }),
      runPromise
    )
  })
  it("setCurrentLocation", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    await Effect.gen(function* () {
      return yield* McpService.setCurrentLocation("横浜駅")
    }).pipe(
      Effect.provide([McpServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      runPromise
    )
  })
  it("getDestinationAddress", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    await Effect.gen(function* () {
      return yield* McpService.getDestinationAddress()
    }).pipe(
      Effect.provide([McpServiceLive,DbServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
  })
  it("setDestinationAddress", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    await Effect.gen(function* () {
      return yield* McpService.setDestinationAddress("川崎駅")
    }).pipe(
      Effect.provide([McpServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
  })
  it("startJourneyPractice", async () => {
    //  vitest --run --testNamePattern=startJourneyPractice McpService.test.ts
    const res = await Effect.gen(function* () {
      yield* McpService.startJourney()
      return yield *McpService.getCurrentLocationInfo(true,true,true)
    }).pipe(
      Effect.provide([McpServiceLive,DbServiceLive,McpLogServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(JSON.stringify(a).slice(0,200))),
      runPromise
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("stopJourneyPractice", async () => {
    //  vitest --run --testNamePattern=startJourneyPractice McpService.test.ts
    const res = await Effect.gen(function* () {
      yield* McpService.startJourney()
      return yield *McpService.stopJourney()
    }).pipe(
      Effect.provide([McpServiceLive,DbServiceLive,McpLogServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(JSON.stringify(a).slice(0,200))),
      runPromise
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("startJourney", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    await Effect.gen(function* () {
      return yield* McpService.startJourney()
    }).pipe(
      Effect.provide([McpServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
  })
  it("stopJourney", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    await Effect.gen(function* () {
      return yield* McpService.stopJourney()
    }).pipe(
        Effect.provide([McpServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => Effect.logError(e.toString())),
        Effect.tap(a => Effect.log(a)),
        runPromise
    )
  })
  it("snsFeedの加工", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.getSnsFeeds()
    }).pipe(
        Effect.provide([McpServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => Effect.logError(e.toString())),
        Effect.tap(a => Effect.log(a)),
        runPromise
    )
    console.log(res)
  })

})
