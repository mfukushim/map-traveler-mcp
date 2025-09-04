// @vitest-environment node

import { describe, expect, it} from "@effect/vitest"
import {Effect, Layer, Logger, LogLevel, ManagedRuntime, Option} from "effect";
import {McpService, McpServiceLive} from "../src/McpService.js";
import {FetchHttpClient} from "@effect/platform";
import * as fs from "node:fs";
import {McpLogService, McpLogServiceLive} from "../src/McpLogService.js";
import {DbService, DbServiceLive} from "../src/DbService.js";
import {StoryServiceLive} from "../src/StoryService.js";
import {AnswerError} from "../src/mapTraveler.js";
import {SnsServiceLive} from "../src/SnsService.js";
import {z} from "zod";
import {CallToolRequestSchema} from "@modelcontextprotocol/sdk/types.js";
import {ImageServiceLive} from "../src/ImageService.js";
import {MapServiceLive} from "../src/MapService.js";
import {RunnerServiceLive} from "../src/RunnerService.js";

const inGitHubAction = process.env.GITHUB_ACTIONS === 'true';

const AppLive = Layer.mergeAll(McpLogServiceLive, McpServiceLive, DbServiceLive, McpServiceLive, ImageServiceLive, MapServiceLive, RunnerServiceLive, SnsServiceLive, StoryServiceLive, FetchHttpClient.layer)
const aiRuntime = ManagedRuntime.make(AppLive);

