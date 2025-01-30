/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import {Effect, Schedule, Option, Schema} from "effect";
import sharp = require("sharp");
import {FetchHttpClient, HttpClient, HttpClientRequest} from "@effect/platform";
import dayjs from "dayjs";
import FormData from 'form-data';
import {Jimp} from "jimp";
import {PixAIClient} from '@pixai-art/client'
import {type MediaBaseFragment, TaskBaseFragment} from "@pixai-art/client/types/generated/graphql.js";
import * as Process from "node:process";
import 'dotenv/config'
import {McpLogService, McpLogServiceLive} from "./McpLogService.js";
import {__pwd, DbService, env} from "./DbService.js";
import WebSocket from 'ws'
import * as path from "path";
import * as os from "node:os";
import * as fs from "node:fs";
import {execSync} from "node:child_process";
import {defaultAvatarId} from "./RunnerService.js";
import jp from "jsonpath";

export const defaultBaseCharPrompt = 'depth of field, cinematic composition, masterpiece, best quality,looking at viewer,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut'

let recentImage: Buffer | undefined //  直近の1生成画像を保持する snsのpostに自動引用する

const key: string = Process.env.sd_key || ''
const defaultPixAiModelId = '1648918127446573124';

const pixAiClient = new PixAIClient({
  apiKey: Process.env.pixAi_key || '',
  webSocketImpl: WebSocket
})

const scriptTables = new Map<string, { script: any, nodeNameToId: Map<string, number> }>();


