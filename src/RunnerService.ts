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
import 'dotenv/config'
import {McpLogService} from "./McpLogService.js";
import {NodeFileSystem} from "@effect/platform-node";
import {AnswerError} from "./mapTraveler.js";
import * as path from "path";
import {ToolContentResponse} from "./McpService.js";
import sharp = require("sharp");
import * as fs from "node:fs";


dayjs.extend(utc)
dayjs.extend(duration)
dayjs.extend(relativeTime)

export const useAiImageGen = (Process.env.pixAi_key ? 'pixAi' : Process.env.sd_key ? 'sd' : '')

export interface LocationDetail {
  status: TripStatus;
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
    const durationScale2 = (Process.env.time_scale && Number.parseFloat(Process.env.time_scale)) || 4

    const isShips = (maneuver?: string) => ['ferry', 'airplane'].includes(maneuver || '')
    const maneuverIsShip = (step: typeof MapDef.GmStepSchema.Type) => isShips(step.maneuver)

    const getFacilitiesPractice = (toAddress: string, includePhoto: boolean) => {
      return Effect.gen(function* () {
        const practiceInfo = practiceData.find(value => value.address === toAddress) || practiceData[0]
        const nearFacilities = yield* Effect.async<Buffer, Error>((resume) =>
          fs.readFile(path.join(__pwd, practiceInfo.placesPath), (err, data) => {
            if (err) {
              resume(Effect.fail(err))
            }
            resume(Effect.succeed(data));
          })).pipe(
          Effect.andThen(a => Schema.decode(Schema.parseJson(MapDef.GmPlacesSchema))((Buffer.from(a).toString('utf-8')))),
          Effect.andThen(a => StoryService.placesToFacilities(a)))
        const image = includePhoto ? (yield* Effect.async<Buffer, Error>((resume) =>
          fs.readFile(path.join(__pwd, practiceInfo.sampleImagePath), (err, data) => {
            if (err) {
              resume(Effect.fail(err))
            }
            resume(Effect.succeed(data));
          })).pipe(
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

    const runningReport = (locText: string,nearFacilities?: FacilityInfo, image?: Buffer, abort = false, justArrive = false) => {
      return Effect.gen(function* () {
        const facilityText = nearFacilities && nearFacilities.facilities.length !== 0 ?
          `The following facilities are nearby:\n` + nearFacilities.facilities.map(value =>
            value.name + (value.types.length > 0 ? ' (kinds:' + value.types.join(',') + ')' : '')).join('\n') + '\n' :
          "There don't appear to be any buildings nearby.";

        const infoText = abort ? `I have received a message to discontinue my trip. This time, I will discontinue my trip.\n` :
          justArrive ? `We have arrived at our destination.` : ''
        const posText = nearFacilities && Option.isSome(nearFacilities.townName) ? `Town name is ${nearFacilities.townName.value}\n` : 'Town name is unknown.\n'
        const content: ToolContentResponse[] = [{
          type: "text",
          text: infoText + locText + posText + (nearFacilities ? facilityText : '')
        }];
        if (image) {
          content.push({
            type: "image",
            data: image.toString('base64'),
            mimeType: 'image/png'
          } as ToolContentResponse)
        }
        return {out: content, address: nearFacilities ? nearFacilities.address:Option.none()}
      }).pipe(Effect.provide(NodeFileSystem.layer))
    }

    const vehicleView = (loc:LocationDetail,includePhoto:boolean) => {
      //  乗り物
      const maneuver = loc.maneuver;
      const vehiclePrompt = maneuver?.includes('ferry') ? '(on ship deck:1.3),(ferry:1.2),sea,handrails' :
        maneuver?.includes('airplane') ? '(airplane cabin:1.3),reclining seat,sitting' : ''
      const out: ToolContentResponse[] = [
        {
          type: "text",
          text: `I'm on the ${maneuver} now. Longitude and Latitude is almost ${loc.lat},${loc.lng}`
        },
      ]
      if (includePhoto && env.anyImageAiExist) {
        return ImageService.makeEtcTripImage(useAiImageGen, vehiclePrompt, loc.timeZoneId).pipe(Effect.andThen(image => {
          out.push({type: "image", data: image.toString("base64"), mimeType: 'image/png'})
          return Effect.succeed(out)
        }))
      }
      return Effect.succeed(out)
    }
    const hotelView = (timeZoneId:string,includePhoto: boolean,toAddress:string) => {
      //  ホテル画像
      const hour = dayjs().tz(timeZoneId).hour()
      const out: ToolContentResponse[] = [
        {type: "text", text: `I am in a hotel in ${toAddress}.`}
      ]
      if (includePhoto) {
        return ImageService.makeHotelPict(useAiImageGen, hour, undefined).pipe(Effect.andThen(image1 => {
          out.push({
            type: "image",
            data: image1.toString("base64"),
            mimeType: 'image/png'
          })
          return Effect.succeed(out)
        }))
      }
      return Effect.succeed(out)
    }

    function getElapsedView(proceedPercent:number, localDebug = false) {
      return Effect.gen(function *() {
        const status = yield* DbService.getRecentRunStatus().pipe(Effect.orElseFail(() =>
          new AnswerError(`current location not set. Please set the current location address`)))
        if (status.status === "stop" && !status.to) {
          //  停止している場合は直近の行き先のtoが現在地
          return yield* Effect.fail(new AnswerError(`current location not set. Please set the current location address`))
        } else if(status.status === "stop") {
          return yield* Effect.fail(new AnswerError(`The journey is over`))
        }
        const proceed = Math.max(0,Math.min(100,proceedPercent))
        return yield *makeView(status,proceed/100,false, true,true)
      })
    }


    function getCurrentView(now:dayjs.Dayjs,includePhoto: boolean,includeNearbyFacilities:boolean, practice = false) {
      return Effect.gen(function *() {
        const {runStatus, justArrive,elapseRatio} = yield* getRunStatusAndUpdateEnd(now);
        //  ただし前回旅が存在し、それが終了していても、そのendTimeから1時間以内ならその場所にいるものとして表示する
        return yield *makeView(runStatus,elapseRatio,justArrive && dayjs().isBefore(dayjs.unix(runStatus.tilEndEpoch).add(1, "hour")),includePhoto,includeNearbyFacilities, practice)
      })
    }
    
    function makeView(runStatus:RunStatus,elapseRatio:number,showRunning:boolean,includePhoto: boolean,includeNearbyFacilities:boolean, practice = false,debugRoute?:string) {
      return Effect.gen(function* () {
        let loc:LocationDetail
        let status: TripStatus;
        if (practice) {
          loc = {
            status:runStatus.status,
            lat:runStatus.endLat,
            lng:runStatus.endLng,
            lat:runStatus.endLat,
          }
          status = runStatus.status;
        } else {
          loc = yield* calcCurrentLoc(runStatus, elapseRatio,debugRoute); //  これは計算位置情報
          status = loc.status;
          yield *McpLogService.logTrace(`getCurrentView:elapseRatio:${elapseRatio},start:${runStatus.startTime},end:${dayjs.unix(runStatus.tilEndEpoch)},status:${loc.status}`)
          if (showRunning) {
            status = 'running'
          }
        }
        switch (status) {
          case 'vehicle':
            return yield *vehicleView(loc, includePhoto);
          case 'stop':
            return yield *hotelView(practice ?'Asia/Tokyo': loc.timeZoneId,includePhoto,runStatus.to)
          case "running":
            const {
              nearFacilities,
              image,
              locText
            } = yield* (practice ? getFacilitiesPractice(runStatus.to, includePhoto) : getFacilities(loc, includePhoto, false))
            return yield* runningReport(locText, includeNearbyFacilities ? nearFacilities:undefined, image, false, showRunning).pipe(Effect.andThen(a => a.out))
        }

      }) .pipe(Effect.catchAll(e => {
        if (e instanceof AnswerError) {
          return Effect.fail(e)
        }
        return McpLogService.logError(`getCurrentView catch:${e},${JSON.stringify(e)}`).pipe(Effect.andThen(() =>
          Effect.fail(new AnswerError("Sorry,I don't know where you are right now. Please wait a moment and ask again."))));
      }))     
    }

//     function makeView(status:TripStatus,loc:LocationDetail,toAddress:string,justArrive:boolean,includePhoto: boolean,runInfo:{nearFacilities,image:Buffer,locText;string}) {
//       // function makeView(now:dayjs.Dayjs,includePhoto: boolean, includeNearbyFacilities: boolean, practice = false, localDebug = false) {
//       return Effect.gen(function* () {
// /*
//         const {runStatus, justArrive} = yield* getRunStatusAndUpdateEnd(now);
//         const loc = yield* calcCurrentLoc(runStatus, now); //  これは計算位置情報
//         let status: TripStatus;
//         if (practice) {
//           status = runStatus.status;
//         } else {
//           status = loc.status;
//           yield *McpLogService.logTrace(`getCurrentView:now:${now.unix()},start:${runStatus.startTime},end:${dayjs.unix(runStatus.tilEndEpoch)},status:${loc.status}`)
//           //  ただし前回旅が存在し、それが終了していても、そのendTimeから1時間以内ならその場所にいるものとして表示する
//           if (justArrive && now.isBefore(dayjs.unix(runStatus.tilEndEpoch).add(1, "hour"))) {
//             status = 'running'
//           }
//         }
// */
//
//         switch (status) {
//           case 'vehicle': {
//             //  乗り物
//             const maneuver = loc.maneuver;
//             const vehiclePrompt = maneuver?.includes('ferry') ? '(on ship deck:1.3),(ferry:1.2),sea,handrails' :
//               maneuver?.includes('airplane') ? '(airplane cabin:1.3),reclining seat,sitting' : ''
//             const image = includePhoto && env.anyImageAiExist && (yield* ImageService.makeEtcTripImage(useAiImageGen, vehiclePrompt, loc.timeZoneId))
//             const out: ToolContentResponse[] = [
//               {
//                 type: "text",
//                 text: `I'm on the ${maneuver} now. Longitude and Latitude is almost ${loc.lat},${loc.lng}`
//               },
//             ]
//             if (image) {
//               out.push({type: "image", data: image.toString("base64"), mimeType: 'image/png'}
//               )
//             }
//             return out
//           }
//           case 'running': {
//             //  通常旅行
// /*
//             const {
//               nearFacilities,
//               image,
//               locText
//             } = yield* (practice ? getFacilitiesPractice(toAddress, includePhoto) : getFacilities(loc, includePhoto, false))
// */
//             return yield* runningReport(locText, nearFacilities, image, false, justArrive).pipe(Effect.andThen(a => a.out))
//           }
//           case 'stop': {
//             //  ホテル画像
//             const hour = now.tz(loc.timeZoneId).hour()
//             const image1 = includePhoto && (yield* ImageService.makeHotelPict(useAiImageGen, hour, undefined))
//             const out: ToolContentResponse[] = [
//               {type: "text", text: `I am in a hotel in ${toAddress}.`}
//             ]
//             if (image1) {
//               out.push({
//                 type: "image",
//                 data: image1.toString("base64"),
//                 mimeType: 'image/png'
//               })
//             }
//             return out
//           }
//         }
//       }).pipe(Effect.catchAll(e => {
//         if (e instanceof AnswerError) {
//           return Effect.fail(e)
//         }
//         return McpLogService.logError(`getCurrentView catch:${e},${JSON.stringify(e)}`).pipe(Effect.andThen(() =>
//           Effect.fail(new AnswerError("Sorry,I don't know where you are right now. Please wait a moment and ask again."))));
//       }))
//     }

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
     * @param elapseRatio
     * @param debugRouteStr
     */
    function calcCurrentLoc(runStatus: RunStatus, elapseRatio:number,debugRouteStr?:string) { //  now: dayjs.Dayjs
      return Effect.gen(function* () {
        const runAllSec = dayjs.unix(runStatus.tilEndEpoch).diff(runStatus.startTime, "seconds")*elapseRatio;  //  実時間でのstep0を0とした旅行実行秒数
        yield* McpLogService.logTrace(`calcCurrentLoc: elapseRatio=${elapseRatio},runAllSec=${runAllSec}`)
        // const runAllSec = now.diff(runStatus.startTime, "seconds");  //  実時間でのstep0を0とした旅行実行秒数
        const fullRoute = debugRouteStr ? yield *Schema.decode(Schema.parseJson(MapDef.RouteArraySchema))(debugRouteStr) : yield* loadCurrentRunnerRoute(runStatus.avatarId)
        const allSteps = routesToDirectionStep(fullRoute)
        const currentStepOption = calcCurrentStep(allSteps, runAllSec)

        if (Option.isNone(currentStepOption)) {
          //  すでに到着済み または不定
          yield* McpLogService.logTrace(`calcCurrentLoc: end`)
          return {
            status: "stop" as TripStatus,
            lat: runStatus.endLat,
            lng: runStatus.endLng,
            bearing: MapService.getBearing(runStatus.startLat, runStatus.startLng, runStatus.endLat, runStatus.endLng),
            timeZoneId: runStatus.endTz!,
            remainSecInPath: 0,
            maneuver: undefined,
            isEnd: true,
            landPathNo: -1,
          } as LocationDetail
        }
        //  現在の位置で報告+次の停泊地までの時間
        const currentStep = currentStepOption.value;
        const rat = Math.min((runAllSec - currentStep.start) / (currentStep.end - currentStep.start), 1); //  step内の進行割合

        const lat = (currentStep.end_location.lat - currentStep.start_location.lat) * rat + currentStep.start_location.lat;
        const lng = (currentStep.end_location.lng - currentStep.start_location.lng) * rat + currentStep.start_location.lng;
        yield* McpLogService.logTrace(`calcCurrentLoc: step=${currentStep.pathNo},${currentStep.stepNo},${currentStep.start},${currentStep.end},${runAllSec},${rat},${lat},${lng},${currentStep.maneuver}`)

        return {
          status: (isShips(currentStep.maneuver) ? "vehicle" : "running") as TripStatus,
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
        } as LocationDetail
      })
    }

    function getDestinationAddress() {
      //  プラン中の行き先を確認し、中がなければrunStatusを確認し、走行中であるならばtoの値を取る なければ未設定
      return Effect.gen(function* () {
        const dest = yield* DbService.getEnvOption('destination')
        if (Option.isSome(dest)) {
          return dest.value;
        }
        const runStatus = yield* DbService.getRecentRunStatus()
        if (runStatus.status === 'running' && runStatus.to) {
          return runStatus.to
        }
        return yield* Effect.fail(new AnswerError("The destination has not yet been decided"))
      })
    }

    const sumDurationSec = (destList: typeof MapDef.RouteArraySchema.Type) => destList.flatMap(v => v.leg).flatMap(a => a.steps)
      .map(a => calcStepTime(a)).reduce((p, c) => p + c, 0)

    function setDestinationAddress(address: string) {
      return Effect.gen(function* () {
        const location = yield* MapService.getMapLocation(address);
        if (Option.isNone(location)) {
          return yield* Effect.fail(new AnswerError("I don't know where you're talking about. destination location not found"))
        }
        const {runStatus} = yield* getRunStatusAndUpdateEnd(dayjs());
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

    const resetRunStatus = (recent: RunStatus, to: string, endTime: Date, lat: number, lng: number, country: string | null, timeZone: string | null) => {
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

    const getRunStatusAndUpdateEnd = (now:dayjs.Dayjs) => {
      return Effect.gen(function* () {
        const status = yield* DbService.getRecentRunStatus().pipe(Effect.orElseFail(() =>
          new AnswerError(`current location not set. Please set the current location address`)))
        if (status.status === "stop" && !status.to) {
          //  停止している場合は直近の行き先のtoが現在地
          return yield* Effect.fail(new AnswerError(`current location not set. Please set the current location address`))
        }
        const endTime = dayjs.unix(status.tilEndEpoch);
        const start = dayjs(status.startTime);
        const elapseRatio = Math.min((now.diff(start,"seconds"))/(endTime.diff(start,"seconds")),1)
        let justArrive = false
        if (elapseRatio >= 1) {
          //  旅は終了している 終点画像を撮るタイミングがないな。。ここで入れるか? 今の取得で作れるのは作れるが。。
          if (status.status !== "running") {
            justArrive = true
          }
          resetRunStatus(status, status.to, endTime.toDate(), status.endLat, status.endLng, status.endCountry, status.endTz);
          yield* DbService.saveRunStatus(status)
        }
        return {runStatus: status, justArrive,elapseRatio}
      })
    }
    
    function startJourney(practice = false) {
      return Effect.gen(function* () {
        const now = dayjs();
        let rs: RunStatus
        if (practice) {
          rs = yield* DbService.practiceRunStatus(true)
        } else {
          const {runStatus} = yield* getRunStatusAndUpdateEnd(now).pipe(Effect.tap(a => {
            if ((["running", "vehicle"] as TripStatus[]).includes(a.runStatus.status as TripStatus)) {
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
          rs = runStatus
        }
        //  旅開始ホテル画像、旅開始挨拶
        const hour = now.tz(rs.startTz!).hour()
        const image1 = yield* ImageService.makeHotelPict(useAiImageGen, hour);
        yield* DbService.saveEnv("destination", "")
        yield* DbService.saveEnv("destTimezoneId", "")
        yield* DbService.saveRunStatus(rs)

        return {
          text: `We set out on a journey. The departure point is "${rs.from}". I'm heading to "${rs.to}".`,
          image: image1
        }
      })
    }

    function stopJourney(practice: boolean) {
      return Effect.gen(function* () {
        const now = dayjs()
        const {runStatus} = yield* getRunStatusAndUpdateEnd(now)
        if (runStatus.status === "stop") {
          return yield* Effect.fail(new AnswerError(`The journey has already arrived in "${runStatus.to}".`));
        }
        let res
        if (practice) {
          res = yield* getFacilitiesPractice(runStatus.to, true).pipe(Effect.andThen(a => runningReport(a.locText,a.nearFacilities, a.image, true)))
        } else {
          const elapse = Math.min(now.diff(runStatus.startTime,"seconds")/dayjs.unix(runStatus.tilEndEpoch).diff(runStatus.startTime,"seconds"),1)
          const currentInfo = yield* calcCurrentLoc(runStatus, elapse); //  これは計算位置情報
          const nears = yield* StoryService.getNearbyFacilities({
            lat: currentInfo.lat,
            lng: currentInfo.lng,
            bearing: currentInfo.bearing
          })

          resetRunStatus(runStatus, Option.getOrElse(nears.address, () => runStatus.to), now.toDate(),
            currentInfo.lat, currentInfo.lng, Option.getOrElse(nears.country, () => runStatus.endCountry), currentInfo.timeZoneId)

          res = yield* getFacilities(currentInfo, true, false).pipe(Effect.andThen(a => runningReport(a.locText,a.nearFacilities, a.image, true)))
        }

        runStatus.to = Option.getOrElse(res.address, () => runStatus.from)
        yield* DbService.saveRunStatus(runStatus)
        return res.out
      }).pipe(Effect.provide(DbServiceLive))
    }

    function getStreetImage(loc: any, abort = false, localDebug = false) {
      return Effect.gen(function* () {
        const okLoc = yield* MapService.findStreetViewMeta(loc.lat, loc.lng, loc.bearing, 640, 640)
        const baseImage = yield* MapService.getStreetViewImage(okLoc.lat, okLoc.lng, loc.bearing, 640, 640)
        const bodyAreaRatio = Process.env.bodyAreaRatio ? {bodyAreaRatio: Number.parseFloat(Process.env.bodyAreaRatio)} : {}
        const bodyHWRatio = Process.env.bodyHWRatio ? {bodyHWRatio:Number.parseFloat(Process.env.bodyHWRatio)} : {}
        const bodyWindowRatioW = Process.env.bodyWindowRatioW ? {bodyWindowRatioW:Number.parseFloat(Process.env.bodyWindowRatioW)} : {}
        const bodyWindowRatioH = Process.env.bodyWindowRatioH ? {bodyWindowRatioH:Number.parseFloat(Process.env.bodyWindowRatioH)} : {}
        return yield* ImageService.makeRunnerImageV3(baseImage, useAiImageGen, abort,{...bodyAreaRatio,...bodyHWRatio,...bodyWindowRatioW,...bodyWindowRatioH},localDebug).pipe(
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
          })))));
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
      getElapsedView,
      makeView,
    }
  }),
  dependencies: [DbServiceLive]
}) {
}

export const RunnerServiceLive = RunnerService.Default
