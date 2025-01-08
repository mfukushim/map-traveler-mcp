/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import { relations } from "drizzle-orm/relations";
import {avatarModel, run_history, run_status, runAbroadRoute, runAvatar, runTerminal} from "./schema.js";


export const terminalRelations = relations(runAbroadRoute, ({ one }) => ({
  terminalStartR: one(runTerminal, {
    fields: [runAbroadRoute.terminalStart],
    references: [runTerminal.id],
  }),
  terminalEndR: one(runTerminal, {
    fields: [runAbroadRoute.terminalEnd],
    references: [runTerminal.id],
  }),
}));

export const routeRelations = relations(runTerminal, ({ many }) => ({
  routeStarts: many(runAbroadRoute),
  routeEnds: many(runAbroadRoute),
}));

export const modelRelations = relations(runAvatar, ({ one }) => ({
  terminalStartR: one(avatarModel, {
    fields: [runAvatar.modelId],
    references: [avatarModel.id],
  })
}))

export const runStatuslRelations = relations(run_status, ({ many }) => ({
  runHistory: many(run_history)
}))
