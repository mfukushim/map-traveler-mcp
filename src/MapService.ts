import * as geolib from "geolib";
import {Effect, Schema, Option} from "effect";
import {FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse} from "@effect/platform";
import dayjs from "dayjs";
import * as querystring from "querystring";

// import * as config from "config";

import {Jimp} from "jimp";
import * as Process from "node:process";
import {McpLogService, McpLogServiceLive} from "./McpLogService.js";

/**
 * 経路の基本単位
 */
// export interface DirectionStep {
//   duration: {
//     value: number
//   },
//   start_location: {
//     lat: number,
//     lng: number
//   },
//   end_location: {
//     lat: number,
//     lng: number
//   },
//   maneuver: string,  //  移動向きの意味だがフェリー旅では ferry の文字列が入っていた
//   html_instructions: string; //  これにも ferry は入っていたがhtml解説文章
//   pathNo?: number; //  連結経路のシーケンス番号 0～
//   stepNo?: number; //  単一経路内の手順番号 0～
//   isRelayPoint: boolean; //  中継ポイント(google mapからではなく後付けで追加)
// }


export class MapDef {
  static readonly GmPlaceSchema = Schema.Struct({
    // name: Schema.String,
    id: Schema.String,
    types: Schema.OptionFromUndefinedOr(Schema.Array(Schema.String)),
    formattedAddress: Schema.String,
    location: Schema.Struct({
      latitude: Schema.Number,
      longitude: Schema.Number,
    }),
    displayName: Schema.Struct({
      text: Schema.String,
      languageCode: Schema.String
    }),
    primaryTypeDisplayName: Schema.OptionFromUndefinedOr(Schema.Struct({
      text: Schema.String,
      languageCode: Schema.String
    })),
    primaryType: Schema.OptionFromUndefinedOr(Schema.String),
    // shortFormattedAddress: Schema.String,
    photos:Schema.OptionFromUndefinedOr(Schema.Array(Schema.Struct({
      name:Schema.String,
      authorAttributions:Schema.Array(Schema.Struct({
        displayName:Schema.String,
        photoUri:Schema.String,
      }))
    }))),
    addressComponents:Schema.OptionFromUndefinedOr(Schema.Array(Schema.Struct({
      shortText:Schema.String,
      longText:Schema.String,
      types:Schema.Array(Schema.String),
    })))
  })
  static readonly GmPlacesSchema = Schema.Array(MapDef.GmPlaceSchema)
  static readonly GmTextSearchSchema = Schema.Struct({
    places: MapDef.GmPlacesSchema
  })
  static readonly GmStepSchema = Schema.Struct({
      html_instructions: Schema.String,
      distance: Schema.Struct({
        text: Schema.String,
        value: Schema.Number,
      }),
      duration: Schema.Struct({
        text: Schema.String,
        value: Schema.Number,
      }),
      start_location: Schema.Struct({
        lat: Schema.Number,
        lng: Schema.Number
      }),
      end_location: Schema.Struct({
        lat: Schema.Number,
        lng: Schema.Number
      }),
      maneuver: Schema.UndefinedOr(Schema.String),  //  移動向きの意味だがフェリー旅では ferry の文字列が入っていた
      travel_mode: Schema.String
    }
  )

  static readonly DirectionStepSchema = Schema.mutable(Schema.Struct({
    ...MapDef.GmStepSchema.fields,
    pathNo: Schema.Number, //  連結経路のシーケンス番号 0～
    stepNo: Schema.Number, //  単一経路内の手順番号 0～
    isRelayPoint: Schema.Boolean, //  中継ポイント(google mapからではなく後付けで追加)
    start: Schema.Number,
    end: Schema.Number,
  }))
  static readonly GmLegSchema = Schema.Struct({
    // country:Schema.mutable(Schema.UndefinedOr(Schema.Struct({
    //   start_country:Schema.mutable(Schema.String),  //  処理都合の拡張
    //   end_country:Schema.mutable(Schema.String),  //  処理都合の拡張
    // }))),
    start_address: Schema.UndefinedOr(Schema.String),
    end_address: Schema.UndefinedOr(Schema.String),
    end_location: Schema.UndefinedOr(Schema.Struct({
      lat: Schema.Number,
      lng: Schema.Number,
    })),
    start_location: Schema.UndefinedOr(Schema.Struct({
      lat: Schema.Number,
      lng: Schema.Number,
    })),
    distance: Schema.Struct({
      text: Schema.String,
      value: Schema.Number,
    }),
    duration: Schema.Struct({
      text: Schema.String,
      value: Schema.Number,
    }),
    steps: Schema.NonEmptyArray(MapDef.GmStepSchema)
  })
  static readonly LegSchema = Schema.Struct({
    ...MapDef.GmLegSchema.fields,
    start_country: Schema.String,  //  処理都合の拡張
    end_country: Schema.String,  //  処理都合の拡張
  })
  static readonly GmRouteSchema = Schema.Struct({
    summary: Schema.String,
    legs: Schema.NonEmptyArray(MapDef.GmLegSchema) //  legは1個だけ見ればよかったような(複数ルーティング候補の仕組みだったはず
  })

