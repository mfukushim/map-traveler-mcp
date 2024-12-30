// import {AiLlmType} from "../../mi-common/mi_common/AiDef";

export class StringUtils {

  constructor(
  ) {
    //  サービスとして登録してないのでここは通らない。。。
  }

  /**
   * テンプレート文字列風に文字列を置き換える
   * @param template
   * @param values
   */
  static templateFormat(template: string, values: any) {
    return template.replace(/\$\{(\w+)}/g, (placeholder, key) => {
      return typeof values[key] !== 'undefined' ? values[key] : placeholder;
    });
  }

  /**
   * 文字列のリストの中で指定対象文字列により含まれている文字列の番号を抽出する
   * ざっくりとした類似語の抽出用
   * @param buildings
   * @param relayPointSelectHint
   */
  static pickNearString(buildings: string[], relayPointSelectHint: string) {
    const pop = buildings.map((value, index) => {
      let count = 0
      for (const nameElement of value) {
        count += relayPointSelectHint.includes(nameElement) ? 1 : 0
      }
      return [count, index]
    }).sort((a, b) => a[0] - b[0]).pop();
    if (pop) {
      return pop[1]
    }
    return -1;
  }

  /**
   * データリストからランダムに指定件数を抽出する
   * @param data
   * @param pickNum
   */
  static randomPick<T>(data:T[],pickNum:number) {
    const picks:T[] = []
    while (pickNum-- > 0 && data.length > 0) {
      const rnd = Math.floor(Math.random() * data.length)
      picks.push(data[rnd])
      data.splice(rnd, 1)
    }
    return picks

  }

  /**
   * SNS書き込み向きにサイズを切り出す
   * @param maxTextNum
   * @param isKanji2Char
   * @param header
   * @param body
   * @param license
   */
  static makeSnsText(maxTextNum: number, isKanji2Char: boolean, header: string, body: string, license: string) {
    //  全角140文字、半角280文字を余裕を少しつけてbodyを切り取る
    // const maxBodyHalf = maxTextNum - 50 - license.length //  licenceは英字前提 TODO ただ結構ずれてエラー出てるな。。。
    const licenseLen = this.snsCharCount(license, isKanji2Char)
    const headerLen = this.snsCharCount(header, isKanji2Char)
    const ableBodyLen = maxTextNum - licenseLen - headerLen - 20  //  20でよいか? 半角換算での切り取り長さにしているので
    let pos = 0
    let count = 0
    for (const tx of body) {
      const t = tx.codePointAt(0)
      if (t && t > 255) {
        count += isKanji2Char ? 2 : 1
      } else {
        count++
      }
      pos++
      if (count >= ableBodyLen)
        break;
    }
    return header + body.substring(0, pos) + (pos < body.length ? '...' : '') + '\n' + license
  }

  static snsCharCount(countText: string, isKanji2Char: boolean) {
    let count = 0
    for (const tx of countText) {
      const t = tx.codePointAt(0)
      if (t && t > 255) {
        count += isKanji2Char ? 2 : 1
      } else {
        count++
      }
    }
    return count
  }

  static licenceGoogleMap = 'Google map apis'
  static licenceText1 = `(Powered ${this.licenceGoogleMap},`;
  static licenceText2 = ',etc.)';
  static licenceText3 = 'etc.';

  static llmNameList = [
    ['GPT4', 'GPT-4o'],
    ['GPT4o-mini', 'GPT-4o-mini'],
    ['elyza', 'ELYZA-7b'],
    ['elyza13', 'ELYZA-13b'],
    ['qarasu14', 'qarasu-14b'],
    ['nekomata14', 'nekomata-14b'],
    ['qarasu7', 'karasu-7b'],
    ['nekomata7', 'nekomata-7b'],
    ['swallow7', 'Swallow-7b'],
    ['xwin', 'Xwin-LM'],
    ['stable-lm', 'Stable-beta7b'],
    ['ca-calm', 'CyberA-calm2'],
    ['rinna', 'rinna-gpt'],
    ['gemini', 'gemini1.5f'],
    ['houou', 'mf-houou'],
    ['rakuten7', 'rakuten-7b'],
    ['claude3-sonnet', 'Claude3.5-sonnet'],
    ['claude3-opus', 'Claude3-opus'],
    ['claude3-haiku', 'Claude3-haiku'],
    ['command-r-plus-server', 'command-r-plus(cloud)'],
    ['command-r-server', 'command-r(cloud)'],
    ['command-r-local', 'command-r(local)'],
    // ['llama3', 'llama3-70iq'], //  llama3:70b-instruct  llama3-8bi16
    ['llama3','llama3-7iq'],
    ['phi3', 'phi3-3.8mi16'],
    ['vecteus-v1', 'vecteus-v1-q4'],
    ['aya', 'aya-8bq4'],
    ['elyza8', 'Llama3Elyza8b-q4'],
    ['gemma2', 'Gemma9b-iq4'],
    ['swallow8', 'Llama3Swallow8b-iq4'],
    ['neoai8', 'Llama3NeoAi8b-q4'],
    ['tanuki8', 'Tanuki-8B-GGUFq4'],
    ['GPT-o1-preview', 'OpenAI-o1-preview'],
    ['GPT-o1-mini', 'OpenAI-o1-mini'],
    ['llmjp3-13', 'llmjp3-13b-i-ggufq4'],
    ['llama31swallow8', 'Llama31-Swallow8b-i-ggufq8'],
    ['ca-calm3', 'ca-calm3-22b-GGUFq4'],
    ['plamo-beta', 'plamo-beta'],
    ['GPT3.5', 'GPT-3.5'],
  ]

  static makeLicenseLlm(sys: string) {
    const find = this.llmNameList.find(value => value[0] === sys as string);
    if (find) {
      return find[1]
    }
    return sys as string
  }

  static makeLicenceText(useSystem: string, pictModelName?: string, noMap = false, appendLicence?:string) {
    const header = noMap ? '(reply Powered ' : this.licenceText1
    return header + this.makeLicenseLlm(useSystem) + (pictModelName ? ',' + pictModelName : '') +
      (appendLicence ? `,${appendLicence}`:'')+this.licenceText2
  }

  static makeLicenceText2(useTechNames: string[], photoName?: string) {
    return '(Powered ' + useTechNames.concat(this.licenceText3).join(',')
      + (photoName ? `basePhoto:${photoName}` : '')
      + ')'
  }



  static replacePrevTalkRegPat = /\$\{prevTalk}/g

  /**
   * TypeScrip@t型の文字列テンプレート変換する
   * 書式はとりあえずtypescript型の${val}でparamMapで置き換え
   * prevUserTalkは特例で${prevTalk}に差し替える
   * @param text
   * @param paramMap
   * @param prevUserTalk
   * @private
   */
  static templatingText(text: string, paramMap: Map<string, string>, prevUserTalk: string) {
    const s = text.replaceAll(this.replacePrevTalkRegPat, prevUserTalk);
    return Array.from(paramMap.entries()).reduce((previousValue, currentValue) => {
      const reg = new RegExp('\\$\\{' + currentValue[0] + '\\}', 'g')
      return previousValue.replaceAll(reg, currentValue[1])
    }, s);
  }

  static test() {
    return "test"
  }

}
