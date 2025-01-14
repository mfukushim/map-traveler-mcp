/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import {Effect, Option, Schema} from "effect";
import {MapService, MapDef} from "./MapService.js";
import {__pwd, DbService, DbServiceLive, env, RunStatus} from "./DbService.js";
import * as geolib from "geolib";
import dayjs = require("dayjs");
import utc = require("dayjs/plugin/utc");
import duration = require("dayjs/plugin/duration");
import relativeTime = require("dayjs/plugin/relativeTime");
import {ImageService} from "./ImageService.js";
import * as Process from "node:process";
import {FacilityInfo, StoryService} from "./StoryService.js";
import {TripStatus} from "./db/schema.js";
import {HttpClientError} from "@effect/platform/HttpClientError";
import 'dotenv/config'
import {McpLogService} from "./McpLogService.js";
import {FileSystem} from "@effect/platform";
import {NodeFileSystem} from "@effect/platform-node";
import {AnswerError} from "./mapTraveler.js";
import * as path from "path";
import {ToolContentResponse} from "./McpService.js";
import sharp = require("sharp");


dayjs.extend(utc)
dayjs.extend(duration)
dayjs.extend(relativeTime)

export const useAiImageGen = (Process.env.pixAi_key ? 'pixAi' : Process.env.sd_key ? 'sd' : '')

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

export const defaultAvatarId = 1 //  TODO 現在は一人用

export const practiceData: { address: string; placesPath: string; sampleImagePath: string; durationSec: number; }[] = [
  {
    address: "Hakata Station,〒812-0012 Fukuoka, Hakata Ward, 博多駅中央街1−1",
    placesPath: "assets/places1.json",
    sampleImagePath: "assets/place1.png",
    durationSec: 20 * 60,
  },
  {
    address: "Nishitetsu Fukuoka Tenjin Station,〒810-0001 福岡県福岡市中央区天神２−22",
    placesPath: "assets/places2.json",
    sampleImagePath: "assets/place2.png",
    durationSec: 20 * 60,
  },
  {
    address: "Ohori Park,〒810-0051 Fukuoka, Chuo Ward, Ohorikoen, 公園管理事務所",
    placesPath: "assets/places3.json",
    sampleImagePath: "assets/place3.png",
    durationSec: 20 * 60,
  },
  {
    address: "Fukuoka Tower,2 Chome-3-26 Momochihama, Sawara Ward, Fukuoka, 814-0001",
    placesPath: "assets/places4.json",
    sampleImagePath: "assets/place4.png",
    durationSec: 20 * 60,
  }
]


