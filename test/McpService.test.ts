// @vitest-environment node

import {beforeAll, describe, expect, it} from "@effect/vitest"
import {Effect, Logger, LogLevel} from "effect";
import {McpService, McpServiceLive} from "../src/McpService.js";
import {FetchHttpClient} from "@effect/platform";
import {runPromise} from "effect/Effect";
import * as fs from "node:fs";
import {McpLogService, McpLogServiceLive} from "../src/McpLogService.js";
import {DbService, DbServiceLive} from "../src/DbService.js";
import {StoryServiceLive} from "../src/StoryService.js";
import {AnswerError} from "../src/mapTraveler.js";
import {SnsServiceLive} from "../src/SnsService.js";
import {NodeFileSystem} from "@effect/platform-node";

const inGitHubAction = process.env.GITHUB_ACTIONS === 'true';

describe("Mcp", () => {
  beforeAll(async () => {
    return await DbService.initSystemMode().pipe(
      Effect.provide([DbServiceLive]),
      Effect.runPromise
    )
  });

  it("run", async () => {
    //  vitest --run --testNamePattern=run McpService.test.ts
    await McpService.run().pipe(
      Effect.provide([StoryServiceLive, McpServiceLive, FetchHttpClient.layer, McpLogServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      // Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      Effect.provide([McpServiceLive, DbServiceLive]),
      runPromise
    )
  })
  it("tips", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.tips()  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      Effect.provide([StoryServiceLive, McpServiceLive, FetchHttpClient.layer]),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
    expect(res[0].text).includes('Currently in practice mode')
  })
  it("setTravelerInfo/getTravelerInfo", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield* McpService.setTravelerInfo('name is mi')
      return yield* McpService.getTravelerInfo();
    }).pipe(
      Effect.provide([DbServiceLive, McpServiceLive, FetchHttpClient.layer]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e)),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
    expect(res[0].text).includes('name is mi')
  })
  it("getCurrentLocationInfo追加なし", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.getCurrentLocationInfo(false, false, true)
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => {
        if (e instanceof AnswerError) {
          console.log('ans')
        }
        return Effect.logError(e.toString());
      }),
      Effect.tap(a => Effect.log(a)),
      Effect.provide([McpServiceLive]),
      runPromise
    )
    console.log(res)
    expect(res).toBeInstanceOf(Array)
    expect(res[0].text).includes('I am in a hotel')
  })
  it("getCurrentLocationInfoすべて", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.getCurrentLocationInfo(true, true, true)
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => {
        a.filter(b => b.type === 'text')
          .forEach((c, i) =>
            McpLogService.logTrace(c.text))
        a.filter(b => b.type === 'image')
          .forEach((c, i) => {
            if (inGitHubAction) {
              McpLogService.logTrace(c.data?.slice(0, 5))
            } else {
              fs.writeFileSync(`tools/test/getCurrentImage${i}.png`, Buffer.from(c.data!, "base64"));
            }
          })
      }),
      Effect.provide([McpServiceLive]),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
    expect(res.some((a) => a.type === 'text')).toBeTruthy()
    expect(res.some((a) => a.type === 'image')).toBeTruthy()
  })
  it("setCurrentLocation", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.setCurrentLocation("456 Random Street, Lost City") //東京都千代田区丸の内1丁目9-1
    }).pipe(
      Effect.provide([McpServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("setCurrentLocation存在する", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.setCurrentLocation("Yokohama Station") //東京都千代田区丸の内1丁目9-1
    }).pipe(
      Effect.provide([McpServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("getDestinationAddress", async () => {
    //  vitest --run --testNamePattern=getDestinationAddress McpService.test.ts
    await Effect.gen(function* () {
      return yield* McpService.getDestinationAddress()
    }).pipe(
      Effect.provide([McpServiceLive, DbServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a instanceof AnswerError, e => {
        expect(e.message).toBe('The destination has not yet been decided')
        return Effect.succeed([]);
      }),
      runPromise
    )
  })
  it("setDestinationAddress存在しない", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.setDestinationAddress("456 Random Street, Lost City")  //川崎駅
    }).pipe(
      Effect.provide([McpServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("setDestinationAddress存在する", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.setDestinationAddress("Tokyo station")  //川崎駅
    }).pipe(
      Effect.provide([McpServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("getTravelerInfo", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.getTravelerInfo()
    }).pipe(
      Effect.provide([McpServiceLive, DbServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      // Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })

  it("startJourneyPractice", async () => {
    //  vitest --run --testNamePattern=startJourneyPractice McpService.test.ts
    const res = await Effect.gen(function* () {
      yield* McpService.startJourney()
      return yield* McpService.getCurrentLocationInfo(true, true, true)
    }).pipe(
      Effect.provide([McpServiceLive, DbServiceLive, McpLogServiceLive, NodeFileSystem.layer]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(JSON.stringify(a).slice(0, 200))),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("stopJourneyPractice", async () => {
    //  vitest --run --testNamePattern=startJourneyPractice McpService.test.ts
    const res = await Effect.gen(function* () {
      yield* McpService.startJourney()
      return yield* McpService.stopJourney()
    }).pipe(
      Effect.provide([McpServiceLive, DbServiceLive, McpLogServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(JSON.stringify(a).slice(0, 200))),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("startJourney", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.startJourney()
    }).pipe(
      Effect.provide([McpServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(a.map(b => {
          if (b.data) {
            return {
              ...b,
              data: b.data.slice(0, 5)
            }
          }
          return b
        }))
      ),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("stopJourney", async () => {
    //  vitest --run --testNamePattern=stopJourney McpService.test.ts
    const res = await Effect.gen(function* () {
      yield* McpService.startJourney()
      return yield* McpService.stopJourney()
    }).pipe(
      Effect.provide([McpServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(a.map(b => {
        return {
          type: b.type,
          text: b.text,
          data: b.data && b.data.slice(0, 5)
        }
      }))),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("snsFeedの加工", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.getSnsFeeds()
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed([])),
      Effect.tap(a => Effect.log(a)),
      Effect.provide([McpServiceLive, DbServiceLive]),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("getSnsMentions", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.getSnsMentions()
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed([])),
      Effect.tap(a => Effect.log(a)),
      Effect.provide([McpServiceLive, SnsServiceLive, DbServiceLive]),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("replySnsWriter", async () => {
    //  vitest --run --testNamePattern=replySnsWriter McpService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.replySnsWriter("リプライテスト6", "\"at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.post/3letmqctays2a-bafyreigqfjn2spwkuqziieuh5xijimyyld7dpbnpajxc7ax5bkokyyxjna\"")
    }).pipe(
      Effect.provide([McpServiceLive, SnsServiceLive, McpLogServiceLive, DbServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed([])),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })

})
