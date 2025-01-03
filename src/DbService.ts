import {Effect} from "effect";
import {drizzle} from 'drizzle-orm/libsql';
import {migrate} from 'drizzle-orm/libsql/migrator';
import {
  anniversary,
  avatar_model, avatar_sns, env_kv,
  run_history,
  run_status,
  runAvatar,
  sns_posts, SnsType
} from "./db/schema.js";
import {and, desc, eq, inArray, or} from "drizzle-orm";
import dayjs from "dayjs";
import 'dotenv/config'
import * as Process from "node:process";
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import * as path from "node:path";
import {logSync, McpLogService, McpLogServiceLive} from "./McpLogService.js";
import {findSystemPython} from "transparent-background/lib/utils.js";
import {practiceData} from "./RunnerService.js";
import {defaultBaseCharPrompt} from "./ImageService.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const __pwd = __dirname.endsWith('src') ? path.join(__dirname, '..') : path.join(__dirname, '../..')

export type RunStatus = typeof run_status.$inferSelect
export type RunStatusI = typeof run_status.$inferInsert
export type RunHistoryI = typeof run_history.$inferInsert

function expandPath(envPath: string) {
  return envPath.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, name) => process.env[name] || match)
      .replace(/%([a-zA-Z_][a-zA-Z0-9_]*)%/g, (match, name) => process.env[name] || match);
}

