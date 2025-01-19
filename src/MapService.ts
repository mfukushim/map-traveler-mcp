/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import * as geolib from "geolib";
import {Effect, Schema, Option, Schedule} from "effect";
import {FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse} from "@effect/platform";
import dayjs from "dayjs";
import * as querystring from "querystring";
import {Jimp} from "jimp";
import * as Process from "node:process";
import {McpLogService, McpLogServiceLive} from "./McpLogService.js";
import {AnswerError} from "./mapTraveler.js";

/**
 * Google Map API定義
 */
export class MapDef {
  static readonly GmPlaceSchema = Schema.Struct({
    id: Schema.String,
    types: Schema.OptionFromUndefinedOr(Schema.Array(Schema.String)),
    formattedAddress: Schema.String,
    location: Schema.Struct({
      latitude: Schema.Number,
      longitude: Schema.Number,
    }),
    displayName: Schema.Struct({
      text: Schema.String,
      languageCode: Schema.UndefinedOr(Schema.String)
    }),
    primaryTypeDisplayName: Schema.OptionFromUndefinedOr(Schema.Struct({
      text: Schema.String,
      languageCode: Schema.String
    })),
    primaryType: Schema.OptionFromUndefinedOr(Schema.String),
    photos: Schema.OptionFromUndefinedOr(Schema.Array(Schema.Struct({
      name: Schema.String,
      authorAttributions: Schema.Array(Schema.Struct({
        displayName: Schema.String,
        photoUri: Schema.String,
      }))
    }))),
    addressComponents: Schema.OptionFromUndefinedOr(Schema.Array(Schema.Struct({
      shortText: Schema.String,
      longText: Schema.String,
      types: Schema.Array(Schema.String),
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
  static readonly ErrorSchema = Schema.Struct({
    error: Schema.Struct({
      code: Schema.Number,
      message: Schema.String,
      status: Schema.String,
    })
  })
  static readonly EmptySchema = Schema.Struct({
  })
}

export class MapService extends Effect.Service<MapService>()("traveler/MapService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const key: string = Process.env.GoogleMapApi_key || ''

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
      return Effect.forEach(destList, destElement => calcSingleRoute(start, destElement))
    }

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
      //  TODO 一旦海外コースは移植除外
      //  国内/単一国コース選定
      return calcDomesticTravelRoute(start.lat, start.lng, dest.lat, dest.lng, start.country, dest.country);
    }

    /**
     * 国内ルート計算 ルートAPI呼び出し
     * @param depLat
     * @param depLng
     * @param destLat
     * @param destLng
     * @param depCountry
     * @param destCountry
     * @param method
     */
    function calcDomesticTravelRoute(depLat: number, depLng: number, destLat: number, destLng: number, depCountry: string, destCountry: string, method: "BICYCLING" | "TRANSIT" = "BICYCLING") {
      if (!Process.env.GoogleMapApi_key) {
        return Effect.fail(new Error('no key'))
      }
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
          Effect.flatMap(a => HttpClientResponse.schemaBodyJson(Schema.Union(
            MapDef.DirectionsSchema.pipe(Schema.attachPropertySignature('kind', 'routes')),
            MapDef.ErrorSchema.pipe(Schema.attachPropertySignature('kind', 'error')),
            MapDef.EmptySchema.pipe(Schema.attachPropertySignature('kind', 'empty')),
          ))(a)),
          Effect.scoped,
          Effect.tap(a => McpLogService.logTrace(`calcDomesticTravelRoute: ${JSON.stringify(a).slice(0,10)}`)),
          Effect.tapError(e => McpLogService.logError(`calcDomesticTravelRoute error:${JSON.stringify(e)}`)),
          Effect.flatMap(a => {
            if (a.kind === 'routes') {
              if (a.status === 'OK' && a.routes.length > 0) {
                //  最初の選択の単一routesの単一legだけでよい
                return Effect.succeed({
                  summary: a.routes[0].summary,
                  leg: {
                    ...a.routes[0].legs[0],
                    start_country: depCountry,
                    end_country: destCountry,
                  },
                  start_country: 'jp',
                  end_country: 'jp'
                });
              } else if(a.status === 'REQUEST_DENIED') {
                return Effect.fail(new AnswerError(`directions API request denied. Check Api setting.`))
              }
            } else if (a.kind === 'error') {
              return Effect.fail(new AnswerError(`A system error has occurred. ${a.error.message}`))
            }
            return Effect.fail(new AnswerError(`No suitable route was found`))
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
      if (!Process.env.GoogleMapApi_key) {
        return Effect.fail(new Error('no key'))
      }
      return Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient
        return yield* client.get(`https://maps.googleapis.com/maps/api/timezone/json`, {
          urlParams: {
            location: `${lat},${lng}`,
            timestamp: `${dayjs().unix()}`,
            key: key
          }
        }).pipe(
          Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds")))),
          Effect.flatMap(a => a.json),
          Effect.scoped,
          Effect.tap(a => McpLogService.logTrace(`getTimezoneByLatLng:${JSON.stringify(a)}`)),
          Effect.tapError(e => McpLogService.logError(`getTimezoneByLatLng error:${JSON.stringify(e)}`)),
          Effect.andThen(a => a as { status: string, timeZoneId?: string }),
          Effect.tap(a => (a.status !== 'OK' || !a.timeZoneId) && Effect.fail(new Error('getTimezoneByLatLng error'))),
          Effect.andThen(a => a.timeZoneId!)
        )
      }).pipe(Effect.provide([FetchHttpClient.layer, McpLogServiceLive]))
    }

    const getCountry = (place: typeof MapDef.GmPlaceSchema.Type) => {
      const countryData = place.addressComponents.pipe(
        Option.andThen(a => Option.fromNullable(a.find(value => value.types.includes('country')))))
      return Option.getOrElse(countryData, () => ({shortText: 'JP'})).shortText  //  TODO 見つからない場合、現時点 日本想定
    }

    /**
     * 住所キーワードから緯度経度座標値を取得する(新)
     * 目的地に出来るかの確認にも使う
     * @param address
     */
    function getMapLocation(address: string) {
      if (!Process.env.GoogleMapApi_key) {
        return Effect.fail(new Error('no key'))
      }
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
          Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds")))),
          Effect.flatMap(a => a.text),
          Effect.tap(a => McpLogService.logTrace(`getMapLocation:${JSON.stringify(a).slice(0,10)}`)),
          Effect.flatMap(a => Schema.decode(Schema.parseJson(Schema.Union(
            MapDef.GmTextSearchSchema.pipe(Schema.attachPropertySignature('kind', 'places')),
            MapDef.ErrorSchema.pipe(Schema.attachPropertySignature('kind', 'error')),
            MapDef.EmptySchema.pipe(Schema.attachPropertySignature('kind', 'empty')),
          )))(a)),
          Effect.scoped,
          Effect.flatMap(adr => {
            if (adr.kind === 'places') {
              return Effect.succeed(Option.some({
                status: "OK",
                address: adr.places[0].formattedAddress,
                country: getCountry(adr.places[0]),
                lat: adr.places[0].location.latitude,
                lng: adr.places[0].location.longitude
              }))
            } else if (adr.kind === 'error') {
              return Effect.fail(new AnswerError(`A system error has occurred. ${adr.error.message}`))
            }
            return Effect.succeed(Option.none())
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
      if (!Process.env.GoogleMapApi_key) {
        return Effect.fail(new Error('no key'))
      }
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
            includedTypes: findLandMark ? ["tourist_attraction", "museum", "park", "national_park", "historical_landmark", "aquarium", "zoo", "university", "library", "art_gallery"].concat(additionalType) : undefined
          }),
          Effect.flatMap(client.execute),
          Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds")))),
          Effect.flatMap(a => HttpClientResponse.schemaBodyJson(Schema.Union(
            MapDef.GmTextSearchSchema.pipe(Schema.attachPropertySignature('kind', 'places')),
            MapDef.ErrorSchema.pipe(Schema.attachPropertySignature('kind', 'error')),
            MapDef.EmptySchema.pipe(Schema.attachPropertySignature('kind', 'empty')),
          ))(a)),
          // Effect.flatMap(a => HttpClientResponse.schemaBodyJson(MapDef.GmTextSearchSchema)(a)),
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
        let result: { lat: number, lng: number } | undefined
        yield* Effect.iterate(5, {
          while: a => a > 0,
          body: b => {
            const checkLat = lat + 0.05 * (Math.random() - 0.5)
            const checkLng = lng + 0.04 * (Math.random() - 0.5)
            return client.get(`https://maps.googleapis.com/maps/api/streetview/metadata`, {
              urlParams: {
                size: `${width}x${height}`,
                location: `${checkLat.toFixed(15)},${checkLng.toFixed(15)}`,
                fov: 60,
                heading: bearing.toFixed(1),
                pitch: 0,
                key: key,
                return_error_code: true
              }
            }).pipe(
              Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds")))),
              Effect.flatMap(a => a.json),
              Effect.scoped,
              Effect.tap(a => McpLogService.logTrace(`findStreetViewMeta:${JSON.stringify(a)}`)),
              Effect.tapError(e => McpLogService.logError(`findStreetViewMeta error:${JSON.stringify(e)}`)),
              Effect.andThen(a => {
                if ((a as { status: string }).status === 'OK') {
                  result = {lat: checkLat, lng: checkLng}
                  return 0
                }
                return b - 1
              })
            )
          }
        })
        return result ? result : yield* Effect.fail(new Error('no StreetView'));
      })
    }

    /**
     * google画像URLから画像バイナリを取得する
     * @param url
     * @param width
     * @param height
     * @private
     */
    async function imageUrlToBuffer(url: string, width: number, height: number): Promise<Buffer> {
      const jimp = await Jimp.read(url);
      jimp.resize({w: width, h: height});
      return await jimp.getBuffer("image/jpeg");
    }

    function getStreetViewImage(lat: number, lng: number, bearing: number, width: number, height: number) {
      if (!Process.env.GoogleMapApi_key) {
        return Effect.fail(new Error('no key'))
      }
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
        try: () => imageUrlToBuffer(url, width, height),
        catch: error => new Error(`getStreetViewImage error:${error}`)
      })
    }

    //  endregion

    return {
      getDistance,
      calcSingleRoute,
      calcMultiPathRoute,
      getMapLocation,
      getCountry,
      getNearly,
      findStreetViewMeta,
      getStreetViewImage,
      calcDomesticTravelRoute,
      getTimezoneByLatLng,
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