  static readonly RouteSchema = Schema.Struct({
    summary: Schema.String,
    leg: MapDef.LegSchema,
  })
  static readonly RouteArraySchema = Schema.Array(MapDef.RouteSchema)
  static readonly DirectionsSchema = Schema.Struct({
    status: Schema.String,
    routes: Schema.Array(MapDef.GmRouteSchema)
  })

}

export interface DirectionStepAndTime {
  directionStep: typeof MapDef.DirectionStepSchema.Type;
  start: number;
  end: number;
  pathNo?: number; //  連結経路のシーケンス番号 0～
  stepNo?: number; //  単一経路内の手順番号 0～
  isRelayPoint: boolean; //  中継ポイント(google mapからではなく後付けで追加)
}


export class MapService extends Effect.Service<MapService>()("traveler/MapService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const key:string = Process.env.GoogleMapApi_key || '' // config.get('GoogleMapApi.key')  // Process.env.GoogleMapApi_key

    // const client = yield* HttpClient.HttpClient


    /**
     * 座標からの単純距離計算
     * @param curLat
     * @param curLng
     * @param targetLat
     * @param targetLng
     * @return 距離 m単位
     */
    const getDistance = (curLat: number, curLng: number, targetLat: number, targetLng: number) => {
      return geolib.getDistance({lat: curLat, lng: curLng}, {lat: targetLat, lng: targetLng});
    }

    /**
     * 複数中間地ルート計算(単一も兼ねる)
     * 戻りはGoogle Route のルート取得値全体の複数のリスト
     * @param start
     * @param destList
     */
    const calcMultiPathRoute = (start: { lng: number; lat: number; country: string }, destList: {
      lng: number;
      lat: number;
      country: string
    }[]) => {
      return Effect.forEach(destList, (destElement, i) => calcSingleRoute(start, destElement))

    /*
          const destRouteList = [];
          for (const destElement of destList) {
            const ret = await calcSingleRoute(start, destElement);
            destRouteList.push(ret)
            start = {lat: destElement.lat, lng: destElement.lng, country: destElement.country || 'JP'}
          }
    */
    }

    /**
     * 経路jsonからlegs[].steps[]を抽出して結合する
     * 単一経路の場合と複数連結経路の場合のどちらも処理する
     * 中間経路の終点に isRelayPoint = true を付加
     * @param routeInfo
     */
/*
    const routesToDirectionStep = (routeInfo: any) => { //  : DirectionStep[]
      if (Array.isArray(routeInfo)) {
        return routeInfo.flatMap((r, idx) => {
          return reNumberSteps(r).map(value => {
            value.pathNo = idx
            return value
          });
        });
      } else {
        return reNumberSteps(routeInfo)
      }
    }

    const reNumberSteps = (r: any) => {
      const directionSteps = (r.routes[0].legs[0].steps as DirectionStep[]).map((r, idx) => {
        r.stepNo = idx;
        return r
      });
      directionSteps[directionSteps.length - 1].isRelayPoint = true //  終点追記
      return directionSteps;
    }
*/

    /**
     * 単一ルート計算
     * @param start
     * @param dest
     */
    const calcSingleRoute = (start: { lng: number; lat: number; country: string }, dest: {
      lng: number;
      lat: number;
      country: string
    }) => {
      //  TODO effect/drizzeの制限から一旦海外コースは移植除外
      // if (dest.country != start.country) {
      //  海外コース選定 これは
      // return await this.calcAbroadRoute(start, dest)
      // } else {
      //  国内/単一国コース選定
      return calcDomesticTravelRoute(start.lat, start.lng, dest.lat, dest.lng, start.country, dest.country);
      // }
    }

    function practice() {
      return McpLogService.log('test')
    }
    /**
     * 国内ルート計算 ルートAPI呼び出し
     * TODO 非常に謎なのだがintelliJ経由のvitestだとエラーになる。。。 コマンドラインからだとtestが実行できる。。。
     * @param depLat
     * @param depLng
     * @param destLat
     * @param destLng
     * @param depCountry
     * @param destCountry
     * @param method
     */
    function calcDomesticTravelRoute(depLat: number, depLng: number, destLat: number, destLng: number, depCountry: string, destCountry: string, method: "BICYCLING" | "TRANSIT" = "BICYCLING") {
      return Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient
        return yield* client.get(`https://maps.googleapis.com/maps/api/directions/json`, {
          urlParams: {
            origin: `${depLat},${depLng}`,
            destination: `${destLat},${destLng}`,
            mode: method,
            key: key
          }
        }).pipe(
          Effect.retry({times: 2}),
          Effect.flatMap(a => HttpClientResponse.schemaBodyJson(MapDef.DirectionsSchema)(a)),
          Effect.scoped,
          Effect.tap(a => a.status === 'OK' && McpLogService.logTrace('calcDomesticTravelRoute: OK')),
          Effect.tapError(e => McpLogService.logError(`calcDomesticTravelRoute error:${JSON.stringify(e)}`)),
          Effect.andThen(a => {
            //  最初の選択の単一routesの単一legだけでよい
            return {
              summary: a.routes[0].summary,
              leg: {
                ...a.routes[0].legs[0],
                start_country: depCountry,
                end_country: destCountry,
              },
              start_country: 'jp',
              end_country: 'jp'
            }
          })
        )
      }).pipe(Effect.provide(FetchHttpClient.layer))
    }

    /**
     * タイムゾーン取得
     * @param lat
     * @param lng
     */
    function getTimezoneByLatLng(lat: number, lng: number) {
      return Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient
        return yield* client.get(`https://maps.googleapis.com/maps/api/timezone/json`, {
          urlParams: {
            location: `${lat},${lng}`,
            timestamp: `${dayjs().unix()}`,
            key: key
          }
        }).pipe(
          Effect.retry({times: 2}),
          Effect.flatMap(a => a.json),
          Effect.scoped,
          Effect.tap(a => McpLogService.logTrace(a)),
          Effect.tapError(e => McpLogService.logError(`getTimezoneByLatLng error:${JSON.stringify(e)}`)),
          Effect.andThen(a => a as {status:string, timeZoneId?:string}),  // TODO
          Effect.andThen(a => a.status !== 'OK' || !a.timeZoneId? Effect.fail(new Error('getTimezoneByLatLng error')):Effect.succeed(a)),
          Effect.andThen(a => a.timeZoneId!)
        )
      }).pipe(Effect.provide([FetchHttpClient.layer,McpLogServiceLive]))
    }

    const getCountry = (place:typeof MapDef.GmPlaceSchema.Type) => {
      const countryData = place.addressComponents.pipe(
        Option.andThen(a => Option.fromNullable(a.find(value => value.types.includes('country')))))
      return Option.getOrElse(countryData,() =>({shortText:'JP'})).shortText  //  TODO 見つからない場合、現時点 日本想定
    }

    /**
     * 住所キーワードから緯度経度座標値を取得する(新)
     * 目的地に出来るかの確認にも使う
     * @param address
     */
    function getMapLocation(address: string) {
      return Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient
        return yield* HttpClientRequest.post('https://places.googleapis.com/v1/places:searchText').pipe(
            HttpClientRequest.setHeaders({
              "Content-Type": "application/json",
              "X-Goog-Api-Key": key,
              'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.addressComponents,places.location,places.photos,places.id'  //  places.displayName,places.location
            }),
            HttpClientRequest.bodyJson({
              textQuery: address
            }),
            Effect.flatMap(client.execute),
            Effect.retry({times: 2}),
          Effect.tap(a =>a.text.pipe(Effect.andThen(a1 => a && McpLogService.logTrace(`places:searchText:OK`))) ),
          // Effect.tap(a =>a.text.pipe(Effect.andThen(a1 => Effect.logTrace(`places:searchText:${a1}`))) ),
            Effect.flatMap(a => HttpClientResponse.schemaBodyJson(MapDef.GmTextSearchSchema)(a)),
            Effect.scoped,
            Effect.andThen(adr => {
              return Effect.succeed(Option.some({
                status: "OK",
                address: adr.places[0].formattedAddress,
                country:getCountry(adr.places[0]),
                lat: adr.places[0].location.latitude,
                lng: adr.places[0].location.longitude
              }))
            })
        )
      }).pipe(Effect.provide(FetchHttpClient.layer))
  }

    /**
     * Nearly検索(緯度経度->建物検索)
     * @param lat
     * @param lng
     * @param radius
     * @param findLandMark
     * @param additionalType
     */
    function getNearly(lat: number, lng: number, radius = 2000, findLandMark = false, additionalType: string[] = []) {
      return Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient
        return yield* HttpClientRequest.post('https://places.googleapis.com/v1/places:searchNearby').pipe(
          HttpClientRequest.setHeaders({
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.primaryType,places.location,places.shortFormattedAddress,places.formattedAddress'
              + (findLandMark ? '' : ',places.addressComponents,places.photos')
          }),
          HttpClientRequest.bodyJson({
            maxResultCount: 6,
            languageCode: "ja",
            locationRestriction: {
              circle: {
                center: {
                  latitude: lat,
                  longitude: lng
                },
                radius: radius
              }
            },
            includedTypes: findLandMark ? ["tourist_attraction", "museum", "park", "national_park", "historical_landmark", "aquarium", "zoo", "university", "library", "art_gallery"].concat(additionalType):undefined
          }),
          Effect.flatMap(client.execute),
          Effect.retry({times: 2}),
          Effect.flatMap(a => HttpClientResponse.schemaBodyJson(MapDef.GmTextSearchSchema)(a)),
          // Effect.flatMap(a => a.json),
          // Effect.tap(a => Effect.logTrace(a)),
          // Effect.andThen(a => Schema.decodeUnknown(MapDef.GmTextSearchSchema)(a)),
          Effect.onError(cause => McpLogService.logError(`getNearly error:${JSON.stringify(cause)}`)),
          Effect.scoped,
        )
      }).pipe(Effect.provide(FetchHttpClient.layer))
    }

    //  region streetView制御
    /**
     * StreetView有無確認
     * @param lat
     * @param lng
     * @param bearing
     * @param width
     * @param height
     */
    function findStreetViewMeta(lat: number, lng: number, bearing: number, width: number, height: number) {
      return Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient
        let result:{lat:number,lng:number}|undefined
        yield* Effect.iterate(5,{
          while:a => a > 0,
          body:b => {
            const checkLat= lat + 0.05 * (Math.random() - 0.5)
            const checklng= lng + 0.04 * (Math.random() - 0.5)
                return client.get(`https://maps.googleapis.com/maps/api/streetview/metadata`, {
                  urlParams: {
                    size: `${width}x${height}`,
                    location: `${checkLat.toFixed(15)},${checklng.toFixed(15)}`,
                    fov: 60,
                    heading: bearing.toFixed(1),
                    pitch: 0,
                    key: key,
                    return_error_code: true
                  }
                }).pipe(
                  Effect.retry({times: 2}),
                  Effect.flatMap(a => a.json),
                  Effect.scoped,
                  Effect.tap(a => McpLogService.logTrace(a)),
                  Effect.tapError(e => McpLogService.logError(`findStreetViewMeta error:${JSON.stringify(e)}`)),
                  Effect.andThen(a => {
                    if((a as { status: string }).status === 'OK') {
                      result = {lat:checkLat,lng:checklng}
                      return 0
                    }
                    return b-1
                  })
                )
              }
        })
        if (result) {
          return result;
        } else {
          return yield *Effect.fail(new Error('no StreetView'));
        }

        //   {
        //   while: a => a >= 0,
        //   step: b => b--,
        //   body: c => {
        //     return client.get(`https://maps.googleapis.com/maps/api/streetview/metadata`, {
        //       urlParams: {
        //         size: `${width}x${height}`,
        //         location: `${list[c].lat.toFixed(15)},${list[c].lng.toFixed(15)}`,
        //         fov: 60,
        //         heading: bearing.toFixed(1),
        //         pitch: 0,
        //         key: key,
        //         return_error_code: true
        //       }
        //     }).pipe(
        //       Effect.retry({times: 2}),
        //       Effect.flatMap(a => a.json),
        //       Effect.scoped,
        //       Effect.tap(Effect.logTrace),
        //       Effect.tapError(Effect.logTrace),
        //       Effect.andThen(a => {
        //         if((a as { status: string }).status === 'OK') {
        //           result = c
        //           return -1
        //         }
        //         return c
        //       })
        //     )
        //   }
        // })
        // if (result >= 0) {
        //   return list[result];
        // } else {
        //   return yield *Effect.fail(new Error('no StreetView'));
        // }
      })
    }

    /**
     * google画像URLから画像バイナリを取得する
     * @param url
     * @param width
     * @param height
     * @private
     */
    async function imageUrlToBuffer(url: string, width: number, height: number):Promise<Buffer> {
      const jimp = await Jimp.read(url);
      jimp.resize({w:width, h:height});
      // jimp.q.quality(80);
      return await jimp.getBuffer("image/jpeg");
    }

    function getStreetViewImage(lat: number, lng: number, bearing: number, width: number, height: number) {
        const query = querystring.stringify({
          size: `${width}x${height}`,
          location: `${lat.toFixed(15)},${lng.toFixed(15)}`,
          fov: 60,
          heading: bearing.toFixed(1),
          pitch: 0,
          key: key,
          return_error_code: true
        });
        const url = 'https://maps.googleapis.com/maps/api/streetview?' + query;
        return Effect.tryPromise({
          try:signal => imageUrlToBuffer(url, width, height),
          catch:error => new Error(`getStreetViewImage error:${error}`) //  Effect.logTrace(error).pipe(Effect.andThen(a => Option.none())
        })
          // .pipe(
          // Effect.andThen(a => Effect.succeed(a)),
          // Effect.orElseSucceed(() => Option.none<Buffer>()))  //  失敗ではなく得られなかった状態にする
    }
    //  endregion

    /**
     * endしたステータスを取得して日付単位で件数取得する
     * endしたステータスの全duration+scale時間の統計を取る
     */
