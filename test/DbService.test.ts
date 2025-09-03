import {describe, expect, it,beforeAll} from "@effect/vitest"
import {Effect, Layer, Logger, LogLevel, ManagedRuntime, Option} from "effect";
import {DbService, DbServiceLive, isValidFilePath} from "../src/DbService.js";
import dayjs from "dayjs";
import {McpLogServiceLive} from "../src/McpLogService.js";

const AppLive = Layer.mergeAll(McpLogServiceLive,DbServiceLive)
const aiRuntime = ManagedRuntime.make(AppLive);

describe("Db", () => {
  beforeAll(async () => {
    return await DbService.initSystemMode(Option.none()).pipe(
      aiRuntime.runPromise
    )
  });

  it("getAvatar", async () => {
    //  vitest --run --testNamePattern=getAvatar DbService.test.ts
    const res = await Effect.gen(function* () {
      return yield* DbService.getAvatar(1).pipe(Effect.tap(a => Effect.log(a)))
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e)),
      Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )
    expect(res.id).toBe(1)
  })
  it("getTodayAnniversary", async () => {
    //  vitest --run --testNamePattern=getTodayAnniversary DbService.test.ts
    const res = await Effect.gen(function* () {
      const now = dayjs()
      return yield* DbService.getTodayAnniversary(now).pipe(Effect.tap(a => Effect.log(a)))  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      Effect.tap(a => Effect.log(a.length)),
      aiRuntime.runPromise
    )
    expect(res).toStrictEqual([])
  })
  it("saveEnv/getEnv", async () => {
    //  vitest --run --testNamePattern=getTodayAnniversary DbService.test.ts
    const res = await Effect.gen(function* () {
      const r = yield* DbService.saveEnv("abc","xyz").pipe(Effect.tap(a => Effect.log(a)))
      expect(r.key).toBe('abc')
      expect(r.value).toBe('xyz')
      return yield* DbService.getEnv("abc").pipe(Effect.tap(a => Effect.log(a)))
    }).pipe(
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(Effect.logError),
        Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )
    expect(res).toBe('xyz')
  })
  it("pathTest", async () => {
    //  vitest --run --testNamePattern=getTodayAnniversary DbService.test.ts
    expect(isValidFilePath('C:/Users')).toBeTruthy()
  })
})
