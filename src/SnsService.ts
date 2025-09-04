/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import {Effect, Schedule} from "effect";
import {RichText} from '@atproto/api'
import {AtpAgent} from '@atproto/api'
import dayjs from "dayjs";
import {McpLogService} from "./McpLogService.js";
import {DbService} from "./DbService.js";
import {AnswerError} from "./mapTraveler.js";


type SnsType = "bs" | "tw" | "md" | "sk";



const agent = new AtpAgent({service: 'https://bsky.social'})

let isLogin = false

export interface AtPubNotification {
  mentionType: string;
  createdAt: string;
  name: string;
  handle: string;
  uri: string;
  cid: string;
  rootUri?: string;
  parentUri?: string;
  detectEpoch: number;
}

export class SnsService extends Effect.Service<SnsService>()("traveler/SnsService", {
  accessors: true,
  effect: Effect.gen(function* () {

      function reLogin() {
        return Effect.gen(function* () {
          const runnerEnv = yield *DbService.getSysEnv()
          if (!(runnerEnv.bs_id && runnerEnv.bs_pass && runnerEnv.bs_handle)) return yield* Effect.fail(new AnswerError('no bluesky account'));
          if (isLogin) return yield* Effect.succeed(true);
          yield* Effect.tryPromise({
            try: () => {
              return agent.login({
                identifier: runnerEnv.bs_id || '',
                password: runnerEnv.bs_pass || '',
              })
            },
            catch: error => new Error(`${error}`)
          }).pipe(Effect.tap(a => !a.success && Effect.fail(new Error("bs login fail"))),
            Effect.andThen(() => {
              isLogin = true
              return 'true'
            }),
            Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds"))))
          );
        })
      }

      function uploadBlob(image: Buffer, mime = "image/png") {
        return Effect.tryPromise(() => agent.uploadBlob(image, {encoding: mime,})).pipe(
          Effect.tap(a => !a.success && Effect.fail(new Error(`bs uploadBlob error:${a.headers}`))),
          Effect.andThen(a => a.data.blob),
          Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds"))))
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
          Effect.andThen(() => {
            const rt = new RichText({text: message})
            return Effect.tryPromise(() => rt.detectFacets(agent)).pipe(Effect.andThen(() => {
              const post = {
                $type: "app.bsky.feed.post",
                text: rt.text,
                facets: rt.facets || [],
                createdAt: dayjs().toISOString(),
              }
              return Effect.succeed(post);
            }))
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
            return replyData ? ({...post, reply: replyData}) : post
          }),
          Effect.andThen(a => {
            return Effect.tryPromise({
              try: () => agent.post(a),
              catch: error => new Error(`${error}`)
            })
          }),
          Effect.tapError(e => McpLogService.logError(`bsPost ${e}`)),
          Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds"))))
        )
      }

      function addBsLike(uri: string, cid: string) {
        return reLogin().pipe(
          Effect.andThen(() => {
            return Effect.tryPromise({
              try: () => agent.like(uri, cid),
              catch: error => new Error(`${error}`)
            })
          }),
          Effect.tapError(e => McpLogService.logError(`addBsLike ${e}`)),
          Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds"))))
        )
      }

      function getOwnProfile() {
        return Effect.gen(function *() {
          const runnerEnv = yield *DbService.getSysEnv()
          return runnerEnv.bs_handle ? yield *getProfile(runnerEnv.bs_handle!) : yield *Effect.fail(new Error('no bs handle'));
        })
      }

      function getProfile(handle: string) {
        return reLogin().pipe(
          Effect.andThen(Effect.tryPromise(() => agent.getProfile({actor: handle}))),
          Effect.tap(a => !a.success && Effect.fail(new Error('getProfile error'))),
          Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds")))),
          Effect.andThen(a => a.data));
      }

      function getActorLikes(handle: string) {
        return reLogin().pipe(
          Effect.andThen(Effect.tryPromise(() => agent.getActorLikes({actor: handle}))),
          Effect.tap(a => !a.success && Effect.fail(new Error('getActorLikes error'))),
          Effect.retry(Schedule.recurs(2).pipe(Schedule.intersect(Schedule.spaced("10 seconds")))),
          Effect.andThen(a => a.data))
      }

      function getAuthorFeed(handle: string, length ?: number) {
        return reLogin().pipe(
          Effect.andThen(Effect.tryPromise(() => agent.getAuthorFeed({
            actor: handle,
            filter: 'posts_no_replies',
            limit: length || 10,
          }))),
          Effect.tap(a => !a.success && Effect.fail(new Error('getActorLikes error'))),
          Effect.retry(Schedule.recurs(2).pipe(Schedule.intersect(Schedule.spaced("10 seconds")))),
          Effect.andThen(a => a.data))
      }

    function getFeed(feed: string, length ?: number) {
      return Effect.gen(function* () {
        yield* reLogin()
        const runnerEnv = yield *DbService.getSysEnv()
        const snsInfo = yield* DbService.getAvatarSns(1, 'bs')
        yield* McpLogService.logTrace(`getFeed:feedSeenAt:${dayjs.unix(snsInfo.feedSeenAt).toISOString()}`)
        const feedData = yield* Effect.tryPromise(() => agent.app.bsky.feed.getFeed({
          feed: feed,
          limit: length || 10
        })).pipe(
          Effect.tap(a => !a.success && Effect.fail(new Error('getFeed error'))),
          Effect.tap(a => a.data.feed.map(v => McpLogService.logTrace(`getFeed post:${dayjs(v.post.indexedAt).toISOString()}`))),
          Effect.andThen(a => {
            return a.data.feed.filter(v => (dayjs(v.post.indexedAt).unix() > snsInfo.feedSeenAt) && v.post.author.handle !== runnerEnv.bs_handle)
          }),
          Effect.retry(Schedule.recurs(2).pipe(Schedule.intersect(Schedule.spaced("10 seconds"))))
        )
        const max = feedData.reduce((p, c) => Math.max(p, dayjs(c.post.indexedAt).unix()), snsInfo.feedSeenAt)
        yield* DbService.updateSnsFeedSeenAt(1, 'bs', max)
        return feedData
      })
    }

    function searchPosts(query: string, length ?: number) {
      return Effect.gen(function* () {
        yield* reLogin()
        const runnerEnv = yield *DbService.getSysEnv()
        const snsInfo = yield* DbService.getAvatarSns(1, 'bs')
        yield* McpLogService.logTrace(`searchPosts:feedSeenAt:${dayjs.unix(snsInfo.feedSeenAt).toISOString()}`)
        const feedData = yield* Effect.tryPromise(() => agent.app.bsky.feed.searchPosts({
          q: query,
          limit: length || 10
        })).pipe(
          Effect.tap(a => !a.success && Effect.fail(new Error('getFeed error'))),
          Effect.tap(a => a.data.posts.map(v => McpLogService.logTrace(`getFeed post:${dayjs(v.indexedAt).toISOString()}`))),
          Effect.andThen(a => {
            return a.data.posts.filter(v => (dayjs(v.indexedAt).unix() > snsInfo.feedSeenAt) && v.author.handle !== runnerEnv.bs_handle)
          }),
          Effect.retry(Schedule.recurs(2).pipe(Schedule.intersect(Schedule.spaced("10 seconds"))))
        )
        const max = feedData.reduce((p, c) => Math.max(p, dayjs(c.indexedAt).unix()), snsInfo.feedSeenAt)
        yield* DbService.updateSnsFeedSeenAt(1, 'bs', max)
        return feedData
      })
    }


      function getPost(uri: string) {
        return reLogin().pipe(
          Effect.andThen(Effect.tryPromise(() => agent.getPosts({uris: [uri]}))),
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
          const runnerEnv = yield *DbService.getSysEnv()
          yield* reLogin()
          const bsPostId = yield* bsPost(
            [message.slice(0, 300 - sliceLen), appendNeedText].join('\n'), undefined, image); //  bsは300文字らしい
          postIds.push({
            snsType: 'bs',
            id: yield* DbService.saveSnsPost(JSON.stringify(bsPostId), runnerEnv.bs_handle!)
          })
          //  TODO 他sns
          return postIds
        })
      }

      function snsReply(message: string, appendNeedText: string, replyId: string,image?: {
        buf: Buffer;
        mime: string;
      }) {
        const sliceLen = appendNeedText.length + 1
        return Effect.gen(function* () {
          const postIds: { snsType: SnsType; id: number }[] = []
          const runnerEnv = yield *DbService.getSysEnv()
          yield* reLogin()
          const split = replyId.split('-');
          const bsPostId = yield* bsPost(
            [message.slice(0, 300 - sliceLen), appendNeedText].join('\n'), {uri: split[0], cid: split[1]},image); //  bsは300文字らしい
          postIds.push({
            snsType: 'bs',
            id: yield* DbService.saveSnsPost(JSON.stringify(bsPostId), runnerEnv.bs_handle!)
          })
          //  当面はbsのみ
          return postIds
        })
      }

      function addLike(id:string) {
        const split = id.split('-');
        return addBsLike(split[0],split[1]).pipe(Effect.andThen(a => {
          return Effect.gen(function *() {
            const runnerEnv = yield *DbService.getSysEnv()
            return yield *DbService.saveSnsPost(JSON.stringify(a), runnerEnv.bs_handle!);
          })
        }))
      }

      function getNotification(seenAtEpoch?: number,limit=50) {
        return Effect.gen(function* () {
          yield* reLogin()
          const snsInfo = yield* DbService.getAvatarSns(1, 'bs')
          const notification = yield* Effect.tryPromise(() => agent.listNotifications({limit})).pipe(
            Effect.tap(a => !a.success && Effect.fail(new Error('getNotification fail'))),
            Effect.tap(a => McpLogService.logTrace(`notification num:${a.data.length}`)),
            Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds")))),
          )
          const max = notification.data.notifications.reduce((p, c) => Math.max(p, dayjs(c.indexedAt).unix()), snsInfo.mentionSeenAt)
          yield* DbService.updateSnsMentionSeenAt(1, 'bs', max)
          const runnerEnv = yield *DbService.getSysEnv()

          const seedEpoch = seenAtEpoch || snsInfo.mentionSeenAt
          //  TODO 現状 followは外す
          return notification.data.notifications.filter(v => (dayjs(v.indexedAt).unix() > seedEpoch && v.reason !== "follow") && v.author.handle !== runnerEnv.bs_handle).map(value => {
            if (value.reason === "reply") {
              return {
                uri: value.uri, //  reply記事そのもの
                cid: value.cid,
                rootUri: (value.record as any).reply.root.uri as string,  //  replyの起点記事
                parentUri: (value.record as any).reply.parent.uri as string,  //  replyを付けた記事,
                mentionType: value.reason as string,
                name: value.author.displayName || value.author.handle,
                handle: value.author.handle,
                createdAt: (value.record as any).createdAt as string,
                detectEpoch: dayjs(value.indexedAt).unix(),
              }
            } else {
              //  like
              return {
                uri: (value.record as any).subject.uri, //  likeそのものではなくその付けた元,
                cid: (value.record as any).subject.cid,
                mentionType: value.reason as string,
                name: value.author.displayName || value.author.handle,
                handle: value.author.handle,
                createdAt: (value.record as any).createdAt as string,
                detectEpoch: dayjs(value.indexedAt).unix(),
              }
            }
          })
        })
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
        getPost,
        searchPosts,
        snsReply,
        addLike
      }
    }
  )
}) {
}

export const SnsServiceLive = SnsService.Default
