import {describe, expect, it,beforeAll} from "@effect/vitest"
import {Effect, Logger, LogLevel} from "effect";
import {runPromise} from "effect/Effect";
import {DbService, DbServiceLive, isValidFilePath} from "../src/DbService.js";
import dayjs from "dayjs";


describe("Db", () => {
  beforeAll(async () => {
    return await DbService.initSystemMode().pipe(
        Effect.provide([DbServiceLive]),
        Effect.runPromise
    )
  });

  it("getAvatar", async () => {
    //  vitest --run --testNamePattern=getAvatar DbService.test.ts
    const res = await Effect.gen(function* () {
      return yield* DbService.getAvatar(1).pipe(Effect.tap(a => Effect.log(a)))
    }).pipe(
      Effect.provide([DbService.Default]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e)),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(res.id).toBe(1)
  })
  it("getTodayAnniversary", async () => {
    //  vitest --run --testNamePattern=getTodayAnniversary DbService.test.ts
    const res = await Effect.gen(function* () {
      const now = dayjs()
      return yield* DbService.getTodayAnniversary(now).pipe(Effect.tap(a => Effect.log(a)))  //
    }).pipe(
      Effect.provide([DbService.Default]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      Effect.tap(a => Effect.log(a.length)),
      runPromise
    )
    expect(res).toStrictEqual([])
  })
  it("saveEnv/getEnv", async () => {
    //  vitest --run --testNamePattern=getTodayAnniversary DbService.test.ts
    const res = await Effect.gen(function* () {
      return yield* DbService.saveEnv("abc","xyz").pipe(Effect.tap(a => Effect.log(a)))
    }).pipe(
        Effect.provide([DbService.Default]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(Effect.logError),
        Effect.tap(a => Effect.log(a)),
        runPromise
    )
    expect(res.key).toBe('abc')
    expect(res.value).toBe('xyz')
  })
  it("pathTest", async () => {
    //  vitest --run --testNamePattern=getTodayAnniversary DbService.test.ts
    expect(isValidFilePath('C:/Users')).toBeTruthy()
  })
})
