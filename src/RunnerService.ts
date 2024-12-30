import {Effect, Option, Schema} from "effect";
import {MapService, MapDef} from "./MapService.js";
import {DbService, DbServiceLive, RunStatus} from "./DbService.js";
import * as geolib from "geolib";
import dayjs = require("dayjs");
import utc = require("dayjs/plugin/utc");
import duration = require("dayjs/plugin/duration");
import {ImageService} from "./ImageService.js";
import * as Process from "node:process";
import {FacilityInfo, StoryService} from "./StoryService.js";
import {TripStatus} from "./db/schema.js";
import {HttpClientError} from "@effect/platform/HttpClientError";
import 'dotenv/config'
import {McpLogService} from "./McpLogService.js";
import {FileSystem} from "@effect/platform";
import {NodeFileSystem} from "@effect/platform-node";
import {AnswerError} from "./index.js";


dayjs.extend(utc)
dayjs.extend(duration)

// export const baseCharPrompt = `anime,${Process.env.baseCharPrompt}`


export interface LocationDetail {
  status: string;
  lat: number;
  lng: number;
  bearing: number;
  maneuver: string | undefined;
  timeZoneId: string;
  remainSecInPath: number;
  isEnd: boolean;
  landPathNo: number;
}

export const practiceData: { address: string; placesPath: string; sampleImagePath: string;durationSec:number; }[] = [
  {
    address: "Hakata Station,〒812-0012 Fukuoka, Hakata Ward, 博多駅中央街1−1",
    placesPath: "assets/places1.json",
    sampleImagePath: "assets/place1.png",
    durationSec: 20*60,
  },
  {
    address: "Nishitetsu Fukuoka Tenjin Station,〒810-0001 福岡県福岡市中央区天神２−22",
    placesPath: "assets/places2.json",
    sampleImagePath: "assets/place2.png",
    durationSec: 20*60,
  },
  {
    address: "Ohori Park,〒810-0051 Fukuoka, Chuo Ward, Ohorikoen, 公園管理事務所",
    placesPath: "assets/places3.json",
    sampleImagePath: "assets/place3.png",
    durationSec: 20*60,
  },
  {
    address: "Fukuoka Tower,2 Chome-3-26 Momochihama, Sawara Ward, Fukuoka, 814-0001",
    placesPath: "assets/places4.json",
    sampleImagePath: "assets/place4.png",
    durationSec: 20*60,
  }
]


