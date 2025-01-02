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
import {DbService, DbServiceLive, env, PersonMode} from "./DbService.js";
import {StoryService, StoryServiceLive} from "./StoryService.js";
import {FetchHttpClient} from "@effect/platform";
import {ImageService, ImageServiceLive} from "./ImageService.js";
import {NodeFileSystem} from "@effect/platform-node";
import {McpLogService, McpLogServiceLive} from "./McpLogService.js";
import {AnswerError} from "./index.js";
import {SnsService, SnsServiceLive} from "./SnsService.js";
import * as Process from "node:process";
import {FeedViewPost} from "@atproto/api/dist/client/types/app/bsky/feed/defs.js";

//  Toolのcontentの定義だがzodから持ってくると重いのでここで定義
interface ToolContentResponse {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  resource?:any;
}

const feedTag = "#marble_square"
const feedUri = "at://did:plc:ygcsenazbvhyjmxeltz4fgw4/app.bsky.feed.generator/marble_square25"

const LabelGoogleMap = 'Google Map'
const LabelClaude = 'Claude'
let recentUseLabels:string[] = []
const labelImage = (aiGen:string) => {
  return aiGen === 'pixAi' ? 'PixAi': aiGen === 'sd' ? 'Stability.ai' : ''
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
      //  informationの文
      //  1. practiceモードであればそれを示す 解除にはGoogle map api keyが必要であることを示す
      //  2. dbパスを設定するとアプリを終了しても現在地と行き先が記録されることを示す
      //  2. 画像AIのkeyがなければ 画像API keyがあればアバターの姿を任意に作れることを示す
      //  3. pythonがインストールされていなければ pythonをインストールするとアバターの姿を合成できる
      //
      //  以下はランダムで表示
      //  - 画像AIのkeyがあってかつpromptを変更したことがなければ変更可能を案内する
      //  - snsアカウントがあればpostが出来ることを案内する
      //  - bsアカウントがあれば相互対話が出来ることを案内する
      //  - 二人称モードに切り替えると二人称会話で操作できる(ただし可能な限り)
      //  - リソースに詳細があるのでリソースを取り込むと話やすい。プロジェクトを起こしてある程度会話を調整できる
      const textList: string[] = []
      if (env.isPractice) {
        textList.push('Currently in practice mode. You can only go to fixed locations.' +
            ' To switch to normal mode, you need to obtain and set a Google Map API key.' +
            ' key for detail: https://developers.google.com/maps/documentation/streetview/get-api-key ' +
            ' Need Credentials: [Street View Static API],[Places API (New)],[Time Zone API]' +
            ' Please specify the API key in the configuration file(claude_desktop_config.json).' +
            '"env":["GoogleMapApi_key=(api key)"] example: "env":["GoogleMapApi_key=xxxxxxx"]' +
            ' And restart app. Claude Desktop App. Claude App may shrink into the taskbar, so please quit it completely.')
      } else {
        if (!env.dbFileExist) {
          textList.push('Since the database is not currently set, the configuration information will be lost when you exit.' +
              ' Please specify the path of the saved database file in the configuration file(claude_desktop_config.json).' +
              '"env":["sqlite_path=(filePath)"] example: "env":["sqlite_path=%HOMEPATH%/traveler.sqlite"]')
        } else {
          if (!env.anyImageAiExist) {
            textList.push('If you want to synthesize an avatar image, you will need a key for the image generation AI.' +
                ' Currently, PixAi and Stability AI\'s SDXL 1.0 API are supported.' +
                ' Please refer to the website of each company to obtain an API key.' +
                ' https://platform.stability.ai/docs/getting-started https://platform.stability.ai/account/keys ' +
                ' https://pixai.art/ https://platform.pixai.art/docs/getting-started/00---quickstart/ ' +
                ' Please specify the API key in the configuration file(claude_desktop_config.json).' +
                ' "env":["pixAi_key=(api key)"] or "env":["sd_key=(api key)"] ')
          }
          if (!env.pythonExist) {
            textList.push('In order to synthesize avatar images, your PC must be running Python.' +
                ' Please install Python on your PC using information from the Internet.')
          }
          //  基本動作状態
          //  TODO bsアカウントがあれば

        }

      }

      return Effect.succeed(
          {
            content: [{type: "text", text: textList.join('\n-------\n')} as ToolContentResponse]
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
      return RunnerService.getCurrentView(includePhoto && env.anyImageAiExist, includeNearbyFacilities, env.isPractice, localDebug).pipe(
          Effect.provide([McpLogServiceLive, MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive, FetchHttpClient.layer, ImageServiceLive, NodeFileSystem.layer]),
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
          // start: '',
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
          // epoch: 0,
          tilEndEpoch: 0, //  旅開始していない
          // duration: '',
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
        const dest = yield* DbService.getEnv('destination').pipe(Effect.orElseSucceed(() => undefined));
        if (dest) {
          const res = yield* RunnerService.setDestinationAddress(dest)
          setMessage.push(res.message)
        }
        // return address.value
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
          Effect.provide([MapServiceLive, StoryServiceLive, RunnerServiceLive, ImageServiceLive, NodeFileSystem.layer, McpLogServiceLive]),
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
            recentUseLabels= [LabelClaude]
            if (useAiImageGen) {
              recentUseLabels.push(labelImage(useAiImageGen))
            }
            return {
              content: [{type: "text", text: a.text}, {
                type: "image",
                data: a.image.toString("base64"),
                mimeType: 'image/png'
              }]
            };
          }),
          Effect.provide([MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive, FetchHttpClient.layer, ImageServiceLive, NodeFileSystem.layer, McpLogServiceLive]),
      )
    }
    const stopJourney = () => {
      recentUseLabels= [LabelClaude,LabelGoogleMap]
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
          Effect.andThen(a => sendToolListChanged()),
          Effect.andThen(a => {
            return ({
              content: [{
                type: "text",
                text: (callKick ? "traveler called" : "traveler kicked")
              } as ToolContentResponse]
            })
          })
      )
    }

    const getSnsMentions = () => {
      //  TODO 自身へのメンションしか受け付けない。特定タグに限る? 現在から一定期間しか読み取れない。最大件数がある。その他固定フィルタ機能を置く
      return Effect.succeed({
        content: [] as ToolContentResponse[]
      })
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
            const detectFeeds = a.feed.filter(v => v.post.author.handle !== Process.env.bs_handle)
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
                imageUri: im ? im[0].thumb as string: undefined
              });
            })
            const out = select.map(v => `author: ${v.authorHandle}\nbody: ${v.body}`).join('\n-----\n')
            const images = select.flatMap(v => v.imageUri ? [{uri:v.imageUri,handle:v.authorHandle}]:[])
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
            const c: ToolContentResponse[] =[{
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

    const postSnsWriter = (message: string, image?: any) => {
      //  特定タグを強制付加する 長すぎは強制的に切る 特定ライセンス記述を強制付加する その他固定フィルタ機能を置く
      const appendLicence = 'powered '+recentUseLabels.join(',')  //  追加ライセンスの文字列をclient LLMに制御させることは信頼できないので、直近の生成行為に対する文字列を強制付加する
      //  TODO 固定フィルタ
      return Effect.gen(function *() {
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
            return yield *McpLogService.log(message).pipe(Effect.andThen(() => noMes))
          }
          return yield *Effect.succeed(noMes)
        }
        const img = yield*ImageService.getRecentImageAndClear()
        yield *McpLogService.logTrace(`sns image:${img !== undefined}`)
        const imageData = img ? {
            buf: img,
            mime: "image/png"
          } :undefined
        return yield *SnsService.snsPost(message, `${appendLicence} ${feedTag} `, imageData).pipe(
            Effect.andThen(a => ({
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
        {
          name: "set_person_mode",  //  環境情報はリソースに反映する できれば更新イベントを出す
          description: "set a traveler's view mode. Third person or Second person.",
          inputSchema: {
            type: "object",
            properties: {
              person: {
                type: "string",
                enum: ["third_person", "second_person"],
                description: "traveler's view mode."
              },
            },
            required: ["person"]
          }
        },
        {
          name: "get_traveler_info",
          description: "get a traveler's setting.For example, traveler's name, the language traveler speak, Personality and speaking habits, etc.",
          inputSchema: {
            type: "object",
            properties: {
              settings: {
              },
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
              },
              image: {
                type: "string",
                description: "A image file of the journey scene. base64 png file encoded to string."
              }
            },
            required: ["message"]
          }
        },
      ]

      server.setRequestHandler(ListToolsRequestSchema, async () => {
        return await Effect.gen(function* () {
          // const exist =false// yield* Ref.get(travelerExist)
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
                  required: ["location"]
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
              cmd.push({
                    name: "kick_traveler",  //  pythonがあったらよいとか、db設定がよいとか、tipsを取得する。tipsの取得を行うのはproject側スクリプトとか、script batchとか
                    description: "kick the traveler",
                    inputSchema: {
                      type: "object",
                      properties: {}
                    }
                  },
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
        // console.log(`CallToolRequestSchema:`,request)
        const toolSwitch = () => {
          switch (request.params.name) {
            case "tips":
              return tips()
            case "set_person_mode":
              return setPersonMode(String(request.params.arguments?.person))
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
              return setTravelerExist(true)
            case "kick_traveler":
              return setTravelerExist(false)
            case "get_sns_mentions":
              return getSnsMentions()
            case "read_sns_reader":
              return readSnsReader()
            case "get_sns_feeds":
              return getSnsFeeds()
            case "post_sns_writer":
              const image = request.params.arguments?.image;
              return postSnsWriter(String(request.params.arguments?.message), image)
            default:
              return Effect.fail(new Error("Unknown tool"));
          }
        }

        // const x = toolSwitch()

        return await toolSwitch().pipe(
            Effect.andThen(a => a as { content: ToolContentResponse[] }),
            // Effect.provide([MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive, FetchHttpClient.layer, ImageServiceLive, NodeFileSystem.layer]),
            Effect.catchIf(a => a instanceof AnswerError, e => {
              return Effect.succeed({
                content: [{
                  type: "text",
                  text: e.message
                } as ToolContentResponse]
              })
            }),
            Effect.catchAll(e => {
              return McpLogService.logError(e).pipe(Effect.as({
                content: [{
                  type: "text",
                  text: "Sorry,unknown system error."
                } as ToolContentResponse]
              }))
            }),
            Effect.provide([MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive,
              FetchHttpClient.layer, ImageServiceLive, NodeFileSystem.layer, McpLogServiceLive]),
            Effect.runPromise)
        //   .catch(e => {
        //   logSync(e)
        //   // if (e instanceof AnswerError) {
        //   //   //  AnswerErrorで上げたものは想定エラー
        //   //   logSync(`AnsError:${e}`)
        //   //   return {
        //   //     content: [{
        //   //       type: "text",
        //   //       text: e.message
        //   //     } as ToolContentResponse]
        //   //   }
        //   // }
        //   throw e
        // }) //  Effect.provide([RunnerServiceLive]),
      });

      // console.log(initSystemMode)
      const transport = new StdioServerTransport();
      return DbService.initSystemMode().pipe(Effect.andThen(a => Effect.tryPromise({
            try: signal => {
              return server.connect(transport)
            },
            catch: error => {
              return new Error(`mcp server error:${error}`)
            }
          })),
          Effect.provide([DbServiceLive]))
    }

    /*
        function listRoots() {
          return Effect.tryPromise({
            try: signal => server.listRoots(),
            catch: error => {
              McpLogService.logError(`listRoots error:${error}`)
              return new Error(`listRoots error:${error}`)
            }
          })
        }
    */

    function sendToolListChanged() {
      return Effect.tryPromise({
        try: signal => server.sendToolListChanged(),
        catch: error => {
          //  MCPではsdtoutは切られている
          McpLogService.logError(`sendToolListChanged error:${error}`)
          return new Error(`sendToolListChanged error:${error}`)
        }
      }).pipe(Effect.tap(a => McpLogService.log('sendToolListChanged put')))
    }

    function sendLlmTask(message: string) {
      return Effect.tryPromise({
        try: signal => server.createMessage({
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: message
            }
          }],
          maxTokens: 100,
        }),
        catch: error => {
          //  MCPではsdtoutは切られている
          McpLogService.logError(`sendLlmTask catch:${error}`)
          return new Error(`sendLlmTask error:${error}`)
        }
      }) as Effect.Effect<any, void, never> //  TODO
    }

    function sendLoggingMessage(message: string, level = 'info') {
      return Effect.tryPromise({
        try: signal => server.sendLoggingMessage({
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
      env,
      run,
      sendLoggingMessage,
      tips,
      setPersonMode,
      setTravelerInfo,
      getCurrentLocationInfo,
      setCurrentLocation,
      getDestinationAddress,
      setDestinationAddress,
      startJourney,
      stopJourney,
      getSnsFeeds,
      sendLlmTask,
    }
  })
}) {
}

export const McpServiceLive = McpService.Default
