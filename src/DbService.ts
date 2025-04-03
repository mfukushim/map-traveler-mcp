/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import {Effect, Layer, Option} from "effect";
import {drizzle} from 'drizzle-orm/libsql';
import {migrate} from 'drizzle-orm/libsql/migrator';
import {anniversary, avatar_model, avatar_sns, env_kv, run_status, runAvatar, sns_posts, SnsType} from "./db/schema.js";
import {and, desc, eq, inArray, or} from "drizzle-orm";
import dayjs from "dayjs";
import 'dotenv/config'
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import * as path from "node:path";
import {logSync, McpLogService, McpLogServiceLive} from "./McpLogService.js";
import {practiceData} from "./RunnerService.js";
import {defaultBaseCharPrompt} from "./ImageService.js";
import * as fs from "node:fs";
import {
  bs_handle,
  bs_id,
  bs_pass, comfy_params,
  comfy_url, comfy_workflow_i2i, comfy_workflow_t2i, filter_tools, fixed_model_prompt,
  GoogleMapApi_key,
  mapApi_url, moveMode, no_sns_post,
  pixAi_key, rembg_path, rembgPath, remBgUrl,
  sd_key, ServerLog,
  sqlite_path
} from "./EnvUtils.js";



const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const __pwd = __dirname.endsWith('src') ? path.join(__dirname, '..') : path.join(__dirname, '../..')

export type RunStatus = typeof run_status.$inferSelect
export type RunStatusI = typeof run_status.$inferInsert

function expandPath(envPath: string) {
  return envPath.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, name) => process.env[name] || match)
    .replace(/%([a-zA-Z_][a-zA-Z0-9_]*)%/g, (match, name) => process.env[name] || match);
}

