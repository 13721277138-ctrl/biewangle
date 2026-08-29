import { z } from "zod";

export const ImportanceSchema = z.enum(["normal", "key"]);

export const OfficialTemplateItemSchema = z
  .object({
    itemId: z.string().min(1),
    importance: ImportanceSchema,
    title: z.string().min(1),
    condition: z.string().min(1).optional(),
    hint: z.string().min(1).optional(),
  })
  .strict();

export const OfficialTemplateGroupSchema = z
  .object({
    groupId: z.string().min(1),
    title: z.string().min(1),
    items: z.array(OfficialTemplateItemSchema).min(1),
  })
  .strict();

export const OfficialTemplateSchema = z
  .object({
    templateId: z.string().startsWith("official."),
    contentVersion: z.int().positive(),
    title: z.string().min(1),
    applicability: z.string().min(1),
    targetDurationSec: z.tuple([z.int().positive(), z.int().positive()]),
    searchAliases: z.array(z.string().min(1)).min(1),
    featuredOrder: z.int().min(1).max(7).nullable(),
    editorialIntent: z.string().min(1),
    groups: z.array(OfficialTemplateGroupSchema).min(1),
    userTip: z.string().min(1).optional(),
  })
  .strict();

export const OfficialContentBundleSchema = z
  .object({
    productId: z.literal("biewangle"),
    officialContentVersion: z.literal(1),
    derived: z.literal(true),
    source: z.literal("docs/02_别忘了_官方模板内容库_V1.1.md"),
    templates: z.array(OfficialTemplateSchema).length(13),
  })
  .strict();

export const CheckRunStatusSchema = z.enum([
  "inProgress",
  "completed",
  "endedWithUnresolved",
  "discarded",
]);

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const LocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const OfficialTemplateIdentitySchema = z
  .object({
    kind: z.literal("official"),
    templateId: z.string().startsWith("official."),
    contentVersion: z.int().positive(),
  })
  .strict();

export const PersonalTemplateIdentitySchema = z
  .object({
    kind: z.literal("personal"),
    personalTemplateId: z.string().min(1),
    updatedAt: IsoDateTimeSchema,
  })
  .strict();

export const TemplateIdentitySchema = z.discriminatedUnion("kind", [
  OfficialTemplateIdentitySchema,
  PersonalTemplateIdentitySchema,
]);

export const TemplateSnapshotSchema = z
  .object({
    title: z.string().min(1),
    applicability: z.string().min(1).optional(),
    groups: z.array(OfficialTemplateGroupSchema).min(1),
  })
  .strict();

export const PersonalTemplateSchema = z
  .object({
    personalTemplateId: z.string().min(1),
    derivedFromTemplateId: z.string().startsWith("official.").optional(),
    derivedFromContentVersion: z.int().positive().optional(),
    title: z.string().min(1),
    groups: z.array(OfficialTemplateGroupSchema).min(1),
    icon: z.string().min(1).optional(),
    themeColor: z.string().min(1).optional(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    deletedAt: IsoDateTimeSchema.optional(),
  })
  .strict();

export const PlannedCheckStatusSchema = z.enum([
  "pending",
  "consumed",
  "canceled",
]);

export const PlannedCheckSchema = z
  .object({
    plannedCheckId: z.string().min(1),
    status: PlannedCheckStatusSchema,
    scheduledDate: LocalDateSchema,
    scheduledTime: LocalTimeSchema.optional(),
    createdTimeZoneId: z.string().min(1),
    sourceTemplateIdentity: TemplateIdentitySchema,
    plannedTemplateSnapshot: TemplateSnapshotSchema,
    startedCheckRunId: z.string().min(1).optional(),
    createdAt: IsoDateTimeSchema,
  })
  .strict();

export const CheckRunItemStateSchema = z.enum([
  "unchecked",
  "confirmed",
  "notNeeded",
]);

export const CheckRunItemSchema = z
  .object({
    runItemId: z.string().min(1),
    sourceItemId: z.string().min(1).optional(),
    groupId: z.string().min(1),
    title: z.string().min(1),
    importance: ImportanceSchema,
    condition: z.string().min(1).optional(),
    hint: z.string().min(1).optional(),
    state: CheckRunItemStateSchema,
    oneTimeNote: z.string().max(500).optional(),
    runSortOrder: z.int().nonnegative(),
    isTemporary: z.boolean(),
  })
  .strict();

export const ClosedEventSchema = z
  .object({
    closedEventId: z.string().min(1),
    type: z.enum(["completed", "endedWithUnresolved", "discarded"]),
    closedAt: IsoDateTimeSchema,
    unresolvedCount: z.int().nonnegative(),
    unresolvedKeyCount: z.int().nonnegative(),
  })
  .strict();

export const CheckRunSchema = z
  .object({
    checkRunId: z.string().min(1),
    sourceTemplateIdentity: TemplateIdentitySchema,
    sourcePlannedCheckId: z.string().min(1).optional(),
    runTemplateSnapshot: TemplateSnapshotSchema,
    status: CheckRunStatusSchema,
    items: z.array(CheckRunItemSchema).min(1),
    startedAt: IsoDateTimeSchema,
    lastInteractedAt: IsoDateTimeSchema,
    closedEvents: z.array(ClosedEventSchema),
    reopenCount: z.int().nonnegative(),
    lastReopenedAt: IsoDateTimeSchema.optional(),
    deletedAt: IsoDateTimeSchema.optional(),
  })
  .strict();

export const AppSettingsSchema = z
  .object({
    favoriteTemplateIds: z.array(z.string().min(1)),
    hiddenOfficialTemplateIds: z.array(z.string().startsWith("official.")),
    backupNudgeDismissed: z.boolean(),
  })
  .strict();

export const AppSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    minimumWriterVersion: z.literal(1),
    appVersion: z.string().min(1),
    officialContentVersion: z.literal(1),
    personalTemplates: z.array(PersonalTemplateSchema),
    plannedChecks: z.array(PlannedCheckSchema),
    checkRuns: z.array(CheckRunSchema),
    settings: AppSettingsSchema,
    lastBackupAt: IsoDateTimeSchema.optional(),
    updatedAt: IsoDateTimeSchema,
  })
  .strict();

export type Importance = z.infer<typeof ImportanceSchema>;
export type OfficialTemplateItem = z.infer<
  typeof OfficialTemplateItemSchema
>;
export type OfficialTemplateGroup = z.infer<
  typeof OfficialTemplateGroupSchema
>;
export type OfficialTemplate = z.infer<typeof OfficialTemplateSchema>;
export type OfficialContentBundle = z.infer<
  typeof OfficialContentBundleSchema
>;
export type CheckRunStatus = z.infer<typeof CheckRunStatusSchema>;
export type TemplateIdentity = z.infer<typeof TemplateIdentitySchema>;
export type TemplateSnapshot = z.infer<typeof TemplateSnapshotSchema>;
export type PersonalTemplate = z.infer<typeof PersonalTemplateSchema>;
export type PlannedCheckStatus = z.infer<typeof PlannedCheckStatusSchema>;
export type PlannedCheck = z.infer<typeof PlannedCheckSchema>;
export type CheckRunItemState = z.infer<typeof CheckRunItemStateSchema>;
export type CheckRunItem = z.infer<typeof CheckRunItemSchema>;
export type ClosedEvent = z.infer<typeof ClosedEventSchema>;
export type CheckRun = z.infer<typeof CheckRunSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type AppSnapshot = z.infer<typeof AppSnapshotSchema>;
