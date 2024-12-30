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


    /*
        function getDayInfo(now: dayjs.Dayjs) {
          return DbService.getTodayAnniversary(now).pipe(
            Effect.andThen(a => {
              const s = a.map(v => v.name).join('と');
              return a.length > 0 ? `今日は${s}です。短く${s}について述べてください。` : ''
            })
          )
        }
    
        /!**
         * 判定後に生成文を微調整加工する
         * @param lang
         * @param text
         *!/
        const logModifier = (lang: string, text: string) => {
          if (lang === 'ja') {
            //  elyzaもxwinもどうしても「承知しました。」をいう癖がある。ただそこは完全にパターンが確定しているのでちょっとなんだが、直削除する。。。同様に「私は旅行者です」「あなたは旅行者です。」の除去する
            text = text.replaceAll(/(?:承知しました|承知いたしました|私は旅行者です|私は旅行者ですよ|あなたは旅行者です|あなたは旅行者ですよ|ASSISTANT:)[。、]?/g, '').trim()
            text = text.replace(/^はい、/, '')  //  claudeの はい、で始まる癖
            text = text.replace(/^(?:わかりました|分かりました)[。、]?/, '')  //   claudeの はい、わかりました。 で始まる癖
            //  TODO elyzaおよびたまにGPT3.5も癖として、「情景を説明します。」という傍観者視点の文を生成することがある。これは前方一致でここから前を削除したほうがよい。全部ではないがかなりの傍観者表現の文を削除できる
            const pos = text.indexOf('情景を説明します。');
            if (pos >= 0) {
              text = text.slice(pos + '情景を説明します。'.length).trim()
            }
            return text
          } else {
            //  英語はまだ修正機能は付けていない。理解できんし
            return text
          }
        }
    */

    /**
     * これはmcp化するにあたってLLM処理はクライアント側にまかせてその生成に必要な情報だけを取得する仕組みにするか
     * 仮にここを残すとしても非同期処理はfiber化する
     * ランナー開始イベントの作成と合成
     * 処理はかなりかかるはずなので中は非同期実行にする
     */
    /*    function makeStartStory(runStatus: RunStatus) {
          const func = () => {
            return Effect.gen(function* () {
              // const avatarInfo = yield* DbService.getAvatar(runStatus.avatarId)
              const avatarInfo = yield* DbService.getAvatarInfo(runStatus.avatarId)
              // const modelInfo = yield* ImageService.getModelInfo(avatarInfo.avatar_model?.modelName || '')
              //  記念日機能 とりあえずは単純メモリテーブルで 安定したらDB化、過去の旅行から記念日を合成してもよいかも
              const now = dayjs();
              const dayInfoPrompt = yield* getDayInfo(now);
              //  画像を作る
              const timezone = yield* MapService.getTimezoneByLatLng(runStatus.startLat, runStatus.startLng);
              const hour = now.tz(timezone).hour()
              const img = yield* ImageService.makeHotelPict(avatarInfo.avatar_model?.baseCharPrompt || '', hour); //  , modelInfo
              console.log(img)
              //  TODO ローカル/公開版切替問題
              // yield *this.runHistoryService.saveRawImageToQnap(runStatus.avatarId, runStatus.tripId, runStatus.tripId, "start", img);
              // yield *this.runHistoryService.saveStayImageToBlogServer(runStatus.avatarId, runStatus.tripId, runStatus.tripId, "start", img);
    
              //  TODO LLMスイッチの扱い検討
              // const useAi = nextAiSelect(filterLlm);
              const useAi: string = 'elyza8';
              //  走行サマリと会話を作る
              const summary = yield* MapService.getCompleteRunStatus(runStatus.avatarId);
              let lang = avatarInfo.run_avatar.lang;
              const say = yield* LlmService.execAi(
                `今から旅の開始をする挨拶をしてください。${summary.dayNum}日目で${summary.tripNum}回目の旅であることを伝えてください。${dayInfoPrompt}` +
                (lang.includes('en') ? "英語で返答してください。" : '日本語で返答してください。')
                , (lang.includes('en') ? "英語で返答してください。" : '日本語で返答してください。'), useAi)
              const text = logModifier(lang.includes('en') ? "en" : "ja", Option.getOrUndefined(say) || '')
              console.log(text)
              //  履歴生成と保存
              const visit: RunHistoryI = {
                tripId: runStatus.tripId,
                seq: runStatus.tripId,
                time: now.toDate(), //  Historyの記録時間はあくまで日本標準時
                elapsed: 0,
                address: runStatus.from,
                lat: runStatus.startLat,
                lng: runStatus.startLng,
                // talk: text,  //  ここは統合会話ログなのでmodelの記録はしない。現時点はChatGPT4だが将来はmodel混在の可能性がある
                createTime: now.toDate()
              };
              yield* DbService.saveMiHistory(visit);
              //  TODO ここはブログへの履歴出力
              // await this.runHistoryService.saveStaticMiHistory(runStatus.avatarId, visit);
              // await this.runHistoryService.saveStaticTripList(summary);
    
              //  SNS発行
              // const ableTwitter = await this.checkAbleTwitter(avatarInfo); これは時間判定? いらないかも
              //  twitterに通知
              //  TODO ここのtwitterを整理 できれば外からsnsリストを与える形で
              //  TODO ここは起動のためfunc callがいるので当面ChatGPTでないといけない
              const cropped = yield* ImageService.imageCrop(img);
              const outMes: { snsType: string, lang: string, text: string, media?: string }[] = []
              const name = modelInfo.name
              const license = StringUtils.makeLicenceText(useAi, modelInfo?.modelSnsName, true);
              if (avatarInfo.run_avatar.lang.includes('ja')) {
                const header = `${name}の旅/\n`;
                const mes = StringUtils.makeSnsText(TwitterBotService.maxTwitterLength, true, header, text, license)
                const mesMd = StringUtils.makeSnsText(ActivityPubService.maxPostLength, false, header, text, license)
                const mesBs = StringUtils.makeSnsText(AtPubService.maxPostLength, false, header, text, license)
                // console.log('mes:', mes)
                outMes.push({
                  snsType: 'md',
                  lang: 'ja',
                  text: mesMd,
                  media: cropped
                }, {
                  snsType: 'bs',
                  lang: 'ja',
                  text: mesBs,
                  media: cropped
                })
                if (ableTwitter) {
                  outMes.push({snsType: 'tw', lang: 'ja', text: mes, media: cropped})
                  await this.incTodayTwitterCount()
                }
              }
              if (avatarInfo.lang.includes('en')) {
                //  twitterに通知(英語)  `We're off to "${runStatus.to}"\n`
                const header1 = `${name}'s Trip\n`;
                const mesE = StringUtils.makeSnsText(TwitterBotService.maxTwitterLength, true, header1, text, license)
                const mesMdE = StringUtils.makeSnsText(ActivityPubService.maxPostLength, false, header1, text, license)
                const mesBsE = StringUtils.makeSnsText(AtPubService.maxPostLength, false, header1, text, license)
                // console.log('mesE:', mesE)
                outMes.push({
                  snsType: 'md',
                  lang: 'en',
                  text: mesMdE,
                  media: cropped
                }, {
                  snsType: 'bs',
                  lang: 'en',
                  text: mesBsE,
                  media: cropped
                })
                if (ableTwitter) {
                  outMes.push({snsType: 'tw', lang: 'en', text: mesE, media: cropped})
                  await this.incTodayTwitterCount()
                }
              }
    
              const snsList = this.miRunnerService.getSnsList(runStatus.avatarId)
    
              const snsWriter = (await this.snsService).makeSnsWriter(snsList);
    
              for (const out of outMes) {
                const find = snsWriter.find(value => value.snsType === out.snsType && value.lng === out.lang);
                if (find && find.writer) {
                  await find.writer(out.text, out.media)
                  await new Promise(resolve => setTimeout(resolve, 10 * 1000))
                }
              }*!/
            })
          }
          return Effect.forkDaemon(func());
        }*/

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
          // types: d.types.slice(0,2),  //  とりあえず互換性を保つために1個のリストにしている
          types: Option.isSome(d.primaryType) ? [d.primaryType.value] : [],  //  とりあえず互換性を保つために1個のリストにしている
          id: d.id
          // types: (d.types as string[]).filter(value => value != 'point_of_interest' && value != 'establishment')
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
        // const filter= photos.map(photo => {
        //   return {
        //     photoRef: photo.name || '',
        //     author: photo?.authorAttributions ? photo?.authorAttributions[0]?.displayName || '' : ''
        //   }
        // }) : [];
        const t = Option.getOrElse(result.primaryType, () => '')
        return {
          name: result.displayName.text as string,
          types: t ? [t] : Option.isSome(result.types) ? result.types.value : [result.displayName.text], //  result.typesまでないケースがある? とりあえず名前をそのまま突っ込むしかないか。。。
          photoReference: filter
        }
      })
    }

    /*
        /!**
         * テキスト文字中のCJK漢字系文字の含有数評価
         * @param text
         *!/
        const countCjk = (text: string) => {
          let countEng = 0
          let countCJK = 0
          for (const tx of text) {
            const t = tx.codePointAt(0)
            if (t && t > 255) {
              countCJK++
            } else {
              countEng++
            }
          }
          return {countEng, countCJK};
        }
    
        /!**
         * 旅ログで文章を再生成したほうがよい表現を判定する
         * 再加工でよい表現はここでは通して後の処理で再加工する
         * @param lang
         * @param text
         * @param betterIncludeTexts どれか一つでも含まれたほうが望ましい語(建物名など)
         * @param notIncludeTexts 入力につかって出力に出るべきではないテキスト(建物属性の英単語など)
         * @param useSystem
         *!/
        const detectRemakeText = (lang: string, text: string, betterIncludeTexts: string[], notIncludeTexts: string[] | undefined) => {
          if (lang === 'ja') {
            if (notIncludeTexts && notIncludeTexts.some(value => text.includes(value))) {
              console.log('detectRemakeText ng notIncludeTexts:', notIncludeTexts)
              return {retry: true}; //  リトライ要
            }
            //  NGワード
            //  TODO 与えられた はどうかな。。 施設 。。
            //  TODO GPT3.5 NGワード '申し訳ございません','申し訳ありません','I'm sorry',"すみません"
            //  追加 "選択肢"
            //  廃校  廃棄 破棄
            //  欠損 腫瘍
            //  創立 年度
            if (['|', '属性', '分類', '申し訳ございません', '申し訳ありません', "I'm sorry", "すみません", '想起', '選択肢', '廃校', '廃棄', '破棄', '欠損', '腫瘍', '創立', '年度'].some(value => text.includes(value))) {
              console.log('detectRemakeText ng ng word')
              return {retry: true};  //  リトライ要
            }
            //  建物名が1つでも含まれること
            if (betterIncludeTexts.every(value => !text.includes(value))) {
              console.log('ng LLM no building name:', text)
              return {retry: true}
            }
            return {retry: false};
          } else {
            //  とりあえず英語用
            //  英語メッセージの場合、全体の文字比率を検査する
            const {countEng, countCJK} = countCjk(text);
    
            console.log('Check letter countCJK,countEng:', countCJK, countEng)
            if (countCJK / (countCJK + countEng) > 0.5) {
              //  日本語文字が50%以上の場合、リトライ要
              return {retry: true}
            }
            //  英語についても建物属性文字列がそのまま入っていたらリトライにする
            // return !!(notIncludeTexts && notIncludeTexts.some(value => text.includes(value)));  //  TODO どちらかというと attributeとかのNGワードを見たほうがよいな。。。
            //  NGワード
            return {retry: ['|', 'attribute'].some(value => text.toLowerCase().includes(value))};
          }
        }
    */

    function placesToFacilities(a: typeof MapDef.GmPlacesSchema.Type) {
      const buildings = getNearlyParse(a)
      let selBuilding
      // if (relayPointSelectHint) {
      //   const sel = StringUtils.pickNearString(buildings.map(value => value.name), relayPointSelectHint);
      //   if (sel >= 0) {
      //     selBuilding = buildings[sel]
      //   }
      // }
      if (!selBuilding) {
        selBuilding = buildings[Math.floor(Math.random() * buildings.length)];
      }
      const political = getNearlyPoliticalParse(a, selBuilding.id)
      const photoReferences = getPhotoReferences(a, selBuilding.id)
      const maxLocationNum = 4  //  コスト改善のため、最大4地点までにする 多数の場合、ランダムピックでもよいが、そこまでの精度は必要ない
      const outBuildings = buildings.slice(0, maxLocationNum)
      // const townName = political?.townName || 'どこか' //.pop()?.name || 'どこか';
      // console.log('JSON:', JSON.stringify(outBuildings))
      const buildingProperties = outBuildings.flatMap(value => value.types)
      // const buildingNames = outBuildings.flatMap(value => value.name)
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
     * @param avatarThread
     * @param avatarId
     * @param useLang
     * @param currentLoc
     * @param withAbort
     * @param pointNum
     * @param runStatus
     * @param til
     * @param aiService
     * @param currentUseSystem
     * @param currentUseSystemE
     * @param isRelayPoint
     * @param relayPointSelectHint
     * @param relayPointProposeName
     * @private
     */
    function getNearbyFacilities(currentLoc: {
      lng: number;
      bearing: number;
      lat: number
    })
    //   : Promise<{
    //   townName: string;
    //   stayLogE: string;
    //   stayLogJ: string;
    //   photoReferences: LocationInfo2[];
    //   stayModelJ?: string;
    //   stayModelE?: string;
    //   currentUseSystem: string;
    //   currentUseSystemE: string;
    // }>
    {
      return Effect.gen(function* () {
        // const memorySummary = await this.memoryHistoryService.getRecentSummaryByAvatarId(avatarId);

        //  最初半径1000以内を探索する。該当件数が2以下なら2000で再検索する
        //  →最初は直近200以内で探索しランドスケープの選択精度を上げる、その後1000,2000へ
        let retry = 2
        // let buildings: { types: string[]; name: string; id: string }[] = [] //{ types: string[]; name: string }[] = []
        // let political: { townName: string; country: string } | undefined// { types: string[]; name: string }[] = []
        // let photoReferences: LocationInfo2[] = [] //LocationInfo[] = []

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

    function getSettingResource(pathname: string) {
      return Effect.gen(function* () {
        if (pathname.includes("/role.txt")) {
          return 'AIはユーザに対してtravelerの役割をします。\ntravelerはMCP APIを使って、1. 今いる場所の情報、2. 今いる場所の風景画像を取得することができます。travelerはMCP APIを使って、1. 旅の開始地を設定する 2. 旅の目的地を設定する 3. 旅を開始する 4. 旅を停止する ことを実行することができます。\n' +
            'ユーザはtravelerに対して 1. 現在の場所の情報を問い合わせる 2. 今いる場所の風景の画像を問い合わせる 3. その場所に関する旅の様子の相談を雑談する ことができます。\n' +
            'ユーザが現在の場所の情報を問い合わせたとき、次の内容で返答してください。\n' +
            '1. get_current_pictureを使って'
          // return {
          //   contents: [{
          //     uri: request.params.uri,
          //     mimeType: "text/plain",
          //     text: 'AIはユーザに対してtravelerの役割をします。\ntravelerはMCP APIを使って、1. 今いる場所の情報、2. 今いる場所の風景画像を取得することができます。travelerはMCP APIを使って、1. 旅の開始地を設定する 2. 旅の目的地を設定する 3. 旅を開始する 4. 旅を停止する ことを実行することができます。\n' +
          //       'ユーザはtravelerに対して 1. 現在の場所の情報を問い合わせる 2. 今いる場所の風景の画像を問い合わせる 3. その場所に関する旅の様子の相談を雑談する ことができます。\n' +
          //       'ユーザが現在の場所の情報を問い合わせたとき、次の内容で返答してください。\n' +
          //       '1. get_current_pictureを使って'
          //   }]
          // };
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
      // makeStartStory,
      placesToFacilities,
      getNearbyFacilities,
      getSettingResource
    }
  })
}) {

}

export const StoryServiceLive = StoryService.Default
