/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import {sqliteTable, integer, text, real, unique} from "drizzle-orm/sqlite-core"


export const runAvatar = sqliteTable("run_avatar", {
  id: integer('id', {mode: "number"}).primaryKey({autoIncrement: true}),
  name: text('name').notNull(),
  modelId: integer('modelId').notNull(),
  created: integer('created', {mode: "timestamp"}).notNull(),
  enable: integer('enable', {mode: "boolean"}).default(false).notNull(),
  nextStayTime: integer('nextStayTime', {mode: "timestamp"}),
  lang: text('lang').notNull(),
  currentRoute: text('currentRoute')
})

export const avatarModel = sqliteTable("avatar_model", {
  id: integer('id', {mode: "number"}).primaryKey({autoIncrement: true}),
  label: text('comment').notNull(),
  baseCharPrompt: text('baseCharPrompt').notNull(),
  created: integer('created', {mode: "timestamp"}).notNull(),
  generateAiId: text('generateAiId').notNull(),
  modelName: text('modelName').notNull(),
})


export const runAbroadRoute = sqliteTable("run_abroad_route", {
    id: integer('id', {mode: "number"}).primaryKey({autoIncrement: true}).notNull(),
    html_instructions: text('html_instructions').notNull(),
    maneuver: text('maneuver').notNull(), //  本来向き操作の意味だがferryがここに入っているのでそれに合わせてairplaneをここに入れる
    duration: integer('duration').notNull(),  //  sec単位、human readableは略するか
    terminalStart: integer('terminalStart').notNull(),
    terminalEnd: integer('terminalStart').notNull(),
  }
);

export const runTerminal = sqliteTable("run_terminal", {
  id: integer('id', {mode: "number"}).primaryKey({autoIncrement: true}),
  country: text('country').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),

  //  https://stackoverflow.com/questions/69872250/typeorm-decimal-column-values-returned-as-strings-instead-of-decimal-numbers
  //  typeorm のdecimalはstringに化けることがあるそうだ。。。
  lat: real('lat').notNull().default(0), //  start_location,end_locationの元
  lng: real('lng').notNull().default(0), //  start_location,end_locationの元
})

export type TripStatus = 'stop' | 'running' | 'vehicle';

export const run_status = sqliteTable("run_status", {
  id: integer('id', {mode: "number"}).primaryKey({autoIncrement: true}),
  avatarId: integer("avatarId").default(1).notNull(),
  tripId: integer("tripId").default(0).notNull(),
  tilEndEpoch: integer("tilEndEpoch").default(0).notNull(),
  status: text("status",{enum:["stop","running","vehicle"]}).notNull(),
  from: text("from").notNull(),
  to: text("to").notNull(), //  現在処理中の行き先,現在位置
  destination: text("destination"), //  計画中の行き先
  startLat: real("startLat").notNull(),
  startLng: real("startLng").notNull(),
  endLat: real("endLat").notNull(),
  endLng: real("endLng").notNull(),
  durationSec: integer("durationSec").notNull(),
  distanceM: integer("distanceM").notNull(),
  startTime: integer("startTime", {mode: "timestamp"}).notNull(),
  endTime: integer("endTime", {mode: "timestamp"}),
  startCountry: text("startCountry", {length: 4}).default('NULL'),
  endCountry: text("endCountry", {length: 4}).default('NULL'),
  startTz: text("startTz").default('NULL'),
  endTz: text("endTz").default('NULL'),
  currentPathNo: integer("currentPathNo").default(0).notNull(),
  currentStepNo: integer("currentStepNo").default(0).notNull(),
});

export const avatar_model = sqliteTable("avatar_model", {
  id: integer('id', {mode: "number"}).primaryKey({autoIncrement: true}),
  comment: text("comment").notNull(),
  baseCharPrompt: text("baseCharPrompt").notNull(),
  created: integer("created", {mode: "timestamp"}).notNull(),
  modelName: text("modelName").notNull(),
});

export const env_kv = sqliteTable("env_kv", {
  key: text('key').primaryKey(),
  value: text("value").notNull(),
  created: integer("created", {mode: "timestamp"}).notNull(),
  updated: integer("updated", {mode: "timestamp"}).notNull(),
});

export const anniversary = sqliteTable("anniversary", {
  id: integer('id', {mode: "number"}).primaryKey({autoIncrement: true}),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  day: integer("day").notNull(),
  name: text("name").notNull(),
  dayOff: integer("dayOff").default(0).notNull(),
  dayType: integer("dayType").default(0).notNull(),
  historyType: integer("historyType").default(0).notNull(),
  historyId: integer("historyId").default(0).notNull(),
  del: integer("del", {mode: "boolean"}).default(false).notNull(),
  created: integer("created", {mode: "timestamp"}).notNull(),
});

export const run_history = sqliteTable("run_history", {
    seq: integer("seq").notNull(),
    tripId: integer("tripId").notNull(),
    lng: real("lng").notNull(),
    lat: real("lat").notNull(),
    elapsed: integer("elapsed").notNull(),
    address: text("address").default('NULL'),
    imagePath: text("imagePath").default('NULL'),
    coursePath: text("coursePath").default('NULL'),
    placePath: text("placePath").default('NULL'),
    plainPath: text("plainPath").default('NULL'),
    createTime: integer("createTime", {mode: "timestamp"}).notNull(),
    time: integer("time", {mode: "timestamp"}).notNull(),
    standOffsetX: integer("standOffsetX").default(0).notNull(),
    standOffsetY: integer("standOffsetY").default(0).notNull(),
    model: text("model").default('NULL'),
    fitImage: integer("fitImage", {mode: "number"}).default(0).notNull(),
    appendPrompt: text("appendPrompt").default('NULL'),
    pictAuthor: text("pictAuthor").default('NULL'),
  },
  (table) => [
      unique("UQ_seq").on(table.seq),
  ])

export type SnsType = "bs"| "tw"| "md"| "sk";

export const avatar_sns = sqliteTable("avatar_sns", {
  id: integer('id', {mode: "number"}).primaryKey({autoIncrement: true}),
  assignAvatarId: integer("assignAvatarId").notNull(),
  snsType: text("snsType", {length: 4,enum:["bs", "tw", "md", "sk"]}).notNull(),
  snsHandleName: text("snsHandleName").notNull(),
  snsId: text("snsId").notNull(),
  feedSeenAt: integer("checkedPostId").notNull().default(0),
  mentionSeenAt: integer("mentionPostId").notNull().default(0),
  created: integer("created", {mode: 'timestamp'}).notNull(),
  enable: integer("enable", {mode: "boolean"}).default(false).notNull(),
});

export const sns_posts = sqliteTable("sns_posts", {
  id: integer('id', {mode: "number"}).primaryKey({autoIncrement: true}),
  snsType: text("snsType", {length: 2}).notNull(),
  snsPostId: text("snsPostId").notNull(),
  snsReplyId: text("snsReplyId").default('NULL'),
  postType: integer("postType").notNull(),
  sendUserId: text("sendUserId").notNull(),
  info: text("info").default('NULL'),
  del: integer("del", {mode: "boolean"}).notNull(),
  createTime: integer("createTime", {mode: 'timestamp'}).notNull(),
});
