import {describe, expect, it} from "@effect/vitest"
import {StringUtils} from "../src/StringUtils.js";

describe("StringUtilsService", () => {
  // beforeEach(PlatformTest.create);
  // afterEach(PlatformTest.reset);

  it("should do something", () => {
    expect(true).toBeTruthy()
  });
  it("類似文字列検出", () => {
    const list = [
      "博多",
      "久留米",
      "大牟田",
      "日本",
      "牟田"
    ]
    const number = StringUtils.pickNearString(list,"本から博多絵へ");
    console.log(number)

  });
});
