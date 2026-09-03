// @note this file exports client-safe prisma types that can be imported in browser bundles
// @note we only import types and redeclare values to avoid bundling @prisma/client
import type {
  BlueprintVisibility as BlueprintVisibilityType,
  BotVisibility as BotVisibilityType,
  DatasetVisibility as DatasetVisibilityType,
  FileVisibility as FileVisibilityType,
  ResourceState as ResourceStateType,
  Schedule as ScheduleType,
  SecretKind as SecretKindType,
  SecretType as SecretTypeType,
  SecretVisibility as SecretVisibilityType,
  SkillsetVisibility as SkillsetVisibilityType,
  Trigger as TriggerType,
  Visibility as VisibilityType,
} from '@chatbotkit-dev/db/client'

// Visibility enums

export const Visibility = {
  private: 'private',
  protected: 'protected',
  public: 'public',
} as const satisfies Record<VisibilityType, VisibilityType>

export const BlueprintVisibility = {
  private: 'private',
  protected: 'protected',
  public: 'public',
} as const satisfies Record<BlueprintVisibilityType, BlueprintVisibilityType>

export const BotVisibility = {
  private: 'private',
  protected: 'protected',
  public: 'public',
} as const satisfies Record<BotVisibilityType, BotVisibilityType>

export const DatasetVisibility = {
  private: 'private',
  protected: 'protected',
  public: 'public',
} as const satisfies Record<DatasetVisibilityType, DatasetVisibilityType>

export const FileVisibility = {
  private: 'private',
  protected: 'protected',
  public: 'public',
} as const satisfies Record<FileVisibilityType, FileVisibilityType>

export const SkillsetVisibility = {
  private: 'private',
  protected: 'protected',
  public: 'public',
} as const satisfies Record<SkillsetVisibilityType, SkillsetVisibilityType>

// Lifecycle enums

export const ResourceState = {
  enabled: 'enabled',
  disabled: 'disabled',
} as const satisfies Record<ResourceStateType, ResourceStateType>

// Secret enums

export const SecretKind = {
  shared: 'shared',
  personal: 'personal',
} as const satisfies Record<SecretKindType, SecretKindType>

export const SecretType = {
  plain: 'plain',
  basic: 'basic',
  bearer: 'bearer',
  oauth: 'oauth',
  jwt: 'jwt',
  template: 'template',
  reference: 'reference',
} as const satisfies Record<SecretTypeType, SecretTypeType>

export const SecretVisibility = {
  private: 'private',
  protected: 'protected',
  public: 'public',
} as const satisfies Record<SecretVisibilityType, SecretVisibilityType>

// Scheduling enums

export const Trigger = {
  never: 'never',
  automatic: 'automatic',
} as const satisfies Record<TriggerType, TriggerType>

export const Schedule = {
  never: 'never',
  quarterhourly: 'quarterhourly',
  halfhourly: 'halfhourly',
  hourly: 'hourly',
  twicedaily: 'twicedaily',
  daily: 'daily',
  twiceweekly: 'twiceweekly',
  weekly: 'weekly',
  twicemonthly: 'twicemonthly',
  monthly: 'monthly',
} as const satisfies Record<ScheduleType, ScheduleType>