export class RunnerService extends Effect.Service<RunnerService>()("traveler/RunnerService", {
  accessors: true,
  effect: Effect.gen(function* () {
    // const localDebug = true  //  TODO この切替をどうするか?
    //  走行時間スケール 2で時速40kmくらい 4くらいにするか 20km/hくらい
    // const durationScale = 1
    const durationScale2 = 4

    // const startInfo: Ref.Ref<Option.Option<RunStatus>> = yield* Ref.make(Option.none())

    const getBasePrompt = () => DbService.getEnv('basePrompt').pipe(
        Effect.orElseSucceed(() => 'depth of field, cinematic composition, masterpiece, best quality,looking at viewer,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut'))
    // const startInfo = 使わないかも?
    /**
     * AIランナー走行開始
     * 走行条件確認やsdが動いているかなどの条件確認は別途必要 呼び出し元を参考に
     * @param avatarId
     * @param start
     * @param dest
     */
    /*
            function startAiTrip(avatarId: number, start: { lng: number; lat: number; country: string }, dest: {
              lng: number;
              lat: number;
              country: string
            }[]) {
              return Effect.gen(function* () {
                const destList = yield* MapService.calcMultiPathRoute(start, dest)
                if (destList.length === 0) {
                  return yield* Effect.fail('no route found').pipe(Effect.tapError(Effect.logTrace))
                }
                //  連結した複数の中間位置のリスト
                yield* saveCurrentRunnerRoute(avatarId, destList);
                //  会話ログが完了してからスタートログを作らないと会話が切れてしまう なのでタイマーをかけて遅延実行する
                const runStatus = yield* startTrip(avatarId);
                yield* StoryService.makeStartStory(runStatus)

              })

              //  TODO 自動停泊のタイマーをかける
              // await this.resettingStayTimer(runStatus.avatarId, dayjs().add(4, "minutes"))
              // })
            }
    */

    /**
     * ランナーをスタートする
     */
    /*
        function startTrip(avatarId: number) {
          return Effect.gen(function* () {
            const routeInfo = yield* loadCurrentRunnerRoute(avatarId);
            const now = dayjs();
            const currentTripId = now.unix();
            const topLeg = routeInfo[0].leg

            const endLeg = yield* Option.fromNullable(routeInfo.slice(-1).pop()?.leg).pipe(Effect.orElse(() => Effect.fail('no end Leg')))
            // const endLeg = routeInfo.slice(-1).pop()?.legs.slice(-1).pop() //  TODO どっちが正しい?

            const full = routeInfo.reduce((p, c) => {
              p.duration += c.leg.duration.value || 0
              p.distance += c.leg.distance.value || 0
              return p
            }, {duration: 0, distance: 0});
            const runStatus: RunStatusI = {
              avatarId: avatarId,
              status: "run",
              duration: full.duration.toString() + `,scale=${durationScale}`,
              // duration: routeStr?.routes[0].legs[0].duration.text + `,scale=${this.durationScale}`
              durationSec: full.duration,
              distanceM: full.distance,
              tilEndEpoch: now.add(full.duration * durationScale, "seconds").unix(),
              from: topLeg.start_address || '',
              to: endLeg.end_address || '',
              endLat: endLeg.end_location?.lat || 0,
              endLng: endLeg.end_location?.lng || 0,
              startLat: topLeg.start_location?.lat || 0,
              startLng: topLeg.start_location?.lng || 0,
              startCountry: topLeg.start_country,
              endCountry: endLeg?.end_country,
              start: now.local().format(),
              epoch: now.unix(),
              tripId: currentTripId,
              //  到達ステップは-1から始める、記録が始まるパスは0から
              currentPathNo: -1,
              currentStepNo: 0,
              createTime: new Date()
            }
            return yield* DbService.saveRunStatus(runStatus)
          })
        }
    */


    const isShips = (maneuver?: string) => ['ferry', 'airplane'].includes(maneuver || '')
    const maneuverIsShip = (step: typeof MapDef.DirectionStepSchema.Type) => isShips(step.maneuver)

    const useAiImageGen = (Process.env.pixAi_key ? 'pixAi':Process.env.sd_key ? 'sd':'')

    function makeEtcTripLog(avatarId: number, tripId: number, seq: number, currentLoc: {
      lng: number;
      bearing: number;
      lat: number;
      maneuver?: string
    }, startCountry: string | undefined) {
      //  乗り物の旅行画像生成
      //  画像保存
      //  乗り物と緯度経度での日記生成
      //  日記のブログ結合
      //  日記のtwitterポストはするかどうするか
      //  開始と終了の位置をrunStatusから取り出す
      //  対応する会話イベントがあるかどうかを確認してログを抽出する
      /*
            let vehiclePrompt = ''
            let vehicle = '自転車'
            if (currentLoc.maneuver?.includes('ferry')) {
              vehiclePrompt = '(on ship deck:1.3),(ferry:1.2),sea,handrails'
              vehicle = 'フェリー'
            } else if (currentLoc.maneuver?.includes('airplane')) {
              vehiclePrompt = '(airplane cabin:1.3),reclining seat,sitting'
              vehicle = '旅客機'
            }
      */
      return Effect.gen(function* () {
        //  設定日時に対応した画像を生成する
        // const avatarInfo = yield* DbService.getAvatarInfo(avatarId)

        /*
                const now = dayjs()
                //  trips.jsonを作ってblogServerにアップロードする seqはtripIdと同じにしてみる
                let system: AiLlmType
                const {selectMap, selectMapE} = this.makeAiSelectMap(serverStatus);
                if (avatarInfo?.lang.includes('ja')) {
                  system = avatarInfo?.lang.includes('ja') ? AiService.nextAiSelect(selectMap, this.recentUseSystem) : this.recentUseSystem;
                  this.recentUseSystem = system
                } else {
                  system = avatarInfo?.lang.includes('en') ? AiService.nextAiSelect(selectMapE, this.recentUseSystemE) : this.recentUseSystemE
                  this.recentUseSystemE = system
                }
                const sysPr = 'assistantは旅行者として振る舞ってください。' + this.kutyoJ(avatarId)
                const talkPrompt = `あなたは旅行者です。` +
                  `今、「${vehicle}」にいます。\n` +
                  `場所は緯度=${currentLoc.lat.toFixed(2)},経度=${currentLoc.lng.toFixed(2)}ですが地名は不明です。` +
                  `${vehicle}での旅を楽しんでいることを説明してください。` + this.kutyoJ(avatarId);
                // if (system === "stable-lm") {  //  stable-lmのinput項は外す
                //   talkPrompt = `あなたは旅行者です。` +
                //       `今、「${vehicle}」にいます。` +
                //       `${vehicle}での旅を楽しんでいることを説明してください。`;
                //   sysPr = '以下は、タスクを説明する指示と、文脈のある入力の組み合わせです。要求を適切に満たす応答を書きなさい。assistantは旅行者として振る舞ってください。' + this.kutyoJ(avatarId)
                //       + AiService.stableLmSeparator + `場所は緯度=${currentLoc.lat.toFixed(2)},経度=${currentLoc.lng.toFixed(2)}ですが地名は不明です。`
                // }
                const talkPromptE = `You are a traveler.` +
                  `You are in "${vehicle}". \n` +
                  `Current location is latitude =${currentLoc.lat.toFixed(2)},longitude=${currentLoc.lng.toFixed(2)}.Place name is unknown.` +
                  `Explain that you are enjoying the ${vehicle} trip.` +
                  'Please say it in English.';


                //  ここでAI会話で付近の情報を作る AiRunnerThreadID に会話は保管中
                //  変換にそのままAiRunnerThreadIDを使ってしまうと過去会話が合わせて入力されてエラーになる。。。上限を2に設定する
                const aiExecService = await this.aiExecService
                const tk = await Effect.runPromiseExit(avatarInfo.lang === 'ja' ?
                  aiExecService.execAi(talkPrompt, sysPr, system) : aiExecService.execAi(talkPromptE, 'Assistant should behave as a traveler.', system))
                const talk = tk._tag === "Success" ? tk.value || '' : ''

        */
      })

      /*
            //return {img: Buffer.from('', 'base64'), talk: ''}
                  //  TODO MiHistory処理を対応させる必要あり。。
            const visit: MiHistory = {
              tripId: tripId,
              seq: seq,
              time: now.tz("Japan").format("YYYY/MM/DD HH:mm"),
              elapsed: 0,
              address: '',
              lat: currentLoc.lat,
              lng: currentLoc.lng,
              talk: talk,
              model: system as string
            };
            await this.runHistoryService.saveMiHistory(visit);
            await this.runHistoryService.saveStaticMiHistory(avatarId, visit);
            if (img) {
              await this.runHistoryService.appendRaw(tripId, seq, "image", img, false, 0, 0, appendPrompt)
            }
            //  走行サマリ
            const summary = await this.runStatusService.getCompleteRunStatus(avatarId);
            await this.runHistoryService.saveStaticTripList(summary);
            const ableTwitter = await this.checkAbleTwitter(avatarInfo);

            //  twitterに通知
            const name = avatarInfo?.name || 'Mi'
            const mes = avatarInfo.lang === 'ja' ?
              StringUtils.makeSnsText(TwitterBotService.maxTwitterLength, true, `${name}の旅/\n`, talk, StringUtils.makeLicenceText(system, modelInfo?.modelSnsName, true))
              : StringUtils.makeSnsText(TwitterBotService.maxTwitterLength, true, `${name}'s Trip\n`, talk, StringUtils.makeLicenceText(system, modelInfo?.modelSnsName, true))

            const cropped = img ? await this.imageCrop(img) : undefined;

            const outMes: { snsType: string, lang: string, text: string, media?: string }[] = [
              {snsType: 'md', lang: avatarInfo.lang, text: mes, media: cropped},
              {snsType: 'bs', lang: avatarInfo.lang, text: mes, media: cropped},
            ]
            if (ableTwitter) {
              outMes.push({snsType: 'tw', lang: avatarInfo.lang, text: mes, media: cropped})
              await this.incTodayTwitterCount()
            }

            const snsWriter = (await this.snsService).makeSnsWriter(this.miRunnerService.getSnsList(avatarId));

            for (const out of outMes) {
              const find = snsWriter.find(value => value.snsType === out.snsType && value.lng === out.lang);
              if (find && find.writer) {
                await find.writer(out.text, out.media)
                await new Promise(resolve => setTimeout(resolve, 10 * 1000))
              }
            }
      // return "comp"
      */
    }


    /**
     * 現在状態を計算する
     *  ここは計算位置
     */
    /*
        function getCurrentInfo(runStatus: RunStatus) {
          return Effect.gen(function* () {
            const now = dayjs()
            const currentLoc = yield* calcCurrentLoc(runStatus, now, true).pipe(
                Effect.orElseSucceed(() => {
                  //  終了状態なので最後の着地地点でログを作り、runStateを更新する
                  //  TODO 新ルール終点の場合は必然的に終点なので 報告済み中間点を終点で更新する
                  return {
                    lat: runStatus.endLat,
                    lng: runStatus.endLng,
                    bearing: MapService.getBearing(runStatus.startLat, runStatus.startLng, runStatus.endLat, runStatus.endLng),
                    timeZoneId: runStatus.endTz!,
                    remainSecInPath: 0,
                    maneuver: undefined,
                    isEnd: true,
                    landPathNo: -1,
                    // nextRelayStepSec: 0,
                    // needReportRelaySteps: []
                  }
                }),//)),
                Effect.tap(a => Effect.logTrace(`calcCurrentLoc:${a.landPathNo}`)));  //  ,${a.nextRelayStepSec},${a.needReportRelaySteps}
            //  すでにcalcCurrentLoc()に新ルールを適用して、現在地から最古中間地点へ変更
            //  google apiで付近情報を取得
            const seq = now.unix()  //  seqをどこで作るかがmiFront版と異なっていた。。。

            //  TODO 自動停泊はしないのだからmimiではhistoryは不要
            // const histories = yield* DbService.getHistory(runStatus.tripId);
            // const pointNum = histories.length
            const til = dayjs.duration((runStatus.tilEndEpoch - runStatus.epoch) * durationScale2 + runStatus.epoch - dayjs().unix(), 'seconds').asMinutes() //  通常移動の場合durationScale2が適用なのでおおよそ4倍。。。それはtilEndEpochには反映されていない。。。

            let status: TripStatus
            if (currentLoc.landPathNo < 0) {
              //  旅終了状態
              status = "stop"
            } else if (isShips(currentLoc.maneuver)) {  //   && currentLoc.needReportRelaySteps.length > 0 && !maneuverIsShip(currentLoc.needReportRelaySteps[0])
              //  船関係での停泊画面生成
              //  交通機関が特殊だったらそれ用の画像を作って、それ用の簡易な会話を作るか。。。 とりあえずフェリーと飛行機
              //  →終端=中間停泊地がフェリーというイリーガルなケースが発生した。。。その場合はフェリーであっても停泊という状態で進行させないといけない。。。
              // status = `I'm on the ${currentLoc.maneuver} now. Longitude and Latitude is almost ${currentLoc.lat},${currentLoc.lng}`
              status = "vehicle"
            } else {
              //  通常停泊画面
              status = "running"
            }

            return {
              status: status,
              stayInfo: {
                currentLoc,
                seq,
                til,
                // pointNum,
                now,
                isEnd: currentLoc.isEnd,
                landPathNo: currentLoc.landPathNo,
                // isLandRelayStep: (currentLoc.needReportRelaySteps?.length || 0) > 0,
                // isRemainRelayStep: (currentLoc.needReportRelaySteps?.length || 0) > 1,  //  これの戻りで1回停泊する、そのため停泊残が発生するのは2件以上の場合のみ
                // nextRelayStepSec: currentLoc.nextRelayStepSec
              }
            }
          })
        }
    */

    const getFacilitiesPractice = (runStatus: RunStatus,includePhoto:boolean) => {
      return Effect.gen(function *() {
        const practiceInfo = practiceData.find(value => value.address === runStatus.to) || practiceData[0]
        const fs = yield* FileSystem.FileSystem
        const nearFacilities = yield* fs.readFile(practiceInfo.placesPath).pipe(
          Effect.andThen(a =>Schema.decode(Schema.parseJson(MapDef.GmPlacesSchema))((Buffer.from(a).toString('utf-8')))),
          Effect.andThen(a => StoryService.placesToFacilities(a)))
        const image = includePhoto ? (yield* fs.readFile(practiceInfo.sampleImagePath).pipe(
          Effect.andThen(a => Buffer.from(a)),
          Effect.orElseSucceed(() => undefined))):undefined
        return {nearFacilities,image,locText: ''}
      })
    }

    const getFacilities = (loc: LocationDetail,includePhoto: boolean,abort = false,localDebug = false) => {
      return Effect.gen(function *() {
        const nearFacilities = yield* StoryService.getNearbyFacilities({
          lat: loc.lat,
          lng: loc.lng,
          bearing: 0
        })
        const image = includePhoto ? (yield* getStreetImage(loc, abort, localDebug).pipe(
          Effect.andThen(a => a.buf),
          Effect.orElseSucceed(() => undefined))) : undefined
        return {nearFacilities,image,locText: `current location is below\nlatitude:${loc.lat}\nlongitude:${loc.lng}\n`}
      })

    }

    const runningReport = (nearFacilities:FacilityInfo,locText: string, includeNearbyFacilities: boolean,useImage:boolean,image?:Buffer, abort = false) => {
      return Effect.gen(function* () {
/*
        let image
        let nearFacilities
        if (practice) {
          const practiceInfo = practiceData.find(value => value.address === runStatus.to) || practiceData[0]
          const fs = yield* FileSystem.FileSystem
          nearFacilities = yield* fs.readFile(practiceInfo.placesPath).pipe(
            Effect.andThen(a =>Schema.decode(Schema.parseJson(MapDef.GmPlacesSchema))((Buffer.from(a).toString('utf-8')))),
            Effect.andThen(a => StoryService.placesToFacilities(a)))
          image = yield* fs.readFile(practiceInfo.sampleImagePath).pipe(
            Effect.andThen(a => Buffer.from(a)),
            Effect.orElseSucceed(() => undefined))
        } else {
          nearFacilities = yield* StoryService.getNearbyFacilities({
            lat: loc.lat,
            lng: loc.lng,
            bearing: 0
          })
          image = includePhoto ? (yield* getStreetImage(loc, abort, localDebug).pipe(
            Effect.andThen(a => a.buf),
            Effect.orElseSucceed(() => undefined))) : undefined
        }
*/
        const facilityText = nearFacilities.facilities.length !== 0 ?
          `The following facilities are nearby:\n` + nearFacilities.facilities.map(value =>
            value.name + (value.types.length > 0 ? ' (kinds:' + value.types.join(',') + ')' : '')).join('\n') + '\n' :
          "There don't appear to be any buildings nearby.";

        const abortText = abort ? `I have received a message to discontinue my trip. This time, I will discontinue my trip.\n` : ''
        //const locText = `current location is below\nlatitude:${loc.lat}\nlongitude:${loc.lng}\n`;
        const posText = Option.isSome(nearFacilities.townName) ? `Town name is ${nearFacilities.townName.value}\n` : 'Town name is unknown.\n'
        const content: { type: string, text?: string, data?: string, mimeType?: string }[] = [{
          type: "text",
          text: abortText + locText + posText + (includeNearbyFacilities ? facilityText : '') + `${useImage ?(image ? '' : `\nSorry,I'm busy traveling so I couldn't take a photo.`):''}`
        }];
        if (image) {
          content.push({
            type: "image",
            data: image.toString('base64'),
            mimeType: 'image/png'
          })
        }
        return {out: {content}, address: nearFacilities.address}
      }).pipe(Effect.provide(NodeFileSystem.layer))
    }

    function getCurrentView(includePhoto: boolean, includeNearbyFacilities: boolean,practice=false, localDebug = false) {
      return Effect.gen(function* () {
        const runStatus = yield* getRunStatusAndUpdateEnd();
        const loc = yield* calcCurrentLoc(runStatus, dayjs()); //  これは計算位置情報
        const status = practice ? runStatus.status : loc.status

        const basePrompt = yield *getBasePrompt();
        switch (status) {
          case 'vehicle': {
            //  乗り物
            const maneuver = loc.maneuver;
            const vehiclePrompt = maneuver?.includes('ferry') ? '(on ship deck:1.3),(ferry:1.2),sea,handrails' :
              maneuver?.includes('airplane') ? '(airplane cabin:1.3),reclining seat,sitting' : ''
            const image = includePhoto && (yield* ImageService.makeEtcTripImage(basePrompt, vehiclePrompt, loc.timeZoneId))
            const out: { type: string; text?: string; data?: string; mimeType?: string }[] = [
              {
                type: "text",
                text: `I'm on the ${maneuver} now. Longitude and Latitude is almost ${loc.lat},${loc.lng}`
              },
            ]
            if (image) {
              out.push({type: "image", data: image.toString("base64"), mimeType: 'image/png'}
              )
            }
            return {content: out}
          }
          case 'running': {
            //  通常旅行
            const {nearFacilities,image,locText} = yield *(practice ? getFacilitiesPractice(runStatus,includePhoto):getFacilities(loc,includePhoto,false,localDebug))
            return yield* runningReport(nearFacilities,locText, includeNearbyFacilities,includePhoto,image, false).pipe(Effect.andThen(a => a.out))
          }
          case 'stop': {
            //  ホテル画像
            const hour = dayjs().tz(loc.timeZoneId).hour()
            const image1 = includePhoto && (yield* ImageService.makeHotelPict(basePrompt,useAiImageGen, hour, undefined, localDebug))
            const out: { type: string; text?: string; data?: string; mimeType?: string }[] = [
              {type: "text", text: `I am in a hotel in ${runStatus.to}.`}
            ]
            if (image1) {
              out.push({
                type: "image",
                data: image1.toString("base64"),
                mimeType: 'image/png'
              })
            }
            return {content: out}
          }
        }
        return yield* Effect.fail(new Error('unknown status'))
      }).pipe(Effect.catchAll(e => {
        if (e instanceof AnswerError) {
          return Effect.fail(e)
        }
        return McpLogService.logError(e).pipe(Effect.andThen(a =>
            Effect.fail(new AnswerError("Sorry,I don't know where you are right now. Please wait a moment and ask again."))));
      }))
    }

    /**
     * 現在の位置の各種情報
     * @param avatarId
     * @param forced
     */
    // function getCurrentTripInfo(avatarId: number) {
    //   return Effect.gen(function* () {
    //     //  走っていること→位置なので走っている必要はない
    //     const runStatus = yield* DbService.getRecentRunStatus(avatarId);
    //     if (Option.isNone(runStatus)) {
    //       return yield* Effect.fail('current location not set. Request fail.')
    //     }
    //     //  取得エラーについてここでは停泊でないので最小限のリトライにする
    //     return yield* getCurrentInfo(runStatus.value)
    //   })
    // }

    /**
     * ルートjsonをローカル一時上書き保存する
     * →db保存にする
     * @param avatarId
     * @param data
     * @private
     */
    function saveCurrentRunnerRoute(avatarId: number, data: any) {
      // await this.sysSettingService.set('RunnerCurRoute', ''); //  これ使ってない。。。
      return DbService.updateRoute(avatarId, JSON.stringify(data))
    }

    /**
     * 保存したルートjsonを読み直す
     * @private
     */
    function loadCurrentRunnerRoute(avatarId: number) {
      return DbService.getAvatar(avatarId).pipe(
        Effect.andThen(a => a.currentRoute ? Effect.succeed(a.currentRoute) :
          Effect.fail(new AnswerError('The route to the destination has not yet been determined.'))),
        Effect.andThen(a => Schema.decodeUnknownSync(Schema.parseJson(MapDef.RouteArraySchema))(a)),
        Effect.tapError(cause => McpLogService.logError(cause)),
      )
    }

    const reNumberSteps = (r: typeof MapDef.RouteSchema.Type) => {
      const directionSteps = (r.leg.steps).map((r, idx) => ({
        ...r,
        stepNo: idx,
        isRelayPoint: false,
        pathNo: -1,
        start: -1,  //  再計算してこのstepまでの秒を設定(step0を0秒として)
        end: -1     //  再計算してこのstepの最後のまでの秒を設定(step0を0秒として)
      }));
      directionSteps[directionSteps.length - 1].isRelayPoint = true //  終点追記
      return directionSteps;
    }

    /**
     * stepの経過時間
     * 船と飛行機はMap通りの時間、通常の移動は自転車相当としてそのdurationScale2倍する
     * @param step
     */
    const calcStepTime = (step: typeof MapDef.DirectionStepSchema.Type) => {
      return maneuverIsShip(step) ? step.duration.value : step.duration.value * durationScale2
    }
    /**
     * 経路jsonからlegs[].steps[]を抽出して結合する
     * 単一経路の場合と複数連結経路の場合のどちらも処理する
     * 中間経路の終点に isRelayPoint = true を付加
     * @param routeInfo
     */
    const routesToDirectionStep = (routeInfo: typeof MapDef.RouteArraySchema.Type) => {
      const all = routeInfo.flatMap((r, idx) => {
        return reNumberSteps(r).map(value => {
          value.pathNo = idx
          return value
        });
      })
      all.reduce((p, c) => {
        // フェリーや飛行機などの特殊な乗り物の場合は想定時間そのまま、通常のコースなら時間を4倍する
        c.start = p //  再計算してこのstepまでの秒を設定(step0を0秒として)
        c.end = p + calcStepTime(c)
        p = c.end
        return p
      }, 0);
      return all
    }

    /**
     * ルート情報から時間スパン単位でのルート区間を取得する
     * currentRunSecを指定しなければ全ルート区間のスパンを取得、指定すれば末端が指定の時間スパンになる
     * @param steps
     * @param currentRunSec
     */
      // const calcRouteToTimePointList = (steps: typeof MapDef.DirectionStepSchema.Type[], currentRunSec = Number.MAX_SAFE_INTEGER) => {
      //   steps.reduce((p, c) => {
      //     let duration = c.duration.value
      //     // if (!['ferry', 'airplane'].some(value => c.maneuver?.includes(value))) {
      //     //    // フェリーや飛行機などの特殊な乗り物の場合は想定時間そのまま、通常のコースなら時間を4倍する
      //     //    // FIXME とりあえず1倍に戻して 時間取得側を4倍にする
      //     //   duration *= this.durationScale2
      //     // }
      //     // フェリーや飛行機などの特殊な乗り物の場合は想定時間そのまま、通常のコースなら時間を4倍する
      //     if (!['ferry', 'airplane'].some(value => c.maneuver?.includes(value))) {
      //       duration *= durationScale2
      //     }
      //
      //     //  TODO ここは何か中間計算に使った可能性があるがこの仕組みは排除する
      //     if (p > currentRunSec) {
      //       return p
      //     }
      //     c.start = p
      //     c.end = p + duration
      //     return p
      //   }, 0);  //  実行中および未実行のステップ列
      //   return steps
      // }
    const calcCurrentStep = (steps: typeof MapDef.DirectionStepSchema.Type[], currentRunSec = Number.MAX_SAFE_INTEGER) => {
        return Option.fromNullable(steps.find(value => value.start <= currentRunSec && value.end > currentRunSec))
      }

    /**
     * 現在の旅位置(停泊情報付き)
     走行時間から現在の座標を取得する
     走行時間を調整するためのスケール指数を設定する
     ルート計算の要の処理
     走行時間からルートのstepのどれに該当するかを取り出し、その中点補完lat/lngと想定向きを取り出す 乗り物とstep内の残時間
     @link MiRunnerSeq.puml:6
     * @param runStatus
     * @param now
     * @param useNoReportedMidpoint
     */
    function calcCurrentLoc(runStatus: RunStatus, now: dayjs.Dayjs)
      : Effect.Effect<LocationDetail, Error | HttpClientError, DbService | MapService | McpLogService> {
      return Effect.gen(function* () {
        // const startTime = dayjs.unix(runStatus.epoch);
        const runAllSec = now.diff(runStatus.startTime, "seconds");  //  実時間でのstep0を0とした旅行実行秒数
        // const runAllSec = now.diff(startTime, "seconds", false);  //  実時間でのstep0を0とした旅行実行秒数
        const currentStepOption = yield* loadCurrentRunnerRoute(runStatus.avatarId).pipe(
          Effect.andThen(a => {
          const allSteps = routesToDirectionStep(a)
          return Effect.succeed(calcCurrentStep(allSteps, runAllSec))  //  次到達ステップ(現在のステップ位置でもある)
        }),Effect.orElseSucceed(() => Option.none()));



        if (Option.isNone(currentStepOption)) {
          //  すでに到着済み または不定
          //  すでに到着済みの報告の形を変える failでの報告の形にする
          //  TODO 新ルール終点の場合は必然的に終点なので 報告済み中間点を終点で更新する
          // yield* DbService.saveEnv('destination', '')
          // yield* DbService.saveEnv('destTimezoneId', '')
          return {
            status: "stop",
            lat: runStatus.endLat,
            lng: runStatus.endLng,
            bearing: MapService.getBearing(runStatus.startLat, runStatus.startLng, runStatus.endLat, runStatus.endLng),
            timeZoneId: runStatus.endTz!,
            remainSecInPath: 0,
            maneuver: undefined,
            isEnd: true,
            landPathNo: -1,
          }
          // return yield* Effect.fail(new Error("destination reached"))
        }
        //  現在の位置で報告+次の停泊地までの時間
        const currentStep = currentStepOption.value;
        const rat = Math.min(runAllSec - currentStep.start, 1) / (currentStep.end - currentStep.start); //  step内の進行割合

        const lat = (currentStep.end_location.lat - currentStep.start_location.lat) * rat + currentStep.start_location.lat;
        const lng = (currentStep.end_location.lng - currentStep.start_location.lng) * rat + currentStep.start_location.lng;

        return {
          status: isShips(currentStep.maneuver) ? "vehicle" : "running",
          lat: lat,
          lng: lng,
          bearing: geolib.getRhumbLineBearing({
              lat: currentStep.start_location.lat,
              lng: currentStep.start_location.lng
            },
            {lat: currentStep.end_location.lat, lng: currentStep.end_location.lng}),  //  step始点終点を使った向き想定
          maneuver: currentStep.maneuver,
          timeZoneId: yield* MapService.getTimezoneByLatLng(lat, lng),
          //  remainSecInPathはフェリーとかの特殊移動での残時間計算しか使っていない。そしてここの倍数は4倍になっているはずだが、//  フェリーや飛行機などの特殊な乗り物の場合は想定時間そのまま、通常のコースなら時間を4倍する で4倍しているから問題が起きていないのかも?
          //  →ここが最後にバグってたようだ すでに経路に4倍は入れてあるのでここで4倍してはいけない
          //  src/services/Mi/RunnerService.ts:402
          isEnd: false,
          remainSecInPath: Math.min(currentStep.end - runAllSec, currentStep.end - currentStep.start), //  現step内の残り秒数
          // needReportRelaySteps: needReportRelaySteps,  //  報告されなければならない中間地点(複数の場合があり、一番小さな並びからすべて停泊を報告する必要がある
          landPathNo: currentStep.pathNo,                      //  到着したpathNo (中間停泊地を0から数えて連番した番号)
          // nextRelayStepSec: nextRelayStepSec           //  次の中間停泊地までの秒数
        }
//        }
      })
    }

    function getDestinationAddress() {
      return DbService.getEnv('destination').pipe(
        Effect.tap(a => !a && Effect.fail(new Error())),
        Effect.orElseFail(() => new AnswerError("The destination has not yet been decided")))
      // return Effect.gen(function* () {
      //   const dest = yield* DbService.getEnv('destination');
      //   if (Option.isNone(dest) || !dest.value.value) {
      //     return yield* Effect.fail(new Error("The destination has not yet been decided"))
      //   }
      //   return `Current destination is "${dest.value.value}"`
      // })
    }

    function setDestinationAddress(address: string) {
      return Effect.gen(function* () {
        const location = yield* MapService.getMapLocation(address);
        if (Option.isNone(location)) {
          return yield* Effect.fail(new AnswerError("I don't know where you're talking about. destination location not found"))
        }
        const runStatus = yield* getRunStatusAndUpdateEnd();
        //  TODO 目的地が設定されたときにコース計算と行程時間を報告する必要がある そしてコースをrunStatusに設定する必要がある。saveEnvでもいいかも。
        const destList = yield* MapService.calcMultiPathRoute({
          lat: runStatus.endLat, lng: runStatus.endLng, country: runStatus.endCountry || location.value.country
        }, [{
          lat: location.value.lat, lng: location.value.lng, country: location.value.country
        }])
        if (destList.length === 0) {
          return yield* Effect.fail(new AnswerError("I can't find a route to my destination."))
        }
        const durationSec = destList.flatMap(v => v.leg).map(a => a.duration.value).reduce((p, c) => p + c, 0)
        if (durationSec > 24 * 60 * 60) {
          return yield* Effect.fail(new AnswerError("It will take 24 hours to reach your destination. That's too long."))
        }
        //  連結した複数の中間位置のリスト
        yield* saveCurrentRunnerRoute(1, destList);

        const timeZoneId = yield* MapService.getTimezoneByLatLng(location.value.lat, location.value.lng);
        yield* DbService.saveEnv('destination', address)
        yield* DbService.saveEnv('destTimezoneId', timeZoneId)
        const mesList = [
          `The traveler's destination was set as follows: ${address}`,
          `The journey takes approximately ${dayjs.duration(durationSec, "seconds").format()}.`
        ]
        const listElement = destList[destList.length-1];
        return {
          message: mesList.join('\n'),
          tilEndSec: durationSec,
          destination: listElement.leg.end_location || {lat:location.value.lat,lng:location.value.lng}
        };
      })
    }

    const resetRunStatus = (recent: RunStatus, to: string, lat: number, lng: number, country: string | null, timeZone: string | null) => {
      recent.status = "stop"
      recent.startTime = new Date(0)
      recent.to = to
      recent.endLat = lat
      recent.endLng = lng
      // recent.startLat = lat
      // recent.startLng = lng
      // recent.value.to = recent.value.  //  toは現在位置を指す
      recent.destination = null
      recent.tilEndEpoch = 0
      recent.durationSec = 0
      recent.distanceM = 0
      recent.startCountry = country
      recent.startTz = timeZone
      recent.currentPathNo = -1
      recent.currentStepNo = -1

    }

    const getRunStatusAndUpdateEnd = () => {
      return Effect.gen(function* () {
        const recent = yield* DbService.getRecentRunStatus(1).pipe(Effect.orElseFail(() =>
            new AnswerError(`current location not set. Please set the current location address`)))
        // if (Option.isNone(recent)) {
        //   return yield* Effect.fail(new Error(`current location not set. Please set the current location address`))
        // }
        if (dayjs().isAfter(dayjs.unix(recent.tilEndEpoch))) {
          //  旅は終了している TODO 終点画像を撮るタイミングがないな。。ここで入れるか? 今の取得で作れるのは作れるが。。
          // yield* DbService.saveEnv('destination', '')
          // yield* DbService.saveEnv('destTimezoneId', '')
          resetRunStatus(recent, recent.to, recent.endLat, recent.endLng, recent.endCountry, recent.endTz)
          // recent.status = "stop"
          // recent.startTime = new Date(0)
          // recent.to = recent.destination!
          // recent.startLat = recent.endLat
          // recent.startLng = recent.endLng
          // // recent.value.to = recent.value.  //  toは現在位置を指す
          // recent.destination = null
          // recent.tilEndEpoch = 0
          // recent.durationSec = 0
          // recent.distanceM = 0
          // recent.startCountry = recent.endCountry
          // recent.startTz = recent.endTz
          // recent.currentPathNo = -1
          // recent.currentStepNo = -1
          yield* DbService.saveRunStatus(recent)
        }
        return recent
      })
    }

    function startJourney(practice = false) {
      return Effect.gen(function* () {
        const now = dayjs();
        let runStatus: RunStatus
        if (practice) {
          runStatus = yield* DbService.practiceRunStatus(true)
        } else {
          runStatus = yield* getRunStatusAndUpdateEnd().pipe(Effect.tap(a => {
            if ((["running", "vehicle"] as TripStatus[]).includes(a.status as TripStatus)) {
              //  旅は継続しているので旅中で報告する
              return Effect.fail(new AnswerError(`already start journey.You may stop or continue the journey`));
            }
          }));
          // if ((["running", "vehicle"] as TripStatus[]).includes(runStatus.status as TripStatus)) {
          //   //  旅は継続しているので旅中で報告する
          //   return yield* Effect.fail(new Error(`already start journey.You may stop or continue the journey`));
          // }
          const dest = yield* getDestinationAddress()
          // const dest = yield* DbService.getEnv("destination").pipe(Effect.orElseFail(() => new Error(`destination not set.Please set journey destination address`)));  //  旅を停止か完了したらdestination=toは現在位置にする
          //  コース再計算
          const destInfo = yield* setDestinationAddress(dest)
          //  旅開始する
          runStatus.status = "running"
          runStatus.startTime = now.toDate()
          runStatus.destination = ""
          runStatus.from = runStatus.to
          runStatus.to = dest
          runStatus.startTz = runStatus.endTz //  TODO 中断の場合異なる可能性がある
          runStatus.startLat = runStatus.endLat
          runStatus.startLng = runStatus.endLng
          runStatus.endLat = destInfo.destination.lat
          runStatus.endLng = destInfo.destination.lng
          runStatus.tilEndEpoch = destInfo.tilEndSec + now.unix()
          runStatus.endTz = yield* DbService.getEnv("destTimezoneId").pipe(Effect.orElseSucceed(() => runStatus.startTz));
          // runStatus.endTz = Option.isSome(tz) ? tz.value.value : runStatus.startTz
        }
        //  旅開始ホテル画像、旅開始挨拶
        const hour = now.tz(runStatus.startTz!).hour()
        const image1 = yield* ImageService.makeHotelPict(yield *getBasePrompt(),useAiImageGen, hour);
        yield* DbService.saveEnv("destination", "")
        yield* DbService.saveEnv("destTimezoneId", "")
        yield* DbService.saveRunStatus(runStatus)

        return {
          text: `We set out on a journey. The departure point is "${runStatus.from}". I'm heading to "${runStatus.to}".`,
          image: image1
        }
      })
    }

    function stopJourney(practice: boolean) {
      return Effect.gen(function* () {
        const runStatus = yield* getRunStatusAndUpdateEnd()
        if (runStatus.status === "stop") {
          return yield* Effect.fail(new AnswerError(`The journey has already arrived in "${runStatus.to}".`));
        }
        let res
        if (practice) {
          const {nearFacilities,image,locText} = yield *getFacilitiesPractice(runStatus,true)
          res = yield* runningReport(nearFacilities,locText, false,true,image, true)

        } else {
          const currentInfo = yield* calcCurrentLoc(runStatus, dayjs()); //  これは計算位置情報
          const nears = yield* StoryService.getNearbyFacilities({
            lat: currentInfo.lat,
            lng: currentInfo.lng,
            bearing: currentInfo.bearing
          })

          resetRunStatus(runStatus, Option.getOrElse(nears.address, () => runStatus.to), //  TODO
            currentInfo.lat, currentInfo.lng, Option.getOrElse(nears.country, () => runStatus.endCountry), currentInfo.timeZoneId)

          const {nearFacilities,image,locText} = yield *getFacilities(currentInfo,true,false)
          res = yield* runningReport(nearFacilities,locText, false,true,image, true)
        }

        // const res = yield* runningReport(currentInfo, runStatus, true, false, true, practice, false)
        runStatus.to = Option.getOrElse(res.address, () => runStatus.from)
        yield* DbService.saveRunStatus(runStatus)
        return res.out
      }).pipe(Effect.provide(DbServiceLive))
    }

    function getStreetImage(loc: any, abort = false, localDebug = false) {
      return MapService.findStreetViewMeta(loc.lat, loc.lng, loc.bearing, 640, 640).pipe(
        Effect.andThen(okLoc => MapService.getStreetViewImage(okLoc.lat, okLoc.lng, loc.bearing, 640, 640)),
        Effect.andThen(baseImage => getBasePrompt().pipe(Effect.andThen(a => ImageService.makeRunnerImageV3(baseImage, a, useAiImageGen, abort, localDebug)))),
        Effect.andThen(a => Effect.succeed(a)),
        // Effect.catchAll(cause => Effect.logTrace(cause).pipe(Effect.andThen(Effect.succeed(Option.none()))))
        // Effect.andThen(a => Effect.succeed(Option.some(a))),
        //   Effect.catchAll(cause => Effect.logTrace(cause).pipe(Effect.andThen(Effect.succeed(Option.none()))))
      )
    }



    return {
      calcCurrentLoc,
      saveCurrentRunnerRoute,
      getCurrentView,
      makeEtcTripLog,
      resetRunStatus,
      getDestinationAddress,
      setDestinationAddress,
      startJourney,
      stopJourney,
    }
  }),
  dependencies: [DbServiceLive]
}) {
}

export const RunnerServiceLive = RunnerService.Default
