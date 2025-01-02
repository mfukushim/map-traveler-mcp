import {Effect, Option, Schedule} from "effect";
import sharp = require("sharp");
import {FetchHttpClient, HttpClient, HttpClientRequest, FileSystem} from "@effect/platform";
import dayjs from "dayjs";
import FormData from 'form-data';
import {transparentBackground} from "transparent-background";
import {Jimp} from "jimp";
import {uint8Array} from "@effect/platform/HttpBody";
import {PixAIClient} from '@pixai-art/client'
import {type MediaBaseFragment, TaskBaseFragment} from "@pixai-art/client/types/generated/graphql.js";
import * as Process from "node:process";
import 'dotenv/config'
import {McpLogService, McpLogServiceLive} from "./McpLogService.js";
import {__pwd, env} from "./DbService.js";
import WebSocket from 'ws'
import * as path from "path";

export const defaultBaseCharPrompt = 'depth of field, cinematic composition, masterpiece, best quality,looking at viewer,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut'

let recentImage: Buffer | undefined //  直近の1生成画像を保持する snsのpostに自動引用する

export class ImageService extends Effect.Service<ImageService>()("traveler/ImageService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const key: string = Process.env.sd_key || ''// config.get('StabilityAI.key')  // Process.env.GoogleMapApi_key
    const defaultPixAiModelId = '1648918127446573124';

    const pixAiClient = new PixAIClient({
      apiKey: Process.env.pixAi_key || '',
      webSocketImpl: WebSocket
    })

    /**
     * SDモデル基本定義
     * モデル名からモデルパラメータを設定する部分をとりあえず定数定義→TODO MCP版ではプロンプトはenvへ
     */
    const modelInfoList = [
      {
        name: 'CounterfeitXL_β',
        modelFile: 'CounterfeitXL_β.safetensors',
        vaeFile: 'diffusion_pytorch_model.safetensors',
        baseNegaPrompt: 'embedding:negativeXL_D.safetensors,elf', //  将来サンプラーとスケジューラーもモデル指定にするかも
        modelSnsName: 'CounterfeitXL_β'
      },
      {
        name: 'emi',
        modelFile: 'emi.safetensors',
        vaeFile: 'diffusion_pytorch_model_emi.safetensors',
        baseNegaPrompt: 'embedding:unaestheticXL_AYv1.safetensors,text', //  将来サンプラーとスケジューラーもモデル指定にするかも
        modelSnsName: 'emi'
      },
      {
        name: 'emi2',
        modelFile: 'emi-2.safetensors',
        vaeFile: 'diffusion_pytorch_model_emi2.safetensors',
        baseNegaPrompt: 'embedding:unaestheticXLv31.safetensors,text', //  将来サンプラーとスケジューラーもモデル指定にするかも
        modelSnsName: 'emi-2'
      },
      {
        name: 'emi25',
        modelFile: 'emi-2-5.safetensors',
        vaeFile: 'diffusion_pytorch_model_emi25.safetensors',
        baseNegaPrompt: 'embedding:unaestheticXL_bp5.safetensors,text', //  将来サンプラーとスケジューラーもモデル指定にするかも
        modelSnsName: 'emi-2.5'
      },
      {
        name: 'animagine3',
        modelFile: 'animagine-xl-3.0.safetensors',
        vaeFile: 'diffusion_pytorch_model.safetensors',
        baseNegaPrompt: 'nsfw,lowres,bad anatomy,bad hands,text,error,missing fingers,extra digit,fewer digits,cropped,worst quality,low quality,normal quality,jpeg artifacts,signature,watermark,username,blurry,artist name,elf', //  将来サンプラーとスケジューラーもモデル指定にするかも
        modelSnsName: 'animagine-xl-3.0'
      },
      {
        name: 'animagine31',
        modelFile: 'animagine-xl-3.1.safetensors',
        vaeFile: 'diffusion_pytorch_model.safetensors',
        baseNegaPrompt: 'nsfw,lowres,bad anatomy,bad hands,text,error,missing fingers,extra digit,fewer digits,cropped,worst quality,low quality,normal quality,jpeg artifacts,signature,watermark,username,blurry,artist name,elf', //  将来サンプラーとスケジューラーもモデル指定にするかも
        modelSnsName: 'animagine-xl-3.1'
      },
      {
        name: 'bluePencilXl6',
        modelFile: 'blue_pencil-XL-v6.0.0.safetensors',
        vaeFile: 'diffusion_pytorch_model.safetensors',
        baseNegaPrompt: 'nsfw,lowres,bad anatomy,bad hands,text,error,missing fingers,extra digit,fewer digits,cropped,worst quality,low quality,normal quality,jpeg artifacts,signature,watermark,username,blurry,artist name,elf', //  将来サンプラーとスケジューラーもモデル指定にするかも
        modelSnsName: 'blue_pencil-XL6'
      },
      {
        name: 'CounterfeitXL25',
        modelFile: 'CounterfeitXL-V2.5.safetensors',
        vaeFile: 'diffusion_pytorch_model.safetensors',
        baseNegaPrompt: 'embedding:negativeXL_D.safetensors,elf', //  将来サンプラーとスケジューラーもモデル指定にするかも
        modelSnsName: 'CounterfeitXL-2.5'
      },
    ]

    function getModelInfo(modelName: string) {
      return Option.fromNullable(modelInfoList.find(value => value.name === modelName))
    }


    function sdMakeTextToImage(prompt: string, opt?: {
      width: number,
      height: number,
      sampler: string,
      samples: number,
      steps: number,
      cfg_scale: number
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
        yield* McpLogService.logTrace(param.list);
        if (param.list.length > 10) {
          return yield* Effect.fail(new Error('param weight too long'))
        }
        const client = yield* HttpClient.HttpClient;
        // const form = new FormData()
        // form.append('responseType','arraybuffer')
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
                return Effect.fail(`fail sd`)
              }
              return Effect.succeed(a.artifacts.map(c => c.base64))
            }),
            Effect.retry({times: 2}),
            Effect.mapError(e => new Error(`sdMakeTextToImage error:${e}`)),
            Effect.scoped,
        )
      }).pipe(Effect.provide(FetchHttpClient.layer))

    }

    function sdMakeImageToImage(prompt: string, inImage: Buffer, opt?: {
      width: number,
      height: number,
      sampler: string,
      samples: number,
      steps: number,
      cfg_scale: number
    }) {
      return Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient
            const form = new FormData()
            form.append("image_strength", 0.35)
            form.append("init_image_mode", "IMAGE_STRENGTH")
            form.append("init_image", inImage)
            form.append("text_prompts[0][text]", "A dog space commander")
            form.append("text_prompts[0][weight]", 1)
            form.append("cfg_scale", 7)
            form.append("sampler", "K_DPM_2_ANCESTRAL")
            form.append("samples", 3)
            form.append("steps", 30)
            return yield* HttpClientRequest.post(`https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image`).pipe(
                HttpClientRequest.setHeaders({
                  Authorization: `Bearer ${key}`,
                  Accept: "application/json",
                  ...form.getHeaders()
                }),
                HttpClientRequest.setBody(uint8Array(form.getBuffer())),
                client.execute,
                Effect.flatMap(a => a.json),
                Effect.andThen(a => a as { artifacts: { base64: string, finishReason: string, seed: number }[] }),
                Effect.flatMap(a => {
                  if (a.artifacts.some(b => b.finishReason !== 'SUCCESS') || a.artifacts.length === 0) {
                    return Effect.fail(`fail sd`)
                  }
                  return Effect.succeed(a.artifacts.map(c => c.base64))
                }),
                Effect.retry({times: 2}),
                Effect.mapError(e => new Error(`sdMakeImageToImage error:${e}`)),
                Effect.scoped,
            )
          }
      ).pipe(Effect.provide(FetchHttpClient.layer))

    }

    function sdMakeImage(prompt: string, inImage?: Buffer, opt?: {
      width: number,
      height: number,
      sampler: string,
      samples: number,
      steps: number,
      cfg_scale: number,
    }) {
      if (inImage) {
        return sdMakeImageToImage(prompt, inImage, opt).pipe(Effect.andThen(a => a[0]))
      }
      return sdMakeTextToImage(prompt, opt).pipe(Effect.andThen(a => a[0]))
    }

    function pixAiMakeImage(prompt: string, inImage?: Buffer, opt?: {
      width: number,
      height: number,
      sampler: string,
      samples: number,
      steps: number,
      cfg_scale: number,
    }) {
      return Effect.retry(
          Effect.gen(function* () {
            let mediaId
            if (inImage) {
              const blob = new Blob([inImage], {type: 'image/jpeg'});
              const file = new File([blob], "image.jpg", {type: 'image/jpeg'})
              mediaId = yield* Effect.tryPromise({
                try: signal => pixAiClient.uploadMedia(file),
                catch: error => new Error(`uploadMedia fail:${error}`)
              }).pipe(Effect.andThen(a1 => {
                if (!a1.mediaId) {
                  return Effect.fail(new Error(`uploadMedia fail`))
                }
                return Effect.succeed(a1.mediaId)
              }))
            }
            return mediaId
          }).pipe(
              Effect.tap(a => McpLogService.logTrace(`uploadMedia ${a}`)),
              Effect.tapError(a => McpLogService.logError(`uploadMedia error ${a}`)),
              Effect.andThen(a => {
                const body = a ? {
                  prompts: prompt,
                  modelId: Process.env.pixAi_modelId || defaultPixAiModelId, //1648918127446573124
                  width: 512,
                  height: 512,
                  mediaId: a
                } : {
                  prompts: prompt,
                  modelId: Process.env.pixAi_modelId || defaultPixAiModelId, //1648918127446573124
                  width: 512,
                  height: 512,
                }
                return Effect.tryPromise({
                  try: signal => pixAiClient.generateImage(body,
                      // {
                      // onUpdate: task => {
                      // console.log(new Date(), 'Task update:', task)
                      // }
                      // }
                  ),
                  catch: error => new Error(`generateImage fail:${error}`)
                })
              }),
              Effect.tap(a => McpLogService.logTrace(`generateImage ${a.status}`)),
              Effect.tapError(a => McpLogService.logError(`generateImage ${a}`)),
              Effect.andThen(task => {
                return Effect.tryPromise({
                  try: signal => pixAiClient.getMediaFromTask(task as TaskBaseFragment), //  TODO
                  catch: error => new Error(`getMediaFromTask fail:${error}`)
                })
              }),
              Effect.tap(a => McpLogService.logTrace(`getMediaFromTask ${a}`)),
              Effect.andThen(media => {
                if (!media) {
                  return Effect.fail(new Error(`media fail1:${media}`))
                }
                if (Array.isArray(media)) {
                  return Effect.fail(new Error(`media fail2:${media}`))
                }
                return Effect.tryPromise({
                  try: signal => pixAiClient.downloadMedia(media as MediaBaseFragment), // TODO
                  catch: error => new Error(`downloadMedia fail:${error}`)
                });
              }),
              Effect.tap(a => McpLogService.logTrace(`downloadMedia out:${a.slice(0, 10)}`)),
              Effect.tapError(a => McpLogService.logError(`downloadMedia err:${a}`)),
              Effect.andThen(a => Effect.succeed(Buffer.from(a).toString('base64')))
          ), Schedule.recurs(4).pipe(Schedule.intersect(Schedule.spaced("10 seconds")))).pipe(Effect.provide([McpLogServiceLive]))
    }

    /**
     * ホテル画像
     * , modelInfo: {
     *                              vaeFile: string | undefined;
     *                              modelFile: string | undefined;
     *                              modelSnsName: string | undefined;
     *                              name: string | undefined;
     *                              baseNegaPrompt: string | undefined
     *                            }
     * @param baseCharPrompt
     * @param selectGen
     * @param hour
     * @param append
     * @param localDebug
     */
    function makeHotelPict(baseCharPrompt: string, selectGen: string, hour: number, append ?: string, localDebug = false) {
      return Effect.gen(function* () {
        if (!env.anyImageAiExist || env.isPractice) {
          //  画像生成AIがなければ固定ホテル画像を使う
          const fs = yield* FileSystem.FileSystem
          return yield* fs.readFile(path.join(__pwd,'assets/hotelPict.png')).pipe(Effect.andThen(a => Buffer.from(a)))
        }
        let prompt = (baseCharPrompt || defaultBaseCharPrompt) + ',';
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
              const data = Buffer.from(a, "base64");
              recentImage = data
              if (localDebug) {
                return FileSystem.FileSystem.pipe(Effect.andThen(fs => fs.writeFile('tools/test/hotelPict.png', data, {flag: "w"})))
              }
            }),
            Effect.andThen(a => Buffer.from(a, 'base64'))
        )
      })
    }

    /**
     * 船等の特殊ロケーション
     * @param basePrompt
     * @param selectGen
     * @param vehiclePrompt
     * @param timeZoneId
     * @param localDebug
     * @private
     */
    function makeEtcTripImage(basePrompt: string, selectGen: string, vehiclePrompt: string, timeZoneId: string, localDebug = false) {
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
        const prompt = `${basePrompt},${appendPrompt}`
        return yield* selectImageGenerator(selectGen, prompt).pipe(
            Effect.tap(a => {
              const data = Buffer.from(a, "base64");
              recentImage = data
              if (localDebug) {
                return FileSystem.FileSystem.pipe(Effect.andThen(fs => fs.writeFile('tools/test/hotelPict.png', data, {flag: "w"})))
              }
            }),
            Effect.andThen(a => Buffer.from(a[0], 'base64')))
        // negative_prompt: modelInfo?.baseNegaPrompt || 'embedding:negativeXL_D.safetensors,elf',
        // width: 768, height: 768, strength: 0.65,
        // model: modelInfo?.modelFile || 'CounterfeitXL_β.safetensors',
        // vae: modelInfo?.vaeFile || 'diffusion_pytorch_model.safetensors',
        // sampler_name: 'lcm', //'dpmpp_2s_ancestral',
        // scheduler: 'karras',
      })
    }


    function imageCrop(rawImage: Buffer) {
      return Effect.gen(function* () {
        const img = sharp(rawImage, {animated: true})
        const meta = yield* Effect.tryPromise(signal => img.metadata());
        const out = yield* Effect.tryPromise(signal => img.resize({
          width: (meta.width || 256),
          height: Math.floor((meta.height || 256) * 0.6),
          fit: "inside"
        }).png().toBuffer());
        return Option.some(out.toString('base64'))
      }).pipe(Effect.catchAll(e => Effect.succeed(Option.none())))

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
        let backPrompt: string
        if (simple || withAbort) {
          backPrompt = ',(simple background:1.2)' //  ,simple background
        } else {
          backPrompt = ',road'
        }
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
      width: number,
      height: number,
      sampler: string,
      samples: number,
      steps: number,
      cfg_scale: number,
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
        const image = yield* Effect.tryPromise(signal => Jimp.read(avatarImage));
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

    /**
     * 旅画像生成処理V3
     * @param basePhoto
     * @param baseCharPrompt
     * @param selectGen
     * @param withAbort
     * @param localDebug
     * @param bodyAreaRatio アバター本体占有面積比率 0.042 以上
     * @param bodyHWRatio アバター縦横比率 2.3 以上
     * @param sideBias 貼り付け位置を左右に偏らせる
     */
    function makeRunnerImageV3(
        basePhoto: Buffer,
        baseCharPrompt: string,
        selectGen: string,
        withAbort = false,
        localDebug = false,
        bodyAreaRatio = 0.042,
        bodyHWRatio = 2.3,
        sideBias = false
    ) {
      return Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem
            const outSize = {w: 1600, h: 1000}
            const innerSize = {w: 1600, h: 1600}
            const windowSize = {w: 832, h: 1216}
            const cutPos = sideBias ? (Math.random() < 0.5 ? Math.random() * 0.3 : 0.7 + Math.random() * 0.3) : Math.random()
            const shiftX = Math.floor((innerSize.w - windowSize.w) * cutPos);  //  0～1で均等にランダム切り出しだったはず
            const innerImage = yield* Effect.tryPromise(signal => sharp(basePhoto).resize({
              width: innerSize.w,
              height: innerSize.h,
              fit: "fill"
            }).toBuffer());
            const clopImage = yield* Effect.tryPromise(signal => sharp(innerImage).extract({
              left: shiftX,
              top: innerSize.h - windowSize.h,
              width: windowSize.w,
              height: windowSize.h
            }).toBuffer())
            if (localDebug) {
              yield* fs.writeFile('tools/test/testOutInClop.png', clopImage, {flag: "w"})
            }

            /** 画像評価リトライ */
            let retry = 7 //  5回リトライになってるな 現在初期値7 最小値2(でないと画像できない)
            const fixedThreshold = 3  //  バストショットに切り替える閾値 2,1の2回はバストショット生成を試みる
            let isFixedBody = false
            let appendPrompt: string | undefined

            const avatarImage = yield* Effect.gen(function* () {
              const {prompt, append} = yield* generatePrompt(baseCharPrompt, retry < fixedThreshold, withAbort)
              appendPrompt = append
              retry--
              if (retry < fixedThreshold) {
                //  立ち絵
                isFixedBody = true
                return yield* selectImageGenerator(selectGen, prompt)
              } else {
                //  画面i2i
                isFixedBody = false
                return yield* selectImageGenerator(selectGen, prompt, clopImage)
              }
            }).pipe(
                Effect.andThen(a => Buffer.from(a, 'base64')),
                Effect.tap(sdImage => localDebug && fs.writeFile('tools/test/testOutGen.png', sdImage, {flag: "w"})),
                Effect.andThen(sdImage => Effect.tryPromise({
                  try: signal => transparentBackground(sdImage, "png", {fast: false}),
                  catch: error => `transparentBackground error:${error}`
                })),
                Effect.tap(avatarImage => localDebug && fs.writeFile('tools/test/testOutRmBg.png', avatarImage, {flag: "w"})),
                Effect.tap(avatarImage => {
                  //  TODO tap内のfailは正しくきくっけ?
                  //  非透明度判定 0.02以上
                  return checkPersonImage(avatarImage, windowSize).pipe(
                      Effect.tap(a => McpLogService.logTrace(`'check runner image:${retry},${a}`)),  //, retry, number, alphaNum.rect.w, alphaNum.rect.h\
                      Effect.andThen(a => {
                        //  非透明度が0.02以上かつ範囲の縦と横の比率が3:1以上なら完了 counterfeit V3=0.015, counterfeit LX 0.03 にしてみる
                        //  TODO 非透明面積に乱数要素を入れてある程度強制的に立ち絵を発生させるか
                        if (a.number > bodyAreaRatio && a.alphaNum.rect.h / a.alphaNum.rect.w > bodyHWRatio) { //  比率値を3から2.5にしてみる。ダメ映像が増えたらまた調整する。。非透明率を0.015にしてみる
                          Effect.succeed(avatarImage)
                        }
                        Effect.fail(new Error('avatar fail'))
                      })
                  );
                }),
                Effect.retry({times: 7})
            )
            const stayImage = yield* Effect.tryPromise(signal => {
              return sharp(innerImage).composite([{
                input: avatarImage,
                left: shiftX,
                top: innerSize.h - windowSize.h
              }]).toBuffer()
            }).pipe(Effect.andThen(a => Effect.tryPromise(signal => sharp(a).extract({
              left: (innerSize.w - outSize.w) / 2,
              top: (innerSize.h - outSize.h) / 2,
              width: outSize.w,
              height: outSize.h
            }).toBuffer())))
            recentImage = stayImage
        yield *McpLogService.logTrace(`stayImage:${recentImage}`)

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

    function getRecentImageAndClear() {
      const image = recentImage
      recentImage = undefined
      return image
    }


    return {
      getRecentImageAndClear,
      getModelInfo,
      makeHotelPict,
      makeEtcTripImage,
      imageCrop,
      makeRunnerImageV3,
      pixAiMakeImage,
      generatePrompt,
    }
  }),
  dependencies: [McpLogServiceLive]  //  この様式で書くことでservice内のgen()内の変数が有効になるので、極力こちらで書く。。
}) {
}

export const ImageServiceLive = ImageService.Default