export function isValidFilePath(filePath: string) {
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

export const dbPath = sqlite_path && isValidFilePath(expandPath(sqlite_path)) ?
  'file:' + path.normalize(expandPath(sqlite_path)).replaceAll('\\', '/') : ':memory:'

const db = drizzle(dbPath);
// logSync(`db path:${dbPath}`)

export type DbMode = 'memory' | 'file';
export type PersonMode = 'third' | 'second';
export type MoveMode = 'realtime' | 'skip';
const MapEndpoint = ['directions', 'places', 'timezone', 'svMeta', 'streetView', 'nearby'] as const;
export type MapEndpoint = (typeof MapEndpoint)[number];


export const env = {
  travelerExist: true, //  まだ動的ツール切り替えはClaude desktopに入っていない。。
  dbMode: 'memory' as DbMode,
  dbFileExist: false,
  isPractice: false,
  anyImageAiExist: false,
  anySnsExist: false,
  personMode: 'third' as PersonMode,
  fixedModelPrompt: false,
  promptChanged: false,
  noSnsPost: false,
  moveMode: 'realtime' as MoveMode,
  remBgUrl: undefined as string | undefined,
  rembgPath: undefined as string | undefined,
  loggingMode: false,
  filterTools: [] as string[],
  progressToken: undefined as string | number | undefined,
  mapApis: new Map<MapEndpoint, string>(),
}

export const scriptTables = new Map<string, { script: any, nodeNameToId: Map<string, number> }>();


export class DbService extends Effect.Service<DbService>()("traveler/DbService", {
  accessors: true,
  effect: Effect.gen(function* () {

    const stub = <T>(qy: Promise<T>) => Effect.tryPromise({
      try: () => qy,
      catch: error => {
        return new Error(`${error}`);
      }
    })

    function init() {
      return Effect.gen(function* () {
        yield* stub(migrate(db, {migrationsFolder: path.join(__pwd, 'drizzle')}))
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
                Effect.onError(cause => McpLogService.logError(`error init avatar:${cause}`)))
            }
          }),
          Effect.andThen(a => McpLogService.logTrace(`init avatar:${JSON.stringify(a)}`))
        )
        yield* stub(db.select().from(avatar_sns)).pipe(Effect.tap(a => {
            if (a.length === 0 && bs_id && bs_pass && bs_handle) {
              return stub(db.insert(avatar_sns).values({
                assignAvatarId: 1,
                snsType: "bs",
                snsHandleName: bs_handle,
                snsId: bs_id,
                feedSeenAt: 0,
                mentionSeenAt: 0,
                created: created,
                enable: true,
              }).returning()).pipe(
                Effect.onError(cause => McpLogService.logError(`init bs sns:${cause}`)))
            }
          }),
          Effect.andThen(a => McpLogService.logTrace(`init0:${JSON.stringify(a)}`))
        )
        yield* stub(db.select().from(run_status)).pipe(Effect.tap(a => {
          if (a.length === 0) {
            return saveRunStatus({
              id: 1,  // 1レコードにする
              status: 'stop',
              from: '',
              to: '',
              destination: null,
              startLat: 0,
              startLng: 0,
              endLat: 0,  //  最後のrunStatusが現在位置
              endLng: 0,
              durationSec: 0,
              distanceM: 0,
              avatarId: 1,
              tripId: 0,
              tilEndEpoch: 0, //  旅開始していない
              startTime: new Date(0),  //  旅開始していない
              endTime: new Date(0), //  開始位置再設定の場合は0にする
              startCountry: '',
              endCountry: '',
              startTz: '',
              endTz: '',
              currentPathNo: -1,
              currentStepNo: -1,
            })
          }
        }))
      })
    }

    function updateRoute(avatarId: number, routeJson: string) {
      return stub(db.update(runAvatar).set({currentRoute: routeJson}).where(eq(runAvatar.id, avatarId)))
    }

    function getEnv(key: string) {
      return stub(db.select().from(env_kv).where(eq(env_kv.key, key))).pipe(
        Effect.andThen(takeOne),
        Effect.andThen(a => a.value))
    }

    function getEnvOption(key: string) {
      return stub(db.select().from(env_kv).where(eq(env_kv.key, key))).pipe(
        Effect.map(a => a.length === 1 && a[0].value ? Option.some(a[0].value) : Option.none()),
        Effect.orElseSucceed(() => Option.none<string>()),
      )
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
      }).returning()).pipe(Effect.andThen(a =>
        a && Array.isArray(a) && a.length === 1 ? Effect.succeed(a[0]) : Effect.fail(new Error(`saveEnv fail:${run_status.id}`))));
    }

    function getAvatar(avatarId: number) {
      //  初期化 もし未初期化ならavatar travelerを1つ登録する
      return stub(db.select().from(runAvatar).where(eq(runAvatar.id, avatarId))).pipe(Effect.andThen(takeOne))
    }

    const takeOne = <T>(list: T[]) => {
      return list.length === 1 ? Effect.succeed(list[0]) : Effect.fail(new Error(`no element`))
    }

    function saveRunStatus(runStatus: RunStatusI) {
      const save = {
        ...runStatus,
        startTime: runStatus.startTime || dayjs().unix()
      }
      return stub(db.insert(run_status).values(save).onConflictDoUpdate({
        target: run_status.id,
        set: save
      }).returning()).pipe(Effect.andThen(a =>
        a && Array.isArray(a) && a.length === 1 ? Effect.succeed(a[0]) : Effect.fail(new Error(`saveRunStatus fail:${run_status.id}`))));
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

    function getRecentRunStatus() {
      return stub(db.select().from(run_status).orderBy(desc(run_status.id))).pipe(Effect.andThen(takeOne))
    }

    function getEnvs(keys: string[]) {
      return stub(db.select().from(env_kv).where(inArray(env_kv.key, keys))).pipe(
        Effect.andThen(a => a.reduce((p, c) => {
          p[c.key] = c.value
          return p;
        }, {} as { [key: string]: string })))
    }

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

    function getAvatarSns(avatarId: number, snsType: SnsType) {
      return stub(db.select().from(avatar_sns).where(and(eq(avatar_sns.assignAvatarId, avatarId), eq(avatar_sns.snsType, snsType)))).pipe(Effect.andThen(takeOne))
    }

    function updateSnsFeedSeenAt(avatarId: number, snsType: SnsType, timeEpoch: number) {
      return stub(db.update(avatar_sns).set({feedSeenAt: timeEpoch})
        .where(and(eq(avatar_sns.assignAvatarId, avatarId), eq(avatar_sns.snsType, snsType))).returning()).pipe(
        Effect.andThen(a =>
          a.length === 1 ? Effect.succeed(a[0]) : Effect.fail(new Error('updateSnsFeedSeenAt'))),
        Effect.tap(a => McpLogService.logTrace(`update feedSeenAt:${a.feedSeenAt}`)),
      )
    }

    function updateSnsMentionSeenAt(avatarId: number, snsType: SnsType, timeEpoch: number) {
      return stub(db.update(avatar_sns).set({mentionSeenAt: timeEpoch})
        .where(and(eq(avatar_sns.assignAvatarId, avatarId), eq(avatar_sns.snsType, snsType))).returning()).pipe(
        Effect.andThen(a =>
          a.length === 1 ? Effect.succeed(a[0]) : Effect.fail(new Error('updateSnsMentionSeenAt'))),
        Effect.tap(a => McpLogService.logTrace(`update mentionSeenAt:${a.mentionSeenAt}`)),
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
        const recent = yield* getRecentRunStatus().pipe(Effect.orElseSucceed(() => undefined))
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

    const getVersion = () => {
      const packageJsonPath = path.resolve(__pwd, 'package.json');
      return Effect.async<string, Error>((resume) => {
        fs.readFile(packageJsonPath, {encoding: "utf8"}, (err, data) => {
          if (err) resume(Effect.fail(err))
          else resume(Effect.succeed(data));
        });
      }).pipe(Effect.andThen(a => JSON.parse(a).version as string))
    }

    const initSystemMode = () => {
      //  主要なモード
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
      //  filterTools: 使うツールのフィルタ undefinedなら可能なすべて
      return Effect.gen(function* () {
        //  db有無の確認 dbサービスの初期化によって確認させる とコマンドon/off
        yield* init()
        env.progressToken = undefined
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
        const setting = yield* getEnvs(['personMode', 'promptChanged'])

        //  Google Map APIがなければ強制的に練習モード ある場合は設定に従う
        //  APIがあるなら通常モード
        env.isPractice = !(GoogleMapApi_key || mapApi_url);
        if (sd_key || pixAi_key || comfy_url) {
          env.anyImageAiExist = true
        }
        if ((bs_id && bs_pass && bs_handle)) {
          env.anySnsExist = true
        }
        if (no_sns_post) {
          env.noSnsPost = true;
        }
        if (ServerLog) {
          env.loggingMode = true
        }
        if (moveMode === 'skip') {
          env.moveMode = "skip"
        }
        if (remBgUrl) {
          env.remBgUrl = remBgUrl
        }
        if (rembg_path || rembgPath) {
          env.rembgPath = rembgPath || rembg_path
        }
        //  デフォルトは三人称モード
        env.personMode = !setting.personMode ? 'third' : setting.personMode as PersonMode;
        yield* saveEnv('personMode', env.personMode as string)

        if (filter_tools) {
          env.filterTools = filter_tools.trim().split(',').map(value => value.trim())
        }

        logSync('comfy_params:', comfy_params)

        env.promptChanged = !!setting.promptChanged
        yield* saveEnv('promptChanged', env.promptChanged ? '1' : '')

        if (fixed_model_prompt) {
          env.fixedModelPrompt = true
        }

        if (env.isPractice) {
          yield* practiceRunStatus();
        }
        if (mapApi_url) {
          const s = mapApi_url.split(',')
          s.forEach(value => {
            const match = value.match(/(\w+)=([\w:\/.\-_]+)/);
            if (match) {
              const key = match[1]
              const val = match[2]
              if (MapEndpoint.includes(key as MapEndpoint)) {
                env.mapApis.set(key as MapEndpoint, val)
              }
            }
          })
        }

        const files = yield* Effect.tryPromise(() => fs.promises.readdir(path.join(__pwd, `assets/comfy`)))
        files.map(a => addScript(path.join(__pwd, `assets/comfy`, a)));
        if (comfy_workflow_i2i) {
          addScript(comfy_workflow_i2i, 'i2i')
        }
        if (comfy_workflow_t2i) {
          addScript(comfy_workflow_t2i, 't2i')
        }

        yield* McpLogService.logTrace(`initSystemMode end:${JSON.stringify(env)}`)
      }).pipe(Effect.provide(McpLogServiceLive))
    }

    function addScript(filePath: string, tag?: string) {
      const script = loadScript(filePath);
      scriptTables.set(tag || script.name, {script: script.script, nodeNameToId: script.nodeNameToId})
    }

    function loadScript(filePath: string) {
      const s = fs.readFileSync(filePath, {encoding: "utf8"});
      const parse = JSON.parse(s);
      const map: [string, number][] = Object.keys(parse).flatMap(key => {
        const node = parse[key];
        const clsName: string = node.class_type;
        const number = Number.parseInt(key);
        return [[clsName, number], [`${clsName}:${key}`, number]]
      });
      //  重複名が存在した場合、それはエラーとして記録するために0を入れることにする
      const map1 = map.reduce((previousValue, currentValue: [string, number]) => {
        if (previousValue.has(currentValue[0])) {
          //  重複なので 0
          previousValue.set(currentValue[0], 0)
        } else {
          previousValue.set(currentValue[0], currentValue[1])
        }
        return previousValue;
      }, new Map<string, number>());
      const name = path.basename(filePath, '.json');
      return {name: name, script: parse, nodeNameToId: map1};
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
      getAvatarSns,
      updateSnsFeedSeenAt,
      updateSnsMentionSeenAt,
      updateBasePrompt,
      getEnv,
      getEnvOption,
      saveEnv,
      getVersion,
    }
  }),
  dependencies: [McpLogServiceLive]
}) {
}

export const DbServiceLive = Layer.merge(DbService.Default, McpLogServiceLive)
