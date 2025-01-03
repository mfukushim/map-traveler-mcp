import {Effect, Schedule} from "effect";
import {RichText} from '@atproto/api'
import {AtpAgent} from '@atproto/api'
import dayjs from "dayjs";
import * as Process from "node:process";
import {McpLogService} from "./McpLogService.js";
import {DbService} from "./DbService.js";


type SnsType = "bs" | "tw" | "md" | "sk";

const agent = new AtpAgent({service: 'https://bsky.social'})

let isLogin = false

export interface AtPubNotification {
  // clientId: number;
  mentionType: string;
  createdAt: string;
  name: string;
  handle: string;
  uri: string;
  cid: string;
  rootUri?: string;
  parentUri?: string;
  detectEpoch: number;
  // mentionDayDiff: number;
}

export class SnsService extends Effect.Service<SnsService>()("traveler/SnsService", {
  accessors: true,
  effect: Effect.gen(function* () {

        function reLogin() {
          return Effect.gen(function* () {
            if (!(Process.env.bs_id && Process.env.bs_pass && Process.env.bs_handle)) return yield* Effect.fail(new Error('no bs account'));
            if (isLogin) return yield* Effect.succeed(true);
            yield* Effect.tryPromise({
              try: signal => {
                return agent.login({
                  identifier: Process.env.bs_id || '',
                  password: Process.env.bs_pass || '',
                })
              }
              ,
              catch: error => new Error(`${error}`)
            }).pipe(Effect.tap(a => !a.success && Effect.fail(new Error("bs login fail"))),
                Effect.andThen(a => {
                  isLogin = true
                  return 'true'
                }));
          })
        }

        function uploadBlob(image: Buffer, mime = "image/png") {
          // const mime = mediaType === "webm" ? "image/webm" : mediaType === "gif" ? "image/gif" : mediaType === "jpeg" ? "image/jpeg" : "image/png"
          return Effect.tryPromise(signal => agent.uploadBlob(image, {encoding: mime,})).pipe(
              Effect.tap(a => !a.success && Effect.fail(new Error(`bs uploadBlob error:${a.headers}`))),
              Effect.andThen(a => a.data.blob)
          )
        }

        function bsPost(message: string, reply?: { uri: string; cid: string; }, image?: {
          buf: Buffer;
          mime: string;
        }) {
          const replyData = reply && {
            root: {
              uri: reply.uri,
              cid: reply.cid
            },
            parent: {
              uri: reply.uri,
              cid: reply.cid
            }
          }
          return reLogin().pipe(
              Effect.andThen(a => {
                const rt = new RichText({text: message})
                const post = {
                  $type: "app.bsky.feed.post",
                  text: rt.text,
                  facets: rt.facets || [],
                  createdAt: dayjs().toISOString(),
                }
                return Effect.tryPromise(signal => rt.detectFacets(agent)).pipe(Effect.andThen(a1 => Effect.succeed(post)))
              }),
              Effect.andThen(post => {
                return image ? uploadBlob(image.buf, image.mime).pipe(
                    Effect.andThen(blob => ({
                      $type: "app.bsky.embed.images",
                      images: [{
                        image: blob,
                        alt: ''
                      }]
                    })),
                    Effect.andThen(a => ({...post, embed: a}))
                ) : Effect.succeed(post);
              }),
              Effect.andThen(post => {
                // const p2 = imageBock ? ({...post,embed: imageBock}): post
                return replyData ? ({...post, reply: replyData}) : post
                // if (imageBock) {
                //   const post = {
                //     createdAt: dayjs().toISOString(),
                //     embed: imageBock,
                //   }
                //
                // } else {
                //   return Effect.succeed(replyData ? ({...post,reply: replyData}):post)
                // }
              }),
              Effect.andThen(a => {
                return Effect.tryPromise({
                  try: signal => agent.post(a),
                  catch: error => new Error(`${error}`)
                })
              }),
              Effect.tapError(e => McpLogService.logError(`bsPost ${e}`)),
              Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds"))))
          )
        }

    function getOwnProfile() {
      const bsHandle = Process.env.bs_handle
      if (!bsHandle) {
        return Effect.fail(new Error('no bs handle'))
      }
      return getProfile(Process.env.bs_handle!);
    }

    function getProfile(handle:string) {
      return reLogin().pipe(
          Effect.andThen(Effect.tryPromise(signal => agent.getProfile({actor: handle}))),
          Effect.tap(a => !a.success && Effect.fail(new Error('getProfile error'))),
          Effect.andThen(a => a.data));
    }

        function getActorLikes(handle: string) {
          return reLogin().pipe(
              Effect.andThen(Effect.tryPromise(signal => agent.getActorLikes({actor: handle}))),
              Effect.tap(a => !a.success && Effect.fail(new Error('getActorLikes error'))),
              Effect.retry(Schedule.recurs(2).pipe(Schedule.intersect(Schedule.spaced("10 seconds")))),
              Effect.andThen(a => a.data))
        }

        function getAuthorFeed(handle: string, length ?: number) {
          return reLogin().pipe(
              Effect.andThen(Effect.tryPromise(signal => agent.getAuthorFeed({
                actor: handle,
                filter: 'posts_no_replies',
                limit: length || 10,
              }))),
              Effect.tap(a => !a.success && Effect.fail(new Error('getActorLikes error'))),
              Effect.retry(Schedule.recurs(2).pipe(Schedule.intersect(Schedule.spaced("10 seconds")))),
              Effect.andThen(a => a.data))
        }

        function getFeed(feed: string, length ?: number, cursor?: string) {
          const params = cursor ? {
            feed: feed,
            cursor: cursor,
            limit: length || 10,
          } : {
            feed: feed,
            limit: length || 10,
          };
          return reLogin().pipe(
              Effect.andThen(Effect.tryPromise(signal => agent.app.bsky.feed.getFeed(params))),
              Effect.tap(a => !a.success && Effect.fail(new Error('getActorLikes error'))),
              Effect.retry(Schedule.recurs(2).pipe(Schedule.intersect(Schedule.spaced("10 seconds")))),
              Effect.andThen(a => a.data),
              Effect.tap(a => {
                DbService.updateSnsCursor(1, 'bs', a.cursor || '')
              })
          )
        }


        function getPost(uri: string) {
          return reLogin().pipe(
              Effect.andThen(Effect.tryPromise(signal => agent.getPosts({uris: [uri]}))),
              Effect.tap(a => !a.success && Effect.fail(new Error('getPost fail'))),
              Effect.retry(Schedule.recurs(2).pipe(Schedule.intersect(Schedule.spaced("10 seconds")))),
              Effect.andThen(a => a.data))
        }

        function snsPost(message: string, appendNeedText: string, image?: {
          buf: Buffer;
          mime: string;
        }) {
          const sliceLen = appendNeedText.length + 1
          return Effect.gen(function* () {
            const postIds: { snsType: SnsType; id: number }[] = []
            if (Process.env.bs_id && Process.env.bs_pass && Process.env.bs_handle) {
              const bsPostId = yield* bsPost(
                  [message.slice(0, 300 - sliceLen), appendNeedText].join('\n'), undefined, image); //  bsは300文字らしい
              postIds.push({
                snsType: 'bs',
                id: yield* DbService.saveSnsPost(JSON.stringify(bsPostId), Process.env.bs_handle)
              })
            }
            //  他sns
            return postIds
          })
        }

        function getNotification(seenAtEpoch?: number) { //  : Promise<AtPubNotification[]>
          return reLogin().pipe(
              Effect.andThen(Effect.tryPromise(signal => agent.listNotifications())),
              Effect.tap(a => !a.success && Effect.fail(new Error('getNotification fail'))),
              Effect.andThen(a => a.data.notifications),
              Effect.tap(a => McpLogService.logTrace(`notification num:${a.length}`)),
              Effect.andThen(a => {
                //  TODO 現時点はfollowは返すべき記事がいないので追加しない
                return a.filter(v=>(!seenAtEpoch || dayjs(v.indexedAt).unix() > seenAtEpoch) && v.reason !== "follow").
                    map(value=> {
                  if (value.reason === "reply") {
                    return {
                      // clientId: clientId,
                      uri: value.uri, //  reply記事そのもの
                      cid: value.cid,
                      rootUri: (value.record as any).reply.root.uri as string,  //  replyの起点記事
                      parentUri: (value.record as any).reply.parent.uri as string,  //  replyを付けた記事,
                      mentionType: value.reason as string,
                      name: value.author.displayName || value.author.handle,
                      handle: value.author.handle,
                      createdAt: (value.record as any).createdAt as string,
                      detectEpoch: dayjs(value.indexedAt).unix(),
                      // mentionDayDiff: diff
                    }
                  } else {
                    //  like
                    // const basePost = await this.getPost(clientId, uri);
                    // if (basePost) {
                    //   const baseCreated = dayjs(basePost.posts[0].indexedAt)
                    //   diff = dayjs(value.indexedAt).diff(baseCreated, "day")
                    // }
                    return {
                      // clientId: clientId,
                      uri: (value.record as any).subject.uri, //  likeそのものではなくその付けた元,
                      cid: (value.record as any).subject.cid,
                      mentionType: value.reason as string,
                      name: value.author.displayName || value.author.handle,
                      handle: value.author.handle,
                      createdAt: (value.record as any).createdAt as string,
                      detectEpoch: dayjs(value.indexedAt).unix(),
                      // mentionDayDiff: diff
                    }
                  }
                })
              })
          )

        }

        return {
          uploadBlob,
          bsPost,
          snsPost,
          getProfile,
          getOwnProfile,
          getActorLikes,
          getAuthorFeed,
          getNotification,
          getFeed,
          getPost
        }
      }
  )
}) {

}