export function isValidFilePath(filePath:string) {
  try {
    const normalizedPath = path.normalize(filePath);
    const invalidChars = /[<>"|?*\x00-\x1F]/g;
    if (invalidChars.test(normalizedPath)) {
      return false;
    }
    return normalizedPath.length <= 260;
  } catch (error) {
    return false;
  }
}

export let dbPath = Process.env.sqlite_path && isValidFilePath(expandPath(Process.env.sqlite_path)) ?
    'file:' + path.normalize(expandPath(Process.env.sqlite_path)).replaceAll('\\', '/') : ':memory:'

const db = drizzle(dbPath);
logSync(`behind db:${dbPath}`)
logSync(`behind db1:${Process.env.sqlite_path && path.normalize(expandPath(Process.env.sqlite_path)).replaceAll('\\', '/')}`)

export type DbMode = 'memory' | 'file';
export type PersonMode = 'third' | 'second';

export const env: {
  travelerExist: boolean;
  dbMode: DbMode;
  dbFileExist: boolean;
  isPractice: boolean;
  gmKeyExist: boolean;
  anyImageAiExist: boolean;
  pythonExist: boolean;
  anySnsExist: boolean;
  personMode: PersonMode;
  promptChanged: boolean;
  noSnsPost: boolean;
  loggingMode: boolean;
} = {
  travelerExist: true, //  まだ動的ツール切り替えはClaude desktopに入っていない。。
  dbMode: 'memory',
  dbFileExist: false,
  isPractice: false,
  gmKeyExist: false,
  anyImageAiExist: false,
  pythonExist: false,
  anySnsExist: false,
  personMode: 'third',
  promptChanged: false,
  noSnsPost: false,
  loggingMode: false,
}

export class DbService extends Effect.Service<DbService>()("traveler/DbService", {
  accessors: true,
  effect: Effect.gen(function* () {

    const stub = <T>(qy: Promise<T>) => Effect.tryPromise({
      try: () => qy,
      catch: error => {
        return new Error(`${error},${JSON.stringify(qy[Symbol.toStringTag])}`);
      }
    })

    function init() {
      return Effect.gen(function* () {
        yield* stub(migrate(db, {migrationsFolder: path.join(__pwd, 'drizzle')}))  //  TODO migrationさせるにはmigrationフォルダを入れておかないといけないな。。。
        //  暫定のdb初期値
        const created = dayjs().toDate();
        yield* stub(db.select().from(avatar_model)).pipe(Effect.tap(a => {
              if (a.length === 0) {
                return stub(db.insert(avatar_model).values({
                  id: 1,
                  comment: '',
                  baseCharPrompt: defaultBaseCharPrompt,
                  created: created,
                  modelName: '',
                }).returning()).pipe(
                    Effect.andThen(a1 => a),
                    Effect.onError(cause => McpLogService.logError(`error init avatar:${cause}`)))
              }
            }),
            Effect.andThen(a => McpLogService.logTrace(`init avatar:${JSON.stringify(a)}`))
        )
        yield* stub(db.select().from(runAvatar)).pipe(Effect.tap(a => {
              if (a.length === 0) {
                return stub(db.insert(runAvatar).values({
                  name: 'traveler',
                  modelId: 1,
                  created: created,
                  enable: true,
                  nextStayTime: dayjs('9999-12-31').toDate(),
                  lang: 'JP',
                  currentRoute: ''
                } as typeof runAvatar.$inferInsert).returning()).pipe(
                    Effect.andThen(a1 => a),
                    Effect.onError(cause => McpLogService.logError(`error init avatar:${cause}`)))
              }
            }),
            Effect.andThen(a => McpLogService.logTrace(`init avatar:${JSON.stringify(a)}`))
        )
        yield* stub(db.select().from(avatar_sns)).pipe(Effect.tap(a => {
              if (a.length === 0 && Process.env.bs_id && Process.env.bs_pass && Process.env.bs_handle) {
                return stub(db.insert(avatar_sns).values({
                  assignAvatarId: 1,
                  snsType: "bs",
                  // usageType: "",
                  snsHandleName: Process.env.bs_handle,
                  snsId: Process.env.bs_id,
                  checkedPostId: '',
                  mentionPostId: '',
                  created: created,
                  // lang: '',
                  // configId: 1,
                  enable: true,
                }).returning()).pipe(  //  as typeof avatar_sns.$inferInsert
                    Effect.andThen(a1 => a),
                    Effect.onError(cause => McpLogService.logError(`init bs sns:${cause}`)))
              }
            }),
            Effect.andThen(a => McpLogService.logTrace(`init0:${JSON.stringify(a)}`))
        )
      })
    }

    /*
        function getAbroadRouteByCountryPair(country1: string, country2: string) {
          return stub(db.select().from(runAbroadRoute)
            .leftJoin(runTerminal, eq(runAbroadRoute.terminalStart, runTerminal.id))
            .leftJoin(runTerminal, eq(runAbroadRoute.terminalEnd, runTerminal.id)))//.pipe(Effect.provide(DbServiceLive))
        }
    */

    function updateRoute(avatarId: number, routeJson: string) {
      return stub(db.update(runAvatar).set({currentRoute: routeJson}).where(eq(runAvatar.id, avatarId)))
    }

    function getEnv(key: string) {
      return stub(db.select().from(env_kv).where(eq(env_kv.key, key))).pipe(
          Effect.andThen(takeOne),
          Effect.andThen(a => a.value))
    }

    function saveEnv(key: string, value: string) {
      const now = dayjs().toDate();
      const save = {
        key,
        value,
        created: now,
        updated: now
      }
      return stub(db.insert(env_kv).values(save).onConflictDoUpdate({
        target: env_kv.key,
        set: {
          key,
          value,
          updated: now
        }
      }).returning()).pipe(Effect.andThen(a => {
        if (a && Array.isArray(a) && a.length === 1) {
          return Effect.succeed(a[0])
        }
        return Effect.fail(new Error(`saveEnv fail:${run_status.id}`))
      }));
    }

    function getAvatar(avatarId: number) {
      //  初期化 もし未初期化ならavatar travelerを1つ登録する
      return stub(db.select().from(runAvatar).where(eq(runAvatar.id, avatarId))).pipe(Effect.andThen(takeOne))
    }

    /*
        function getAvatarInfo(avatarId: number) {
          return stub(db.select().from(avatar_model).where(eq(avatar_model.id, avatarId))).pipe(Effect.andThen(takeOne))
        }
    */

    const takeOne = <T>(list: T[]) => {
      return list.length === 1 ? Effect.succeed(list[0]) : Effect.fail(new Error(`no element`))
    }
    // const takeOneOption = <T>(list: T[]) => {
    //   return Effect.succeed(list.length === 1 ? Option.some(list[0]) : Option.none())
    // }


    function saveRunStatus(runStatus: RunStatusI) {
      const save = {
        ...runStatus,
        startTime: runStatus.startTime || dayjs().unix()
      }
      return stub(db.insert(run_status).values(save).onConflictDoUpdate({
        target: run_status.id,
        set: save
      }).returning()).pipe(Effect.andThen(a => {
        if (a && Array.isArray(a) && a.length === 1) {
          return Effect.succeed(a[0])
        }
        return Effect.fail(new Error(`saveRunStatus fail:${run_status.id}`))
      }));

    }

    function getAvatarModel(avatarId: number) {
      return stub(db.select().from(avatar_model).where(eq(avatar_model.id, avatarId))).pipe(Effect.andThen(takeOne))
    }

    function getTodayAnniversary(now: dayjs.Dayjs) {
      return stub(db.select().from(anniversary).where(
              and(eq(anniversary.del, false),
                  eq(anniversary.month, now.month() + 1),
                  eq(anniversary.day, now.date()),
                  or(eq(anniversary.year, now.year()),
                      eq(anniversary.year, 0)))
          )
      )
    }

    /*
        function getRunStatusByStatus(avatarId: number, status: TripStatus) {
          return stub(db.select().from(run_status).where(and(eq(run_status.status, status), eq(run_status.avatarId, avatarId))))
        }
    */

    function getRecentRunStatus(avatarId: number) {
      return stub(db.select().from(run_status).orderBy(desc(run_status.id))).pipe(Effect.andThen(takeOne))
    }

    function getEnvs(keys: string[]) {
      return stub(db.select().from(env_kv).where(inArray(env_kv.key, keys))).pipe(
          Effect.andThen(a => a.reduce((p, c) => {
            p[c.key] = c.value
            return p;
          }, {} as { [key: string]: string })))
    }

    /*
        function getHistory(tripId: number) {
          return stub(db.select().from(run_history).where(eq(run_history.tripId, tripId)))
        }
    */

    /**
     * 最新のヒストリ
     * 通常はテキストなしを意味する
     * @param avatarId
     */
    /*
        function getLastHistory(avatarId: number) {
          //  TODO historyに属性を付けてないので、開始ヒストリや計画ヒストリを除外するのにelapse=0を使ってみる あまりよくないけど。。。
          return stub(db.select().from(run_history).leftJoin(run_status, eq(run_history.tripId, run_status.tripId))
            .where(and(eq(run_status.avatarId, avatarId), ne(run_history.elapsed, 0))).orderBy(desc(run_history.seq))).pipe(
            Effect.andThen(a => {
              if (a.length <= 0) {
                return Effect.fail(`history relation error:${avatarId}`)
              }
              return Effect.succeed(a);
            }),
            Effect.andThen(takeOne))
        }
    */

    /**
     * 走行ヒストリーの保存
     * @param visit
     */

    /*
        function saveMiHistory(visit: RunHistoryI) {
          return stub(db.insert(run_history).values(visit).onConflictDoUpdate({
            target: run_history.seq,
            set: visit
          }).returning()).pipe(Effect.andThen(a => {
            if (a && Array.isArray(a) && a.length === 1) {
              return Effect.succeed(a[0])
            }
            return Effect.fail(`saveMiHistory fail:${run_history.seq}`)
          }));
        }
    */

    function saveSnsPost(snsPostId: string, sendUserId: string, postType = 0, snsType = 'bs') {
      return stub(db.insert(sns_posts).values({
        snsPostId,
        snsType,
        postType,
        sendUserId,
        createTime: dayjs().toDate(),
        del: false
      }).returning()).pipe(
          Effect.andThen(a => a.length === 1 ? Effect.succeed(a[0].id) : Effect.fail(new Error('saveSnsPost'))))
    }

    function updateSnsCursor(avatarId: number, snsType: SnsType, cursor: string) {
      return stub(db.update(avatar_sns).set({checkedPostId: cursor})
          .where(and(eq(avatar_sns.assignAvatarId, avatarId), eq(avatar_sns.snsType, snsType))).returning()).pipe(
          Effect.andThen(a =>
              a.length === 1 ? Effect.succeed(a[0].id) : Effect.fail(new Error('updateSnsCursor')))
      )
    }

    function updateBasePrompt(avatarId: number, prompt: string) {
      return stub(db.update(avatar_model).set({
        baseCharPrompt: prompt
      }).where(eq(avatar_model.id, avatarId)).returning()).pipe(
          Effect.andThen(a =>
              a.length === 1 ? Effect.succeed(a[0].baseCharPrompt) : Effect.fail(new Error('updateBasePrompt')))
      )
    }

    function practiceRunStatus(run = false) {
      return Effect.gen(function* () {
        const recent = yield* getRecentRunStatus(1).pipe(Effect.orElseSucceed(() => undefined))

        const practice = practiceData[Math.floor(Math.random() * practiceData.length)]

        const now = dayjs()
        const status = {
          id: 1,
          status: run ? "running" : "stop",
          startTime: now.toDate(),
          destination: "",
          from: recent?.to || 'Hakata,Fukuoka,Japan',
          to: practice.address,
          startLat: 0,
          startLng: 0,
          endLat: 0,
          endLng: 0,
          durationSec: 0,
          distanceM: 0,
          startTz: "Asia/Tokyo",
          tilEndEpoch: run ? practice.durationSec + now.unix() : 0,
          endTz: "Asia/Tokyo"
        } as RunStatus;
        yield* saveRunStatus(status)
        return status
      })

    }

    const initSystemMode = () => {
      //  TODO 主要なモード
      //  noTraveler: traveler未呼び出し
      //  memoryDb: メモリdbを使う
      //  noDb: dbファイルをまだ割り当てていない
      //  practice: 練習モード-固定パターンで動作する
      //  noGm: Google map api key未アサイン
      //  noImageAi: いずれかの画像AI key未アサイン
      //  noPython: pythonなしなので経路画像合成できない
      //  ThirdPerson/SecondPerson: 三人称モード/二人称モード
      //  noChangeBasePrompt: プロンプトを変えたことがない
      //  noSns:いずれかのsnsのアカウントがない
      //  noBlueSky: 対話用bsアカウントがない
      return Effect.gen(function* () {
        //  db有無の確認 dbサービスの初期化によって確認させる とコマンドon/off
        yield* init()
        if (dbPath !== ':memory:') {
          env.dbMode = "file"
          env.dbFileExist = true
        }
        yield* getEnv('travelerExist').pipe(
            Effect.andThen(a => {
              env.travelerExist = a !== ''
            }),
            Effect.orElseSucceed(() => {
              env.travelerExist = true // memoryモードで動くときはシンプルにコマンド存在にする
            }))
        const setting = yield* getEnvs(['isPractice', 'personMode', 'promptChanged'])

        //  Google Map APIがなければ強制的に練習モード ある場合は設定に従う
        if (!Process.env.GoogleMapApi_key) {
          env.isPractice = true
        } else {
          //  APIがあって設定不定なら通常モード
          env.isPractice = setting.isPractice === undefined ? false : setting.isPractice !== ''
          env.gmKeyExist = true
        }
        yield* saveEnv('isPractice', env.isPractice ? '1' : '')
        if (Process.env.sd_key || Process.env.pixAi_key) {
          env.anyImageAiExist = true
        }
        env.pythonExist = findSystemPython() !== null
        if ((Process.env.bs_id && Process.env.bs_pass && Process.env.bs_handle)) {
          env.anySnsExist = true
        }
        if (Process.env.no_sns_post) {
          env.noSnsPost = true
        }
        if (Process.env.ServerLog) {
          env.loggingMode = true
        }
        //  デフォルトは三人称モード
        env.personMode = !setting.personMode ? 'third' : setting.personMode as PersonMode;
        yield* saveEnv('personMode', env.personMode as string)

        env.promptChanged = !!setting.promptChanged
        yield* saveEnv('promptChanged', env.promptChanged ? '1' : '')

        if (env.isPractice) {
          yield* practiceRunStatus()
        }
        yield* McpLogService.logTrace(`initSystemMode end:${JSON.stringify(env)}`)
      })
    }

    return {
      init,
      initSystemMode,
      updateRoute,
      getAvatar,
      getAvatarModel,
      saveRunStatus,
      getTodayAnniversary,
      getRecentRunStatus,
      practiceRunStatus,
      saveSnsPost,
      updateSnsCursor,
      updateBasePrompt,
      getEnv,
      saveEnv,
    }
  }),
  dependencies: [McpLogServiceLive]  //  この様式で書くことでservice内のgen()内の変数が有効になるので、極力こちらで書く。。
}) {
}

export const DbServiceLive = DbService.Default