export class ImageService extends Effect.Service<ImageService>()("traveler/ImageService", {
  accessors: true,
  effect: Effect.gen(function* () {

    const getBasePrompt = (avatarId: number) => {
      if (env.fixedModelPrompt) {
        return Effect.succeed(Process.env.fixed_model_prompt!!)
      }
      return DbService.getAvatarModel(avatarId).pipe(
        Effect.andThen(a => a.baseCharPrompt + ',anime'),
        Effect.orElseSucceed(() => defaultBaseCharPrompt));
    }

    function sdMakeTextToImage(prompt: string, opt?: {
      width?: number,
      height?: number,
      sampler?: string,
      samples?: number,
      steps?: number,
      cfg_scale?: number
    }) {
      return Effect.gen(function* () {
        const param = prompt.split(',').reduce((p, c) => {
          const match = c.trim().match(/\((\w+):([0-9.]+)\)/)
          if (match) {
            p.list.push({text: p.buf, weight: 1})
            p.list.push({text: match[1].trim(), weight: Number.parseFloat(match[2])})
            return p
          } else {
            return {buf: p.buf ? `${p.buf},${c}` : c, list: p.list}
          }
        }, {list: [] as { text: string, weight: number }[], buf: ''});
        if (param.buf) {
          param.list.push({text: param.buf, weight: 1})
        }
        yield* McpLogService.logTrace(`sdMakeTextToImage:${JSON.stringify(param.list)}`);
        if (param.list.length > 10) {
          return yield* Effect.fail(new Error('param weight too long'))
        }
        const client = yield* HttpClient.HttpClient;
        return yield* HttpClientRequest.post(`https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`).pipe(
          HttpClientRequest.setHeaders({
            Authorization: `Bearer ${key}`,
            Accept: "application/json",
          }),
          HttpClientRequest.bodyJson({
            cfg_scale: opt?.cfg_scale || 7,
            height: opt?.height || 1024,
            width: opt?.width || 1024,
            sampler: opt?.sampler || "K_DPM_2_ANCESTRAL",
            samples: opt?.samples || 1,
            steps: opt?.steps || 30,
            text_prompts: param.list
          }),
          Effect.flatMap(client.execute),
          Effect.flatMap(a => a.json),
          Effect.andThen(a => a as { artifacts: { base64: string, finishReason: string, seed: number }[] }),
          Effect.flatMap(a => {
            if (a.artifacts.some(b => b.finishReason !== 'SUCCESS') || a.artifacts.length === 0) {
              return Effect.fail(new Error(`fail sd`))
            }
            return Effect.tryPromise(() => sharp(Buffer.from(a.artifacts[0].base64, 'base64')).resize({
              width: 512,
              height: 512
            }).png().toBuffer())
          }),
          Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds")))),
          Effect.mapError(e => new Error(`sdMakeTextToImage error:${e}`)),
          Effect.scoped,
        )
      }).pipe(Effect.provide(FetchHttpClient.layer))

    }

    function sdMakeImageToImage(prompt: string, inImage: Buffer, opt?: {
      width?: number,
      height?: number,
      sampler?: string,
      samples?: number,
      steps?: number,
      cfg_scale?: number
    }) {
      return Effect.tryPromise(() => sharp(inImage).resize({
        width: opt?.width || 1024,
        height: opt?.height || 1024
      }).png().toBuffer()).pipe(
        Effect.andThen(a =>
          Effect.tryPromise({
            try: () => {
              const formData = new FormData()
              formData.append('init_image', a)
              formData.append('init_image_mode', 'IMAGE_STRENGTH')
              formData.append('image_strength', 0.35)
              formData.append('text_prompts[0][text]', prompt)
              formData.append('cfg_scale', 7)
              formData.append('samples', 1)
              formData.append('steps', 30)
              return fetch(
                `https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image`,
                {
                  method: 'POST',
                  headers: {
                    ...formData.getHeaders(),
                    Accept: 'application/json',
                    Authorization: `Bearer ${key}`,
                  },
                  body: formData.getBuffer(),
                }
              )
            },
            catch: error => new Error(`${error}`)
          })),
        Effect.andThen(a => a.json()),
        Effect.andThen(a => a as { artifacts: { base64: string, finishReason: string, seed: number }[] }),
        Effect.flatMap(a => {
          if (!a.artifacts || a.artifacts.some(b => b.finishReason !== 'SUCCESS') || a.artifacts.length === 0) {
            return Effect.fail(new Error(`fail sd`))
          }
          return Effect.succeed(Buffer.from(a.artifacts[0].base64, 'base64'))
          // return Effect.tryPromise(() => sharp(Buffer.from(a.artifacts[0].base64, 'base64')).resize({
          //   width: opt?.width || 1024,
          //   height: opt?.height || 1024
          // }).png().toBuffer())
        }),
      )
    }

    function sdMakeImage(prompt: string, inImage?: Buffer, opt?: {
      width?: number,
      height?: number,
      sampler?: string,
      samples?: number,
      steps?: number,
      cfg_scale?: number,
    }) {
      if (!Process.env.sd_key) {
        return Effect.fail(new Error('no key'))
      }
      return inImage ? sdMakeImageToImage(prompt, inImage, opt) : sdMakeTextToImage(prompt, opt);
    }

    function pixAiMakeImage(prompt: string, inImage?: Buffer, opt?: {
      width?: number,
      height?: number,
      sampler?: string,
      samples?: number,
      steps?: number,
      cfg_scale?: number,
    }) {
      if (!Process.env.pixAi_key) {
        return Effect.fail(new Error('no key'))
      }
      return Effect.retry(
        Effect.gen(function* () {
          let mediaId
          if (inImage) {
            const blob = new Blob([inImage], {type: 'image/jpeg'});
            const file = new File([blob], "image.jpg", {type: 'image/jpeg'})
            mediaId = yield* Effect.tryPromise({
              try: () => pixAiClient.uploadMedia(file),
              catch: error => new Error(`uploadMedia fail:${error}`)
            }).pipe(Effect.andThen(a1 => {
              return !a1.mediaId ? Effect.fail(new Error(`uploadMedia fail`)) : Effect.succeed(a1.mediaId);
            }))
          }
          return mediaId
        }).pipe(
          Effect.tap(a => McpLogService.logTrace(`uploadMedia ${a}`)),
          Effect.tapError(a => McpLogService.logError(`uploadMedia error ${a}`)),
          Effect.andThen(a => {
            const body = a ? {
              prompts: prompt,
              modelId: Process.env.pixAi_modelId || defaultPixAiModelId,
              width: opt?.width || 512,
              height: opt?.height || 512,
              mediaId: a
            } : {
              prompts: prompt,
              modelId: Process.env.pixAi_modelId || defaultPixAiModelId,
              width: opt?.width || 512,
              height: opt?.height || 512,
            }
            return Effect.tryPromise({
              try: () => pixAiClient.generateImage(body,
              ),
              catch: error => new Error(`generateImage fail:${error}`)
            })
          }),
          Effect.tap(a => McpLogService.logTrace(`generateImage ${a.status}`)),
          Effect.tapError(a => McpLogService.logError(`generateImage ${a}`)),
          Effect.andThen(task => {
            return Effect.tryPromise({
              try: () => pixAiClient.getMediaFromTask(task as TaskBaseFragment),
              catch: error => new Error(`getMediaFromTask fail:${error}`)
            })
          }),
          Effect.tap(a => McpLogService.logTrace(`getMediaFromTask ${a}`)),
          Effect.andThen(media => {
            if (!media) return Effect.fail(new Error(`media fail1:${media}`))
            if (Array.isArray(media)) return Effect.fail(new Error(`media fail2:${media}`))
            return Effect.tryPromise({
              try: () => pixAiClient.downloadMedia(media as MediaBaseFragment),
              catch: error => new Error(`downloadMedia fail:${error}`)
            });
          }),
          Effect.andThen(a => Buffer.from(a)),
          Effect.tap(a => McpLogService.logTrace(`downloadMedia out:${a.length}`)),
          Effect.tapError(a => McpLogService.logError(`downloadMedia err:${a}`)),
        ), Schedule.recurs(4).pipe(Schedule.intersect(Schedule.spaced("10 seconds")))).pipe(Effect.provide([McpLogServiceLive]));
    }

    /**
     * ホテル画像
     * @param selectGen
     * @param hour
     * @param append
     * @param localDebug
     */
    function makeHotelPict(selectGen: string, hour: number, append ?: string, localDebug = false) {
      return Effect.gen(function* () {
        if (!env.anyImageAiExist || env.isPractice) {
          //  画像生成AIがなければ固定ホテル画像を使う
          return yield* Effect.async<Buffer, Error>((resume) => fs.readFile(path.join(__pwd, 'assets/hotelPict.png'), (err, data) => {
            if (err) {
              resume(Effect.fail(err))
            }
            resume(Effect.succeed(data));
          })).pipe(Effect.andThen(a => Buffer.from(a)))
        }
        const baseCharPrompt = yield* getBasePrompt(defaultAvatarId)
        let prompt = baseCharPrompt + ',';
        if (hour < 6 || hour >= 19) {
          prompt += 'hotel room,desk,drink,laptop computer,talking to computer,sitting,window,night,(pyjamas:1.3)'
        } else if (hour < 11) {
          prompt += 'hotel room,desk,drink,laptop computer,talking to computer,sitting,window,morning'
        } else if (hour < 16) {
          prompt += 'cafe terrace,outdoor dining table,outdoor bistro chair,drink,laptop computer,talking to computer,sitting,noon'
        } else {
          prompt += 'cafe terrace,outdoor dining table,outdoor bistro chair,drink,laptop computer,talking to computer,sitting,evening'
        }
        if (append) {
          prompt += `,${append}`
        }
        return yield* selectImageGenerator(selectGen, prompt).pipe(
          Effect.tap(a => {
            // const data = Buffer.from(a, "base64");
            recentImage = a
            if (localDebug) {
              return Effect.async<void, Error>((resume) => fs.writeFile('tools/test/hotelPict.png', a, err => {
                if (err) {
                  resume(Effect.fail(err))
                }
                resume(Effect.void)
              }))
            }
          }),
          Effect.andThen(a => Effect.tryPromise(() => sharp(a).resize({
            width: 512,
            height: 512
          }).png().toBuffer()))
        )
      })
    }

    /**
     * 船等の特殊ロケーション
     * @param selectGen
     * @param vehiclePrompt
     * @param timeZoneId
     * @param localDebug
     * @private
     */
    function makeEtcTripImage(selectGen: string, vehiclePrompt: string, timeZoneId: string, localDebug = false) {
      //  乗り物の旅行画像生成
      //  画像保存
      //  乗り物と緯度経度での日記生成
      //  日記のブログ結合
      //  日記のtwitterポストはするかどうするか
      //  開始と終了の位置をrunStatusから取り出す
      //  対応する会話イベントがあるかどうかを確認してログを抽出する
      return Effect.gen(function* () {
        //  設定日時に対応した画像を生成する
        const appendPrompts: string[] = []
        appendPrompts.push(vehiclePrompt)
        const now = dayjs()
        const hour = now.tz(timeZoneId).hour()
        if (hour < 6 || hour >= 19) {
          appendPrompts.push('night')
        } else if (hour < 11) {
          appendPrompts.push('morning')
        } else if (hour < 16) {
          appendPrompts.push('noon')
        } else {
          appendPrompts.push('evening')
        }
        const appendPrompt = appendPrompts.join(',')
        const baseCharPrompt = yield* getBasePrompt(defaultAvatarId)
        const prompt = `${baseCharPrompt},${appendPrompt}`
        return yield* selectImageGenerator(selectGen, prompt).pipe(
          Effect.tap(a => {
            // const data = Buffer.from(a, "base64");
            recentImage = a
            if (localDebug) {
              return Effect.async<void, Error>((resume) => fs.writeFile('tools/test/etcPict.png', a, err => {
                if (err) {
                  resume(Effect.fail(err))
                }
                resume(Effect.void)
              }))
            }
          }),
          Effect.andThen(a => Effect.tryPromise(() => sharp(a).resize({
            width: 512,
            height: 512
          }).png().toBuffer()))
        )
      })
    }

    /**
     * 絵生成のpromptを生成する
     * @param baseCharPrompt
     * @param simple
     * @param withAbort
     * @private
     */
    const generatePrompt = (baseCharPrompt: string, simple = false, withAbort = false) => {
      return Effect.gen(function* () {
        const backPrompt = (simple || withAbort) ? ',(simple background:1.2)' : ',road'
        //  ここがキャラの基本スタイル
        const basePrompt = baseCharPrompt + backPrompt;
        const prompt: string[] = [];
        const bodyRnd = Math.random()
        const faceRnd = Math.random()
        const poseRnd = Math.random()
        if (simple || withAbort) {
          if (withAbort) {
            //  電話絵は上半身のみ
            prompt.push('(upper body:1.3)');
          } else {
            //  簡易背景は上半身かカウボーイショット
            prompt.push(Math.random() < 0.3 ? '(upper body:1.3)' : '(cowboy shot:1.3)');
            //  立ち絵背景は単調にならないようにfromを後ろと横を少し入れる(SDXLから精度が高くなったので単調化しやすい)
            const fromRnd = Math.random()
            if (fromRnd < 0.3) {
              prompt.push('from back')
            } else if (fromRnd < 0.4) {
              prompt.push('from side')
            }
          }
        } else {
          //  通常は全身、カウボーイショット、上半身の各種をやってみる
          if (bodyRnd < 0.3) {
            prompt.push('full body');
          } else if (bodyRnd < 0.6) {
            prompt.push('cowboy shot');
          } else {
            prompt.push('upper body');
          }
        }
        if (withAbort) {
          prompt.push('surprised,(calling phone:1.2),(holding smartphone to ear:1.2)');
        } else {
          if (faceRnd < 0.1) {
            prompt.push(':D');
          } else if (faceRnd < 0.3) {
            prompt.push('smiling');
          } else if (faceRnd < 0.4) {
            prompt.push('laughing');
          } else if (faceRnd < 0.6) {
            prompt.push('surprised');
          } else if (faceRnd < 0.8) {
            prompt.push('grin');
          }
          //  なしもある
          if (poseRnd < 0.2) {
            prompt.push('looking around');
          } else if (poseRnd < 0.6) {
            prompt.push('walking,looking sky')
          } else if (poseRnd < 0.7) {
            prompt.push('jumping')
          } else {
            prompt.push('standing')
            //  立ちの場合に少しポーズを入れる
            const faceRnd = Math.random()
            if (faceRnd < 0.2) {
              prompt.push('(salute:1.3),posing,(tilt my head:1.2)')
            } else if (faceRnd < 0.5) {
              prompt.push('posing,(tilt my head:1.2)')
            }
          }
        }
        const ap = prompt.join(',')
        return {prompt: `${basePrompt},${ap}`, append: ap};
      })
    }

    const selectImageGenerator = (generatorId: string, prompt: string, inImage?: Buffer, opt?: {
      width?: number,
      height?: number,
      sampler?: string,
      samples?: number,
      steps?: number,
      cfg_scale?: number,
    }) => {
      switch (generatorId) {
        case 'pixAi':
          return pixAiMakeImage(prompt, inImage, opt)
        default:
          return sdMakeImage(prompt, inImage, opt)
      }
    };

    /**
     * 人物像の成功度を確認する
     * @param avatarImage
     * @param windowSize
     */
    function checkPersonImage(avatarImage: Buffer, windowSize: { w: number; h: number }) {
      return Effect.gen(function* () {
        const image = yield* Effect.tryPromise(() => Jimp.read(avatarImage));
        // アルファ領域のピクセル数をカウントと囲むサイズを抽出する
        let minX = Number.MAX_SAFE_INTEGER
        let minY = Number.MAX_SAFE_INTEGER
        let maxX = Number.MIN_SAFE_INTEGER
        let maxY = Number.MIN_SAFE_INTEGER
        let alphaCount = 0
        image.scan(0, 0, image.width, image.height, (x, y, idx) => {
          const alpha = image.bitmap.data[idx + 3];
          if (alpha > 127) {
            alphaCount++
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
          }
        })
        const alphaNum = {alphaCount, rect: {x: minX, y: minY, w: maxX - minX, h: maxY - minY}}
        const number = alphaNum.alphaCount / (windowSize.w * windowSize.h);
        return {alphaNum, number};
      })
    }

    const rembg = (sdImage: Buffer) => {
      return Effect.gen(function* () {
        //  TODO EffectのCommandをうまく書けなかったのでnodejsの素で
        const tempPath = os.tmpdir()
        const tempIn = path.join(tempPath, `tr-${crypto.randomUUID()}.png`)
        const tempOut = path.join(tempPath, `tr-${crypto.randomUUID()}.png`)
        fs.writeFileSync(tempIn, sdImage)
        let rembgPath
        if (Process.env.rembg_path) {
          rembgPath = Process.env.rembg_path
        } else {
          yield* Effect.fail(new Error('rembg_path not set'))
        }
        yield* Effect.addFinalizer(() => McpLogService.logTrace(`rembg finalizer ${tempPath}`).pipe(Effect.andThen(() => {
          try {
            fs.unlinkSync(tempIn)
          } catch (e) {
          }
          try {
            fs.unlinkSync(tempOut)
          } catch (e) {
          }
        })))
        try {
          execSync(`${rembgPath} i ${tempIn} ${tempOut}`)
        } catch (e) {
          yield* Effect.fail(new Error(`rembg fail ${e}`))
        }
        return fs.readFileSync(tempOut);
      }).pipe(Effect.scoped)
      //  TODO Mac OSでなぜか現在使用不能。。。
      // return Effect.tryPromise({
      //   try: () => transparentBackground(sdImage, "png", {fast: false}),
      //   catch: error => `transparentBackground error:${error}`
      // })
    }

    /**
     * 旅画像生成処理V3
     * @param basePhoto
     * @param selectGen
     * @param withAbort
     * @param localDebug
     * @param bodyAreaRatio アバター本体占有面積比率 0.042 以上
     * @param bodyHWRatio アバター縦横比率 2.3 以上
     * @param sideBias 貼り付け位置を左右に偏らせる
     */
    function makeRunnerImageV3(
      basePhoto: Buffer,
      selectGen: string,
      withAbort = false,
      localDebug = false,
      bodyAreaRatio = 0.042,
      bodyHWRatio = 1.5, // 画像AIの精度が上がっているので2.3から少し減らす
      sideBias = false
    ) {
      return Effect.gen(function* () {
          if (!Process.env.rembg_path) {
            //  rembg pathがない場合、画像合成しないままの画像を戻す
            return {
              buf: yield* Effect.tryPromise(() => sharp(basePhoto).resize({
                width: 512,
                height: 512
              }).png().toBuffer()),
              shiftX: 0,
              shiftY: 0,
              fit: false,
              append: ''
            }
          }
          const outSize = {w: 1600, h: 1000};
          const innerSize = {w: 1600, h: 1600}
          const windowSize = {w: 832, h: 1216}
          const cutPos = sideBias ? (Math.random() < 0.5 ? Math.random() * 0.3 : 0.7 + Math.random() * 0.3) : Math.random()
          const shiftX = Math.floor((innerSize.w - windowSize.w) * cutPos);  //  0～1で均等にランダム切り出しだったはず
          const innerImage = yield* Effect.tryPromise(() => sharp(basePhoto).resize({
            width: innerSize.w,
            height: innerSize.h,
            fit: "fill"
          }).toBuffer());
          const clopImage = yield* Effect.tryPromise(() => sharp(innerImage).extract({
            left: shiftX,
            top: innerSize.h - windowSize.h,
            width: windowSize.w,
            height: windowSize.h
          }).toBuffer())
          if (localDebug) {
            fs.writeFileSync('tools/test/testOutInClop.png', clopImage)
          }

          /** 画像評価リトライ */
          let retry = 4 //  5回リトライになってるな 現在初期値7 最小値2(でないと画像できない)
          const fixedThreshold = 2  //  バストショットに切り替える閾値 2,1の2回はバストショット生成を試みる
          let isFixedBody = false
          let appendPrompt: string | undefined

          const avatarImage = yield* Effect.gen(function* () {
            const baseCharPrompt = yield* getBasePrompt(defaultAvatarId)
            const {prompt, append} = yield* generatePrompt(baseCharPrompt, retry < fixedThreshold, withAbort)
            appendPrompt = append
            retry--
            if (retry < fixedThreshold) {
              //  立ち絵
              isFixedBody = true
              yield* McpLogService.logTrace(`bast shot:${retry}`)
              return yield* selectImageGenerator(selectGen, prompt, undefined, {
                width: windowSize.w,
                height: windowSize.h
              })
            } else {
              //  画面i2i
              isFixedBody = false
              yield* McpLogService.logTrace(`i2i:${retry}`)
              return yield* selectImageGenerator(selectGen, prompt, clopImage, {
                width: windowSize.w,
                height: windowSize.h
              })
            }
          }).pipe(
            // Effect.andThen(a => Buffer.from(a, 'base64')),
            Effect.tap(sdImage => localDebug && fs.writeFileSync('tools/test/testOutGen.png', sdImage)),
            Effect.andThen(sdImage => rembg(sdImage)),
            Effect.tap(avatarImage => localDebug && fs.writeFileSync('tools/test/testOutRmBg.png', avatarImage)),
            Effect.tap(avatarImage => {
              if (Process.env.ServerLog && Process.env.ServerLog.includes('trace')) {
                fs.writeFileSync(path.join(os.tmpdir(), `trd-${crypto.randomUUID()}.png`), avatarImage, {flag: "w"});
              }
            }),
            Effect.tap(avatarImage => {
              //  非透明度判定 0.02以上
              return checkPersonImage(avatarImage, windowSize).pipe(
                Effect.tap(a => McpLogService.logTrace(
                  `check runner image:${retry},${JSON.stringify(a)},${a.number}<>${bodyAreaRatio},${a.alphaNum.rect.h / a.alphaNum.rect.w}<>${bodyHWRatio}`)),  //, retry, number, alphaNum.rect.w, alphaNum.rect.h\
                Effect.andThen(a => {
                  //  非透明度が0.02以上かつ範囲の縦と横の比率が3:1以上なら完了 counterfeit V3=0.015, counterfeit LX 0.03 にしてみる
                  //  比率値を3から2.5にしてみる。ダメ映像が増えたらまた調整する。。非透明率を0.015にしてみる
                  return a.number > bodyAreaRatio && a.alphaNum.rect.h / a.alphaNum.rect.w > bodyHWRatio
                    ? Effect.succeed(avatarImage) : Effect.fail(new Error('avatar fail'));
                })
              );
            }),
            Effect.retry(Schedule.recurs(2).pipe(Schedule.intersect(Schedule.spaced("5 seconds"))))
          )
          const stayImage = yield* Effect.tryPromise(() => {
            return sharp(innerImage).composite([{
              input: avatarImage,
              left: shiftX,
              top: innerSize.h - windowSize.h
            }]).toBuffer()
          }).pipe(Effect.andThen(a => Effect.tryPromise(() => sharp(a).extract({
            left: (innerSize.w - outSize.w) / 2,
            top: (innerSize.h - outSize.h) / 2,
            width: outSize.w,
            height: outSize.h
          }).resize({width: 512, height: 512}).png().toBuffer()))) //  現状のClaude MCPだと512*512以上のbase64はエラーになりそう
          recentImage = stayImage
          yield* McpLogService.logTrace(`stayImage:${recentImage?.length}`)
          return {
            buf: stayImage,
            shiftX,
            shiftY: innerSize.h - windowSize.h,
            fit: !isFixedBody,
            append: appendPrompt
          }
        }
      )
    }

    function addComfyScript(id: string, script: any) {
      scriptTables.set(id, script)
    }

    function getRecentImageAndClear() {
      const image = recentImage
      recentImage = undefined
      return image
    }

    function mergeParams(baseScript: any, map: Map<string, number>, params: any) {
      //  jsonPathで置き換えてるからbaseScriptのshallow copyは必要ないはず
      Object.keys(params).forEach(key => {
        const keyList = key.split('.');
        if (keyList.length > 0) {
          const topKey = map.get(keyList[0]);
          if (!topKey) {
            console.log('sd mergeParams no top key')
          } else {
            keyList[0] = topKey.toString()
            jp.value(baseScript, `$.${keyList.join('.')}`, params[key])
          }
        }
      })
      return baseScript
    }

    function comfyUploadImage(inImage: Buffer, opt?: {
      width?: number,
      height?: number,
      sampler?: string,
      samples?: number,
      steps?: number,
      cfg_scale?: number,
    }) {
      //  TODO comfyの場合のファイルアップロード。。
      const nowMs = dayjs().valueOf()
      const fileName = `trv${nowMs}`
      return Effect.tryPromise(() => sharp(inImage).resize({
        width: opt?.width || 1024,
        height: opt?.height || 1024
      }).png().toBuffer()).pipe(
        Effect.andThen(a =>
          Effect.tryPromise({
            try: () => {
              const formData = new FormData()
              formData.append(fileName, a)
              return fetch(
                `${Process.env.comfy_url}/upload/image`,
                {
                  method: 'POST',
                  headers: {
                    ...formData.getHeaders(),
                    Accept: 'application/json',
                    // Authorization: `Bearer ${key}`,
                  },
                  body: formData.getBuffer(),
                }
              )
            },
            catch: error => new Error(`${error}`)
          })),
        Effect.andThen(a => a.json()),
        Effect.andThen(a => a as { artifacts: { base64: string, finishReason: string, seed: number }[] }),
        Effect.flatMap(a => {
          if (!a.artifacts || a.artifacts.some(b => b.finishReason !== 'SUCCESS') || a.artifacts.length === 0) {
            return Effect.fail(new Error(`fail sd`))
          }
          return Effect.succeed(fileName)
          // return Effect.succeed(Buffer.from(a.artifacts[0].base64, 'base64'))
        }),
        Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("3 seconds")))),
      )
    }

    function comfyUpExecPrompt(script: any, opt?: {
      width?: number,
      height?: number,
    }) {
      //  TODO comfyの場合のファイルアップロード。。
      return Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        return yield* HttpClientRequest.post(`${Process.env.comfy_url}/prompt`).pipe(
          HttpClientRequest.setHeaders({
            // Authorization: `Bearer ${key}`,
            Accept: "application/json",
          }),
          HttpClientRequest.bodyJson({
            prompt: script,
          }),
          Effect.flatMap(client.execute),
          Effect.flatMap(a => a.json),
          Effect.andThen(a => Schema.decodeUnknown(Schema.parseJson(Schema.Struct({
            prompt_id: Schema.String
          })))(a)),
          Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds")))),
          Effect.scoped,
        )
      })
    }

    function downloadOutput(prompt_id: string, needKeyNum: number = 1)
    //   : Promise<{
    //   image?: Buffer;
    //   images?: { buf: Buffer; fileName: string, dir?: string }[];
    //   prompt_id: string
    // } | undefined> 
    {
      
        return HttpClient.get(`${Process.env.comfy_url}/history`).pipe(
          Effect.andThen((response) => response.json),
          Effect.scoped,
          Effect.provide(FetchHttpClient.layer),
          Effect.andThen(a1 => Schema.decodeUnknown(Schema.parseJson(Schema.Record({
            key: Schema.String,
            value: Schema.Struct({
              outputs: Schema.Struct({
                images: Schema.Array(Schema.Struct({
                  filename: Schema.String,
                  subfolder: Schema.String,
                  type:Schema.String
                }))
              })
            })
          })))(a1)),
          Effect.andThen(a1 =>{
            const prOut = a1[prompt_id]
            if (!prOut) {
              //  TODO ここの書き方どうなるんだろう?
              return Effect.fail(new Error('wait not ready'))
            }
            const outputs = prOut.outputs
            return  Effect.loop(0,{
              while: a => a < needKeyNum,
              step:b => b+1,
              body: c => {
                return HttpClient.get(`${Process.env.comfy_url}/view`,{urlParams:outputs.images[c]}).pipe(
                  Effect.andThen((response) => response.arrayBuffer),
                  Effect.scoped,
                  Effect.provide(FetchHttpClient.layer) //  TODO この後に削除が欲しいところだけど
                )
              }
            })
          } ),
          Effect.retry(Schedule.recurs(44).pipe(Schedule.intersect(Schedule.spaced("30 seconds")))),
          )
/*      let retry = 44
      while (retry > 0) {
        const response = await axios.get(`${this.comfyUrl}/history`);
        const histList: any = response.data
        const hist: any = histList[prompt_id]
        // console.log('check0:',hist)
        if (hist) {
          const keys = Object.keys(hist.outputs);
          //  TODO 今は出力する複数画像の対応は決め打ち。。。
          const outImgList: { buf: Buffer; fileName: string, dir?: string }[] = []
          if (keys.length === needKeyNum) {
            for (const key of keys) {
              const outKey: { filename: string, subfolder?: string, type?: string }[] = hist.outputs[key][dir];
              if (outKey) {
                for (const image of outKey) {
                  const response = await axios.get(`${this.comfyUrl}/view`, {
                    responseType: "arraybuffer",
                    params: {
                      filename: image.filename,
                      subfolder: image.subfolder,
                      type: image.type
                    }
                  });
                  outImgList.push({
                    buf: Buffer.from(response.data as ArrayBuffer),
                    fileName: image.filename,
                    dir: image.subfolder
                  })
                  if (appendForVideo) {
                    //  ビデオ保存の場合同じ名前で拡張子がpngの画像があるようだ これを追加で引き上げる
                    const response = await axios.get(`${this.comfyUrl}/view`, {
                      responseType: "arraybuffer",
                      params: {
                        filename: path.basename(image.filename, `.${videoExt}`) + '.png',
                        subfolder: image.subfolder,
                        type: image.type  //  得られるのはpngだけどimage/webpで指定しないとダメらしい?
                      }
                    });
                    outImgList.push({
                      buf: Buffer.from(response.data as ArrayBuffer),
                      fileName: image.filename,
                      dir: image.subfolder
                    })
                  }

                }
              }
            }
            return {
              prompt_id,
              image: outImgList.length >= 1 ? outImgList[0].buf : undefined,
              images: outImgList
            }
          }
        }
        retry--
        await new Promise(resolve => setTimeout(resolve, 30 * 1000))
      }
      console.log('waitComfyOutput time out')
      return undefined*/
    }

    function comfyApiMakeImage(prompt: string, inImage?: Buffer, params?: {
      width?: number,
      height?: number,
      sampler?: string,
      samples?: number,
      steps?: number,
      cfg_scale?: number,
      seed?: number,
      scheduler?: string,
      denoise?: number,
      model?: string,
      negative_prompt?: string,
    }) {
      return Effect.gen(function* () {
        const uploadFileName = inImage ? yield* comfyUploadImage(inImage, params).pipe(Effect.andThen(a => Effect.succeedSome(a))) : Option.none()
        //  uploadFileNameはプロンプトスクリプト内で置き換えなければならないので
        const sdT2i = scriptTables.get('sd_i2i');
        if (!sdT2i) {
          return yield* Effect.fail(new Error('comfyText2ImageStubInner no script table'))
        }
        const modelParams: any = {
          "KSampler.inputs.seed": params?.seed && params?.seed >= 0 ? params.seed : Math.floor(Math.random() * 999999999999999), // TODO randomは0か? どうもComfyは今randomの設定がないようだ。。。 負数なら15桁の9をベースに乱数とする
          // "KSampler.inputs.steps": params?.steps || 8,  //  20->8
          // "KSampler.inputs.cfg": params?.cfg_scale || 1.5, //  8->1.5
          // "KSampler.inputs.sampler_name": params?.sampler,//dpmpp_2s_ancestral
          // "KSampler.inputs.scheduler": params?.scheduler,//karras,
          // "KSampler.inputs.denoise": params?.denoise || 1, //0.63,
          // "CheckpointLoaderSimple.inputs.ckpt_name": params?.model || '', // TODO どうするか
          // "CLIPTextEncode:6.inputs.text": prompt,
          // "CLIPTextEncode:7.inputs.text": params?.negative_prompt,
          // "LoadImage.inputs.image": uploadFileName,
        };
        if (Option.isSome(uploadFileName)) {
          modelParams["LoadImage.inputs.image"] = uploadFileName.value
        }
        const script = mergeParams(sdT2i.script, sdT2i.nodeNameToId, modelParams)
        const ret = yield* comfyUpExecPrompt(script, params)
        
        return yield * downloadOutput(ret.prompt_id,1).pipe(
          Effect.tap(a => a.length !== 1 && a.length !== 2 && Effect.fail(new Error('download fail'))),
          Effect.andThen(a => a[0]))
      })

    }


    return {
      getRecentImageAndClear,
      makeHotelPict,
      makeEtcTripImage,
      makeRunnerImageV3,
      selectImageGenerator,
      generatePrompt,
      getBasePrompt,
      comfyApiMakeImage,
    }
  }),
  dependencies: [McpLogServiceLive]
}) {
}

export const ImageServiceLive = ImageService.Default