export class RunnerService extends Effect.Service<RunnerService>()("traveler/RunnerService", {
  accessors: true,
  effect: Effect.gen(function* () {
    //  走行時間スケール 2で時速40kmくらい 4くらいにするか 20km/hくらい
    const durationScale2 = 4
    
    const isShips = (maneuver?: string) => ['ferry', 'airplane'].includes(maneuver || '')
    const maneuverIsShip = (step: typeof MapDef.GmStepSchema.Type) => isShips(step.maneuver)

    const getFacilitiesPractice = (runStatus: RunStatus, includePhoto: boolean) => {
      return Effect.gen(function* () {
        const practiceInfo = practiceData.find(value => value.address === runStatus.to) || practiceData[0]
        const fs = yield* FileSystem.FileSystem
        const nearFacilities = yield* fs.readFile(path.join(__pwd, practiceInfo.placesPath)).pipe(
            Effect.andThen(a => Schema.decode(Schema.parseJson(MapDef.GmPlacesSchema))((Buffer.from(a).toString('utf-8')))),
            Effect.andThen(a => StoryService.placesToFacilities(a)))
        const image = includePhoto ? (yield* fs.readFile(path.join(__pwd, practiceInfo.sampleImagePath)).pipe(
            Effect.andThen(a => Buffer.from(a)),
            Effect.orElseSucceed(() => undefined))) : undefined
        return {nearFacilities, image, locText: ''}
      })
    }

    const getFacilities = (loc: LocationDetail, includePhoto: boolean, abort = false, localDebug = false) => {
      return Effect.gen(function* () {
        const nearFacilities = yield* StoryService.getNearbyFacilities({
          lat: loc.lat,
          lng: loc.lng,
          bearing: 0
        })
        const image = includePhoto && env.anyImageAiExist ? (yield* getStreetImage(loc, abort, localDebug).pipe(
                Effect.andThen(a => a.buf),
                Effect.orElseSucceed(() => undefined))) :
            includePhoto ? (yield* getStreetImageOnly(loc)) : undefined
        return {
          nearFacilities,
          image,
          locText: `current location is below\nlatitude:${loc.lat}\nlongitude:${loc.lng}\n`
        }
      })

    }

    const runningReport = (nearFacilities: FacilityInfo, locText: string, includeNearbyFacilities: boolean, useImage: boolean, image?: Buffer, abort = false) => {
      return Effect.gen(function* () {
        const facilityText = nearFacilities.facilities.length !== 0 ?
            `The following facilities are nearby:\n` + nearFacilities.facilities.map(value =>
                value.name + (value.types.length > 0 ? ' (kinds:' + value.types.join(',') + ')' : '')).join('\n') + '\n' :
            "There don't appear to be any buildings nearby.";

        const abortText = abort ? `I have received a message to discontinue my trip. This time, I will discontinue my trip.\n` : ''
        const posText = Option.isSome(nearFacilities.townName) ? `Town name is ${nearFacilities.townName.value}\n` : 'Town name is unknown.\n'
        const content: ToolContentResponse[] = [{
          type: "text",
          text: abortText + locText + posText + (includeNearbyFacilities ? facilityText : '') + `${useImage ? (image ? '' : `\nSorry,I'm busy traveling so I couldn't take a photo.`) : ''}`
        }];
        if (image) {
          content.push({
            type: "image",
            data: image.toString('base64'),
            mimeType: 'image/png'
          } as ToolContentResponse)
        }
        return {out: content, address: nearFacilities.address}
      }).pipe(Effect.provide(NodeFileSystem.layer))
    }

    function getCurrentView(includePhoto: boolean, includeNearbyFacilities: boolean, practice = false, localDebug = false) {
      return Effect.gen(function* () {
        const runStatus = yield* getRunStatusAndUpdateEnd();
        const loc = yield* calcCurrentLoc(runStatus, dayjs()); //  これは計算位置情報
        let status: any;
        if (practice) {
          status = runStatus.status;
        } else {
          status = loc.status;
          //  ただし前回旅が存在し、それが終了していても、そのendTimeから1時間以内ならその場所にいるものとして表示する
          if(dayjs().isBefore(dayjs(runStatus.endTime || 0).add(1,"hour"))) {
            status = 'running'
          }
        }

        switch (status) {
          case 'vehicle': {
            //  乗り物
            const maneuver = loc.maneuver;
            const vehiclePrompt = maneuver?.includes('ferry') ? '(on ship deck:1.3),(ferry:1.2),sea,handrails' :
                maneuver?.includes('airplane') ? '(airplane cabin:1.3),reclining seat,sitting' : ''
            const image = includePhoto && env.anyImageAiExist && (yield* ImageService.makeEtcTripImage(useAiImageGen, vehiclePrompt, loc.timeZoneId, localDebug))
            const out: ToolContentResponse[] = [
              {
                type: "text",
                text: `I'm on the ${maneuver} now. Longitude and Latitude is almost ${loc.lat},${loc.lng}`
              },
            ]
            if (image) {
              out.push({type: "image", data: image.toString("base64"), mimeType: 'image/png'}
              )
            }
            return out
          }
          case 'running': {
            //  通常旅行
            const {
              nearFacilities,
              image,
              locText
            } = yield* (practice ? getFacilitiesPractice(runStatus, includePhoto) : getFacilities(loc, includePhoto, false, localDebug))
            return yield* runningReport(nearFacilities, locText, includeNearbyFacilities, includePhoto, image, false).pipe(Effect.andThen(a => a.out))
          }
          case 'stop': {
            //  ホテル画像
            const hour = dayjs().tz(loc.timeZoneId).hour()
            const image1 = includePhoto && (yield* ImageService.makeHotelPict(useAiImageGen, hour, undefined, localDebug))
            const out: ToolContentResponse[] = [
              {type: "text", text: `I am in a hotel in ${runStatus.to}.`}
            ]
            if (image1) {
              out.push({
                type: "image",
                data: image1.toString("base64"),
                mimeType: 'image/png'
              })
            }
            return out
          }
        }
        return yield* Effect.fail(new Error('unknown status'))
      }).pipe(Effect.catchAll(e => {
        if (e instanceof AnswerError) {
          return Effect.fail(e)
        }
        return McpLogService.logError(`getCurrentView catch:${e},${JSON.stringify(e)}`).pipe(Effect.andThen(() =>
            Effect.fail(new AnswerError("Sorry,I don't know where you are right now. Please wait a moment and ask again."))));
      }))
    }

    /**
     * ルートjsonをローカル一時上書き保存する
     * →db保存にする
     * @param avatarId
     * @param data
     * @private
     */
    function saveCurrentRunnerRoute(avatarId: number, data: any) {
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
          Effect.tapError(cause => McpLogService.logError(`loadCurrentRunnerRoute ${cause}`)),
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
    const calcStepTime = (step: typeof MapDef.GmStepSchema.Type) => {
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
     */
    function calcCurrentLoc(runStatus: RunStatus, now: dayjs.Dayjs)
        : Effect.Effect<LocationDetail, Error | HttpClientError, DbService | MapService | McpLogService> {
      return Effect.gen(function* () {
        const runAllSec = now.diff(runStatus.startTime, "seconds");  //  実時間でのstep0を0とした旅行実行秒数
        const currentStepOption = yield* loadCurrentRunnerRoute(runStatus.avatarId).pipe(
            Effect.andThen(a => {
              const allSteps = routesToDirectionStep(a)
              return Effect.succeed(calcCurrentStep(allSteps, runAllSec))  //  次到達ステップ(現在のステップ位置でもある)
            }), Effect.orElseSucceed(() => Option.none()));

        if (Option.isNone(currentStepOption)) {
          //  すでに到着済み または不定
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
          //  src/services/Mi/RunnerService.ts:402
          isEnd: false,
          remainSecInPath: Math.min(currentStep.end - runAllSec, currentStep.end - currentStep.start), //  現step内の残り秒数
          landPathNo: currentStep.pathNo,                      //  到着したpathNo (中間停泊地を0から数えて連番した番号)
        }
      })
    }

    function getDestinationAddress() {
      //  プラン中の行き先を確認し、中がなければrunStatusを確認し、走行中であるならばtoの値を取る なければ未設定
      return Effect.gen(function *() {
        const dest = yield*DbService.getEnvOption('destination')
        if (Option.isSome(dest)) {
          return dest.value;
        }
        const runStatus = yield* DbService.getRecentRunStatus()
        if (runStatus.status === 'running' && runStatus.to) {
          return runStatus.to
        }
        return yield *Effect.fail(new AnswerError("The destination has not yet been decided"))
      })
    }

    const sumDurationSec = (destList:typeof MapDef.RouteArraySchema.Type) => destList.flatMap(v => v.leg).flatMap(a => a.steps)
      .map(a => calcStepTime(a)).reduce((p, c) => p + c, 0)
    
    function setDestinationAddress(address: string) {
      return Effect.gen(function* () {
        const location = yield* MapService.getMapLocation(address);
        if (Option.isNone(location)) {
          return yield* Effect.fail(new AnswerError("I don't know where you're talking about. destination location not found"))
        }
        const runStatus = yield* getRunStatusAndUpdateEnd();
        //  目的地が設定されたときにコース計算と行程時間を報告する必要がある そしてコースをrunStatusに設定する必要がある。saveEnvでもいいかも。
        const destList = yield* MapService.calcMultiPathRoute({
          lat: runStatus.endLat, lng: runStatus.endLng, country: runStatus.endCountry || location.value.country
        }, [{
          lat: location.value.lat, lng: location.value.lng, country: location.value.country
        }])
        if (destList.length === 0) {
          return yield* Effect.fail(new AnswerError("I can't find a route to my destination."))
        }
        const durationSec = sumDurationSec(destList)
        if (durationSec > 3 * 24 * 60 * 60) {
          return yield* Effect.fail(new AnswerError("It will take 3 days to reach your destination. That's too long."))
        }
        //  連結した複数の中間位置のリスト
        yield* saveCurrentRunnerRoute(defaultAvatarId, destList);

        const timeZoneId = yield* MapService.getTimezoneByLatLng(location.value.lat, location.value.lng);
        yield* DbService.saveEnv('destination', address)
        yield* DbService.saveEnv('destTimezoneId', timeZoneId)
        const mesList = [
          `The traveler's destination was set as follows: ${address}`,
          `The journey takes approximately ${dayjs.duration(durationSec, "seconds").humanize()}.`
        ]
        const listElement = destList[destList.length - 1];
        return {
          message: mesList.join('\n'),
          tilEndSec: durationSec,
          destination: listElement.leg.end_location || {lat: location.value.lat, lng: location.value.lng}
        };
      })
    }

    const resetRunStatus = (recent: RunStatus, to: string,endTime:Date, lat: number, lng: number, country: string | null, timeZone: string | null) => {
      recent.status = "stop"
      recent.startTime = new Date(0)
      recent.endTime = endTime
      recent.to = to
      recent.endLat = lat
      recent.endLng = lng
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
        const recent = yield* DbService.getRecentRunStatus().pipe(Effect.orElseFail(() =>
            new AnswerError(`current location not set. Please set the current location address`)))
        if (recent.status === "stop" && !recent.to) {
          //  停止している場合は直近の行き先のtoが現在地
          return yield *Effect.fail(new AnswerError(`current location not set. Please set the current location address`))
        }
        const endTime = dayjs.unix(recent.tilEndEpoch);
        if (dayjs().isAfter(endTime)) {
          //  旅は終了している 終点画像を撮るタイミングがないな。。ここで入れるか? 今の取得で作れるのは作れるが。。
          resetRunStatus(recent, recent.to,endTime.toDate(), recent.endLat, recent.endLng, recent.endCountry, recent.endTz)
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
          const dest = yield* DbService.getEnv('destination') //  これはプラン中の行き先
          //  コース再計算
          const destInfo = yield* setDestinationAddress(dest)
          //  旅開始する
          runStatus.status = "running"
          runStatus.startTime = now.toDate()
          runStatus.endTime = dayjs.unix(destInfo.tilEndSec).toDate()
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
        }
        //  旅開始ホテル画像、旅開始挨拶
        const hour = now.tz(runStatus.startTz!).hour()
        const image1 = yield* ImageService.makeHotelPict(useAiImageGen, hour);
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
          const {nearFacilities, image, locText} = yield* getFacilitiesPractice(runStatus, true)
          res = yield* runningReport(nearFacilities, locText, false, true, image, true)

        } else {
          const currentInfo = yield* calcCurrentLoc(runStatus, dayjs()); //  これは計算位置情報
          const nears = yield* StoryService.getNearbyFacilities({
            lat: currentInfo.lat,
            lng: currentInfo.lng,
            bearing: currentInfo.bearing
          })

          resetRunStatus(runStatus, Option.getOrElse(nears.address, () => runStatus.to),dayjs().toDate(),
              currentInfo.lat, currentInfo.lng, Option.getOrElse(nears.country, () => runStatus.endCountry), currentInfo.timeZoneId)

          const {nearFacilities, image, locText} = yield* getFacilities(currentInfo, true, false)
          res = yield* runningReport(nearFacilities, locText, false, true, image, true)
        }

        runStatus.to = Option.getOrElse(res.address, () => runStatus.from)
        yield* DbService.saveRunStatus(runStatus)
        return res.out
      }).pipe(Effect.provide(DbServiceLive))
    }

    function getStreetImage(loc: any, abort = false, localDebug = false) {
      return Effect.gen(function *() {
        const okLoc = yield* MapService.findStreetViewMeta(loc.lat, loc.lng, loc.bearing, 640, 640)
        const baseImage = yield*MapService.getStreetViewImage(okLoc.lat, okLoc.lng, loc.bearing, 640, 640)
        return yield *ImageService.makeRunnerImageV3(baseImage, useAiImageGen, abort, localDebug).pipe(
          //  合成画像を失敗したらStreetViewだけでも出す
          Effect.orElse(() => Effect.tryPromise(() => sharp(baseImage).resize({
            width: 512,
            height: 512
          }).png().toBuffer()).pipe(Effect.andThen(a => ({
            buf: a,
            shiftX: 0,
            shiftY: 0,
            fit: false,
            append: ''
          })))))
      })
    }

    function getStreetImageOnly(loc: any) {
      return MapService.findStreetViewMeta(loc.lat, loc.lng, loc.bearing, 640, 640).pipe(
          Effect.andThen(okLoc => MapService.getStreetViewImage(okLoc.lat, okLoc.lng, loc.bearing, 640, 640)),
          Effect.andThen(baseImage => Effect.tryPromise(() => sharp(baseImage).resize({
            width: 512,
            height: 512
          }).png().toBuffer())),
      )
    }


    return {
      getCurrentView,
      resetRunStatus,
      getDestinationAddress,
      setDestinationAddress,
      startJourney,
      stopJourney,
      sumDurationSec,
      routesToDirectionStep,
    }
  }),
  dependencies: [DbServiceLive]
}) {
}

export const RunnerServiceLive = RunnerService.Default
