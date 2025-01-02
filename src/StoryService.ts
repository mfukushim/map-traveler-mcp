import {Effect, Option} from "effect";
import dayjs from "dayjs";
import timezone = require("dayjs/plugin/timezone")
import {MapDef, MapService} from "./MapService.js";
import {DbService} from "./DbService.js";
import {McpLogService} from "./McpLogService.js";
// import { StringUtils } from "./StringUtils";
// import {StringUtils} from "./StringUtils.js";

dayjs.extend(timezone)


export interface FacilityInfo {
  townName: Option.Option<string>,
  address: Option.Option<string>,
  country: Option.Option<string>,
  facilities: { id: string|undefined; types: string[]; name: string; }[],
  photoReferences: {
    name: string;
    types: readonly string[], //  result.typesまでないケースがある? とりあえず名前をそのまま突っ込むしかないか。。。
    photoReference: {
      photoRef: string;
      author: string;
    }[]
  }[],
}

export class StoryService extends Effect.Service<StoryService>()("traveler/StoryService", {
  accessors: true,
  effect: Effect.gen(function* () {
    /**
     * Nearlyから公的都市名類を抽出する
     * Nearlyから都市名(自分のイメージでは、日本の場合 市のレベル)は取り出しにくくなっている感じ。
     * 方針としては 新Nearの places[n].addressComponents[n].types[n] が sublocality_level_2 のものが直感に合う
     * 取れないときは locality で
     * 互換性を外す 最初の1施設の townNameとcountryコード (JPで返る)を直で返す
     * 一応互換構造だが、複数の sublocality_level_2 と locality が戻る形になる
     * @param places
     * @param id
     */
    const getNearlyPoliticalParse = (places: typeof MapDef.GmPlacesSchema.Type, id: string | undefined) => {
      const n = (places).filter(value => value.id === id).flatMap(d => {
        if (Option.isSome(d.addressComponents)) {
          const addressComponents = d.addressComponents.value
          const country = addressComponents.find(f => f.types[0] === 'country')
          const townName =
            addressComponents.find(f => f.types[0] === 'sublocality_level_2') ||
            addressComponents.find(f => f.types[0] === 'locality')
          return [
            {
              address: Option.fromNullable(d.formattedAddress),
              country: Option.fromNullable(country?.shortText),
              townName: Option.fromNullable(townName?.longText)
            }
          ]
        }
        return []
      }).shift()
      return n ? n : {country: Option.none(), townName: Option.none(), address: Option.none()}
    }
    /**
     * Nearlyから名称と種別、住所を抽出する
     * @param places
     */
    const getNearlyParse = (places: typeof MapDef.GmPlacesSchema.Type): {
      types: string[];
      name: string;
      id: string | undefined
    }[] => {
      //  photos がないものがある
      return places.filter(value => Option.isSome(value.photos)).map(d => {
        return {
          name: d.displayName.text,
          types: Option.isSome(d.primaryType) ? [d.primaryType.value] : [],  //  とりあえず互換性を保つために1個のリストにしている
          id: d.id
        }
      })
    }
    /**
     * photo_referenceを取得
     * getNearlyの戻りjsonから抽出
     * author nameをきちんと出す方向で拡張するか。。。 SNSでは (Powered xx+Photo by xx) かな。でもgoogle 自身もサムネイルでは出してないし、MiMiでは出さざるを得ないけどSNSは略するかな。。。仕組みは作っておく
     */
    const getPhotoReferences = (places: typeof MapDef.GmPlacesSchema.Type, id: string | undefined) => {
      return (places).filter(value => value.id === id).map(result => {
        const filter = Option.getOrElse(result.photos, () => []).map(a => {
          return {
            photoRef: a.name || '',
            author: a?.authorAttributions ? a?.authorAttributions[0]?.displayName || '' : ''
          }
        })
        const t = Option.getOrElse(result.primaryType, () => '')
        return {
          name: result.displayName.text as string,
          types: t ? [t] : Option.isSome(result.types) ? result.types.value : [result.displayName.text], //  result.typesまでないケースがある? とりあえず名前をそのまま突っ込むしかないか。。。
          photoReference: filter
        }
      })
    }


    function placesToFacilities(a: typeof MapDef.GmPlacesSchema.Type) {
      const buildings = getNearlyParse(a)
      let selBuilding

      if (!selBuilding) {
        selBuilding = buildings[Math.floor(Math.random() * buildings.length)];
      }
      const political = getNearlyPoliticalParse(a, selBuilding.id)
      const photoReferences = getPhotoReferences(a, selBuilding.id)
      const maxLocationNum = 4  //  コスト改善のため、最大4地点までにする 多数の場合、ランダムピックでもよいが、そこまでの精度は必要ない
      const outBuildings = buildings.slice(0, maxLocationNum)
      const buildingProperties = outBuildings.flatMap(value => value.types)
      buildingProperties.push('|')  //  表に出現する | も含まれてはいけないことにする
      return Effect.succeed({
        townName: political.townName,
        address: political.address,
        country: political.country,
        facilities: outBuildings,
        photoReferences: photoReferences,
      })
    }

    /**
     * 停泊ログテキスト生成
     * @param currentLoc
     * @private
     */
    function getNearbyFacilities(currentLoc: {
      lng: number;
      bearing: number;
      lat: number
    })
    {
      return Effect.gen(function* () {
        //  最初半径1000以内を探索する。該当件数が2以下なら2000で再検索する
        //  →最初は直近200以内で探索しランドスケープの選択精度を上げる、その後1000,2000へ
        let retry = 2
        return yield* Effect.async<number, Error>((resume) => resume(Effect.succeed(retry--))).pipe(
          Effect.andThen(a => MapService.getNearly(currentLoc.lat, currentLoc.lng, a === 2 ? 200 : retry === 1 ? 1000 : 2000)),
          Effect.andThen(a => placesToFacilities(a.places)),
          Effect.tap(a => McpLogService.logTrace(`getNearbyFacilities:${a}`)),
          Effect.retry({times: 2})
        )
      })
    }

    /**
     * 現在のステータスからユーザに何か指南する情報を与える
     * または汎用のtipsを示す
     * 初回: ありがとうございます 必須の設定は以下です。それぞれ従量がかかることがあります。 GM API,segmind,pixAi,sd, 任意 X/Twitter,Bluesky
     * db未設定: dbを設定してよいですか? 自分で位置を設定することもできます。
     * プロンプト未指定: プロンプトが指定可能。フェイク画像になることを避けるためanime,manga指定は必須
     * useLandmark: 画像取得先にGMのユーザ画像も含めます。
     * ランダム: 旅の過程は現在地の設定、行き先の設定、旅の開始
     * ランダム: 一定時間後に現在の報告を聞くとさらに先の画像が出ます
     */
    function info() {
      return Effect.succeed("Hello")
    }

    //  TODO ここはいる?
    function getSettingResource(pathname: string) {
      return Effect.gen(function* () {
        if (pathname.includes("/role.txt")) {
          return 'AIはユーザに対してtravelerの役割をします。\ntravelerはMCP APIを使って、1. 今いる場所の情報、2. 今いる場所の風景画像を取得することができます。travelerはMCP APIを使って、1. 旅の開始地を設定する 2. 旅の目的地を設定する 3. 旅を開始する 4. 旅を停止する ことを実行することができます。\n' +
            'ユーザはtravelerに対して 1. 現在の場所の情報を問い合わせる 2. 今いる場所の風景の画像を問い合わせる 3. その場所に関する旅の様子の相談を雑談する ことができます。\n' +
            'ユーザが現在の場所の情報を問い合わせたとき、次の内容で返答してください。\n' +
            '1. get_current_pictureを使って'
        } else if (pathname.includes("/setting.txt")) {
          //  言語
          const langText = yield* DbService.getEnv('language').pipe(
            Effect.andThen(a => `Please speak to me in ${a}`),
            Effect.orElseSucceed(() => 'The language of the conversation should be the language the user speaks.'))
          //  目的地
          const destText = yield* Effect.gen(function* () {
            const runStatus = yield* DbService.getRecentRunStatus(1)
            if (runStatus.status !== 'stop' && runStatus.destination) {
              return `Current destination is ${runStatus.destination}`
            }
            return yield* DbService.getEnv('destination').pipe(
              Effect.andThen(a => `Current destination is ${a}`),
              Effect.orElseSucceed(() => 'The destination is not decided.'))
          })
          //  他にあるはず

          return [langText, destText].join('\n')
        } else if (pathname.includes("/credit.txt")) {
          return 'https://akibakokoubou.jp/ contain Google Map Apis,'
        } else {
          throw new Error(`resource not found`);
        }
      })

    }


    return {
      info,
      placesToFacilities,
      getNearbyFacilities,
      getSettingResource
    }
  })
}) {

}

export const StoryServiceLive = StoryService.Default
