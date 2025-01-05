// @vitest-environment node

import {describe, expect, it, beforeAll} from "@effect/vitest"
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
        Effect.provide([DbServiceLive, McpLogServiceLive]),
        Effect.runPromise
    )
  });

  it("run", async () => {
    //  vitest --run --testNamePattern=run McpService.test.ts
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
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.tips()  //
    }).pipe(
        Effect.provide([StoryServiceLive, McpServiceLive, FetchHttpClient.layer, McpLogServiceLive, NodeFileSystem.layer]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => Effect.logError(e.toString())),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    expect(res.content).toBeInstanceOf(Array)
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
    expect(res.content).toBeInstanceOf(Array)
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
          return Effect.logError(e.toString());
        }),
        Effect.tap(a => Effect.log(a)),
        runPromise
    )
    console.log(res)
    expect(res.content).toBeInstanceOf(Array)
  })
  it("getCurrentLocationInfoすべて", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.getCurrentLocationInfo(true, true, true)
    }).pipe(
        Effect.provide([McpServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => Effect.logError(e.toString())),
        Effect.tap(a => {
          a.content.filter(b => b.type === 'text')
              .forEach((c, i) =>
                  Effect.logTrace(c.text))
          a.content.filter(b => b.type === 'image')
              .forEach((c, i) => {
                if (inGitHubAction) {
                  Effect.logTrace(c.data?.slice(0, 5))
                } else {
                  fs.writeFileSync(`tools/test/getCurrentImage${i}.png`, Buffer.from(c.data!, "base64"));
                }
              })

          return Effect.log(a);
        }),
        runPromise
    )
    expect(res.content).toBeInstanceOf(Array)
  })
  it("setCurrentLocation", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.setCurrentLocation("横浜駅")
    }).pipe(
        Effect.provide([McpServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    expect(res.content).toBeInstanceOf(Array)
  })
  it("getDestinationAddress", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.getDestinationAddress()
    }).pipe(
        Effect.provide([McpServiceLive, DbServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => Effect.logError(e.toString())),
        Effect.tap(a => Effect.log(a)),
        runPromise
    )
    expect(res.content).toBeInstanceOf(Array)
  })
  it("setDestinationAddress", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.setDestinationAddress("川崎駅")
    }).pipe(
        Effect.provide([McpServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => Effect.logError(e.toString())),
        Effect.tap(a => Effect.log(a)),
        runPromise
    )
    expect(res.content).toBeInstanceOf(Array)
  })
  it("startJourneyPractice", async () => {
    //  vitest --run --testNamePattern=startJourneyPractice McpService.test.ts
    const res = await Effect.gen(function* () {
      yield* McpService.startJourney()
      return yield* McpService.getCurrentLocationInfo(true, true, true)
    }).pipe(
        Effect.provide([McpServiceLive, DbServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => Effect.logError(e.toString())),
        Effect.tap(a => Effect.log(JSON.stringify(a).slice(0, 200))),
        runPromise
    )
    expect(res.content).toBeInstanceOf(Array)
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
    expect(res.content).toBeInstanceOf(Array)
  })
  it("startJourney", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.startJourney()
    }).pipe(
        Effect.provide([McpServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => Effect.logError(e.toString())),
        Effect.tap(a => Effect.log(a.content.map(b => {
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
    expect(res.content).toBeInstanceOf(Array)
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
        Effect.tap(a => Effect.log(a.content.map(b => {
          return {
            type: b.type,
            text: b.text,
            data: b.data && b.data.slice(0, 5)
          }
        }))),
        runPromise
    )
    expect(res.content).toBeInstanceOf(Array)
  })
  it("snsFeedの加工", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.getSnsFeeds()
    }).pipe(
        Effect.provide([McpServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => Effect.logError(e.toString())),
        Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed({content: []})),
        Effect.tap(a => Effect.log(a)),
        runPromise
    )
    expect(res.content).toBeInstanceOf(Array)
  })
  it("getSnsMentions", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.getSnsMentions()
    }).pipe(
        Effect.provide([McpServiceLive, SnsServiceLive, McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => Effect.logError(e.toString())),
        Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed({content: []})),
        Effect.tap(a => Effect.log(a)),
        runPromise
    )
    expect(res.content).toBeInstanceOf(Array)
  })
  it("replySnsWriter", async () => {
    //  vitest --run --testNamePattern=replySnsWriter McpService.test.ts
    const res = await Effect.gen(function* () {
      return yield* McpService.replySnsWriter("リプライテスト6", "\"at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.post/3letmqctays2a,bafyreigqfjn2spwkuqziieuh5xijimyyld7dpbnpajxc7ax5bkokyyxjna\"")
    }).pipe(
        Effect.provide([McpServiceLive, SnsServiceLive, McpLogServiceLive, DbServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => Effect.logError(e.toString())),
        Effect.catchIf(a => a.toString() === 'Error: no bs account', e => Effect.succeed({content: []})),
        Effect.tap(a => Effect.log(a)),
        runPromise
    )
    expect(res.content).toBeInstanceOf(Array)
  })

})
