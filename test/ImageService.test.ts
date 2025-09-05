import {describe, expect, it} from "@effect/vitest"
import {Effect, Layer, Logger, LogLevel, ManagedRuntime, Option} from "effect";
import {ImageService, ImageServiceLive} from "../src/ImageService.js";
import {FetchHttpClient} from "@effect/platform";
import * as fs from "node:fs";
import {DbService, DbServiceLive} from "../src/DbService.js";
import {NodeFileSystem} from "@effect/platform-node"
import {McpLogService, McpLogServiceLive} from "../src/McpLogService.js";

const inGitHubAction = process.env.GITHUB_ACTIONS === 'true';

const AppLive = Layer.mergeAll(McpLogServiceLive,DbServiceLive,ImageServiceLive,FetchHttpClient.layer,NodeFileSystem.layer)
const aiRuntime = ManagedRuntime.make(AppLive);

describe("Image", () => {
  // beforeAll(async () => {
  //   return await DbService.initSystemMode(Option.none()).pipe(
  //     aiRuntime.runPromise
  //   )
  // });

  it("makeHotelPictPixAi", async () => {
    //  vitest --run --testNamePattern=makeHotelPictPixAi ImageService.test.ts
    const res = await Effect.gen(function* () {
      console.log(process.env.pixAi_key)
      yield *DbService.setEnvironment({
        pixAi_key:process.env.pixAi_key,
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
      })
      yield *DbService.initSystemMode(Option.none())
      return yield* ImageService.makeHotelPict("pixAi", 12)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a.length).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise
    )

    if (!inGitHubAction) {
      fs.writeFileSync("tools/test/makeHotelPictPixAi.jpg", res);
    }

    expect(res).toBeInstanceOf(Buffer)
  })
  it("makeHotelPictSd", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        sd_key:process.env.sd_key,
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
      })
      yield *DbService.initSystemMode(Option.none())
      return yield* ImageService.makeHotelPict("sd", 12)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a.length).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise
    )
    if (!inGitHubAction) {
      fs.writeFileSync("tools/test/makeHotelPictSd.jpg", res);
    }
    expect(res).toBeInstanceOf(Buffer)
  })
  it("makeHotelPictComfy", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        comfy_url:process.env.comfy_url,
        comfy_workflow_t2i: process.env.comfy_workflow_t2i,
        comfy_workflow_i2i: process.env.comfy_workflow_i2i,
        comfy_params: process.env.comfy_params,
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
      })
      yield *DbService.initSystemMode(Option.none())
      return yield* ImageService.makeHotelPict("comfyUi", 12)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a.length).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise
    )

    if (!inGitHubAction) {
      fs.writeFileSync("tools/test/makeHotelComfyUi.jpg", res);
    }

    expect(res).toBeInstanceOf(Buffer)
  })
  it("makeHotelPictGemini", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
        GeminiImageApi_key:process.env.GeminiImageApi_key
      })
      yield *DbService.initSystemMode(Option.none())
      return yield* ImageService.makeHotelPict("gemini", 12)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a.length).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise
    )

    if (!inGitHubAction) {
      fs.writeFileSync("tools/test/makeHotelGemini.jpg", res);
    }

    expect(res).toBeInstanceOf(Buffer)
  })
  it("makeEtcPictGemini", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
        GeminiImageApi_key:process.env.GeminiImageApi_key
      })
      yield *DbService.initSystemMode(Option.none())
      return yield* ImageService.makeEtcTripImage("gemini", "airplane","Asia/Tokyo")  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a.length).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise
    )

    if (!inGitHubAction) {
      fs.writeFileSync("tools/test/makeEtcGemini.jpg", res);
    }

    expect(res).toBeInstanceOf(Buffer)
  })
  it("pixAiMakeT2I", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        pixAi_key:process.env.pixAi_key,
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
      })
      yield *DbService.initSystemMode(Option.none())
      return yield* ImageService.selectImageGenerator("pixAi","depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut")  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.andThen(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/pixAiMakeImage.jpg", a);
        }
        return "succeed";
      }),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a instanceof Error && a.message === 'no key', _ => Effect.succeed("noKey")),
      aiRuntime.runPromise
    )
    expect(typeof res).toBe('string')
  })
  it("pixAiMakeI2I", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        pixAi_key:process.env.pixAi_key,
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
      })
      yield *DbService.initSystemMode(Option.none())
      const buffer = fs.readFileSync('tools/test.jpg');
      return yield* ImageService.selectImageGenerator("pixAi","depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut", buffer)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.andThen(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/pixAiMakeI2I.jpg", a)
        }
        return "succeed";
      }),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.catchIf(a => a instanceof Error && a.message === 'no key', _ => Effect.succeed("noKey")),
      aiRuntime.runPromise
    )
    expect(typeof res).toBe('string')
  })
  it("sdMakeT2I", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        sd_key:process.env.sd_key,
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
      })
      yield *DbService.initSystemMode(Option.none())
      return yield* ImageService.selectImageGenerator("sd","depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut")  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.andThen(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/sdMakeImage.jpg", a);
        }
        return "succeed";
      }),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a instanceof Error && a.message === 'no key', _ => Effect.succeed("noKey")),
      aiRuntime.runPromise
    )
    expect(typeof res).toBe('string')
  })
  it("sdMakeI2I", async () => {
    //  vitest --run --testNamePattern=sdMakeI2I ImageService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        sd_key:process.env.sd_key,
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
      })
      yield *DbService.initSystemMode(Option.none())
      const buffer = fs.readFileSync('tools/test.jpg');
      return yield* ImageService.selectImageGenerator("sd","depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut", buffer)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.andThen(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/sdMakeI2I.jpg", a)
        }
        return "succeed";
      }),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.catchIf(a => a instanceof Error && a.message === 'no key', _ => Effect.succeed("noKey")),
      aiRuntime.runPromise
    )
    expect(typeof res).toBe('string')
  })
  it("makeRunnerImageV3_i2iPixAI", async () => {
    //  vitest --run --testNamePattern=makeRunnerImageV3_i2i ImageService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        pixAi_key:process.env.pixAi_key,
        rembg_path:process.env.rembg_path,
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
      })
      yield *DbService.initSystemMode(Option.none())
      const buffer = fs.readFileSync('tools/test.jpg');
      return yield* ImageService.makeRunnerImageV3(buffer, 'pixAi',false, {bodyWindowRatioW:0.7,bodyWindowRatioH:0.7,bodyAreaRatio:0.001,bodyHWRatio:0.3}, true)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/makeRunnerImageV3PixAI.png", a.buf);
        }
      }),
      Effect.catchIf(a => a.toString() === 'Error: no key', _ => Effect.succeed({})),
      // Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )
    expect(typeof res).toBe('object')
  })
  it("makeRunnerImageV3_i2iSd", async () => {
    //  vitest --run --testNamePattern=makeRunnerImageV3_i2i ImageService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        sd_key:process.env.sd_key,
        rembg_path:process.env.rembg_path,
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
      })
      yield *DbService.initSystemMode(Option.none())
      const buffer = fs.readFileSync('tools/test.jpg');
      return yield* ImageService.makeRunnerImageV3(buffer, 'sd', false,{}, true)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/makeRunnerImageV3Sd.png", a.buf);
        }
      }),
      Effect.catchIf(a => a.toString() === 'Error: no key', _ => Effect.succeed({})),
      // Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )
    expect(typeof res).toBe('object')
  })
  it("makeRunnerImageV3_i2iComfy", async () => {
    //  vitest --run --testNamePattern=makeRunnerImageV3_i2i ImageService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        comfy_url:process.env.comfy_url,
        comfy_workflow_t2i: process.env.comfy_workflow_t2i,
        comfy_workflow_i2i: process.env.comfy_workflow_i2i,
        comfy_params: process.env.comfy_params,
        rembg_path:process.env.rembg_path,
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
      })
      yield *DbService.initSystemMode(Option.none())
      const buffer = fs.readFileSync('tools/test.jpg');
      return yield* ImageService.makeRunnerImageV3(buffer, 'comfyUi', false,{}, true)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/makeRunnerImageV3_i2iComfy.png", a.buf);
        }
      }),
      Effect.catchIf(a => a.toString() === 'Error: no key', _ => Effect.succeed({})),
      // Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )
    expect(typeof res).toBe('object')
  },10*60*1000)
  it("makeRunnerImageV4", async () => {
    //  vitest --run --testNamePattern=makeRunnerImageV3_i2i ImageService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
        GeminiImageApi_key:process.env.GeminiImageApi_key
      })
      yield *DbService.initSystemMode(Option.none())
      const buffer = fs.readFileSync('tools/test.jpg');
      return yield* ImageService.makeRunnerImageV4(buffer, false, true)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/makeRunnerImageV4.png", a.buf);
        }
      }),
      Effect.catchIf(a => a.toString() === 'Error: no key', _ => Effect.succeed({})),
      // Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )
    expect(typeof res).toBe('object')
  },10*60*1000)
  it("comfyApiMakeImage_t2i", async () => {
    //  vitest --run --testNamePattern=comfyApiMakeImage_t2i ImageService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        comfy_url:process.env.comfy_url,
        comfy_workflow_t2i: process.env.comfy_workflow_t2i,
        comfy_workflow_i2i: process.env.comfy_workflow_i2i,
        comfy_params: process.env.comfy_params,
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
      })
      yield *DbService.initSystemMode(Option.none())
      return yield* ImageService.comfyApiMakeImage('1girl',undefined,{ckpt_name:"animagineXL40_v40.safetensors"})  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/comfyApiMakeImage_t2i.png",Buffer.from(a));
        }
      }),
      Effect.catchIf(a => a.toString() === 'Error: no comfy_url', _ => Effect.succeed({})),
      // Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )
    expect(typeof res).toBe('object')
  })
  it("comfyApiMakeImage_i2i", async () => {
    //  vitest --run --testNamePattern=comfyApiMakeImage ImageService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({
        comfy_url:process.env.comfy_url,
        comfy_workflow_t2i: process.env.comfy_workflow_t2i,
        comfy_workflow_i2i: process.env.comfy_workflow_i2i,
        comfy_params: process.env.comfy_params,
        GoogleMapApi_key:process.env.GoogleMapApi_key,  //  isPracticeもフラグにしているので指定しないとプリセット画像になる。。
      })
      yield *DbService.initSystemMode(Option.none())
      const buffer = fs.readFileSync('tools/test.jpg');
      return yield* ImageService.comfyApiMakeImage('1girl',buffer,{ckpt_name:"animagineXL40_v40.safetensors"})  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/comfyApiMakeImage_i2i.png",Buffer.from(a));
        }
      }),
      Effect.catchIf(a => a.toString() === 'Error: no comfy_url', _ => Effect.succeed({})),
      // Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )
    expect(typeof res).toBe('object')
  })
  it("rembgService", async () => {
    //  vitest --run --testNamePattern=comfyApiMakeImage ImageService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.initSystemMode(Option.none())
      const buffer = fs.readFileSync('tools/testRembg.png');
      const runnerEnv = yield* DbService.getSysEnv()
      return yield* ImageService.rembgService(buffer,runnerEnv)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/rembgOut.png",Buffer.from(a));
        }
      }),
      Effect.catchIf(a => a.toString() === 'Error: no rembg url', _ => Effect.succeed({})),
      // Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )
    expect(typeof res).toBe('object')
  })
  it("rembgApi", async () => {
    //  vitest --run --testNamePattern=comfyApiMakeImage ImageService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.initSystemMode(Option.none())
      const buffer = fs.readFileSync('tools/testRembg.png');
      return yield* ImageService.rembgApi(buffer)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/rembgOut.png",Buffer.from(a));
        }
      }),
      Effect.catchIf(a => a.toString() === 'Error: no rembg Wo key', _ => Effect.succeed({})),
      // Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )
    expect(typeof res).toBe('object')
  })
})
