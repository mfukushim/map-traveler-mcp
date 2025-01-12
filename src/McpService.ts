/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import {Effect, Option} from "effect"
import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema, Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {defaultAvatarId, RunnerService, RunnerServiceLive, useAiImageGen} from "./RunnerService.js";
import {MapService, MapServiceLive} from "./MapService.js";
import {__pwd, DbService, DbServiceLive, env, PersonMode} from "./DbService.js";
import {StoryService, StoryServiceLive} from "./StoryService.js";
import {FetchHttpClient, FileSystem} from "@effect/platform";
import {ImageService, ImageServiceLive} from "./ImageService.js";
import {NodeFileSystem} from "@effect/platform-node";
import {McpLogService, McpLogServiceLive} from "./McpLogService.js";
import {AnswerError} from "./mapTraveler.js";
import {AtPubNotification, SnsService, SnsServiceLive} from "./SnsService.js";
import * as Process from "node:process";
import {FeedViewPost} from "@atproto/api/dist/client/types/app/bsky/feed/defs.js";
import * as path from "path";

//  Toolのcontentの定義だがzodから持ってくると重いのでここで定義
export interface ToolContentResponse {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  resource?: any;
}

//  bluesky SNS用固定feed
const feedTag = "#geo_less_traveler"
const feedUri = "at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.generator/marble_square25"

const LabelGoogleMap = 'Google Map'
const LabelClaude = 'Claude'
let recentUseLabels: string[] = []
const labelImage = (aiGen: string) => {
  return aiGen === 'pixAi' ? 'PixAi' : aiGen === 'sd' ? 'Stability.ai' : ''
}