export const SnsServiceLive = SnsService.Default
/*

    const getSnsList = (avatarId: number) => {
      return this.snsList.filter(value => value.assignAvatarId === avatarId)
    }
    this.snsList = await this.runStatusService.getAvatarSnsInfos();

    /!**
     * SNS書き込みライター一式生成
     * @param snsInfo
     * @param replySnsList
     * @param allMediaType
     * @private
     *!/
    function makeSnsWriter(snsInfo: AvatarSns[], replySnsList?: AvatarSns[], allMediaType = 'png'): {
      writer?: (text: string, media?: string, appendText?: string, appendMedia?: any, mediaType?: string) => Promise<{
        PostId?: string;
        appendId?: string;
        snsType: string;
        snsConfigId: number;
      }>,
        lng: string,
        snsType: string;
    }[] {
      return snsInfo.map(sns => {
        if (sns.snsType === 'tw') {
          return {
            snsType: sns.snsType,
            lng: sns.lang,
            writer: async (text: string, media?: string, appendText?: string, appendMedia?: any, mediaType?: string) => {
              let tweetRes
              let tweetResAppend
              if (media) {
                tweetRes = await this.twitterBotService.tweetWithMedia(text, media, sns.configId, mediaType || allMediaType); //  別Twitterアカウントへ移動
              } else {
                tweetRes = await this.twitterBotService.tweet(text, sns.configId);
              }
              //  回想
              if (tweetRes && tweetRes.data.id && appendText) {
                const replySns = (replySnsList ? replySnsList.find(value => value.snsType === 'tw') : undefined) || sns
                //  コメントツイートする まだtwitter関係保存がないものは過去画像を取れないか検討したが労力の割に効果が少ないと思うので
                await new Promise(resolve => setTimeout(resolve, 10 * 1000))
                tweetResAppend = await this.twitterBotService.tweetComment(tweetRes.data.id, appendText, replySns.configId);
              }
              return {
                PostId: tweetRes?.data.id,
                appendId: tweetResAppend?.data.id,
                snsType: sns.snsType,
                snsConfigId: sns.configId
              }
            }
          }
        } else if (sns.snsType === 'bs') {
          return {
            snsType: sns.snsType,
            lng: sns.lang,
            writer: async (text: string, media?: string, appendText?: string, appendMedia?: any, mediaType?: string) => {
              const ret = await this.atPubService.postPubState(sns.configId, text, media, {
                language: sns.lang,
                mediaType
              });
              //  回想
              if (appendText && ret) {
                const replySns = (replySnsList ? replySnsList.find(value => value.snsType === 'md') : undefined) || sns
                await new Promise(resolve => setTimeout(resolve, 10 * 1000))
                if (appendMedia) {
                  const embed = await this.atPubService.postMakeWebCardEmbed(replySns.configId, appendMedia.url, appendMedia.title, appendMedia.description, appendMedia.image, mediaType);
                  // const embed = await instance.makeWebCardEmbed("https:akibakokoubou.jp","テスト","テスト2");
                  const reply: ReplyRef = {
                    root: {
                      uri: ret.uri || '',
                      cid: ret.cid || ''
                    },
                    parent: {
                      uri: ret.uri || '',
                      cid: ret.cid || ''
                    }
                  }
                  const ret2 = await this.atPubService.postPub(replySns.configId, appendText, reply, embed);
                  // TODO ATの場合の引用には AT URIとCIDの2つのデータが必要らしい。従来と互換にするためには2つをセパレータでくっつける形にせざるを得ないかな。。。:から,に変更 uriに:があるから紛らわしいので。。。
                  return {
                    PostId: ret.uri + ',' + ret.cid,
                    appendId: ret2?.uri + ',' + ret2?.cid,
                    snsType: sns.snsType,
                    snsConfigId: sns.configId
                  }
                } else {
                  const ret2 = await this.atPubService.postPubState(replySns.configId, appendText, undefined, {
                    language: replySns.lang,
                    // replyId: ret.data.id
                    cid: ret.cid,
                    uri: ret.uri
                  });
                  // TODO ATの場合の引用には AT URIとCIDの2つのデータが必要らしい。従来と互換にするためには2つをセパレータでくっつける形にせざるを得ないかな。。。:から,に変更 uriに:があるから紛らわしいので。。。
                  return {
                    PostId: ret.uri + ',' + ret.cid,
                    appendId: ret2?.uri + ',' + ret2?.cid,
                    snsType: sns.snsType,
                    snsConfigId: sns.configId
                  }
                }
              }
              return {PostId: ret?.uri + ',' + ret?.cid, snsType: sns.snsType, snsConfigId: sns.configId}
            }
          }
        } else if (sns.snsType === 'md') {
          return {
            snsType: sns.snsType,
            lng: sns.lang,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            writer: async (text: string, media?: string, appendText?: string, appendMedia?: any, mediaType?: string) => {
              const ret = await this.activityPubService.postPubState(sns.configId, text, media, {
                language: sns.lang
              });
              //  回想
              if (appendText && ret?.status === 200 && ret?.data) {
                const replySns = (replySnsList ? replySnsList.find(value => value.snsType === 'md') : undefined) || sns
                await new Promise(resolve => setTimeout(resolve, 10 * 1000))
                const ret2 = await this.activityPubService.postPubState(replySns.configId, appendText, undefined, {
                  language: replySns.lang,
                  replyId: ret.data.id
                });
                return {PostId: ret.data.id, appendId: ret2?.data.id, snsType: sns.snsType, snsConfigId: sns.configId}
              }
              return {PostId: ret?.data.id, snsType: sns.snsType, snsConfigId: sns.configId}
            }
          }
        } else if (sns.snsType === 'sk') {
          return {
            snsType: sns.snsType,
            lng: sns.lang,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            writer: async (text: string, media?: string, appendText?: string, appendMedia?: any, mediaType?: string) => {
              const tx = text + (appendText ? `\n${appendText}` : '')
              let channel
              if (media) {
                channel = await this.slackService.postImage(tx, Buffer.from(media, "base64"));
              } else {
                channel = await this.slackService.postSisters(tx);
              }
              //  TODO リプライはまだ入れない というか slackにはreplyの概念がない
              return {PostId: channel, snsType: sns.snsType, snsConfigId: sns.configId}
            }
          }
        } else {
          return {snsType: '', lng: ''}
        }
      })
    }

    function makeBasicSnsWriter(snsInfo: AvatarSns[], mediaType = 'png'): {
      writer?: (text: string, media?: any, replyId?: string) => Promise<{
        PostId?: string;
        snsType: string;
        snsConfigId: number
      }>,
        lng: string,
        snsType: string;
    }[] {
      return snsInfo.map(sns => {
        if (sns.snsType === 'tw') {
          return {
            snsType: sns.snsType,
            lng: sns.lang,
            writer: async (text: string, media?: any, replyId?: string) => {
              let tweetRes
              if (replyId) {
                tweetRes = await this.twitterBotService.tweetComment(replyId, text, sns.configId);

              } else {
                if (media) {
                  tweetRes = await this.twitterBotService.tweetWithMedia(text, media, sns.configId, mediaType); //  別Twitterアカウントへ移動
                } else {
                  tweetRes = await this.twitterBotService.tweet(text, sns.configId);
                }
              }
              await new Promise(resolve => setTimeout(resolve, 10 * 1000))
              return {
                PostId: tweetRes?.data.id,
                snsType: sns.snsType,
                snsConfigId: sns.configId
              }
            }
          }
        } else if (sns.snsType === 'bs') {
          return {
            snsType: sns.snsType,
            lng: sns.lang,
            writer: async (text: string, media?: any, replyId?: string) => {
              if (replyId) {
                const rep = replyId.split(',');
                if (!media || typeof media === "string") {
                  const ret2 = await this.atPubService.replyPost(sns.configId, rep[0], rep[1], rep[2], rep[3], text, media);
                  return {
                    PostId: ret2?.uri + ',' + ret2?.cid + ',' + rep[2] + ',' + rep[3],
                    snsType: sns.snsType,
                    snsConfigId: sns.configId
                  }
                } else {
                  const embed = await this.atPubService.postMakeWebCardEmbed(sns.configId, media.url, media.title, media.description, media.image, mediaType);
                  const reply: ReplyRef = {
                    root: {uri: rep[2], cid: rep[3]},
                    parent: {uri: rep[0], cid: rep[1]}
                  }
                  const ret2 = await this.atPubService.postPub(sns.configId, text, reply, embed);
                  // TODO ATの場合の引用には AT URIとCIDの2つのデータが必要らしい。従来と互換にするためには2つをセパレータでくっつける形にせざるを得ないかな。。。:から,に変更 uriに:があるから紛らわしいので。。。
                  return {
                    PostId: ret2?.uri + ',' + ret2?.cid + ',' + rep[2] + ',' + rep[3],
                    snsType: sns.snsType,
                    snsConfigId: sns.configId
                  }
                }
              } else {
                const ret = await this.atPubService.postPubState(sns.configId, text, media, {
                  language: sns.lang
                });
                return {
                  PostId: ret?.uri + ',' + ret?.cid + ',' + ret?.uri + ',' + ret?.cid,
                  snsType: sns.snsType,
                  snsConfigId: sns.configId
                }
              }
            }
          }
        } else if (sns.snsType === 'md') {
          return {
            snsType: sns.snsType,
            lng: sns.lang,
            writer: async (text: string, media?: any, replyId?: string) => {
              if (replyId) {
                const ret = await this.activityPubService.replyPubState(sns.configId, replyId, text, media, {
                  language: sns.lang
                })
                return {PostId: ret?.data.id, snsType: sns.snsType, snsConfigId: sns.configId}
              } else {
                const ret = await this.activityPubService.postPubState(sns.configId, text, media, {
                  language: sns.lang
                });
                return {PostId: ret?.data.id, snsType: sns.snsType, snsConfigId: sns.configId}
              }
            }
          }
        } else if (sns.snsType === 'sk') {
          return {
            snsType: sns.snsType,
            lng: sns.lang,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            writer: async (text: string, media?: string, _replyId?: string) => {
              let channel
              if (media) {
                channel = await this.slackService.postImage(text, Buffer.from(media, "base64"));
              } else {
                channel = await this.slackService.postSisters(text);
              }
              //  TODO リプライはまだ入れない というか slackにはreplyの概念がない
              return {PostId: channel, snsType: sns.snsType, snsConfigId: sns.configId}
            }
          }
        } else {
          return {snsType: '', lng: ''}
        }
      })
    }

    /!**
     * 通常の3SNS+Slackに同時テキストポストをする
     *!/
    const broadcastSns = (text: string, slackOnly = false, forceTw = false) => {
      const hour = dayjs().tz('Japan').hour()
      return Effect.tryPromise(() => this.runStatusService.getAvatarSnsById(1)).pipe(
        Effect.andThen(a1 => {
          const writers = this.makeBasicSnsWriter(a1);
          if (writers) {
            return Effect.succeed(writers)
          }
          return Effect.fail(new Error('writer error'))
        }),
        Effect.andThen(a1 => {
          return Effect.all(a1.map(w => {
              if (w.writer && (w.snsType === "sk" || !slackOnly)) {
                if (hour >= 6 && hour <= 18 || w.snsType !== 'tw' || forceTw) {
                  //  現状 絵日記は twitterは6時～19時のみの書き出しにする
                  const f = w.writer  //  TODO w.writerが undefinedと誤認する
                  return Effect.tryPromise(() => f(text))
                }
                return Effect.succeed({PostId: '', snsType: '', snsConfigId: -1})
              } else {
                return Effect.fail(new Error())
              }
            }
          ));
        }),
        Effect.andThen(a1 => a1.every(a1 => a1.PostId) ? "post all" : "post some"));
    }

    function sendSnsByMultiChatBlocks(talk: AiBlock[], localDebug = false) {
      const avatarSnsList = await this.getSnsList()
      for (const aiBlock of talk) {
        const thread = aiBlock.getThread();
        const avatarId = thread?.avatarId === "mar" ? 4 : MiRunnerAiService.avatarIdToThread.find(value => value.th === thread?.avatarId)?.id

        const header = `${thread?.avatarId}:\n`
        // const info = this.miRunnerService.avatarList.find(value => value.name === talkElement.name) || this.miRunnerService.marAvatar;
        const useTechNames = thread?.avatarId === "mar" ? [] : [
          StringUtils.makeLicenseLlm(aiBlock.mode.temporaryLlm || thread?.mode.llm || "none")
        ];
        const licenceText = thread?.avatarId === "mar" ? '' : StringUtils.makeLicenceText2(useTechNames)
        const outMes = [
          {
            snsType: 'sk',
            lang: "ja", //  この目的では日本語固定
            text: StringUtils.makeSnsText(1000, false, header, aiBlock.aiStatement || '', licenceText)
          },
          {
            snsType: 'md',
            lang: "ja", //  この目的では日本語固定
            text: StringUtils.makeSnsText(ActivityPubService.maxPostLength, false, header, aiBlock.aiStatement || '', licenceText)
          },
          {
            snsType: 'bs',
            lang: "ja", //  この目的では日本語固定
            text: StringUtils.makeSnsText(AtPubService.maxPostLength, false, header, aiBlock.aiStatement || '', licenceText)
          },
        ]
        const hour = dayjs().hour();
        if (hour >= 6 && hour <= 18) {
          //  現状 絵日記は twitterは6時～19時のみの書き出しにする
          outMes.push({
              snsType: 'tw',
              lang: "ja", //  この目的では日本語固定
              text: StringUtils.makeSnsText(TwitterBotService.maxTwitterLength, true, header, aiBlock.aiStatement || '', licenceText)
            },
          )
        }
        //  TODO marのidを決め打ち。。
        const snsList = avatarSnsList.filter(value => value.assignAvatarId === avatarId)
        // const snsList = info.id === 4 ? await this.runStatusService.getAvatarSnsById(info.id) : this.miRunnerService.getSnsList(info.id);  //  TODO 安定したらavatar一括で初期化で作って置いてよい
        const makeSnsWriter = this.makeBasicSnsWriter(snsList);
        console.log('sendSnsByMultiChatBlocks:', outMes)
        for (const outMe of outMes) {
          //  TODO いまは言語縛りしない 筋としてはavatar_snsにen,jaの両方の定義があるべきが筋
          const find = makeSnsWriter.find(value => value.snsType === outMe.snsType);
          console.log('find:', find)
          // const find = makeSnsWriter.find(value => value.snsType === outMe.snsType && value.lng === outMe.lang);
          const prevId = this.currentSnsThread.get(outMe.snsType);
          console.log('prevId:', prevId)
          if (find && find.writer) {
            if (localDebug && find.snsType !== "sk") {
              //  ログのみ
              console.log('makeOutdoorDiscussion out:', find.snsType, outMe.text)
            } else {
              const postInfo = await find.writer(outMe.text, undefined, prevId);
              console.log('postInfo:', postInfo)
              if (postInfo.PostId) {
                this.currentSnsThread.set(outMe.snsType, postInfo.PostId);
              }
              await new Promise(resolve => setTimeout(resolve, 10 * 1000));
            }
          }
        }
      }

    }

    return {
    }
  })
  }){

}

*/