describe("Mcp", () => {
  // beforeAll(async () => {
  //   return await DbService.initSystemMode().pipe(
  //     Effect.provide([DbServiceLive]),
  //     Effect.runPromise
  //   )
  // });
  it("practice", async () => {
    //  vitest --run --testNamePattern=practice McpService.test.ts
    //  他のテストスクリプトが走行状態を作るのでこれは最初にやらないといけない
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      const requests: z.infer<typeof CallToolRequestSchema>[] = [
        {params: {name: "tips"}, method: "tools/call"},
        {
          params: {name: "get_traveler_view_info", arguments: {includePhoto: true, includeNearbyFacilities: true}},
          method: "tools/call"
        },
        {params: {name: "start_traveler_journey"}, method: "tools/call"},
        {
          params: {name: "get_traveler_view_info", arguments: {includePhoto: true, includeNearbyFacilities: true}},
          method: "tools/call"
        },
        {params: {name: "stop_traveler_journey"}, method: "tools/call"},
        {
          params: {name: "get_traveler_view_info", arguments: {includePhoto: true, includeNearbyFacilities: true}},
          method: "tools/call"
        },
      ]
      const env = yield *DbService.getSysEnv()
      return yield* Effect.forEach(requests, (request, i) => McpService.toolSwitch(request,env.mode))
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => {
        return McpLogService.logTraceToolsRes(a.flat());
      }),
      aiRuntime.runPromise,
      // Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed([])),
      // Effect.catchIf(a => a instanceof AnswerError, e => {
      //   return Effect.log(e.toString());
      // }),
    )
    expect(res).toBeInstanceOf(Array)
    const mes = res.flat()
    expect(mes[0].text).includes('Currently in practice mode')
    expect(mes[1].text).includes('I am in a hotel ')
    expect(mes[2].type).toBe('image')
    expect(mes[3].text).includes('The departure point')
    expect(mes[4].type).toBe('image')
    expect(mes[5].text).includes('Town name is')
    expect(mes[6].type).toBe('image')
    expect(mes[7].text).includes('discontinue')
    expect(mes[8].type).toBe('image')
    expect(mes[9].text).includes('Town name is')
  })

  it("run", async () => {
    //  vitest --run --testNamePattern=run McpService.test.ts
    await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield *McpService.run(aiRuntime,Option.none())
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      // Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
  })
  it("tips", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield * McpService.tips()  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
    expect(res[0].text).includes('Currently in practice mode')
  })
  it("setTravelerInfo/getTravelerInfo", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      yield* McpService.setTravelerInfo('name is mi')
      return yield* McpService.getTravelerInfo();
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e)),
      Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
    expect(res[0].text).includes('name is mi')
  })
  it("getCurrentLocationInfo追加なし", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      const env = yield *DbService.getSysEnv()
      return yield* McpService.getCurrentLocationInfo(false, false, env.mode)
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => {
        if (e instanceof AnswerError) {
          console.log('ans')
        }
        return Effect.logError(e.toString());
      }),
      Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise,
    )
    console.log(res)
    expect(res).toBeInstanceOf(Array)
    expect(res[0].text).includes('I am in a hotel')
  })
  it("getCurrentLocationInfoすべて", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      const env = yield *DbService.getSysEnv()
      return yield* McpService.getCurrentLocationInfo(true, true, env.mode)
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
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
    expect(res.some((a) => a.type === 'text')).toBeTruthy()
    expect(res.some((a) => a.type === 'image')).toBeTruthy()
  })
  it("setCurrentLocation", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* McpService.setCurrentLocation("456 Random Street, Lost City") //東京都千代田区丸の内1丁目9-1
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("setCurrentLocation存在する", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* McpService.setCurrentLocation("Yokohama Station") //東京都千代田区丸の内1丁目9-1
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("getDestinationAddress", async () => {
    //  vitest --run --testNamePattern=getDestinationAddress McpService.test.ts
    await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      const env = yield *DbService.getSysEnv()
      return yield* McpService.getDestinationAddress(env.mode)
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a instanceof AnswerError, e => {
        expect(e.message).toBe('The destination has not yet been decided')
        return Effect.succeed([]);
      }),
      aiRuntime.runPromise,
    )
  })
  it("setDestinationAddress存在しない", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      const env = yield *DbService.getSysEnv()
      return yield* McpService.setDestinationAddress("456 Random Street, Lost City",env.mode)  //川崎駅
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("setDestinationAddress存在する", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      const env = yield *DbService.getSysEnv()
      return yield* McpService.setDestinationAddress("Tokyo station", env.mode)  //川崎駅
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("getTravelerInfo", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* McpService.getTravelerInfo()
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      // Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })

  it("startJourneyPractice", async () => {
    //  vitest --run --testNamePattern=startJourneyPractice McpService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      const env = yield *DbService.getSysEnv()
      yield* McpService.startJourney(env.mode)
      return yield* McpService.getCurrentLocationInfo(true, true,env.mode)
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(JSON.stringify(a).slice(0, 200))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("stopJourneyPractice", async () => {
    //  vitest --run --testNamePattern=startJourneyPractice McpService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      const env = yield *DbService.getSysEnv()
      yield* McpService.startJourney(env.mode)
      return yield* McpService.stopJourney(env.mode)
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(JSON.stringify(a).slice(0, 200))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("startJourney", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      const env = yield *DbService.getSysEnv()
      return yield* McpService.startJourney(env.mode)
    }).pipe(
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
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("stopJourney", async () => {
    //  vitest --run --testNamePattern=stopJourney McpService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      const env = yield *DbService.getSysEnv()
      yield* McpService.startJourney(env.mode)
      return yield* McpService.stopJourney(env.mode)
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(a.map(b => {
        return {
          type: b.type,
          text: b.text,
          data: b.data && b.data.slice(0, 5)
        }
      }))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("snsFeedの加工", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* McpService.getSnsFeeds()
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed([])),
      Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("getSnsMentions", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* McpService.getSnsMentions(5)
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed([])),
      Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("replySnsWriter", async () => {
    //  vitest --run --testNamePattern=replySnsWriter McpService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* McpService.replySnsWriter("リプライテスト6", "\"at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.post/3letmqctays2a-bafyreigqfjn2spwkuqziieuh5xijimyyld7dpbnpajxc7ax5bkokyyxjna\"")
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed([])),
      Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("getSetting", async () => {
    //  vitest --run --testNamePattern=replySnsWriter McpService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* McpService.getSetting()
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      // Effect.tapError(e => Effect.logError(e.toString())),
      // Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed([])),
      Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("makeToolsDef", async () => {
    //  vitest --run --testNamePattern=replySnsWriter McpService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        filter_tools:"tips",
      })
      // env.filterTools = ["tips"]
      yield *DbService.initSystemMode(Option.none())
      const env = yield *DbService.getSysEnv()
      return yield* McpService.makeToolsDef(env.mode)
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      // Effect.tapError(e => Effect.logError(e.toString())),
      // Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed([])),
      Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Object)
    expect(res.tools.length).toBe(1)
  })
  it("toolSwitch", async () => {
    //  vitest --run --testNamePattern=toolSwitch McpService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      const env = yield *DbService.getSysEnv()
      const commands = [
        "get_traveler_view_info",
        "set_traveler_location",
        "get_traveler_destination_address",
        "set_traveler_destination_address",
        "start_traveler_journey",
        "stop_traveler_journey",
        "set_traveler_info",
        "get_traveler_info",
        "set_avatar_prompt",
        "reset_avatar_prompt",
        "get_sns_feeds",
        "get_sns_mentions",
        "post_sns_writer",
        "reply_sns_writer",
        "add_like",
        "tips",
        "get_setting",
        "get_traveler_location",
      ]
      const requests: z.infer<typeof CallToolRequestSchema>[] = commands.map(value => ({
        params: {name: value},
        method: "tools/call"
      }))
      return yield* Effect.forEach(requests, (request, i) => McpService.toolSwitch(request,env.mode).pipe(
        Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed([])),
        Effect.catchIf(a => a instanceof AnswerError, e => Effect.succeed([])),
      ))
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => McpLogService.logTraceToolsRes(a.flat())),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Array)
  })

})