export class McpService extends Effect.Service<McpService>()("traveler/McpService", {
  accessors: true,
  effect: Effect.gen(function* () {
      const server = new Server(
        {
          name: "geo-less-traveler",
          version: "0.1.0",
        },
        {
          capabilities: {
            resources: {
              listChanged: true
            },
            tools: {
              listChanged: true
            },
            prompts: {},
            sampling: {},
          },
        }
      );

      const tips = () => {
        return Effect.gen(function* () {
            const res = yield* StoryService.tips()
            const out = {
              content: [{type: "text", text: res.textList.join('\n-------\n')} as ToolContentResponse]
            };
            if (res.imagePathList.length > 0) {
              const fs = yield* FileSystem.FileSystem
              yield* Effect.forEach(res.imagePathList, a => {
                return fs.readFile(path.join(__pwd, a)).pipe(Effect.andThen(b => {
                  out.content.push({
                    type: "image",
                    data: Buffer.from(b).toString('base64'),
                    mimeType: 'image/png'
                  } as ToolContentResponse)
                }))
              })
            }
            return out
          }
        )
      }
      const setPersonMode = (person: string) => {
        const mode: PersonMode = person === 'second_person' ? 'second' : 'third'
        env.personMode = mode
        return DbService.saveEnv('personMode', mode).pipe(
          Effect.tap(() => sendToolListChanged()),
          Effect.andThen(a => ({
            content: [{type: "text", text: `Person mode set as follows: ${a.value}`} as ToolContentResponse]
          }))
        )
      }
      const getTravelerInfo = () => {
        return DbService.getEnv('aiEnv').pipe(
          Effect.andThen(a => ({
            content: [{
              type: "text",
              text: `The traveller's information is as follows: ${a}`
            } as ToolContentResponse]
          })),
          Effect.orElseSucceed(() => ({
            content: [{
              type: "text",
              text: `There is no traveler information.`
            } as ToolContentResponse]
          }))
        )
      }

      const setTravelerInfo = (info: string) => {
        return DbService.saveEnv('aiEnv', info).pipe(
          Effect.andThen(a => ({
            content: [{
              type: "text",
              text: `The traveller information is as follows: ${a.value}`
            } as ToolContentResponse]
          }))
        )
      }
      const setAvatarPrompt = (prompt: string) => {
        return DbService.updateBasePrompt(defaultAvatarId, prompt).pipe(
          Effect.andThen(a => ({
            content: [{
              type: "text",
              text: `Set traveller prompt to: "${a}"`
            } as ToolContentResponse]
          }))
        )
      }

      const getCurrentLocationInfo = (includePhoto: boolean, includeNearbyFacilities: boolean, localDebug = false) => {
        return RunnerService.getCurrentView(includePhoto, includeNearbyFacilities, env.isPractice, localDebug).pipe(
          Effect.provide([McpLogServiceLive, MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive, FetchHttpClient.layer, ImageServiceLive]),
        )
      }

      const practiceNotUsableMessage = Effect.succeed({
        content: [
          {
            type: "text",
            text: 'Sorry,this feature not usable in practice mode. ' +
              'Please assign Google Map API key and restart application if you use this function. ' +
              'For more information, please see the resource "SettingInfo"'
          } as ToolContentResponse
        ]
      })

      const setCurrentLocation = (location: string) => {
        if (env.isPractice) {
          return practiceNotUsableMessage
        }
        if (!location) {
          throw new AnswerError("Location address is required");
        }
        return Effect.gen(function* () {
          const address = yield* MapService.getMapLocation(location)
          if (Option.isNone(address)) {
            return yield* Effect.fail(new AnswerError("I don't know where you're talking about. location not found"))
          }
          const timeZoneId = yield* MapService.getTimezoneByLatLng(address.value.lat, address.value.lng)
          yield* Effect.logTrace(address.value)
          yield* DbService.saveRunStatus({
            id: 1,  // 1レコードにする
            status: 'stop',
            from: '',
            to: address.value.address,
            destination: null,
            startLat: 0,
            startLng: 0,
            endLat: address.value.lat,  //  最後のrunStatusが現在位置
            endLng: address.value.lng,
            durationSec: 0,
            distanceM: 0,
            avatarId: 1,
            tripId: 0,
            tilEndEpoch: 0, //  旅開始していない
            startTime: new Date(0),  //  旅開始していない
            startCountry: address.value.country,
            endCountry: address.value.country,
            startTz: timeZoneId,
            endTz: timeZoneId,
            currentPathNo: -1,
            currentStepNo: -1,
          })
          const setMessage = [
            `location set succeed`,
            `address:${address.value.address}`,
            `latitude:${address.value.lat}, longitude:${address.value.lng}`
          ];
          yield* DbService.getEnv('destination').pipe(
            Effect.andThen(dest => RunnerService.setDestinationAddress(dest)),
            Effect.andThen(a => setMessage.push(a.message)),
            Effect.orElse(() => Effect.succeed(true))
          );
          return {
            content: [{
              type: "text",
              text: setMessage.join('\n')
            } as ToolContentResponse]
          }
        }).pipe(Effect.provide([MapServiceLive, DbServiceLive, McpLogServiceLive, RunnerServiceLive]))
      }
      const getDestinationAddress = () => {
        if (env.isPractice) {
          return practiceNotUsableMessage
        }
        return RunnerService.getDestinationAddress().pipe(
          Effect.andThen(a => ({
            content: [{type: "text", text: `Current destination is "${a}"`} as ToolContentResponse]
          })),
          Effect.provide([MapServiceLive, StoryServiceLive, RunnerServiceLive, ImageServiceLive, NodeFileSystem.layer, McpLogServiceLive,DbServiceLive]),
        )
      }
      const setDestinationAddress = (address: string) => {
        if (env.isPractice) {
          return practiceNotUsableMessage
        }
        return RunnerService.setDestinationAddress(address).pipe(
          Effect.andThen(a => ({
            content: [{type: "text", text: a.message} as ToolContentResponse]
          })),
          Effect.provide([MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive, ImageServiceLive, NodeFileSystem.layer, McpLogServiceLive]),
        )
      }
      const startJourney = () => {
        return RunnerService.startJourney(env.isPractice).pipe(
          Effect.andThen(a => {
            recentUseLabels = [LabelClaude]
            if (useAiImageGen) {
              recentUseLabels.push(labelImage(useAiImageGen))
            }
            return {
              content: [{type: "text", text: a.text}, {
                type: "image",
                data: a.image.toString("base64"),
                mimeType: 'image/png'
              }] as ToolContentResponse[]
            };
          }),
          Effect.provide([MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive, FetchHttpClient.layer, ImageServiceLive, NodeFileSystem.layer, McpLogServiceLive]),
        )
      }
      const stopJourney = () => {
        recentUseLabels = [LabelClaude, LabelGoogleMap]
        if (useAiImageGen) {
          recentUseLabels.push(labelImage(useAiImageGen))
        }
        return RunnerService.stopJourney(env.isPractice).pipe(
          Effect.provide([MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive, FetchHttpClient.layer, ImageServiceLive, NodeFileSystem.layer, McpLogServiceLive]),
        )
      }

      const setTravelerExist = (callKick: boolean) => {
        env.travelerExist = callKick
        return McpLogService.log(`enter setTravelerExist:${callKick}`).pipe(
          Effect.tap(() => sendToolListChanged()),
          Effect.andThen(() => {
            return ({
              content: [{
                type: "text",
                text: (callKick ? "traveler called" : "traveler kicked")
              } as ToolContentResponse]
            })
          })
        )
      }

      const makeVisitorMessage = (notification: AtPubNotification) => {
        // `|イイネを付けた人の名前|イイネが付いた記事の内容|イイネを付けた人の直近の記事|イイネを付けた人のプロフィール|\n`+
        return Effect.gen(function* () {
          const visitorProf = yield* SnsService.getProfile(notification.handle)
          const visitorPosts = yield* SnsService.getAuthorFeed(notification.handle, 3);
          //  イイネのときの自分が書いていいねがつけられたpost、replyの場合のreplyを付けた相手のpost
          const mentionPostText = yield* SnsService.getPost(notification.uri).pipe(
            Effect.andThen(a =>
              Effect.succeed(Option.fromNullable(a.posts.length > 0 ? (a.posts[0].record as any).text as string : undefined))))
          //  replyのときに、replyが付けられた自分が書いたpost, イイネのときはないはず
          const repliedPostText = notification.mentionType === 'reply' && notification.parentUri ?
            (yield* SnsService.getPost(notification.parentUri).pipe(
              Effect.andThen(a =>
                Effect.succeed(Option.fromNullable(a.posts.length > 0 ? (a.posts[0].record as any).text as string : undefined))))) : Option.none();

          const visitorName = notification.name || notification.handle || '誰か'
          yield* McpLogService.logTrace(`avatarName:${visitorName}`)
          const visitorPost = visitorPosts && visitorPosts.feed.length > 0 ? Option.some(visitorPosts.feed[0].post) : Option.none()
          const visitorPostText = visitorPost.pipe(Option.andThen(a => (a.record as any).text as string))
          yield* McpLogService.logTrace(`mentionPostText:${mentionPostText}`)
          yield* McpLogService.logTrace(`repliedPostText:${repliedPostText}`)
          yield* McpLogService.logTrace(`visitorPostText:${visitorPostText}`)
          return {
            visitorName,
            recentVisitorPost: visitorPostText,
            visitorProf: visitorProf.description,
            mentionPost: mentionPostText,
            repliedPost: repliedPostText,
            target: notification.uri + '-' + notification.cid //  bsの場合はuri+cid
          }
        })
      }

      const getSnsMentions = () => {
        //  TODO 自身へのメンションしか受け付けない。特定タグに限る? 現在から一定期間しか読み取れない。最大件数がある。その他固定フィルタ機能を置く
        //  Like: likeを付けた人のhandle,likeがついた記事の内容、likeを付けた人の最新の記事、likeを付けた人のプロフィール
        //    これのランダム選択はllmでするかロジック側で選定して記事を作らせるか
        //  reply: replyを付けた人のhandle,replyがついた記事の内容、replyの記事内容、replyを付けた人のプロフィール
        return Effect.gen(function* () {
          const notifications = yield* SnsService.getNotification()
          const {reply, like} = notifications.reduce((p, c) => {
            if (c.mentionType === 'reply') {
              p.reply.push(c)
            } else if (c.mentionType === 'like') {
              p.like.push(c)
            }
            return p
          }, {reply: [], like: []} as { reply: AtPubNotification[], like: AtPubNotification[] })
          const likeMes = yield* Effect.forEach(like, a => makeVisitorMessage(a))
          const replyMes = yield* Effect.forEach(reply, a => makeVisitorMessage(a))

          //  replyがあればreplyを優先にしてlikeは処理しないことにするか。多くをまとめて処理できることを確認してからより多くの返答を行う
          const likeText = `Our SNS post received the following likes.\n` +
            `|id|Name of the person who liked the post|Content of the article with the like|recent article by the person who liked this|Profile of the person who liked|\n` +
            likeMes.map((a) =>
              `|"${a.target}"|${a.visitorName}|${Option.getOrElse(a.mentionPost, () => '')}|${Option.getOrElse(a.recentVisitorPost, () => '')}|${a.visitorProf}|`).join('\n') +
            '\n'

          const replyText = `We received the following reply to our SNS post:\n` +
            `|id|The name of the person who replied|Content of the article with the reply|Content of the reply article|Profile of the person who replied|\n` +
            replyMes.map((a) =>
              `|"${a.target}"|${a.visitorName}|${Option.getOrElse(a.repliedPost, () => '')}|${Option.getOrElse(a.mentionPost, () => '')}|${a.visitorProf || ''}|`).join('\n') +
            '\n'

          const content: ToolContentResponse[] = []
          if (replyMes.length > 0) {
            content.push({
              type: 'text',
              text: replyText
            })
          }
          if (likeMes.length > 0) {
            content.push({
              type: 'text',
              text: likeText
            })
          }
          return {
            content: content
          };
        }).pipe(Effect.provide(SnsServiceLive))
      }

      const readSnsReader = () => {
        //  TODO 特定タグを含むものしか読み取れない。現在から一定期間しか読み取れない。最大件数がある。その他固定フィルタ機能を置く
        return Effect.succeed({
          content: [] as ToolContentResponse[]
        })
      }
      const getSnsFeeds = () => {
        //  特定タグを含むものしか読み取れない。現在から一定期間しか読み取れない。最大件数がある。その他固定フィルタ機能を置く
        //  自身は除去する
        return SnsService.getFeed(feedUri, 4).pipe(
          Effect.andThen(a => {
            const detectFeeds = a.filter(v => v.post.author.handle !== Process.env.bs_handle)
              .reduce((p, c) => {
                //  同一ハンドルの直近1件のみ
                if (!p.find(v => v.post.author.handle === c.post.author.handle)) {
                  p.push(c)
                }
                return p
              }, [] as FeedViewPost[])
            const select = detectFeeds.map(v => {
              const im = (v.post.embed as any)?.images as any[]
              return ({
                authorHandle: v.post.author.displayName, //  LLMには可読名を返す。id管理は面倒なので正しくなくても可読名で記事の対応を取る
                body: (v.post.record as any).text || '',
                imageUri: im ? im[0].thumb as string : undefined
              });
            })
            const out = select.map(v => `author: ${v.authorHandle}\nbody: ${v.body}`).join('\n-----\n')
            const images = select.flatMap(v => v.imageUri ? [{uri: v.imageUri, handle: v.authorHandle}] : [])
            const imageOut = images.map(v => {
              return {
                type: "resource",
                resource: {
                  uri: v.uri,
                  mimeType: "image/jpeg",
                  text: `image of ${v.handle}`
                }
              }
            })
            const c: ToolContentResponse[] = [{
              type: 'text',
              text: `I got the following article:\n${out}\n-----\n`
            }]
            c.push(...imageOut)
            return Effect.succeed({
              content: c
            })
          }),
          Effect.provide(SnsServiceLive))
      }

      const replySnsWriter = (message: string, id: string) => {
        const appendLicence = 'powered ' + LabelClaude  //  追加ライセンスの文字列をclient LLMに制御させることは信頼できないので、直近の生成行為に対する文字列を強制付加する
        //  TODO 固定フィルタ
        return Effect.gen(function* () {
          if (env.noSnsPost) {
            const noMes = {
              content: [
                {
                  type: "text",
                  text: env.loggingMode ? "posted to log." : "Posting to SNS is stopped by env settings."
                }
              ] as ToolContentResponse[]
            };
            if (env.loggingMode) {
              return yield* McpLogService.log(message).pipe(Effect.andThen(() => noMes))
            }
            return yield* Effect.succeed(noMes)
          }
          const exec = /^"?(at.+?)"?$/.exec(id);
          const id2 = exec && exec[1]
          if (!id2) {
            return yield* Effect.fail(new AnswerError('id is invalid'))
          }
          return yield* SnsService.snsReply(message, `${appendLicence} ${feedTag} `, id2).pipe(
            Effect.andThen(() => ({
              content: [
                {
                  type: "text",
                  text: "posted"
                }
              ] as ToolContentResponse[]
            })),
            Effect.provide(SnsServiceLive)
          );
        })
      }

      const postSnsWriter = (message: string) => {
        //  特定タグを強制付加する 長すぎは強制的に切る 特定ライセンス記述を強制付加する その他固定フィルタ機能を置く
        const appendLicence = 'powered ' + recentUseLabels.join(',')  //  追加ライセンスの文字列をclient LLMに制御させることは信頼できないので、直近の生成行為に対する文字列を強制付加する
        //  TODO 固定フィルタ
        return Effect.gen(function* () {
          if (env.noSnsPost) {
            const noMes = {
              content: [
                {
                  type: "text",
                  text: env.loggingMode ? "posted to log." : "Posting to SNS is stopped by env settings."
                }
              ] as ToolContentResponse[]
            };
            if (env.loggingMode) {
              return yield* McpLogService.log(message).pipe(Effect.andThen(() => noMes))
            }
            return yield* Effect.succeed(noMes)
          }
          const img = yield* ImageService.getRecentImageAndClear()
          yield* McpLogService.logTrace(`sns image:${img !== undefined}`)
          const imageData = img ? {
            buf: img,
            mime: "image/png"
          } : undefined
          return yield* SnsService.snsPost(message, `${appendLicence} ${feedTag} `, imageData).pipe(
            Effect.andThen(() => ({
              content: [
                {
                  type: "text",
                  text: "posted"
                }
              ] as ToolContentResponse[]
            })),
            Effect.provide(SnsServiceLive)
          );

        })
      }

      /**
       * Effect上でMCP実行
       */
      const run = () => {
        server.setRequestHandler(ListResourcesRequestSchema, async () => {
          return {
            resources: [
              {
                uri: "file:///role.txt",
                mimeType: "text/plain",
                name: "role.txt",
                description: "The purpose and role of AI"
              }, {
                uri: "file:///roleWithSns.txt",
                mimeType: "text/plain",
                name: "roleWithSns.txt",
                description: "The purpose and role of AI with SNS"
              }, {
                uri: "file:///credit.txt",
                mimeType: "text/plain",
                name: "credit.txt",
                description: "credit of this component"
              }, {
                uri: "file:///setting.txt",
                mimeType: "text/plain",
                name: "setting.txt",
                description: "setting of traveler"
              }
            ]
          };
        });
        server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
          const url = new URL(request.params.uri);
          return await StoryService.getSettingResource(url.pathname).pipe(
            Effect.andThen(a => ({
              contents: [{
                uri: request.params.uri,
                mimeType: "text/plain",
                text: a
              }]
            })),
            Effect.provide([MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive, FetchHttpClient.layer, ImageServiceLive, NodeFileSystem.layer]),
            Effect.runPromise
          ).catch(e => {
            if (e instanceof Error) {
              throw new Error(e.message);
            }
            throw e
          })
        });
        server.setRequestHandler(ListPromptsRequestSchema, async () => {
          return {
            prompts: [
              {
                name: "tips",
                description: "Inform you of recommended actions for traveler",
              }
            ]
          };
        });
        server.setRequestHandler(GetPromptRequestSchema, async (request) => {
          if (request.params.name !== "tips") {
            throw new Error("Unknown prompt");
          }

          return {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: "Get tips information."
                }
              }
            ]
          };
        });

        const SETTING_COMMANDS: Tool[] = [
          {
            name: "tips",  //  pythonがあったらよいとか、db設定がよいとか、tipsを取得する。tipsの取得を行うのはproject側スクリプトとか、script batchとか
            description: "Inform you of recommended actions for your device",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          //  TODO 当面はずす
          // {
          //   name: "set_person_mode",  //  環境情報はリソースに反映する できれば更新イベントを出す
          //   description: "set a traveler's view mode. Third person or Second person.",
          //   inputSchema: {
          //     type: "object",
          //     properties: {
          //       person: {
          //         type: "string",
          //         enum: ["third_person", "second_person"],
          //         description: "traveler's view mode."
          //       },
          //     },
          //     required: ["person"]
          //   }
          // },
          {
            name: "get_traveler_info",
            description: "get a traveler's setting.For example, traveler's name, the language traveler speak, Personality and speaking habits, etc.",
            inputSchema: {
              type: "object",
              properties: {
                settings: {},
              }
            }
          },
          {
            name: "set_traveler_info",  //  環境情報はリソースに反映する できれば更新イベントを出す
            description: "set a traveler's setting.For example, traveler's name, the language traveler speak, Personality and speaking habits, etc.",
            inputSchema: {
              type: "object",
              properties: {
                settings: {
                  type: "string",
                  description: "traveler's setting. traveler's name, the language traveler speak, etc."
                },
              },
              required: ["settings"]
            }
          },
          {
            name: "set_avatar_prompt",  //  環境情報はリソースに反映する できれば更新イベントを出す
            description: "set a traveler's avatar prompt. A prompt for AI image generation to specify the appearance of a traveler's avatar",
            inputSchema: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "traveler's avatar AI image generation prompt."
                },
              },
              required: ["prompt"]
            }
          },
        ]
        const START_STOP_COMMAND: Tool[] = [
          {
            name: env.personMode === 'second' ? "start_journey" : "start_traveler_journey",
            description: env.personMode === 'second' ? "Start the journey to destination" : "Start the traveler's journey to destination",  //  スタートと合わせてスタートシーン画像を取得して添付する
            inputSchema: {
              type: "object",
              properties: {},
            }
          },
          {
            name: env.personMode === 'second' ? "stop_journey" : "stop_traveler_journey",
            description: env.personMode === 'second' ? "Stop the journey" : "Stop the traveler's journey",  //  停泊と合わせて停止シーン画像を取得して添付する
            inputSchema: {
              type: "object",
              properties: {},
            }
          },
        ]
        const GET_LOCATION_COMMAND: Tool[] = [
          {
            name: env.personMode === 'second' ? "get_current_location_info" : "get_traveler_location_info",
            description: env.personMode === 'second' ?
              "get a address of current my location and information on nearby facilities,view snapshot" :
              "get a address of current traveler's location and information on nearby facilities,view snapshot",
            inputSchema: {
              type: "object",
              properties: {
                includePhoto: {
                  type: "boolean",
                  description: "Get scenery photos of current location"
                },
                includeNearbyFacilities: {
                  type: "boolean",
                  description: "Get information on nearby facilities"
                },
              }
            }
          },
        ]

        const SNS_COMMAND: Tool[] = [
          {
            name: "get_sns_mentions",
            description: "Get recent social media mentions",
            inputSchema: {
              type: "object",
              properties: {},
            }
          },
          {
            name: "get_sns_feeds",
            description: "Get recent social media posts from fellow travelers feeds",
            inputSchema: {
              type: "object",
              properties: {},
            }
          },
          {
            name: "post_sns_writer",
            description: "Post your recent travel experiences to social media for fellow travelers and readers.",
            inputSchema: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "A description of the journey. important: Do not use offensive language."
                }
              },
              required: ["message"]
            }
          },
          {
            name: "reply_sns_writer",
            description: "Write a reply to the article with the specified ID.",
            inputSchema: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "A description of the reply article. important: Do not use offensive language."
                },
                id: {
                  type: "string",
                  description: "The ID of the original post to which you want to add a reply."
                }
              },
              required: ["message", "id"]
            }
          },
        ]

        server.setRequestHandler(ListToolsRequestSchema, async () => {
          return await Effect.gen(function* () {
            if (env.isPractice) {
              return {
                tools: [
                  ...GET_LOCATION_COMMAND,
                  ...SETTING_COMMANDS,
                  ...START_STOP_COMMAND
                ]
              }
            } else {
              const basicToolsCommand: Tool[] = [
                {
                  name: env.personMode === 'second' ? "set_current_location" : "set_traveler_location",
                  description: env.personMode === 'second' ? "Set my current address" : "Set the traveler's current address",
                  inputSchema: {
                    type: "object",
                    properties: {
                      address: {
                        type: "string",
                        description: env.personMode === 'second' ? "address to set" : "address set to traveler"
                      }
                    },
                    required: ["address"]
                  }
                },
                {
                  name: env.personMode === 'second' ? "get_destination_address" : "get_traveler_destination_address",
                  description: env.personMode === 'second' ? "get a address of destination location" : "get a address of traveler's destination location",
                  inputSchema: {
                    type: "object",
                    properties: {}
                  }
                },
                {
                  name: env.personMode === 'second' ? "set_destination_address" : "set_traveler_destination_address",
                  description: env.personMode === 'second' ? "set a address of destination" : "set a address of traveler's destination",
                  inputSchema: {
                    type: "object",
                    properties: {
                      address: {
                        type: "string",
                        description: "address of destination"
                      }
                    },
                    required: ["address"]
                  }
                }]
              const cmd: Tool[] = []
              if (env.travelerExist) {
                cmd.push(
                  //  TODO tool change Notificationがきかないので一旦はずしておく
                  // {
                  //   name: "kick_traveler",  //  pythonがあったらよいとか、db設定がよいとか、tipsを取得する。tipsの取得を行うのはproject側スクリプトとか、script batchとか
                  //   description: "kick the traveler",
                  //   inputSchema: {
                  //     type: "object",
                  //     properties: {}
                  //   }
                  // },
                  ...basicToolsCommand,
                  ...GET_LOCATION_COMMAND,
                  ...SETTING_COMMANDS,
                  ...START_STOP_COMMAND)
                if (env.anySnsExist) {
                  cmd.push(...SNS_COMMAND)
                }
              } else {
                cmd.push({
                    name: "call_traveler",  //  pythonがあったらよいとか、db設定がよいとか、tipsを取得する。tipsの取得を行うのはproject側スクリプトとか、script batchとか
                    description: "call the traveler",
                    inputSchema: {
                      type: "object",
                      properties: {}
                    }
                  },
                )
              }
              return {tools: cmd}
            }

          }).pipe(Effect.runPromise)
        });

        server.setRequestHandler(CallToolRequestSchema, async (request) => {
          const toolSwitch = () => {
            switch (request.params.name) {
              case "tips":
                return tips().pipe(Effect.provide([StoryServiceLive, NodeFileSystem.layer]))
              // case "set_person_mode":
              //   return setPersonMode(String(request.params.arguments?.person)).pipe(Effect.provide([DbServiceLive,McpLogServiceLive]))
              case "get_traveler_info":
                return getTravelerInfo().pipe(
                  Effect.provide([DbServiceLive, McpLogServiceLive])
                )
              case "set_traveler_info":
                return setTravelerInfo(String(request.params.arguments?.settings)).pipe(
                  Effect.provide([DbServiceLive, McpLogServiceLive])
                )
              case "set_avatar_prompt":
                return setAvatarPrompt(String(request.params.arguments?.prompt)).pipe(
                  Effect.provide([DbServiceLive, McpLogServiceLive])
                )
              case "get_current_location_info":
              case "get_traveler_location_info":
                return getCurrentLocationInfo(request.params.arguments?.includePhoto as boolean, request.params.arguments?.includeNearbyFacilities as boolean)
              case "set_current_location":
              case "set_traveler_location":
                return setCurrentLocation(String(request.params.arguments?.address))
              case "get_destination_address":
              case "get_traveler_destination_address":
                return getDestinationAddress()
              case "set_destination_address":
              case "set_traveler_destination_address":
                return setDestinationAddress(String(request.params.arguments?.address))
              case "start_journey":
              case "start_traveler_journey":
                return startJourney()
              case "stop_journey":
              case "stop_traveler_journey":
                return stopJourney()
              case "call_traveler":
                return setTravelerExist(true).pipe(
                  Effect.provide([ McpLogServiceLive]))
              case "kick_traveler":
                return setTravelerExist(false).pipe(
                  Effect.provide([ McpLogServiceLive]))
              case "get_sns_mentions":
                return getSnsMentions().pipe(
                  Effect.provide([DbServiceLive, McpLogServiceLive])
                )
              case "read_sns_reader":
                return readSnsReader().pipe(
                  Effect.provide([DbServiceLive])
                )
              case "get_sns_feeds":
                return getSnsFeeds().pipe(
                  Effect.provide([DbServiceLive])
                )
              case "post_sns_writer":
                return postSnsWriter(String(request.params.arguments?.message)).pipe(
                  Effect.provide([DbServiceLive, McpLogServiceLive,ImageServiceLive])
                )
              case "reply_sns_writer":
                return replySnsWriter(String(request.params.arguments?.message), String(request.params.arguments?.id)).pipe(
                  Effect.provide([DbServiceLive, McpLogServiceLive])
                )
              default:
                return Effect.fail(new Error("Unknown tool"));
            }
          }

          return await toolSwitch().pipe(
            Effect.andThen(a => a as { content: ToolContentResponse[] }),
            Effect.catchIf(a => a instanceof AnswerError, e => {
              return Effect.succeed({
                content: [{
                  type: "text",
                  text: e.message
                }] as ToolContentResponse[]
              })
            }),
            Effect.catchAll(e => {
              return McpLogService.logError(`catch all:${e.toString()},${JSON.stringify(e)}`).pipe(Effect.as({
                content: [{
                  type: "text",
                  text: "Sorry,unknown system error."
                } as ToolContentResponse]
              }))
            }),
            Effect.provide([McpLogServiceLive,NodeFileSystem.layer]),
            Effect.runPromise)
        });

        const transport = new StdioServerTransport();
        return DbService.initSystemMode().pipe(Effect.andThen(() => Effect.tryPromise({
            try: () => {
              return server.connect(transport)
            },
            catch: error => {
              return new Error(`mcp server error:${error}`)
            }
          })),
          Effect.provide([DbServiceLive]))
      }

      function sendToolListChanged() {
        return Effect.tryPromise({
          try: () => server.sendToolListChanged(),
          catch: error => {
            //  MCPではstdoutは切られている
            McpLogService.logError(`sendToolListChanged error:${error}`)
            return new Error(`sendToolListChanged error:${error}`)
          }
        }).pipe(Effect.tap(() => McpLogService.log('sendToolListChanged put')))
      }

      function sendLoggingMessage(message: string, level = 'info') {
        return Effect.tryPromise({
          try: () => server.sendLoggingMessage({
            level: level as "info" | "error" | "debug" | "notice" | "warning" | "critical" | "alert" | "emergency",
            data: message,
          }),
          catch: error => {
            McpLogService.logError(`sendLoggingMessage catch:${error}`)
            return new Error(`sendLoggingMessage error:${error}`)
          }
        })
      }

      return {
        tips,
        run,
        sendLoggingMessage,
        setPersonMode,
        getTravelerInfo,
        setTravelerInfo,
        getCurrentLocationInfo,
        setCurrentLocation,
        getDestinationAddress,
        setDestinationAddress,
        startJourney,
        stopJourney,
        getSnsFeeds,
        getSnsMentions,
        replySnsWriter,
      }
    }
  )
}) {
}

export const McpServiceLive = McpService.Default