/*
    function getCompleteRunStatus(avatarId: number) {
      return Effect.gen(function* () {
        const compList = yield* DbService.getRunStatusByStatus(avatarId, 'stop');
        const runningList = yield* DbService.getRunStatusByStatus(avatarId, 'end')
        const curEpoch = dayjs().unix()
        //  トータル時間
        const sumSec = compList.map(value => (value.tilEndEpoch - value.epoch)).reduce((p, c) => p + c, 0)
          + runningList.map(value => (value.tilEndEpoch - curEpoch > 0 ? curEpoch - value.epoch : value.tilEndEpoch - value.epoch))
            .reduce((p, c) => p + c, 0)
        //  トータル旅行数
        const tripNum = compList.length + runningList.length
        //  トータル距離
        const mileageKm = compList.reduce((sum, c) => sum + c.distanceM, 0) / 1000
          + runningList.map(value => {
            const runEpoch = value.tilEndEpoch - curEpoch > 0 ? curEpoch - value.epoch : value.tilEndEpoch - value.epoch;
            const ratio = runEpoch / (value.tilEndEpoch - value.epoch)
            return value.distanceM * ratio
          }).reduce((sum, c) => sum + c, 0) / 1000
        //  日付グループしてその日数の数
        const dayNum = new Set(compList.concat(runningList).map(value => value.start.split(' ')[0])).size;
        return {
          avatarId,
          tripNum,
          sumSec,
          dayNum,
          mileageKm
        }
      })
    }
*/

    return {
      practice,
      // test,
      getDistance,
      calcSingleRoute,
      calcMultiPathRoute,
      // routesToDirectionStep,
      getMapLocation,
      getCountry,
      getNearly,
      findStreetViewMeta,
      getStreetViewImage,
      calcDomesticTravelRoute,
      getTimezoneByLatLng,
      // getCompleteRunStatus,
    }
  }),
}) {
  /**
   * 2点の方位から、そこを結ぶ方向角度を取得する
   * @param startLat
   * @param startLng
   * @param endLat
   * @param endLng
   */
  static getBearing(startLat: number, startLng: number, endLat: number, endLng: number) {
    return geolib.getRhumbLineBearing(
      {lat: startLat, lng: startLng},
      {lat: endLat, lng: endLng}
    );
  }

}

export const MapServiceLive = MapService.Default
