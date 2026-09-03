import { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
  DateTime: { input: any; output: any; }
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JsonObject: { input: any; output: any; }
};

export type CBKAbility = {
  __typename?: 'Ability';
  /** The blueprint associated with the ability */
  blueprint?: Maybe<CBKBlueprint>;
  /** The date and time when the ability was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the ability */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the ability */
  id?: Maybe<Scalars['ID']['output']>;
  /** The instruction for the ability */
  instruction?: Maybe<Scalars['String']['output']>;
  /** The bot the ability is linked to (the bot it acts on) */
  linkedBot?: Maybe<CBKBot>;
  /** The file the ability is linked to (the file it acts on) */
  linkedFile?: Maybe<CBKFile>;
  /** The secret the ability is linked to (the secret it acts with) */
  linkedSecret?: Maybe<CBKSecret>;
  /** The space the ability is linked to (the space it acts on) */
  linkedSpace?: Maybe<CBKSpace>;
  /** The metadata associated with the ability */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the ability */
  name?: Maybe<Scalars['String']['output']>;
  /** The skillset associated with the ability */
  skillset?: Maybe<CBKSkillset>;
  /** The lifecycle state of the ability (enabled/disabled) */
  state?: Maybe<CBKResourceState>;
  /** The date and time when the ability was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CBKAnamIntegration = {
  __typename?: 'AnamIntegration';
  /** The blueprint associated with the anam integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the anam integration */
  bot?: Maybe<CBKBot>;
  /** The date and time when the anam integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the anam integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the anam integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the anam integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the anam integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The date and time when the anam integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CBKAuditLog = {
  __typename?: 'AuditLog';
  /** The ID of the ability associated with this audit */
  abilityId?: Maybe<Scalars['String']['output']>;
  /** The action that was performed */
  action?: Maybe<Scalars['String']['output']>;
  /** The ID of the blueprint associated with this audit */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The ID of the bot associated with this audit */
  botId?: Maybe<Scalars['String']['output']>;
  /** The ID of the contact associated with this audit */
  contactId?: Maybe<Scalars['String']['output']>;
  /** The ID of the conversation associated with this audit */
  conversationId?: Maybe<Scalars['String']['output']>;
  /** The date and time when the audit log was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The ID of the dataset associated with this audit */
  datasetId?: Maybe<Scalars['String']['output']>;
  /** The description of the audit log */
  description?: Maybe<Scalars['String']['output']>;
  /** The ID of the file associated with this audit */
  fileId?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the audit log */
  id?: Maybe<Scalars['ID']['output']>;
  /** The IP address of the request */
  ipAddress?: Maybe<Scalars['String']['output']>;
  /** The metadata associated with the audit log */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the audit log */
  name?: Maybe<Scalars['String']['output']>;
  /** The new values after the action */
  newValues?: Maybe<Scalars['JsonObject']['output']>;
  /** The previous values before the action */
  oldValues?: Maybe<Scalars['JsonObject']['output']>;
  /** The ID of the policy associated with this audit */
  policyId?: Maybe<Scalars['String']['output']>;
  /** The ID of the portal associated with this audit */
  portalId?: Maybe<Scalars['String']['output']>;
  /** The ID of the record associated with this audit */
  recordId?: Maybe<Scalars['String']['output']>;
  /** The ID of the secret associated with this audit */
  secretId?: Maybe<Scalars['String']['output']>;
  /** The ID of the session associated with this audit */
  sessionId?: Maybe<Scalars['String']['output']>;
  /** The ID of the skillset associated with this audit */
  skillsetId?: Maybe<Scalars['String']['output']>;
  /** The ID of the space associated with this audit */
  spaceId?: Maybe<Scalars['String']['output']>;
  /** The ID of the task associated with this audit */
  taskId?: Maybe<Scalars['String']['output']>;
  /** The date and time when the audit log was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** The user agent of the request */
  userAgent?: Maybe<Scalars['String']['output']>;
  /** The ID of the webhook associated with this audit */
  webhookId?: Maybe<Scalars['String']['output']>;
};

export type CBKAvatarIntegration = {
  __typename?: 'AvatarIntegration';
  /** The blueprint associated with the avatar integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the avatar integration */
  bot?: Maybe<CBKBot>;
  /** The date and time when the avatar integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the avatar integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the avatar integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the avatar integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the avatar integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The date and time when the avatar integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CBKBlueprint = {
  __typename?: 'Blueprint';
  /** The abilities associated with the blueprint */
  abilities?: Maybe<CBKBlueprintAbilitiesConnection>;
  /** The bots associated with the blueprint */
  bots?: Maybe<CBKBlueprintBotsConnection>;
  /** The date and time when the blueprint was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The datasets associated with the blueprint */
  datasets?: Maybe<CBKBlueprintDatasetsConnection>;
  /** The description of the blueprint */
  description?: Maybe<Scalars['String']['output']>;
  /** The files associated with the blueprint */
  files?: Maybe<CBKBlueprintFilesConnection>;
  /** The unique identifier of the blueprint */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the blueprint */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the blueprint */
  name?: Maybe<Scalars['String']['output']>;
  /** The portals associated with the blueprint */
  portals?: Maybe<CBKBlueprintPortalsConnection>;
  /** The secrets associated with the blueprint */
  secrets?: Maybe<CBKBlueprintSecretsConnection>;
  /** The skillsets associated with the blueprint */
  skillsets?: Maybe<CBKBlueprintSkillsetsConnection>;
  /** The spaces associated with the blueprint */
  spaces?: Maybe<CBKBlueprintSpacesConnection>;
  /** The tasks associated with the blueprint */
  tasks?: Maybe<CBKBlueprintTasksConnection>;
  /** The date and time when the blueprint was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** The visibility setting of the blueprint */
  visibility?: Maybe<CBKBlueprintVisibility>;
};


export type CBKBlueprintAbilitiesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKBlueprintBotsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKBlueprintDatasetsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKBlueprintFilesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKBlueprintPortalsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKBlueprintSecretsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKBlueprintSkillsetsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKBlueprintSpacesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKBlueprintTasksArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type CBKBlueprintAbilitiesConnection = {
  __typename?: 'BlueprintAbilitiesConnection';
  edges?: Maybe<Array<Maybe<CBKBlueprintAbilitiesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKBlueprintAbilitiesConnectionEdge = {
  __typename?: 'BlueprintAbilitiesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKAbility>;
};

export type CBKBlueprintBotsConnection = {
  __typename?: 'BlueprintBotsConnection';
  edges?: Maybe<Array<Maybe<CBKBlueprintBotsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKBlueprintBotsConnectionEdge = {
  __typename?: 'BlueprintBotsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKBot>;
};

/** Input parameters for creating a new blueprint */
export type CBKBlueprintCreateRequest = {
  /** The alias ID for the blueprint */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the blueprint */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the blueprint */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the blueprint */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The visibility level of the blueprint */
  visibility?: InputMaybe<CBKBlueprintVisibility>;
};

/** Response containing the ID of a newly created blueprint */
export type CBKBlueprintCreateResponse = {
  __typename?: 'BlueprintCreateResponse';
  /** The unique identifier of the created blueprint */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKBlueprintDatasetsConnection = {
  __typename?: 'BlueprintDatasetsConnection';
  edges?: Maybe<Array<Maybe<CBKBlueprintDatasetsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKBlueprintDatasetsConnectionEdge = {
  __typename?: 'BlueprintDatasetsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKDataset>;
};

/** Response containing the ID of a deleted blueprint */
export type CBKBlueprintDeleteResponse = {
  __typename?: 'BlueprintDeleteResponse';
  /** The unique identifier of the deleted blueprint */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKBlueprintFilesConnection = {
  __typename?: 'BlueprintFilesConnection';
  edges?: Maybe<Array<Maybe<CBKBlueprintFilesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKBlueprintFilesConnectionEdge = {
  __typename?: 'BlueprintFilesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKFile>;
};

export type CBKBlueprintPortalsConnection = {
  __typename?: 'BlueprintPortalsConnection';
  edges?: Maybe<Array<Maybe<CBKBlueprintPortalsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKBlueprintPortalsConnectionEdge = {
  __typename?: 'BlueprintPortalsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKPortal>;
};

export type CBKBlueprintSecretsConnection = {
  __typename?: 'BlueprintSecretsConnection';
  edges?: Maybe<Array<Maybe<CBKBlueprintSecretsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKBlueprintSecretsConnectionEdge = {
  __typename?: 'BlueprintSecretsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKSecret>;
};

export type CBKBlueprintSkillsetsConnection = {
  __typename?: 'BlueprintSkillsetsConnection';
  edges?: Maybe<Array<Maybe<CBKBlueprintSkillsetsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKBlueprintSkillsetsConnectionEdge = {
  __typename?: 'BlueprintSkillsetsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKSkillset>;
};

export type CBKBlueprintSpacesConnection = {
  __typename?: 'BlueprintSpacesConnection';
  edges?: Maybe<Array<Maybe<CBKBlueprintSpacesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKBlueprintSpacesConnectionEdge = {
  __typename?: 'BlueprintSpacesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKSpace>;
};

export type CBKBlueprintTasksConnection = {
  __typename?: 'BlueprintTasksConnection';
  edges?: Maybe<Array<Maybe<CBKBlueprintTasksConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKBlueprintTasksConnectionEdge = {
  __typename?: 'BlueprintTasksConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKTask>;
};

/** Input parameters for updating an existing blueprint */
export type CBKBlueprintUpdateRequest = {
  /** The alias ID for the blueprint */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the blueprint */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the blueprint */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the blueprint */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The visibility level of the blueprint */
  visibility?: InputMaybe<CBKBlueprintVisibility>;
};

/** Response containing the ID of an updated blueprint */
export type CBKBlueprintUpdateResponse = {
  __typename?: 'BlueprintUpdateResponse';
  /** The unique identifier of the updated blueprint */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Visibility options for blueprints */
export enum CBKBlueprintVisibility {
  Private = 'private',
  Protected = 'protected',
  Public = 'public'
}

export type CBKBot = {
  __typename?: 'Bot';
  /** The backstory of the bot */
  backstory?: Maybe<Scalars['String']['output']>;
  /** The blueprint associated with the bot */
  blueprint?: Maybe<CBKBlueprint>;
  /** The ID of the blueprint associated with the bot */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The conversations associated with the bot */
  conversations?: Maybe<CBKBotConversationsConnection>;
  /** The date and time when the bot was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The dataset associated with the bot */
  dataset?: Maybe<CBKDataset>;
  /** The ID of the dataset associated with the bot */
  datasetId?: Maybe<Scalars['String']['output']>;
  /** The description of the bot */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the bot */
  id?: Maybe<Scalars['ID']['output']>;
  /** The memories associated with the bot */
  memories?: Maybe<CBKBotMemoriesConnection>;
  /** The metadata associated with the bot */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The model used by the bot */
  model?: Maybe<Scalars['String']['output']>;
  /** The moderation setting of the bot */
  moderation?: Maybe<Scalars['Boolean']['output']>;
  /** The name of the bot */
  name?: Maybe<Scalars['String']['output']>;
  /** The privacy setting of the bot */
  privacy?: Maybe<Scalars['Boolean']['output']>;
  /** The ratings associated with the bot */
  ratings?: Maybe<CBKBotRatingsConnection>;
  /** The skillset associated with the bot */
  skillset?: Maybe<CBKSkillset>;
  /** The ID of the skillset associated with the bot */
  skillsetId?: Maybe<Scalars['String']['output']>;
  /** The tasks associated with the bot */
  task?: Maybe<CBKBotTaskConnection>;
  /** The date and time when the bot was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type CBKBotConversationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKBotMemoriesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKBotRatingsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKBotTaskArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type CBKBotConversationsConnection = {
  __typename?: 'BotConversationsConnection';
  edges?: Maybe<Array<Maybe<CBKBotConversationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKBotConversationsConnectionEdge = {
  __typename?: 'BotConversationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKConversation>;
};

/** Input parameters for creating a new bot */
export type CBKBotCreateRequest = {
  /** The alias ID for the bot */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The backstory for the bot */
  backstory?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the dataset to use */
  datasetId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the bot */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the bot */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The AI model to use for the bot */
  model?: InputMaybe<Scalars['String']['input']>;
  /** Whether moderation is enabled */
  moderation?: InputMaybe<Scalars['Boolean']['input']>;
  /** The name of the bot */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Whether privacy mode is enabled */
  privacy?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the skillset to use */
  skillsetId?: InputMaybe<Scalars['ID']['input']>;
  /** The visibility level of the bot */
  visibility?: InputMaybe<CBKBotVisibility>;
};

/** Response containing the ID of a newly created bot */
export type CBKBotCreateResponse = {
  __typename?: 'BotCreateResponse';
  /** The unique identifier of the created bot */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted bot */
export type CBKBotDeleteResponse = {
  __typename?: 'BotDeleteResponse';
  /** The unique identifier of the deleted bot */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKBotMemoriesConnection = {
  __typename?: 'BotMemoriesConnection';
  edges?: Maybe<Array<Maybe<CBKBotMemoriesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKBotMemoriesConnectionEdge = {
  __typename?: 'BotMemoriesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKMemory>;
};

export type CBKBotRatingsConnection = {
  __typename?: 'BotRatingsConnection';
  edges?: Maybe<Array<Maybe<CBKBotRatingsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKBotRatingsConnectionEdge = {
  __typename?: 'BotRatingsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKRating>;
};

export type CBKBotTaskConnection = {
  __typename?: 'BotTaskConnection';
  edges?: Maybe<Array<Maybe<CBKBotTaskConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKBotTaskConnectionEdge = {
  __typename?: 'BotTaskConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKTask>;
};

/** Input parameters for updating an existing bot */
export type CBKBotUpdateRequest = {
  /** The alias ID for the bot */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The backstory for the bot */
  backstory?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the dataset to use */
  datasetId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the bot */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the bot */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The AI model to use for the bot */
  model?: InputMaybe<Scalars['String']['input']>;
  /** Whether moderation is enabled */
  moderation?: InputMaybe<Scalars['Boolean']['input']>;
  /** The name of the bot */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Whether privacy mode is enabled */
  privacy?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the skillset to use */
  skillsetId?: InputMaybe<Scalars['ID']['input']>;
  /** The visibility level of the bot */
  visibility?: InputMaybe<CBKBotVisibility>;
};

/** Response containing the ID of an updated bot */
export type CBKBotUpdateResponse = {
  __typename?: 'BotUpdateResponse';
  /** The unique identifier of the updated bot */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Visibility options for bots */
export enum CBKBotVisibility {
  Private = 'private',
  Protected = 'protected',
  Public = 'public'
}

export type CBKClonePlatformExampleInput = {
  id: Scalars['ID']['input'];
};

export type CBKClonePlatformExampleResult = {
  __typename?: 'ClonePlatformExampleResult';
  /** A map of resource types to arrays of created resources */
  resources?: Maybe<Scalars['JsonObject']['output']>;
};

export type CBKContact = {
  __typename?: 'Contact';
  /** The conversations associated with the contact */
  conversations?: Maybe<CBKContactConversationsConnection>;
  /** The date and time when the contact was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the contact */
  description?: Maybe<Scalars['String']['output']>;
  /** The email of the contact */
  email?: Maybe<Scalars['String']['output']>;
  /** The fingerprint of the contact */
  fingerprint?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the contact */
  id?: Maybe<Scalars['ID']['output']>;
  /** The memories associated with the contact */
  memories?: Maybe<CBKContactMemoriesConnection>;
  /** The metadata associated with the contact */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the contact */
  name?: Maybe<Scalars['String']['output']>;
  /** The nickname of the contact */
  nick?: Maybe<Scalars['String']['output']>;
  /** The phone number of the contact */
  phone?: Maybe<Scalars['String']['output']>;
  /** The ratings associated with the contact */
  ratings?: Maybe<CBKContactRatingsConnection>;
  /** The spaces associated with the contact */
  spaces?: Maybe<CBKContactSpacesConnection>;
  /** The tasks associated with the contact */
  tasks?: Maybe<CBKContactTasksConnection>;
  /** The date and time when the contact was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** The date and time when the contact was verified */
  verifiedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type CBKContactConversationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKContactMemoriesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKContactRatingsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKContactSpacesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKContactTasksArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type CBKContactConversationsConnection = {
  __typename?: 'ContactConversationsConnection';
  edges?: Maybe<Array<Maybe<CBKContactConversationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKContactConversationsConnectionEdge = {
  __typename?: 'ContactConversationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKConversation>;
};

export type CBKContactMemoriesConnection = {
  __typename?: 'ContactMemoriesConnection';
  edges?: Maybe<Array<Maybe<CBKContactMemoriesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKContactMemoriesConnectionEdge = {
  __typename?: 'ContactMemoriesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKMemory>;
};

export type CBKContactRatingsConnection = {
  __typename?: 'ContactRatingsConnection';
  edges?: Maybe<Array<Maybe<CBKContactRatingsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKContactRatingsConnectionEdge = {
  __typename?: 'ContactRatingsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKRating>;
};

export type CBKContactSpacesConnection = {
  __typename?: 'ContactSpacesConnection';
  edges?: Maybe<Array<Maybe<CBKContactSpacesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKContactSpacesConnectionEdge = {
  __typename?: 'ContactSpacesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKSpace>;
};

export type CBKContactTasksConnection = {
  __typename?: 'ContactTasksConnection';
  edges?: Maybe<Array<Maybe<CBKContactTasksConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKContactTasksConnectionEdge = {
  __typename?: 'ContactTasksConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKTask>;
};

export type CBKContext = {
  __typename?: 'Context';
  /** The ID of the blueprint linked to the context */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The ID of the bot linked to the context */
  botId?: Maybe<Scalars['String']['output']>;
  /** The ID of the contact linked to the context */
  contactId?: Maybe<Scalars['String']['output']>;
  /** The date and time when the context was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The ID of the dataset linked to the context */
  datasetId?: Maybe<Scalars['String']['output']>;
  /** The description of the context */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the context */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the context */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the context */
  name?: Maybe<Scalars['String']['output']>;
  /** The context payload */
  payload?: Maybe<Scalars['JsonObject']['output']>;
  /** The ID of the skillset linked to the context */
  skillsetId?: Maybe<Scalars['String']['output']>;
  /** The date and time when the context was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CBKContextBlueprint = {
  __typename?: 'ContextBlueprint';
  /** The description of the blueprint */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the blueprint */
  id?: Maybe<Scalars['ID']['output']>;
  /** The name of the blueprint */
  name?: Maybe<Scalars['String']['output']>;
};

/** Visibility options for blueprints in the context of a user */
export enum CBKContextBlueprintVisibility {
  Protected = 'protected',
  Public = 'public'
}

export type CBKContextBot = {
  __typename?: 'ContextBot';
  /** The description of the bot */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the bot */
  id?: Maybe<Scalars['ID']['output']>;
  /** The name of the bot */
  name?: Maybe<Scalars['String']['output']>;
};

/** Visibility options for bots in the context of a user */
export enum CBKContextBotVisibility {
  Protected = 'protected',
  Public = 'public'
}

/** Input parameters for creating a new context */
export type CBKContextCreateRequest = {
  /** The ID of the blueprint to link */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to link */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the contact to link */
  contactId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the dataset to link */
  datasetId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the context */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the context */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the context */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Optional JSON payload to attach to the context */
  payload?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The ID of the skillset to link */
  skillsetId?: InputMaybe<Scalars['ID']['input']>;
};

/** Response containing the ID of a newly created context */
export type CBKContextCreateResponse = {
  __typename?: 'ContextCreateResponse';
  /** The unique identifier of the created context */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKContextDataset = {
  __typename?: 'ContextDataset';
  /** The description of the dataset */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the dataset */
  id?: Maybe<Scalars['ID']['output']>;
  /** The name of the dataset */
  name?: Maybe<Scalars['String']['output']>;
};

/** Visibility options for datasets in the context of a user */
export enum CBKContextDatasetVisibility {
  Protected = 'protected',
  Public = 'public'
}

/** Response containing the ID of a deleted context */
export type CBKContextDeleteResponse = {
  __typename?: 'ContextDeleteResponse';
  /** The unique identifier of the deleted context */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKContextFile = {
  __typename?: 'ContextFile';
  /** The description of the file */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the file */
  id?: Maybe<Scalars['ID']['output']>;
  /** The name of the file */
  name?: Maybe<Scalars['String']['output']>;
};

/** Visibility options for files in the context of a user */
export enum CBKContextFileVisibility {
  Protected = 'protected',
  Public = 'public'
}

export type CBKContextPortal = {
  __typename?: 'ContextPortal';
  /** The description of the portal */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the portal */
  id?: Maybe<Scalars['ID']['output']>;
  /** The name of the portal */
  name?: Maybe<Scalars['String']['output']>;
  /** The slug of the portal, used for URL routing */
  slug?: Maybe<Scalars['String']['output']>;
};

export type CBKContextSecret = {
  __typename?: 'ContextSecret';
  /** The contacts associated with the secret */
  contacts?: Maybe<Array<CBKSecretContact>>;
  /** The description of the secret */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the secret */
  id?: Maybe<Scalars['ID']['output']>;
  /** The name of the secret */
  name?: Maybe<Scalars['String']['output']>;
};


export type CBKContextSecretContactsArgs = {
  contactIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

/** Kinds of secrets in the context of a user */
export enum CBKContextSecretKind {
  Personal = 'personal'
}

/** Types of secrets in the context of a user */
export enum CBKContextSecretType {
  Basic = 'basic',
  Bearer = 'bearer',
  Jwt = 'jwt',
  Oauth = 'oauth',
  Plain = 'plain',
  Reference = 'reference',
  Template = 'template'
}

/** Visibility options for secrets in the context of a user */
export enum CBKContextSecretVisibility {
  Protected = 'protected',
  Public = 'public'
}

export type CBKContextSkillset = {
  __typename?: 'ContextSkillset';
  /** The description of the skillset */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the skillset */
  id?: Maybe<Scalars['ID']['output']>;
  /** The name of the skillset */
  name?: Maybe<Scalars['String']['output']>;
};

/** Visibility options for skillsets in the context of a user */
export enum CBKContextSkillsetVisibility {
  Protected = 'protected',
  Public = 'public'
}

/** Input parameters for updating an existing context */
export type CBKContextUpdateRequest = {
  /** The ID of the blueprint to link */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to link */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the contact to link */
  contactId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the dataset to link */
  datasetId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the context */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the context */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the context */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Optional JSON payload to attach to the context */
  payload?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The ID of the skillset to link */
  skillsetId?: InputMaybe<Scalars['ID']['input']>;
};

/** Response containing the ID of an updated context */
export type CBKContextUpdateResponse = {
  __typename?: 'ContextUpdateResponse';
  /** The unique identifier of the updated context */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKContextUser = {
  __typename?: 'ContextUser';
  /** The description of the user */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the user */
  id?: Maybe<Scalars['ID']['output']>;
  /** The name of the user */
  name?: Maybe<Scalars['String']['output']>;
};

export type CBKConversation = {
  __typename?: 'Conversation';
  /** The bot associated with the conversation */
  bot?: Maybe<CBKBot>;
  /** The contact associated with the conversation */
  contact?: Maybe<CBKContact>;
  /** The date and time when the conversation was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the conversation */
  description?: Maybe<Scalars['String']['output']>;
  /** The date and time when the conversation expires */
  expiresAt?: Maybe<Scalars['DateTime']['output']>;
  /** The unique identifier of the conversation */
  id?: Maybe<Scalars['ID']['output']>;
  /** The messages in the conversation */
  messages?: Maybe<CBKConversationMessagesConnection>;
  /** The metadata associated with the conversation */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the conversation */
  name?: Maybe<Scalars['String']['output']>;
  /** The ratings associated with the conversation */
  ratings?: Maybe<CBKConversationRatingsConnection>;
  /** The space associated with the conversation */
  space?: Maybe<CBKSpace>;
  /** The task associated with the conversation */
  task?: Maybe<CBKTask>;
  /** The date and time when the conversation was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type CBKConversationMessagesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKConversationRatingsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type CBKConversationMessagesConnection = {
  __typename?: 'ConversationMessagesConnection';
  edges?: Maybe<Array<Maybe<CBKConversationMessagesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKConversationMessagesConnectionEdge = {
  __typename?: 'ConversationMessagesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKMessage>;
};

export type CBKConversationRatingsConnection = {
  __typename?: 'ConversationRatingsConnection';
  edges?: Maybe<Array<Maybe<CBKConversationRatingsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKConversationRatingsConnectionEdge = {
  __typename?: 'ConversationRatingsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKRating>;
};

export type CBKDataset = {
  __typename?: 'Dataset';
  /** The blueprint associated with the dataset */
  blueprint?: Maybe<CBKBlueprint>;
  /** The ID of the blueprint associated with the dataset */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The bots associated with the dataset */
  bots?: Maybe<CBKDatasetBotsConnection>;
  /** The date and time when the dataset was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the dataset */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the dataset */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the dataset */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the dataset */
  name?: Maybe<Scalars['String']['output']>;
  /** The date and time when the dataset was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type CBKDatasetBotsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type CBKDatasetBotsConnection = {
  __typename?: 'DatasetBotsConnection';
  edges?: Maybe<Array<Maybe<CBKDatasetBotsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKDatasetBotsConnectionEdge = {
  __typename?: 'DatasetBotsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKBot>;
};

/** Input parameters for creating a new dataset */
export type CBKDatasetCreateRequest = {
  /** The alias ID for the dataset */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the dataset */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Instruction when matches are found */
  matchInstruction?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the dataset */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** Instruction when no matches are found */
  mismatchInstruction?: InputMaybe<Scalars['String']['input']>;
  /** The name of the dataset */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Maximum tokens per record */
  recordMaxTokens?: InputMaybe<Scalars['Int']['input']>;
  /** The reranking model to use */
  reranker?: InputMaybe<Scalars['String']['input']>;
  /** Maximum number of search results */
  searchMaxRecords?: InputMaybe<Scalars['Int']['input']>;
  /** Maximum tokens in search results */
  searchMaxTokens?: InputMaybe<Scalars['Int']['input']>;
  /** Minimum score for search results */
  searchMinScore?: InputMaybe<Scalars['Float']['input']>;
  /** The separators for chunking text */
  separators?: InputMaybe<Scalars['String']['input']>;
  /** The visibility level of the dataset */
  visibility?: InputMaybe<CBKDatasetVisibility>;
};

/** Response containing the ID of a newly created dataset */
export type CBKDatasetCreateResponse = {
  __typename?: 'DatasetCreateResponse';
  /** The unique identifier of the created dataset */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted dataset */
export type CBKDatasetDeleteResponse = {
  __typename?: 'DatasetDeleteResponse';
  /** The unique identifier of the deleted dataset */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing dataset */
export type CBKDatasetUpdateRequest = {
  /** The alias ID for the dataset */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the dataset */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Instruction when matches are found */
  matchInstruction?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the dataset */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** Instruction when no matches are found */
  mismatchInstruction?: InputMaybe<Scalars['String']['input']>;
  /** The name of the dataset */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Maximum tokens per record */
  recordMaxTokens?: InputMaybe<Scalars['Int']['input']>;
  /** The reranking model to use */
  reranker?: InputMaybe<Scalars['String']['input']>;
  /** Maximum number of search results */
  searchMaxRecords?: InputMaybe<Scalars['Int']['input']>;
  /** Maximum tokens in search results */
  searchMaxTokens?: InputMaybe<Scalars['Int']['input']>;
  /** Minimum score for search results */
  searchMinScore?: InputMaybe<Scalars['Float']['input']>;
  /** The separators for chunking text */
  separators?: InputMaybe<Scalars['String']['input']>;
  /** The visibility level of the dataset */
  visibility?: InputMaybe<CBKDatasetVisibility>;
};

/** Response containing the ID of an updated dataset */
export type CBKDatasetUpdateResponse = {
  __typename?: 'DatasetUpdateResponse';
  /** The unique identifier of the updated dataset */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Visibility options for datasets */
export enum CBKDatasetVisibility {
  Private = 'private',
  Protected = 'protected',
  Public = 'public'
}

export type CBKDiscordIntegration = {
  __typename?: 'DiscordIntegration';
  /** The allowed senders for the discord integration */
  allowFrom?: Maybe<Scalars['String']['output']>;
  /** Whether attachments are enabled */
  attachments?: Maybe<Scalars['Boolean']['output']>;
  /** The blueprint associated with the discord integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the discord integration */
  bot?: Maybe<CBKBot>;
  /** Whether contact collection is enabled */
  contactCollection?: Maybe<Scalars['Boolean']['output']>;
  /** The date and time when the discord integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the discord integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the discord integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the discord integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the discord integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The session duration for the discord integration */
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  /** The date and time when the discord integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** Whether the integration holds every credential it needs to carry traffic, and how to install it if not */
  verification: CBKIntegrationVerification;
};

/** Input parameters for creating a new Discord integration */
export type CBKDiscordIntegrationCreateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The allowed senders for the discord integration */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** The Discord application ID */
  appId?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The Discord bot token for API access */
  botToken?: InputMaybe<Scalars['String']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** The bot handle or username */
  handle?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The Discord public key for request verification */
  publicKey?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of a newly created Discord integration */
export type CBKDiscordIntegrationCreateResponse = {
  __typename?: 'DiscordIntegrationCreateResponse';
  /** The unique identifier of the created Discord integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Discord integration */
export type CBKDiscordIntegrationDeleteResponse = {
  __typename?: 'DiscordIntegrationDeleteResponse';
  /** The unique identifier of the deleted Discord integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Discord integration */
export type CBKDiscordIntegrationUpdateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The allowed senders for the discord integration */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** The Discord application ID */
  appId?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The Discord bot token for API access */
  botToken?: InputMaybe<Scalars['String']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** The bot handle or username */
  handle?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The Discord public key for request verification */
  publicKey?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of an updated Discord integration */
export type CBKDiscordIntegrationUpdateResponse = {
  __typename?: 'DiscordIntegrationUpdateResponse';
  /** The unique identifier of the updated Discord integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKEmailIntegration = {
  __typename?: 'EmailIntegration';
  /** The allowed sender emails for the email integration */
  allowFrom?: Maybe<Scalars['String']['output']>;
  /** Whether attachments are enabled */
  attachments?: Maybe<Scalars['Boolean']['output']>;
  /** The blueprint associated with the email integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the email integration */
  bot?: Maybe<CBKBot>;
  /** Whether contact collection is enabled */
  contactCollection?: Maybe<Scalars['Boolean']['output']>;
  /** The date and time when the email integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the email integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the email integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the email integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the email integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The session duration for the email integration */
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  /** The date and time when the email integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** Whether the integration holds every credential it needs to carry traffic, and how to install it if not */
  verification: CBKIntegrationVerification;
};

/** Input parameters for creating a new Email integration */
export type CBKEmailIntegrationCreateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** A line-separated list of allowed sender email addresses */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable file attachments */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of a newly created Email integration */
export type CBKEmailIntegrationCreateResponse = {
  __typename?: 'EmailIntegrationCreateResponse';
  /** The unique identifier of the created Email integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Email integration */
export type CBKEmailIntegrationDeleteResponse = {
  __typename?: 'EmailIntegrationDeleteResponse';
  /** The unique identifier of the deleted Email integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Email integration */
export type CBKEmailIntegrationUpdateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** A line-separated list of allowed sender email addresses */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable file attachments */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of an updated Email integration */
export type CBKEmailIntegrationUpdateResponse = {
  __typename?: 'EmailIntegrationUpdateResponse';
  /** The unique identifier of the updated Email integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKEventLog = {
  __typename?: 'EventLog';
  /** The ID of the ability associated with this event */
  abilityId?: Maybe<Scalars['String']['output']>;
  /** The ID of the blueprint associated with this event */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The ID of the bot associated with this event */
  botId?: Maybe<Scalars['String']['output']>;
  /** The ID of the contact associated with this event */
  contactId?: Maybe<Scalars['String']['output']>;
  /** The ID of the conversation associated with this event */
  conversationId?: Maybe<Scalars['String']['output']>;
  /** The date and time when the event log was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The ID of the dataset associated with this event */
  datasetId?: Maybe<Scalars['String']['output']>;
  /** The description of the event log */
  description?: Maybe<Scalars['String']['output']>;
  /** The ID of the file associated with this event */
  fileId?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the event log */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the event log */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the event log */
  name?: Maybe<Scalars['String']['output']>;
  /** The ID of the record associated with this event */
  recordId?: Maybe<Scalars['String']['output']>;
  /** The ID of the secret associated with this event */
  secretId?: Maybe<Scalars['String']['output']>;
  /** The ID of the skillset associated with this event */
  skillsetId?: Maybe<Scalars['String']['output']>;
  /** The ID of the space associated with this event */
  spaceId?: Maybe<Scalars['String']['output']>;
  /** The ID of the task associated with this event */
  taskId?: Maybe<Scalars['String']['output']>;
  /** The type of the event */
  type?: Maybe<Scalars['String']['output']>;
  /** The date and time when the event log was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CBKExtractIntegration = {
  __typename?: 'ExtractIntegration';
  /** The blueprint associated with the extract integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the extract integration */
  bot?: Maybe<CBKBot>;
  /** The date and time when the extract integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the extract integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the extract integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the extract integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The LLM model to use for the extract integration */
  model?: Maybe<Scalars['String']['output']>;
  /** The name of the extract integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The date and time when the extract integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Input parameters for creating a new Extract integration */
export type CBKExtractIntegrationCreateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The LLM model to use for the extract integration */
  model?: InputMaybe<Scalars['String']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The webhook URL to send extracted data to */
  request?: InputMaybe<Scalars['String']['input']>;
  /** The JSON schema defining the data structure to extract */
  schema?: InputMaybe<Scalars['JsonObject']['input']>;
};

/** Response containing the ID of a newly created Extract integration */
export type CBKExtractIntegrationCreateResponse = {
  __typename?: 'ExtractIntegrationCreateResponse';
  /** The unique identifier of the created Extract integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Extract integration */
export type CBKExtractIntegrationDeleteResponse = {
  __typename?: 'ExtractIntegrationDeleteResponse';
  /** The unique identifier of the deleted Extract integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Extract integration */
export type CBKExtractIntegrationUpdateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The LLM model to use for the extract integration */
  model?: InputMaybe<Scalars['String']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The webhook URL to send extracted data to */
  request?: InputMaybe<Scalars['String']['input']>;
  /** The JSON schema defining the data structure to extract */
  schema?: InputMaybe<Scalars['JsonObject']['input']>;
};

/** Response containing the ID of an updated Extract integration */
export type CBKExtractIntegrationUpdateResponse = {
  __typename?: 'ExtractIntegrationUpdateResponse';
  /** The unique identifier of the updated Extract integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKFile = {
  __typename?: 'File';
  /** The blueprint associated with the file */
  blueprint?: Maybe<CBKBlueprint>;
  /** The ID of the blueprint associated with the file */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The date and time when the file was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the file */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the file */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the file */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the file */
  name?: Maybe<Scalars['String']['output']>;
  /** The date and time when the file was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Input parameters for creating a new file */
export type CBKFileCreateRequest = {
  /** The alias ID for the file */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the file */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the file */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the file */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The visibility level of the file */
  visibility?: InputMaybe<CBKFileVisibility>;
};

/** Response containing the ID of a newly created file */
export type CBKFileCreateResponse = {
  __typename?: 'FileCreateResponse';
  /** The unique identifier of the created file */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted file */
export type CBKFileDeleteResponse = {
  __typename?: 'FileDeleteResponse';
  /** The unique identifier of the deleted file */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing file */
export type CBKFileUpdateRequest = {
  /** The alias ID for the file */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the file */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the file */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the file */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The visibility level of the file */
  visibility?: InputMaybe<CBKFileVisibility>;
};

/** Response containing the ID of an updated file */
export type CBKFileUpdateResponse = {
  __typename?: 'FileUpdateResponse';
  /** The unique identifier of the updated file */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Visibility options for files */
export enum CBKFileVisibility {
  Private = 'private',
  Protected = 'protected',
  Public = 'public'
}

export type CBKGithubIntegration = {
  __typename?: 'GithubIntegration';
  /** The blueprint associated with the github integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the github integration */
  bot?: Maybe<CBKBot>;
  /** The date and time when the github integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the github integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the github integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the github integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the github integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The date and time when the github integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CBKGooglechatIntegration = {
  __typename?: 'GooglechatIntegration';
  /** The allowed senders for the Google Chat integration */
  allowFrom?: Maybe<Scalars['String']['output']>;
  /** The auto-respond configuration for the Google Chat integration */
  autoRespond?: Maybe<Scalars['String']['output']>;
  /** The blueprint associated with the Google Chat integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the Google Chat integration */
  bot?: Maybe<CBKBot>;
  /** Whether contact collection is enabled */
  contactCollection?: Maybe<Scalars['Boolean']['output']>;
  /** The date and time when the Google Chat integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the Google Chat integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the Google Chat integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the Google Chat integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the Google Chat integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The session duration for the Google Chat integration */
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  /** The date and time when the Google Chat integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** Whether the integration holds every credential it needs to carry traffic, and how to install it if not */
  verification: CBKIntegrationVerification;
};

/** Input parameters for creating a new Google Chat integration */
export type CBKGooglechatIntegrationCreateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The allowed senders for this integration */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable file attachments */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** Configure automatic response behavior */
  autoRespond?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The Google Cloud project number used to verify incoming event JWT audience claims */
  projectNumber?: InputMaybe<Scalars['String']['input']>;
  /** The Google service account JSON key for sending messages via the Chat REST API */
  serviceAccountKey?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of a newly created Google Chat integration */
export type CBKGooglechatIntegrationCreateResponse = {
  __typename?: 'GooglechatIntegrationCreateResponse';
  /** The unique identifier of the created Google Chat integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Google Chat integration */
export type CBKGooglechatIntegrationDeleteResponse = {
  __typename?: 'GooglechatIntegrationDeleteResponse';
  /** The unique identifier of the deleted Google Chat integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Google Chat integration */
export type CBKGooglechatIntegrationUpdateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The allowed senders for this integration */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable file attachments */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** Configure automatic response behavior */
  autoRespond?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The Google Cloud project number used to verify incoming event JWT audience claims */
  projectNumber?: InputMaybe<Scalars['String']['input']>;
  /** The Google service account JSON key for sending messages via the Chat REST API */
  serviceAccountKey?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of an updated Google Chat integration */
export type CBKGooglechatIntegrationUpdateResponse = {
  __typename?: 'GooglechatIntegrationUpdateResponse';
  /** The unique identifier of the updated Google Chat integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKIncludeOwnBlueprintsInput = {
  /** Filter own blueprints by metadata */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** Visibility of the own blueprints to include */
  visibility?: InputMaybe<Array<CBKBlueprintVisibility>>;
};

export type CBKIncludeOwnBotsInput = {
  /** Filter own bots by metadata */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** Visibility of the own bots to include */
  visibility?: InputMaybe<Array<CBKBotVisibility>>;
};

export type CBKIncludeOwnDatasetsInput = {
  /** Filter own datasets by metadata */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** Visibility of the own datasets to include */
  visibility?: InputMaybe<Array<CBKDatasetVisibility>>;
};

export type CBKIncludeOwnFilesInput = {
  /** Filter own files by metadata */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** Visibility of the own files to include */
  visibility?: InputMaybe<Array<CBKFileVisibility>>;
};

export type CBKIncludeOwnSecretsInput = {
  /** Filter secrets by kind */
  kind?: InputMaybe<Array<CBKSecretKind>>;
  /** Filter own secrets by metadata */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** Filter own secrets by type */
  type?: InputMaybe<Array<CBKSecretType>>;
  /** Visibility of the own secrets to include */
  visibility?: InputMaybe<Array<CBKSecretVisibility>>;
};

export type CBKIncludeOwnSkillsetsInput = {
  /** Filter own skillsets by metadata */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** Visibility of the own skillsets to include */
  visibility?: InputMaybe<Array<CBKSkillsetVisibility>>;
};

export type CBKInstagramIntegration = {
  __typename?: 'InstagramIntegration';
  /** Whether attachments are enabled */
  attachments?: Maybe<Scalars['Boolean']['output']>;
  /** The blueprint associated with the instagram integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the instagram integration */
  bot?: Maybe<CBKBot>;
  /** Whether contact collection is enabled */
  contactCollection?: Maybe<Scalars['Boolean']['output']>;
  /** The date and time when the instagram integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the instagram integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the instagram integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the instagram integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the instagram integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The session duration for the instagram integration */
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  /** The date and time when the instagram integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** Whether the integration holds every credential it needs to carry traffic, and how to install it if not */
  verification: CBKIntegrationVerification;
};

/** Input parameters for creating a new Instagram integration */
export type CBKInstagramIntegrationCreateRequest = {
  /** The Instagram access token */
  accessToken?: InputMaybe<Scalars['String']['input']>;
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The Meta app secret used to validate webhook signatures */
  appSecret?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable file attachments */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of a newly created Instagram integration */
export type CBKInstagramIntegrationCreateResponse = {
  __typename?: 'InstagramIntegrationCreateResponse';
  /** The unique identifier of the created Instagram integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Instagram integration */
export type CBKInstagramIntegrationDeleteResponse = {
  __typename?: 'InstagramIntegrationDeleteResponse';
  /** The unique identifier of the deleted Instagram integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Instagram integration */
export type CBKInstagramIntegrationUpdateRequest = {
  /** The Instagram access token */
  accessToken?: InputMaybe<Scalars['String']['input']>;
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The Meta app secret used to validate webhook signatures */
  appSecret?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable file attachments */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of an updated Instagram integration */
export type CBKInstagramIntegrationUpdateResponse = {
  __typename?: 'InstagramIntegrationUpdateResponse';
  /** The unique identifier of the updated Instagram integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKIntegrationVerification = {
  __typename?: 'IntegrationVerification';
  /** The actions available for the verification */
  action?: Maybe<CBKIntegrationVerificationAction>;
  /** The verification status of the integration */
  status: CBKIntegrationVerificationStatus;
};

export type CBKIntegrationVerificationAction = {
  __typename?: 'IntegrationVerificationAction';
  /** The type of action that can be performed for verification */
  type: CBKIntegrationVerificationActionType;
  /** The URL to perform the action for verification */
  url?: Maybe<Scalars['String']['output']>;
};

/** The type of action that can be performed for verification of the integration */
export enum CBKIntegrationVerificationActionType {
  Install = 'install'
}

/** The status of the verification for the integration */
export enum CBKIntegrationVerificationStatus {
  Configured = 'configured',
  Unconfigured = 'unconfigured'
}

/** The order of items in a paginated list */
export enum CBKListOrder {
  Asc = 'asc',
  Desc = 'desc'
}

export type CBKMcpserverIntegration = {
  __typename?: 'McpserverIntegration';
  /** The blueprint associated with the MCP server integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The date and time when the MCP server integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the MCP server integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the MCP server integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the MCP server integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the MCP server integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The skillset associated with the MCP server integration */
  skillset?: Maybe<CBKSkillset>;
  /** The date and time when the MCP server integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Input parameters for creating a new MCP Server integration */
export type CBKMcpserverIntegrationCreateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the OAuth connection for IdP-based authentication */
  oAuthConnectionId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the skillset to connect */
  skillsetId?: InputMaybe<Scalars['ID']['input']>;
};

/** Response containing the ID of a newly created MCP Server integration */
export type CBKMcpserverIntegrationCreateResponse = {
  __typename?: 'McpserverIntegrationCreateResponse';
  /** The unique identifier of the created MCP Server integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted MCP Server integration */
export type CBKMcpserverIntegrationDeleteResponse = {
  __typename?: 'McpserverIntegrationDeleteResponse';
  /** The unique identifier of the deleted MCP Server integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing MCP Server integration */
export type CBKMcpserverIntegrationUpdateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the OAuth connection for IdP-based authentication */
  oAuthConnectionId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the skillset to connect */
  skillsetId?: InputMaybe<Scalars['ID']['input']>;
};

/** Response containing the ID of an updated MCP Server integration */
export type CBKMcpserverIntegrationUpdateResponse = {
  __typename?: 'McpserverIntegrationUpdateResponse';
  /** The unique identifier of the updated MCP Server integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKMemory = {
  __typename?: 'Memory';
  /** The ID of the bot the memory is scoped to */
  botId?: Maybe<Scalars['String']['output']>;
  /** The ID of the contact the memory is scoped to */
  contactId?: Maybe<Scalars['String']['output']>;
  /** The date and time when the memory was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the memory */
  description?: Maybe<Scalars['String']['output']>;
  /** The date and time when the memory expires */
  expiresAt?: Maybe<Scalars['DateTime']['output']>;
  /** The unique identifier of the memory */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the memory */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the memory */
  name?: Maybe<Scalars['String']['output']>;
  /** The text content of the memory */
  text?: Maybe<Scalars['String']['output']>;
  /** The date and time when the memory was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** The user associated with the memory */
  user?: Maybe<CBKUser>;
};

export type CBKMessage = {
  __typename?: 'Message';
  /** The conversation this message belongs to */
  conversation: CBKConversation;
  /** The date and time when the message was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the message */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the message */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the message */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the message */
  name?: Maybe<Scalars['String']['output']>;
  /** The ratings associated with the message */
  ratings?: Maybe<CBKMessageRatingsConnection>;
  /** The text content of the message */
  text?: Maybe<Scalars['String']['output']>;
  /** The type of the message */
  type?: Maybe<CBKMessageType>;
  /** The date and time when the message was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type CBKMessageRatingsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type CBKMessageRatingsConnection = {
  __typename?: 'MessageRatingsConnection';
  edges?: Maybe<Array<Maybe<CBKMessageRatingsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKMessageRatingsConnectionEdge = {
  __typename?: 'MessageRatingsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKRating>;
};

/** Types of messages in a conversation */
export enum CBKMessageType {
  Activity = 'activity',
  Backstory = 'backstory',
  Bot = 'bot',
  Checkpoint = 'checkpoint',
  Context = 'context',
  Instruction = 'instruction',
  Reasoning = 'reasoning',
  User = 'user'
}

export type CBKMessengerIntegration = {
  __typename?: 'MessengerIntegration';
  /** Whether attachments are enabled */
  attachments?: Maybe<Scalars['Boolean']['output']>;
  /** The blueprint associated with the messenger integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the messenger integration */
  bot?: Maybe<CBKBot>;
  /** Whether contact collection is enabled */
  contactCollection?: Maybe<Scalars['Boolean']['output']>;
  /** The date and time when the messenger integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the messenger integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the messenger integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the messenger integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the messenger integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The session duration for the messenger integration */
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  /** The date and time when the messenger integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** Whether the integration holds every credential it needs to carry traffic, and how to install it if not */
  verification: CBKIntegrationVerification;
};

/** Input parameters for creating a new Messenger integration */
export type CBKMessengerIntegrationCreateRequest = {
  /** The Facebook Messenger page access token */
  accessToken?: InputMaybe<Scalars['String']['input']>;
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The Meta app secret used to validate webhook signatures */
  appSecret?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable file attachments */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to enable contact collection */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of a newly created Messenger integration */
export type CBKMessengerIntegrationCreateResponse = {
  __typename?: 'MessengerIntegrationCreateResponse';
  /** The unique identifier of the created Messenger integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Messenger integration */
export type CBKMessengerIntegrationDeleteResponse = {
  __typename?: 'MessengerIntegrationDeleteResponse';
  /** The unique identifier of the deleted Messenger integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Messenger integration */
export type CBKMessengerIntegrationUpdateRequest = {
  /** The Facebook Messenger page access token */
  accessToken?: InputMaybe<Scalars['String']['input']>;
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The Meta app secret used to validate webhook signatures */
  appSecret?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable file attachments */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to enable contact collection */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of an updated Messenger integration */
export type CBKMessengerIntegrationUpdateResponse = {
  __typename?: 'MessengerIntegrationUpdateResponse';
  /** The unique identifier of the updated Messenger integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKMicrosoftteamsIntegration = {
  __typename?: 'MicrosoftteamsIntegration';
  /** The allowed senders for the Microsoft Teams integration */
  allowFrom?: Maybe<Scalars['String']['output']>;
  /** Whether attachments are enabled */
  attachments?: Maybe<Scalars['Boolean']['output']>;
  /** The blueprint associated with the Microsoft Teams integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the Microsoft Teams integration */
  bot?: Maybe<CBKBot>;
  /** Whether contact collection is enabled */
  contactCollection?: Maybe<Scalars['Boolean']['output']>;
  /** The date and time when the Microsoft Teams integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the Microsoft Teams integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the Microsoft Teams integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the Microsoft Teams integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the Microsoft Teams integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The session duration for the Microsoft Teams integration */
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  /** The date and time when the Microsoft Teams integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** Whether the integration holds every credential it needs to carry traffic, and how to install it if not */
  verification: CBKIntegrationVerification;
};

/** Input parameters for creating a new Microsoft Teams integration */
export type CBKMicrosoftteamsIntegrationCreateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The allowed senders for this integration */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The Microsoft Bot Framework application ID */
  botFrameworkAppId?: InputMaybe<Scalars['String']['input']>;
  /** The Microsoft Bot Framework application secret */
  botFrameworkAppSecret?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  /** The Azure AD tenant ID */
  tenantId?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of a newly created Microsoft Teams integration */
export type CBKMicrosoftteamsIntegrationCreateResponse = {
  __typename?: 'MicrosoftteamsIntegrationCreateResponse';
  /** The unique identifier of the created Microsoft Teams integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Microsoft Teams integration */
export type CBKMicrosoftteamsIntegrationDeleteResponse = {
  __typename?: 'MicrosoftteamsIntegrationDeleteResponse';
  /** The unique identifier of the deleted Microsoft Teams integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Microsoft Teams integration */
export type CBKMicrosoftteamsIntegrationUpdateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The allowed senders for this integration */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The Microsoft Bot Framework application ID */
  botFrameworkAppId?: InputMaybe<Scalars['String']['input']>;
  /** The Microsoft Bot Framework application secret */
  botFrameworkAppSecret?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  /** The Azure AD tenant ID */
  tenantId?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of an updated Microsoft Teams integration */
export type CBKMicrosoftteamsIntegrationUpdateResponse = {
  __typename?: 'MicrosoftteamsIntegrationUpdateResponse';
  /** The unique identifier of the updated Microsoft Teams integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKMutation = {
  __typename?: 'Mutation';
  clonePlatformExample?: Maybe<CBKClonePlatformExampleResult>;
  createBlueprint?: Maybe<CBKBlueprintCreateResponse>;
  createBot?: Maybe<CBKBotCreateResponse>;
  createContext?: Maybe<CBKContextCreateResponse>;
  createDataset?: Maybe<CBKDatasetCreateResponse>;
  createDiscordIntegration?: Maybe<CBKDiscordIntegrationCreateResponse>;
  createEmailIntegration?: Maybe<CBKEmailIntegrationCreateResponse>;
  createExtractIntegration?: Maybe<CBKExtractIntegrationCreateResponse>;
  createFile?: Maybe<CBKFileCreateResponse>;
  createGooglechatIntegration?: Maybe<CBKGooglechatIntegrationCreateResponse>;
  createInstagramIntegration?: Maybe<CBKInstagramIntegrationCreateResponse>;
  createMcpserverIntegration?: Maybe<CBKMcpserverIntegrationCreateResponse>;
  createMessengerIntegration?: Maybe<CBKMessengerIntegrationCreateResponse>;
  createMicrosoftteamsIntegration?: Maybe<CBKMicrosoftteamsIntegrationCreateResponse>;
  createNotionIntegration?: Maybe<CBKNotionIntegrationCreateResponse>;
  createPolicy?: Maybe<CBKPolicyCreateResponse>;
  createPortal?: Maybe<CBKPortalCreateResponse>;
  createSecret?: Maybe<CBKSecretCreateResponse>;
  createSitemapIntegration?: Maybe<CBKSitemapIntegrationCreateResponse>;
  createSkillserverIntegration?: Maybe<CBKSkillserverIntegrationCreateResponse>;
  createSkillset?: Maybe<CBKSkillsetCreateResponse>;
  createSkillsetAbility?: Maybe<CBKSkillsetAbilityCreateResponse>;
  createSlackIntegration?: Maybe<CBKSlackIntegrationCreateResponse>;
  createSpace?: Maybe<CBKSpaceCreateResponse>;
  createSpaceSite?: Maybe<CBKSpaceSiteCreateResponse>;
  createSupportIntegration?: Maybe<CBKSupportIntegrationCreateResponse>;
  createTask?: Maybe<CBKTaskCreateResponse>;
  createTelegramIntegration?: Maybe<CBKTelegramIntegrationCreateResponse>;
  createTriggerIntegration?: Maybe<CBKTriggerIntegrationCreateResponse>;
  createTwilioIntegration?: Maybe<CBKTwilioIntegrationCreateResponse>;
  createWhatsAppIntegration?: Maybe<CBKWhatsAppIntegrationCreateResponse>;
  createWidgetIntegration?: Maybe<CBKWidgetIntegrationCreateResponse>;
  deleteBlueprint?: Maybe<CBKBlueprintDeleteResponse>;
  deleteBot?: Maybe<CBKBotDeleteResponse>;
  deleteContext?: Maybe<CBKContextDeleteResponse>;
  deleteDataset?: Maybe<CBKDatasetDeleteResponse>;
  deleteDiscordIntegration?: Maybe<CBKDiscordIntegrationDeleteResponse>;
  deleteEmailIntegration?: Maybe<CBKEmailIntegrationDeleteResponse>;
  deleteExtractIntegration?: Maybe<CBKExtractIntegrationDeleteResponse>;
  deleteFile?: Maybe<CBKFileDeleteResponse>;
  deleteGooglechatIntegration?: Maybe<CBKGooglechatIntegrationDeleteResponse>;
  deleteInstagramIntegration?: Maybe<CBKInstagramIntegrationDeleteResponse>;
  deleteMcpserverIntegration?: Maybe<CBKMcpserverIntegrationDeleteResponse>;
  deleteMessengerIntegration?: Maybe<CBKMessengerIntegrationDeleteResponse>;
  deleteMicrosoftteamsIntegration?: Maybe<CBKMicrosoftteamsIntegrationDeleteResponse>;
  deleteNotionIntegration?: Maybe<CBKNotionIntegrationDeleteResponse>;
  deletePolicy?: Maybe<CBKPolicyDeleteResponse>;
  deletePortal?: Maybe<CBKPortalDeleteResponse>;
  deleteSecret?: Maybe<CBKSecretDeleteResponse>;
  deleteSitemapIntegration?: Maybe<CBKSitemapIntegrationDeleteResponse>;
  deleteSkillserverIntegration?: Maybe<CBKSkillserverIntegrationDeleteResponse>;
  deleteSkillset?: Maybe<CBKSkillsetDeleteResponse>;
  deleteSkillsetAbility?: Maybe<CBKSkillsetAbilityDeleteResponse>;
  deleteSlackIntegration?: Maybe<CBKSlackIntegrationDeleteResponse>;
  deleteSpace?: Maybe<CBKSpaceDeleteResponse>;
  deleteSpaceSite?: Maybe<CBKSpaceSiteDeleteResponse>;
  deleteSupportIntegration?: Maybe<CBKSupportIntegrationDeleteResponse>;
  deleteTask?: Maybe<CBKTaskDeleteResponse>;
  deleteTelegramIntegration?: Maybe<CBKTelegramIntegrationDeleteResponse>;
  deleteTriggerIntegration?: Maybe<CBKTriggerIntegrationDeleteResponse>;
  deleteTwilioIntegration?: Maybe<CBKTwilioIntegrationDeleteResponse>;
  deleteWhatsAppIntegration?: Maybe<CBKWhatsAppIntegrationDeleteResponse>;
  deleteWidgetIntegration?: Maybe<CBKWidgetIntegrationDeleteResponse>;
  revokeSecret?: Maybe<CBKSecretRevokeResponse>;
  updateBlueprint?: Maybe<CBKBlueprintUpdateResponse>;
  updateBot?: Maybe<CBKBotUpdateResponse>;
  updateContext?: Maybe<CBKContextUpdateResponse>;
  updateDataset?: Maybe<CBKDatasetUpdateResponse>;
  updateDiscordIntegration?: Maybe<CBKDiscordIntegrationUpdateResponse>;
  updateEmailIntegration?: Maybe<CBKEmailIntegrationUpdateResponse>;
  updateExtractIntegration?: Maybe<CBKExtractIntegrationUpdateResponse>;
  updateFile?: Maybe<CBKFileUpdateResponse>;
  updateGooglechatIntegration?: Maybe<CBKGooglechatIntegrationUpdateResponse>;
  updateInstagramIntegration?: Maybe<CBKInstagramIntegrationUpdateResponse>;
  updateMcpserverIntegration?: Maybe<CBKMcpserverIntegrationUpdateResponse>;
  updateMessengerIntegration?: Maybe<CBKMessengerIntegrationUpdateResponse>;
  updateMicrosoftteamsIntegration?: Maybe<CBKMicrosoftteamsIntegrationUpdateResponse>;
  updateNotionIntegration?: Maybe<CBKNotionIntegrationUpdateResponse>;
  updatePolicy?: Maybe<CBKPolicyUpdateResponse>;
  updatePortal?: Maybe<CBKPortalUpdateResponse>;
  updateSecret?: Maybe<CBKSecretUpdateResponse>;
  updateSitemapIntegration?: Maybe<CBKSitemapIntegrationUpdateResponse>;
  updateSkillserverIntegration?: Maybe<CBKSkillserverIntegrationUpdateResponse>;
  updateSkillset?: Maybe<CBKSkillsetUpdateResponse>;
  updateSkillsetAbility?: Maybe<CBKSkillsetAbilityUpdateResponse>;
  updateSlackIntegration?: Maybe<CBKSlackIntegrationUpdateResponse>;
  updateSpace?: Maybe<CBKSpaceUpdateResponse>;
  updateSpaceSite?: Maybe<CBKSpaceSiteUpdateResponse>;
  updateSupportIntegration?: Maybe<CBKSupportIntegrationUpdateResponse>;
  updateTask?: Maybe<CBKTaskUpdateResponse>;
  updateTelegramIntegration?: Maybe<CBKTelegramIntegrationUpdateResponse>;
  updateTriggerIntegration?: Maybe<CBKTriggerIntegrationUpdateResponse>;
  updateTwilioIntegration?: Maybe<CBKTwilioIntegrationUpdateResponse>;
  updateWhatsAppIntegration?: Maybe<CBKWhatsAppIntegrationUpdateResponse>;
  updateWidgetIntegration?: Maybe<CBKWidgetIntegrationUpdateResponse>;
};


export type CBKMutationClonePlatformExampleArgs = {
  input: CBKClonePlatformExampleInput;
};


export type CBKMutationCreateBlueprintArgs = {
  input: CBKBlueprintCreateRequest;
};


export type CBKMutationCreateBotArgs = {
  input: CBKBotCreateRequest;
};


export type CBKMutationCreateContextArgs = {
  input: CBKContextCreateRequest;
};


export type CBKMutationCreateDatasetArgs = {
  input: CBKDatasetCreateRequest;
};


export type CBKMutationCreateDiscordIntegrationArgs = {
  input: CBKDiscordIntegrationCreateRequest;
};


export type CBKMutationCreateEmailIntegrationArgs = {
  input: CBKEmailIntegrationCreateRequest;
};


export type CBKMutationCreateExtractIntegrationArgs = {
  input: CBKExtractIntegrationCreateRequest;
};


export type CBKMutationCreateFileArgs = {
  input: CBKFileCreateRequest;
};


export type CBKMutationCreateGooglechatIntegrationArgs = {
  input: CBKGooglechatIntegrationCreateRequest;
};


export type CBKMutationCreateInstagramIntegrationArgs = {
  input: CBKInstagramIntegrationCreateRequest;
};


export type CBKMutationCreateMcpserverIntegrationArgs = {
  input: CBKMcpserverIntegrationCreateRequest;
};


export type CBKMutationCreateMessengerIntegrationArgs = {
  input: CBKMessengerIntegrationCreateRequest;
};


export type CBKMutationCreateMicrosoftteamsIntegrationArgs = {
  input: CBKMicrosoftteamsIntegrationCreateRequest;
};


export type CBKMutationCreateNotionIntegrationArgs = {
  input: CBKNotionIntegrationCreateRequest;
};


export type CBKMutationCreatePolicyArgs = {
  input: CBKPolicyCreateRequest;
};


export type CBKMutationCreatePortalArgs = {
  input: CBKPortalCreateRequest;
};


export type CBKMutationCreateSecretArgs = {
  input: CBKSecretCreateRequest;
};


export type CBKMutationCreateSitemapIntegrationArgs = {
  input: CBKSitemapIntegrationCreateRequest;
};


export type CBKMutationCreateSkillserverIntegrationArgs = {
  input: CBKSkillserverIntegrationCreateRequest;
};


export type CBKMutationCreateSkillsetArgs = {
  input: CBKSkillsetCreateRequest;
};


export type CBKMutationCreateSkillsetAbilityArgs = {
  input: CBKSkillsetAbilityCreateRequest;
  skillsetId: Scalars['ID']['input'];
};


export type CBKMutationCreateSlackIntegrationArgs = {
  input: CBKSlackIntegrationCreateRequest;
};


export type CBKMutationCreateSpaceArgs = {
  input: CBKSpaceCreateRequest;
};


export type CBKMutationCreateSpaceSiteArgs = {
  input: CBKSpaceSiteCreateRequest;
  spaceId: Scalars['ID']['input'];
};


export type CBKMutationCreateSupportIntegrationArgs = {
  input: CBKSupportIntegrationCreateRequest;
};


export type CBKMutationCreateTaskArgs = {
  input: CBKTaskCreateRequest;
};


export type CBKMutationCreateTelegramIntegrationArgs = {
  input: CBKTelegramIntegrationCreateRequest;
};


export type CBKMutationCreateTriggerIntegrationArgs = {
  input: CBKTriggerIntegrationCreateRequest;
};


export type CBKMutationCreateTwilioIntegrationArgs = {
  input: CBKTwilioIntegrationCreateRequest;
};


export type CBKMutationCreateWhatsAppIntegrationArgs = {
  input: CBKWhatsAppIntegrationCreateRequest;
};


export type CBKMutationCreateWidgetIntegrationArgs = {
  input: CBKWidgetIntegrationCreateRequest;
};


export type CBKMutationDeleteBlueprintArgs = {
  blueprintId: Scalars['ID']['input'];
  deleteResources?: InputMaybe<Scalars['Boolean']['input']>;
};


export type CBKMutationDeleteBotArgs = {
  botId: Scalars['ID']['input'];
};


export type CBKMutationDeleteContextArgs = {
  contextId: Scalars['ID']['input'];
};


export type CBKMutationDeleteDatasetArgs = {
  datasetId: Scalars['ID']['input'];
};


export type CBKMutationDeleteDiscordIntegrationArgs = {
  discordIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteEmailIntegrationArgs = {
  emailIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteExtractIntegrationArgs = {
  extractIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteFileArgs = {
  fileId: Scalars['ID']['input'];
};


export type CBKMutationDeleteGooglechatIntegrationArgs = {
  googlechatIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteInstagramIntegrationArgs = {
  instagramIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteMcpserverIntegrationArgs = {
  mcpserverIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteMessengerIntegrationArgs = {
  messengerIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteMicrosoftteamsIntegrationArgs = {
  microsoftteamsIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteNotionIntegrationArgs = {
  notionIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeletePolicyArgs = {
  policyId: Scalars['ID']['input'];
};


export type CBKMutationDeletePortalArgs = {
  portalId: Scalars['ID']['input'];
};


export type CBKMutationDeleteSecretArgs = {
  secretId: Scalars['ID']['input'];
};


export type CBKMutationDeleteSitemapIntegrationArgs = {
  sitemapIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteSkillserverIntegrationArgs = {
  skillserverIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteSkillsetArgs = {
  skillsetId: Scalars['ID']['input'];
};


export type CBKMutationDeleteSkillsetAbilityArgs = {
  abilityId: Scalars['ID']['input'];
  skillsetId: Scalars['ID']['input'];
};


export type CBKMutationDeleteSlackIntegrationArgs = {
  slackIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteSpaceArgs = {
  spaceId: Scalars['ID']['input'];
};


export type CBKMutationDeleteSpaceSiteArgs = {
  siteId: Scalars['ID']['input'];
  spaceId: Scalars['ID']['input'];
};


export type CBKMutationDeleteSupportIntegrationArgs = {
  supportIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteTaskArgs = {
  taskId: Scalars['ID']['input'];
};


export type CBKMutationDeleteTelegramIntegrationArgs = {
  telegramIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteTriggerIntegrationArgs = {
  triggerIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteTwilioIntegrationArgs = {
  twilioIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteWhatsAppIntegrationArgs = {
  whatsappIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationDeleteWidgetIntegrationArgs = {
  widgetIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationRevokeSecretArgs = {
  secretId: Scalars['ID']['input'];
};


export type CBKMutationUpdateBlueprintArgs = {
  blueprintId: Scalars['ID']['input'];
  input: CBKBlueprintUpdateRequest;
};


export type CBKMutationUpdateBotArgs = {
  botId: Scalars['ID']['input'];
  input: CBKBotUpdateRequest;
};


export type CBKMutationUpdateContextArgs = {
  contextId: Scalars['ID']['input'];
  input: CBKContextUpdateRequest;
};


export type CBKMutationUpdateDatasetArgs = {
  datasetId: Scalars['ID']['input'];
  input: CBKDatasetUpdateRequest;
};


export type CBKMutationUpdateDiscordIntegrationArgs = {
  discordIntegrationId: Scalars['ID']['input'];
  input: CBKDiscordIntegrationUpdateRequest;
};


export type CBKMutationUpdateEmailIntegrationArgs = {
  emailIntegrationId: Scalars['ID']['input'];
  input: CBKEmailIntegrationUpdateRequest;
};


export type CBKMutationUpdateExtractIntegrationArgs = {
  extractIntegrationId: Scalars['ID']['input'];
  input: CBKExtractIntegrationUpdateRequest;
};


export type CBKMutationUpdateFileArgs = {
  fileId: Scalars['ID']['input'];
  input: CBKFileUpdateRequest;
};


export type CBKMutationUpdateGooglechatIntegrationArgs = {
  googlechatIntegrationId: Scalars['ID']['input'];
  input: CBKGooglechatIntegrationUpdateRequest;
};


export type CBKMutationUpdateInstagramIntegrationArgs = {
  input: CBKInstagramIntegrationUpdateRequest;
  instagramIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationUpdateMcpserverIntegrationArgs = {
  input: CBKMcpserverIntegrationUpdateRequest;
  mcpserverIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationUpdateMessengerIntegrationArgs = {
  input: CBKMessengerIntegrationUpdateRequest;
  messengerIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationUpdateMicrosoftteamsIntegrationArgs = {
  input: CBKMicrosoftteamsIntegrationUpdateRequest;
  microsoftteamsIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationUpdateNotionIntegrationArgs = {
  input: CBKNotionIntegrationUpdateRequest;
  notionIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationUpdatePolicyArgs = {
  input: CBKPolicyUpdateRequest;
  policyId: Scalars['ID']['input'];
};


export type CBKMutationUpdatePortalArgs = {
  input: CBKPortalUpdateRequest;
  portalId: Scalars['ID']['input'];
};


export type CBKMutationUpdateSecretArgs = {
  input: CBKSecretUpdateRequest;
  secretId: Scalars['ID']['input'];
};


export type CBKMutationUpdateSitemapIntegrationArgs = {
  input: CBKSitemapIntegrationUpdateRequest;
  sitemapIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationUpdateSkillserverIntegrationArgs = {
  input: CBKSkillserverIntegrationUpdateRequest;
  skillserverIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationUpdateSkillsetArgs = {
  input: CBKSkillsetUpdateRequest;
  skillsetId: Scalars['ID']['input'];
};


export type CBKMutationUpdateSkillsetAbilityArgs = {
  abilityId: Scalars['ID']['input'];
  input: CBKSkillsetAbilityUpdateRequest;
  skillsetId: Scalars['ID']['input'];
};


export type CBKMutationUpdateSlackIntegrationArgs = {
  input: CBKSlackIntegrationUpdateRequest;
  slackIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationUpdateSpaceArgs = {
  input: CBKSpaceUpdateRequest;
  spaceId: Scalars['ID']['input'];
};


export type CBKMutationUpdateSpaceSiteArgs = {
  input: CBKSpaceSiteUpdateRequest;
  siteId: Scalars['ID']['input'];
  spaceId: Scalars['ID']['input'];
};


export type CBKMutationUpdateSupportIntegrationArgs = {
  input: CBKSupportIntegrationUpdateRequest;
  supportIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationUpdateTaskArgs = {
  input: CBKTaskUpdateRequest;
  taskId: Scalars['ID']['input'];
};


export type CBKMutationUpdateTelegramIntegrationArgs = {
  input: CBKTelegramIntegrationUpdateRequest;
  telegramIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationUpdateTriggerIntegrationArgs = {
  input: CBKTriggerIntegrationUpdateRequest;
  triggerIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationUpdateTwilioIntegrationArgs = {
  input: CBKTwilioIntegrationUpdateRequest;
  twilioIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationUpdateWhatsAppIntegrationArgs = {
  input: CBKWhatsAppIntegrationUpdateRequest;
  whatsappIntegrationId: Scalars['ID']['input'];
};


export type CBKMutationUpdateWidgetIntegrationArgs = {
  input: CBKWidgetIntegrationUpdateRequest;
  widgetIntegrationId: Scalars['ID']['input'];
};

export type CBKNotionIntegration = {
  __typename?: 'NotionIntegration';
  /** The blueprint associated with the notion integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The date and time when the notion integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The dataset associated with the notion integration */
  dataset?: Maybe<CBKDataset>;
  /** The description of the notion integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the notion integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The date and time when the notion integration was last synced */
  lastSyncedAt?: Maybe<Scalars['DateTime']['output']>;
  /** The metadata associated with the notion integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the notion integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The sync schedule of the notion integration */
  syncSchedule?: Maybe<CBKSchedule>;
  /** The sync status of the notion integration */
  syncStatus?: Maybe<Scalars['String']['output']>;
  /** The date and time when the notion integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Input parameters for creating a new Notion integration */
export type CBKNotionIntegrationCreateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the dataset to sync to */
  datasetId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Time in milliseconds before the data expires */
  expiresIn?: InputMaybe<Scalars['Int']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The schedule for automatic synchronization */
  syncSchedule?: InputMaybe<CBKSchedule>;
  /** The Notion integration token */
  token?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of a newly created Notion integration */
export type CBKNotionIntegrationCreateResponse = {
  __typename?: 'NotionIntegrationCreateResponse';
  /** The unique identifier of the created Notion integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Notion integration */
export type CBKNotionIntegrationDeleteResponse = {
  __typename?: 'NotionIntegrationDeleteResponse';
  /** The unique identifier of the deleted Notion integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Notion integration */
export type CBKNotionIntegrationUpdateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the dataset to sync to */
  datasetId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Time in milliseconds before the data expires */
  expiresIn?: InputMaybe<Scalars['Int']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The schedule for automatic synchronization */
  syncSchedule?: InputMaybe<CBKSchedule>;
  /** The Notion integration token */
  token?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of an updated Notion integration */
export type CBKNotionIntegrationUpdateResponse = {
  __typename?: 'NotionIntegrationUpdateResponse';
  /** The unique identifier of the updated Notion integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKPageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['ID']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['ID']['output']>;
};

export type CBKPlatformAbility = {
  __typename?: 'PlatformAbility';
  /** The bot configuration for the platform ability */
  bot?: Maybe<Scalars['String']['output']>;
  /** Additional commentary about the platform ability */
  commentary?: Maybe<Scalars['String']['output']>;
  /** The date and time when the platform ability was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the platform ability */
  description?: Maybe<Scalars['String']['output']>;
  /** An excerpt from the most relevant part of the platform ability */
  excerpt?: Maybe<Scalars['String']['output']>;
  /** The file configuration for the platform ability */
  file?: Maybe<Scalars['String']['output']>;
  /** The icon representing the platform ability */
  icon?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the platform ability */
  id?: Maybe<Scalars['ID']['output']>;
  /** The instruction for the platform ability */
  instruction?: Maybe<Scalars['String']['output']>;
  /** The URL to the official platform ability page */
  link?: Maybe<Scalars['String']['output']>;
  /** The metadata associated with the platform ability */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the platform ability */
  name?: Maybe<Scalars['String']['output']>;
  /** The provider of the platform ability */
  provider?: Maybe<Scalars['String']['output']>;
  /** The parameters associated with the platform ability */
  schema?: Maybe<Scalars['JsonObject']['output']>;
  /** The similarity score of the platform ability search result */
  score?: Maybe<Scalars['Float']['output']>;
  /** The secret configuration for the platform ability */
  secret?: Maybe<Scalars['String']['output']>;
  /** The setup configuration for the platform ability */
  setup?: Maybe<Scalars['String']['output']>;
  /** The space configuration for the platform ability */
  space?: Maybe<Scalars['String']['output']>;
  /** The tags associated with the platform ability */
  tags?: Maybe<Array<Scalars['String']['output']>>;
  /** The original template identifier for the platform ability */
  template?: Maybe<Scalars['String']['output']>;
  /** The date and time when the platform ability was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CBKPlatformAction = {
  __typename?: 'PlatformAction';
  /** The date and time when the platform action was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the platform action */
  description?: Maybe<Scalars['String']['output']>;
  /** Example instructions demonstrating the action usage */
  examples?: Maybe<Array<Scalars['String']['output']>>;
  /** The unique identifier of the platform action */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the platform action */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the platform action */
  name?: Maybe<Scalars['String']['output']>;
  /** The date and time when the platform action was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CBKPlatformExample = {
  __typename?: 'PlatformExample';
  /** The configuration of the platform example. Fetches full config from API when requested. */
  config?: Maybe<Scalars['JsonObject']['output']>;
  /** The date and time when the platform example was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the platform example */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the platform example */
  id?: Maybe<Scalars['ID']['output']>;
  /** The URL of the platform example */
  link?: Maybe<Scalars['String']['output']>;
  /** The metadata associated with the platform example */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the platform example */
  name?: Maybe<Scalars['String']['output']>;
  /** The tags associated with the platform example */
  tags?: Maybe<Array<Scalars['String']['output']>>;
  /** The type of the platform example */
  type?: Maybe<Scalars['String']['output']>;
  /** The date and time when the platform example was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CBKPlatformModel = {
  __typename?: 'PlatformModel';
  /** The date and time when the platform model was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the platform model */
  description?: Maybe<Scalars['String']['output']>;
  /** The family of the platform model */
  family?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the platform model */
  id?: Maybe<Scalars['ID']['output']>;
  /** The maximum number of input tokens for the platform model */
  maxInputTokens?: Maybe<Scalars['Int']['output']>;
  /** The maximum number of output tokens for the platform model */
  maxOutputTokens?: Maybe<Scalars['Int']['output']>;
  /** The maximum number of tokens for the platform model */
  maxTokens?: Maybe<Scalars['Int']['output']>;
  /** The metadata associated with the platform model */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the platform model */
  name?: Maybe<Scalars['String']['output']>;
  /** The provider of the platform model */
  provider?: Maybe<Scalars['String']['output']>;
  /** The date and time when the platform model was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CBKPlatformReport = {
  __typename?: 'PlatformReport';
  /** The date and time when the platform report was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the platform report */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the platform report */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the platform report */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the platform report */
  name?: Maybe<Scalars['String']['output']>;
  /** The report data. Fetches full report from API when requested. */
  report?: Maybe<Scalars['JsonObject']['output']>;
  /** The date and time when the platform report was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type CBKPlatformReportReportArgs = {
  input?: InputMaybe<Scalars['JsonObject']['input']>;
};

export type CBKPlatformSecret = {
  __typename?: 'PlatformSecret';
  /** Additional commentary about the platform secret */
  commentary?: Maybe<Scalars['String']['output']>;
  /** The configuration of the platform secret */
  config?: Maybe<Scalars['JsonObject']['output']>;
  /** The date and time when the platform secret was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the platform secret */
  description?: Maybe<Scalars['String']['output']>;
  /** An excerpt from the most relevant part of the platform secret */
  excerpt?: Maybe<Scalars['String']['output']>;
  /** The icon representing the platform secret */
  icon?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the platform secret */
  id?: Maybe<Scalars['ID']['output']>;
  /** The kind of the platform secret */
  kind?: Maybe<Scalars['String']['output']>;
  /** The URL to the official platform secret page */
  link?: Maybe<Scalars['String']['output']>;
  /** The metadata associated with the platform secret */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the platform secret */
  name?: Maybe<Scalars['String']['output']>;
  /** The similarity score of the platform secret search result */
  score?: Maybe<Scalars['Float']['output']>;
  /** The setup instructions for the platform secret */
  setup?: Maybe<Scalars['String']['output']>;
  /** The tags associated with the platform secret */
  tags?: Maybe<Array<Scalars['String']['output']>>;
  /** The original template identifier for the platform secret */
  template?: Maybe<Scalars['String']['output']>;
  /** The type of the platform secret */
  type?: Maybe<Scalars['String']['output']>;
  /** The date and time when the platform secret was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CBKPolicy = {
  __typename?: 'Policy';
  /** The alias ID for the policy */
  alias?: Maybe<Scalars['String']['output']>;
  /** The ID of the blueprint associated with the policy */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The ID of the bot associated with the policy */
  botId?: Maybe<Scalars['String']['output']>;
  /** The configuration of the policy */
  config?: Maybe<Scalars['JsonObject']['output']>;
  /** The date and time when the policy was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the policy */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the policy */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the policy */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the policy */
  name?: Maybe<Scalars['String']['output']>;
  /** The lifecycle state of the policy (enabled/disabled) */
  state?: Maybe<CBKResourceState>;
  /** The type of the policy */
  type?: Maybe<CBKPolicyType>;
  /** The date and time when the policy was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Input parameters for creating a new policy */
export type CBKPolicyCreateRequest = {
  /** The alias ID for the policy */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to associate */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The policy configuration as JSON */
  config?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The description of the policy */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the policy */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the policy */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The lifecycle state of the policy (enabled/disabled) */
  state?: InputMaybe<CBKResourceState>;
  /** The type of the policy */
  type: CBKPolicyType;
};

/** Response containing the ID of a newly created policy */
export type CBKPolicyCreateResponse = {
  __typename?: 'PolicyCreateResponse';
  /** The unique identifier of the created policy */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted policy */
export type CBKPolicyDeleteResponse = {
  __typename?: 'PolicyDeleteResponse';
  /** The unique identifier of the deleted policy */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Types of policies that can be used in the system */
export enum CBKPolicyType {
  Retention = 'retention',
  Usage = 'usage'
}

/** Input parameters for updating an existing policy */
export type CBKPolicyUpdateRequest = {
  /** The alias ID for the policy */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to associate */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The policy configuration as JSON */
  config?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The description of the policy */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the policy */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the policy */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The lifecycle state of the policy (enabled/disabled) */
  state?: InputMaybe<CBKResourceState>;
  /** The type of the policy */
  type?: InputMaybe<CBKPolicyType>;
};

/** Response containing the ID of an updated policy */
export type CBKPolicyUpdateResponse = {
  __typename?: 'PolicyUpdateResponse';
  /** The unique identifier of the updated policy */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKPortal = {
  __typename?: 'Portal';
  /** The blueprint associated with the portal */
  blueprint?: Maybe<CBKBlueprint>;
  /** The ID of the blueprint associated with the portal */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The configuration of the portal */
  config?: Maybe<Scalars['JsonObject']['output']>;
  /** The date and time when the portal was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the portal */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the portal */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the portal */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the portal */
  name?: Maybe<Scalars['String']['output']>;
  /** The slug of the portal, used for URL routing */
  slug?: Maybe<Scalars['String']['output']>;
  /** The date and time when the portal was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** The URL the portal is served at on this deployment, derived from its slug and the deployment portal topology */
  url?: Maybe<Scalars['String']['output']>;
};

/** Input parameters for creating a new portal */
export type CBKPortalCreateRequest = {
  /** The alias ID for the portal */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** Configuration settings for the portal */
  config?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The description of the portal */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the portal */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the portal */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The custom slug for the portal URL */
  slug?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of a newly created portal */
export type CBKPortalCreateResponse = {
  __typename?: 'PortalCreateResponse';
  /** The unique identifier of the created portal */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted portal */
export type CBKPortalDeleteResponse = {
  __typename?: 'PortalDeleteResponse';
  /** The unique identifier of the deleted portal */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing portal */
export type CBKPortalUpdateRequest = {
  /** The alias ID for the portal */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** Configuration settings for the portal */
  config?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The description of the portal */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the portal */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the portal */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The custom slug for the portal URL */
  slug?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of an updated portal */
export type CBKPortalUpdateResponse = {
  __typename?: 'PortalUpdateResponse';
  /** The unique identifier of the updated portal */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKQuery = {
  __typename?: 'Query';
  anamIntegrations?: Maybe<CBKQueryAnamIntegrationsConnection>;
  /** Fetch audit logs for the current user */
  auditLogs?: Maybe<CBKQueryAuditLogsConnection>;
  avatarIntegrations?: Maybe<CBKQueryAvatarIntegrationsConnection>;
  blueprints?: Maybe<CBKQueryBlueprintsConnection>;
  bots?: Maybe<CBKQueryBotsConnection>;
  contacts?: Maybe<CBKQueryContactsConnection>;
  contexts?: Maybe<CBKQueryContextsConnection>;
  conversations?: Maybe<CBKQueryConversationsConnection>;
  datasets?: Maybe<CBKQueryDatasetsConnection>;
  discordIntegrations?: Maybe<CBKQueryDiscordIntegrationsConnection>;
  emailIntegrations?: Maybe<CBKQueryEmailIntegrationsConnection>;
  /** Fetch event logs for the current user */
  eventLogs?: Maybe<CBKQueryEventLogsConnection>;
  extractIntegrations?: Maybe<CBKQueryExtractIntegrationsConnection>;
  files?: Maybe<CBKQueryFilesConnection>;
  githubIntegrations?: Maybe<CBKQueryGithubIntegrationsConnection>;
  googlechatIntegrations?: Maybe<CBKQueryGooglechatIntegrationsConnection>;
  instagramIntegrations?: Maybe<CBKQueryInstagramIntegrationsConnection>;
  mcpserverIntegrations?: Maybe<CBKQueryMcpserverIntegrationsConnection>;
  /** Fetch the current user */
  me?: Maybe<CBKUser>;
  memories?: Maybe<CBKQueryMemoriesConnection>;
  messages?: Maybe<CBKQueryMessagesConnection>;
  messengerIntegrations?: Maybe<CBKQueryMessengerIntegrationsConnection>;
  microsoftteamsIntegrations?: Maybe<CBKQueryMicrosoftteamsIntegrationsConnection>;
  notionIntegrations?: Maybe<CBKQueryNotionIntegrationsConnection>;
  /** List all available platform abilities */
  platformAbilities?: Maybe<CBKQueryPlatformAbilitiesConnection>;
  /** List all available platform actions */
  platformActions?: Maybe<CBKQueryPlatformActionsConnection>;
  /** List all available platform examples */
  platformExamples?: Maybe<CBKQueryPlatformExamplesConnection>;
  /** List all available platform models */
  platformModels?: Maybe<CBKQueryPlatformModelsConnection>;
  /** List all available platform reports */
  platformReports?: Maybe<CBKQueryPlatformReportsConnection>;
  /** List all available platform secrets */
  platformSecrets?: Maybe<CBKQueryPlatformSecretsConnection>;
  policies?: Maybe<CBKQueryPoliciesConnection>;
  portals?: Maybe<CBKQueryPortalsConnection>;
  ratings?: Maybe<CBKQueryRatingsConnection>;
  recallIntegrations?: Maybe<CBKQueryRecallIntegrationsConnection>;
  /** Fetch the blueprints visible to the user in the context */
  relatedBlueprints?: Maybe<CBKQueryRelatedBlueprintsConnection>;
  /** Fetch the bots visible to the user in the context */
  relatedBots?: Maybe<CBKQueryRelatedBotsConnection>;
  /** Fetch the datasets visible to the user in the context */
  relatedDatasets?: Maybe<CBKQueryRelatedDatasetsConnection>;
  /** Fetch the files visible to the user in the context */
  relatedFiles?: Maybe<CBKQueryRelatedFilesConnection>;
  /** Fetch the secrets visible to the user in the context */
  relatedSecrets?: Maybe<CBKQueryRelatedSecretsConnection>;
  /** Fetch the skillsets visible to the user in the context */
  relatedSkillsets?: Maybe<CBKQueryRelatedSkillsetsConnection>;
  secrets?: Maybe<CBKQuerySecretsConnection>;
  sitemapIntegrations?: Maybe<CBKQuerySitemapIntegrationsConnection>;
  skillserverIntegrations?: Maybe<CBKQuerySkillserverIntegrationsConnection>;
  skillsets?: Maybe<CBKQuerySkillsetsConnection>;
  slackIntegrations?: Maybe<CBKQuerySlackIntegrationsConnection>;
  spaces?: Maybe<CBKQuerySpacesConnection>;
  supportIntegrations?: Maybe<CBKQuerySupportIntegrationsConnection>;
  tasks?: Maybe<CBKQueryTasksConnection>;
  teams?: Maybe<CBKQueryTeamsConnection>;
  telegramIntegrations?: Maybe<CBKQueryTelegramIntegrationsConnection>;
  triggerIntegrations?: Maybe<CBKQueryTriggerIntegrationsConnection>;
  twilioIntegrations?: Maybe<CBKQueryTwilioIntegrationsConnection>;
  users?: Maybe<CBKQueryUsersConnection>;
  whatsappIntegrations?: Maybe<CBKQueryWhatsappIntegrationsConnection>;
  widgetIntegrations?: Maybe<CBKQueryWidgetIntegrationsConnection>;
};


export type CBKQueryAnamIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryAuditLogsArgs = {
  actions?: InputMaybe<Array<Scalars['String']['input']>>;
  after?: InputMaybe<Scalars['ID']['input']>;
  auditLogIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  before?: InputMaybe<Scalars['ID']['input']>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  conversationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  taskIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type CBKQueryAvatarIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryBlueprintsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
  visibility?: InputMaybe<Array<CBKBlueprintVisibility>>;
};


export type CBKQueryBotsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  datasetIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
  skillsetIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  visibility?: InputMaybe<Array<CBKBotVisibility>>;
};


export type CBKQueryContactsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  contactIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  emails?: InputMaybe<Array<Scalars['String']['input']>>;
  fingerprints?: InputMaybe<Array<Scalars['String']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryContextsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  contextIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  datasetIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  skillsetIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type CBKQueryConversationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  contactIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  conversationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
  taskIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type CBKQueryDatasetsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  datasetIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
  visibility?: InputMaybe<Array<CBKDatasetVisibility>>;
};


export type CBKQueryDiscordIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryEmailIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryEventLogsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  conversationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  eventLogIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  taskIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  types?: InputMaybe<Array<Scalars['String']['input']>>;
};


export type CBKQueryExtractIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryFilesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  fileIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
  visibility?: InputMaybe<Array<CBKFileVisibility>>;
};


export type CBKQueryGithubIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryGooglechatIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryInstagramIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryMcpserverIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryMemoriesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  contactIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  memoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryMessagesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  conversationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  messageIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  type?: InputMaybe<CBKMessageType>;
};


export type CBKQueryMessengerIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryMicrosoftteamsIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryNotionIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryPlatformAbilitiesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  platformAbilityIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  search?: InputMaybe<Scalars['String']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKQueryPlatformActionsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  platformActionIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type CBKQueryPlatformExamplesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  platformExampleIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  search?: InputMaybe<Scalars['String']['input']>;
};


export type CBKQueryPlatformModelsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  platformModelIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type CBKQueryPlatformReportsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  platformReportIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type CBKQueryPlatformSecretsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  platformSecretIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  search?: InputMaybe<Scalars['String']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKQueryPoliciesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
  policyIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  type?: InputMaybe<Array<CBKPolicyType>>;
};


export type CBKQueryPortalsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
  portalIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type CBKQueryRatingsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  contactIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  conversationIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  messageIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
  ratingIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  sentiment?: InputMaybe<CBKRatingSentiment>;
  value?: InputMaybe<Scalars['String']['input']>;
};


export type CBKQueryRecallIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryRelatedBlueprintsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  includeOwn?: InputMaybe<CBKIncludeOwnBlueprintsInput>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  visibility?: InputMaybe<Array<CBKContextBlueprintVisibility>>;
};


export type CBKQueryRelatedBotsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  datasetIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  includeOwn?: InputMaybe<CBKIncludeOwnBotsInput>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  skillsetIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  visibility?: InputMaybe<Array<CBKContextBotVisibility>>;
};


export type CBKQueryRelatedDatasetsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  datasetIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  includeOwn?: InputMaybe<CBKIncludeOwnDatasetsInput>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  visibility?: InputMaybe<Array<CBKContextDatasetVisibility>>;
};


export type CBKQueryRelatedFilesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  fileIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  includeOwn?: InputMaybe<CBKIncludeOwnFilesInput>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  visibility?: InputMaybe<Array<CBKContextFileVisibility>>;
};


export type CBKQueryRelatedSecretsArgs = {
  abilityIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  includeOwn?: InputMaybe<CBKIncludeOwnSecretsInput>;
  kind?: InputMaybe<Array<CBKContextSecretKind>>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  secretIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  skillsetIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  type?: InputMaybe<Array<CBKContextSecretType>>;
  visibility?: InputMaybe<Array<CBKContextSecretVisibility>>;
};


export type CBKQueryRelatedSkillsetsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  includeOwn?: InputMaybe<CBKIncludeOwnSkillsetsInput>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  skillsetIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  visibility?: InputMaybe<Array<CBKContextSkillsetVisibility>>;
};


export type CBKQuerySecretsArgs = {
  abilityIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  kind?: InputMaybe<Array<CBKSecretKind>>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
  secretIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  skillsetIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  type?: InputMaybe<Array<CBKSecretType>>;
  visibility?: InputMaybe<Array<CBKSecretVisibility>>;
};


export type CBKQuerySitemapIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQuerySkillserverIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQuerySkillsetsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
  skillsetIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  visibility?: InputMaybe<Array<CBKSkillsetVisibility>>;
};


export type CBKQuerySlackIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQuerySpacesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  contactIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
  spaceIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type CBKQuerySupportIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryTasksArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  botIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  contactIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
  schedule?: InputMaybe<Scalars['String']['input']>;
  taskIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type CBKQueryTeamsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryTelegramIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryTriggerIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryTwilioIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryUsersArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryWhatsappIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};


export type CBKQueryWidgetIntegrationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  order?: InputMaybe<CBKListOrder>;
};

export type CBKQueryAnamIntegrationsConnection = {
  __typename?: 'QueryAnamIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryAnamIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryAnamIntegrationsConnectionEdge = {
  __typename?: 'QueryAnamIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKAnamIntegration>;
};

export type CBKQueryAuditLogsConnection = {
  __typename?: 'QueryAuditLogsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryAuditLogsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryAuditLogsConnectionEdge = {
  __typename?: 'QueryAuditLogsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKAuditLog>;
};

export type CBKQueryAvatarIntegrationsConnection = {
  __typename?: 'QueryAvatarIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryAvatarIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryAvatarIntegrationsConnectionEdge = {
  __typename?: 'QueryAvatarIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKAvatarIntegration>;
};

export type CBKQueryBlueprintsConnection = {
  __typename?: 'QueryBlueprintsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryBlueprintsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryBlueprintsConnectionEdge = {
  __typename?: 'QueryBlueprintsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKBlueprint>;
};

export type CBKQueryBotsConnection = {
  __typename?: 'QueryBotsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryBotsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryBotsConnectionEdge = {
  __typename?: 'QueryBotsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKBot>;
};

export type CBKQueryContactsConnection = {
  __typename?: 'QueryContactsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryContactsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryContactsConnectionEdge = {
  __typename?: 'QueryContactsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKContact>;
};

export type CBKQueryContextsConnection = {
  __typename?: 'QueryContextsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryContextsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryContextsConnectionEdge = {
  __typename?: 'QueryContextsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKContext>;
};

export type CBKQueryConversationsConnection = {
  __typename?: 'QueryConversationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryConversationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryConversationsConnectionEdge = {
  __typename?: 'QueryConversationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKConversation>;
};

export type CBKQueryDatasetsConnection = {
  __typename?: 'QueryDatasetsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryDatasetsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryDatasetsConnectionEdge = {
  __typename?: 'QueryDatasetsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKDataset>;
};

export type CBKQueryDiscordIntegrationsConnection = {
  __typename?: 'QueryDiscordIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryDiscordIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryDiscordIntegrationsConnectionEdge = {
  __typename?: 'QueryDiscordIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKDiscordIntegration>;
};

export type CBKQueryEmailIntegrationsConnection = {
  __typename?: 'QueryEmailIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryEmailIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryEmailIntegrationsConnectionEdge = {
  __typename?: 'QueryEmailIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKEmailIntegration>;
};

export type CBKQueryEventLogsConnection = {
  __typename?: 'QueryEventLogsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryEventLogsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryEventLogsConnectionEdge = {
  __typename?: 'QueryEventLogsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKEventLog>;
};

export type CBKQueryExtractIntegrationsConnection = {
  __typename?: 'QueryExtractIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryExtractIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryExtractIntegrationsConnectionEdge = {
  __typename?: 'QueryExtractIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKExtractIntegration>;
};

export type CBKQueryFilesConnection = {
  __typename?: 'QueryFilesConnection';
  edges?: Maybe<Array<Maybe<CBKQueryFilesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryFilesConnectionEdge = {
  __typename?: 'QueryFilesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKFile>;
};

export type CBKQueryGithubIntegrationsConnection = {
  __typename?: 'QueryGithubIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryGithubIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryGithubIntegrationsConnectionEdge = {
  __typename?: 'QueryGithubIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKGithubIntegration>;
};

export type CBKQueryGooglechatIntegrationsConnection = {
  __typename?: 'QueryGooglechatIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryGooglechatIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryGooglechatIntegrationsConnectionEdge = {
  __typename?: 'QueryGooglechatIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKGooglechatIntegration>;
};

export type CBKQueryInstagramIntegrationsConnection = {
  __typename?: 'QueryInstagramIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryInstagramIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryInstagramIntegrationsConnectionEdge = {
  __typename?: 'QueryInstagramIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKInstagramIntegration>;
};

export type CBKQueryMcpserverIntegrationsConnection = {
  __typename?: 'QueryMcpserverIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryMcpserverIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryMcpserverIntegrationsConnectionEdge = {
  __typename?: 'QueryMcpserverIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKMcpserverIntegration>;
};

export type CBKQueryMemoriesConnection = {
  __typename?: 'QueryMemoriesConnection';
  edges?: Maybe<Array<Maybe<CBKQueryMemoriesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryMemoriesConnectionEdge = {
  __typename?: 'QueryMemoriesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKMemory>;
};

export type CBKQueryMessagesConnection = {
  __typename?: 'QueryMessagesConnection';
  edges?: Maybe<Array<Maybe<CBKQueryMessagesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryMessagesConnectionEdge = {
  __typename?: 'QueryMessagesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKMessage>;
};

export type CBKQueryMessengerIntegrationsConnection = {
  __typename?: 'QueryMessengerIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryMessengerIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryMessengerIntegrationsConnectionEdge = {
  __typename?: 'QueryMessengerIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKMessengerIntegration>;
};

export type CBKQueryMicrosoftteamsIntegrationsConnection = {
  __typename?: 'QueryMicrosoftteamsIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryMicrosoftteamsIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryMicrosoftteamsIntegrationsConnectionEdge = {
  __typename?: 'QueryMicrosoftteamsIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKMicrosoftteamsIntegration>;
};

export type CBKQueryNotionIntegrationsConnection = {
  __typename?: 'QueryNotionIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryNotionIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryNotionIntegrationsConnectionEdge = {
  __typename?: 'QueryNotionIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKNotionIntegration>;
};

export type CBKQueryPlatformAbilitiesConnection = {
  __typename?: 'QueryPlatformAbilitiesConnection';
  edges?: Maybe<Array<Maybe<CBKQueryPlatformAbilitiesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryPlatformAbilitiesConnectionEdge = {
  __typename?: 'QueryPlatformAbilitiesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKPlatformAbility>;
};

export type CBKQueryPlatformActionsConnection = {
  __typename?: 'QueryPlatformActionsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryPlatformActionsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryPlatformActionsConnectionEdge = {
  __typename?: 'QueryPlatformActionsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKPlatformAction>;
};

export type CBKQueryPlatformExamplesConnection = {
  __typename?: 'QueryPlatformExamplesConnection';
  edges?: Maybe<Array<Maybe<CBKQueryPlatformExamplesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryPlatformExamplesConnectionEdge = {
  __typename?: 'QueryPlatformExamplesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKPlatformExample>;
};

export type CBKQueryPlatformModelsConnection = {
  __typename?: 'QueryPlatformModelsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryPlatformModelsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryPlatformModelsConnectionEdge = {
  __typename?: 'QueryPlatformModelsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKPlatformModel>;
};

export type CBKQueryPlatformReportsConnection = {
  __typename?: 'QueryPlatformReportsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryPlatformReportsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryPlatformReportsConnectionEdge = {
  __typename?: 'QueryPlatformReportsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKPlatformReport>;
};

export type CBKQueryPlatformSecretsConnection = {
  __typename?: 'QueryPlatformSecretsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryPlatformSecretsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryPlatformSecretsConnectionEdge = {
  __typename?: 'QueryPlatformSecretsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKPlatformSecret>;
};

export type CBKQueryPoliciesConnection = {
  __typename?: 'QueryPoliciesConnection';
  edges?: Maybe<Array<Maybe<CBKQueryPoliciesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryPoliciesConnectionEdge = {
  __typename?: 'QueryPoliciesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKPolicy>;
};

export type CBKQueryPortalsConnection = {
  __typename?: 'QueryPortalsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryPortalsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryPortalsConnectionEdge = {
  __typename?: 'QueryPortalsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKPortal>;
};

export type CBKQueryRatingsConnection = {
  __typename?: 'QueryRatingsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryRatingsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryRatingsConnectionEdge = {
  __typename?: 'QueryRatingsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKRating>;
};

export type CBKQueryRecallIntegrationsConnection = {
  __typename?: 'QueryRecallIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryRecallIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryRecallIntegrationsConnectionEdge = {
  __typename?: 'QueryRecallIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKRecallIntegration>;
};

export type CBKQueryRelatedBlueprintsConnection = {
  __typename?: 'QueryRelatedBlueprintsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryRelatedBlueprintsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryRelatedBlueprintsConnectionEdge = {
  __typename?: 'QueryRelatedBlueprintsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKContextBlueprint>;
};

export type CBKQueryRelatedBotsConnection = {
  __typename?: 'QueryRelatedBotsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryRelatedBotsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryRelatedBotsConnectionEdge = {
  __typename?: 'QueryRelatedBotsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKContextBot>;
};

export type CBKQueryRelatedDatasetsConnection = {
  __typename?: 'QueryRelatedDatasetsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryRelatedDatasetsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryRelatedDatasetsConnectionEdge = {
  __typename?: 'QueryRelatedDatasetsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKContextDataset>;
};

export type CBKQueryRelatedFilesConnection = {
  __typename?: 'QueryRelatedFilesConnection';
  edges?: Maybe<Array<Maybe<CBKQueryRelatedFilesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryRelatedFilesConnectionEdge = {
  __typename?: 'QueryRelatedFilesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKContextFile>;
};

export type CBKQueryRelatedSecretsConnection = {
  __typename?: 'QueryRelatedSecretsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryRelatedSecretsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryRelatedSecretsConnectionEdge = {
  __typename?: 'QueryRelatedSecretsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKContextSecret>;
};

export type CBKQueryRelatedSkillsetsConnection = {
  __typename?: 'QueryRelatedSkillsetsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryRelatedSkillsetsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryRelatedSkillsetsConnectionEdge = {
  __typename?: 'QueryRelatedSkillsetsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKContextSkillset>;
};

export type CBKQuerySecretsConnection = {
  __typename?: 'QuerySecretsConnection';
  edges?: Maybe<Array<Maybe<CBKQuerySecretsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQuerySecretsConnectionEdge = {
  __typename?: 'QuerySecretsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKSecret>;
};

export type CBKQuerySitemapIntegrationsConnection = {
  __typename?: 'QuerySitemapIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQuerySitemapIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQuerySitemapIntegrationsConnectionEdge = {
  __typename?: 'QuerySitemapIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKSitemapIntegration>;
};

export type CBKQuerySkillserverIntegrationsConnection = {
  __typename?: 'QuerySkillserverIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQuerySkillserverIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQuerySkillserverIntegrationsConnectionEdge = {
  __typename?: 'QuerySkillserverIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKSkillserverIntegration>;
};

export type CBKQuerySkillsetsConnection = {
  __typename?: 'QuerySkillsetsConnection';
  edges?: Maybe<Array<Maybe<CBKQuerySkillsetsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQuerySkillsetsConnectionEdge = {
  __typename?: 'QuerySkillsetsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKSkillset>;
};

export type CBKQuerySlackIntegrationsConnection = {
  __typename?: 'QuerySlackIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQuerySlackIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQuerySlackIntegrationsConnectionEdge = {
  __typename?: 'QuerySlackIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKSlackIntegration>;
};

export type CBKQuerySpacesConnection = {
  __typename?: 'QuerySpacesConnection';
  edges?: Maybe<Array<Maybe<CBKQuerySpacesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQuerySpacesConnectionEdge = {
  __typename?: 'QuerySpacesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKSpace>;
};

export type CBKQuerySupportIntegrationsConnection = {
  __typename?: 'QuerySupportIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQuerySupportIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQuerySupportIntegrationsConnectionEdge = {
  __typename?: 'QuerySupportIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKSupportIntegration>;
};

export type CBKQueryTasksConnection = {
  __typename?: 'QueryTasksConnection';
  edges?: Maybe<Array<Maybe<CBKQueryTasksConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryTasksConnectionEdge = {
  __typename?: 'QueryTasksConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKTask>;
};

export type CBKQueryTeamsConnection = {
  __typename?: 'QueryTeamsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryTeamsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryTeamsConnectionEdge = {
  __typename?: 'QueryTeamsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKTeam>;
};

export type CBKQueryTelegramIntegrationsConnection = {
  __typename?: 'QueryTelegramIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryTelegramIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryTelegramIntegrationsConnectionEdge = {
  __typename?: 'QueryTelegramIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKTelegramIntegration>;
};

export type CBKQueryTriggerIntegrationsConnection = {
  __typename?: 'QueryTriggerIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryTriggerIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryTriggerIntegrationsConnectionEdge = {
  __typename?: 'QueryTriggerIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKTriggerIntegration>;
};

export type CBKQueryTwilioIntegrationsConnection = {
  __typename?: 'QueryTwilioIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryTwilioIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryTwilioIntegrationsConnectionEdge = {
  __typename?: 'QueryTwilioIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKTwilioIntegration>;
};

export type CBKQueryUsersConnection = {
  __typename?: 'QueryUsersConnection';
  edges?: Maybe<Array<Maybe<CBKQueryUsersConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryUsersConnectionEdge = {
  __typename?: 'QueryUsersConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKUser>;
};

export type CBKQueryWhatsappIntegrationsConnection = {
  __typename?: 'QueryWhatsappIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryWhatsappIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryWhatsappIntegrationsConnectionEdge = {
  __typename?: 'QueryWhatsappIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKWhatsappIntegration>;
};

export type CBKQueryWidgetIntegrationsConnection = {
  __typename?: 'QueryWidgetIntegrationsConnection';
  edges?: Maybe<Array<Maybe<CBKQueryWidgetIntegrationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKQueryWidgetIntegrationsConnectionEdge = {
  __typename?: 'QueryWidgetIntegrationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKWidgetIntegration>;
};

export type CBKRating = {
  __typename?: 'Rating';
  /** The bot associated with the rating */
  bot?: Maybe<CBKBot>;
  /** The contact associated with the rating */
  contact?: Maybe<CBKContact>;
  /** The conversation associated with the rating */
  conversation?: Maybe<CBKConversation>;
  /** The date and time when the rating was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the rating */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the rating */
  id?: Maybe<Scalars['ID']['output']>;
  /** The message associated with the rating */
  message?: Maybe<CBKMessage>;
  /** The metadata associated with the rating */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the rating */
  name?: Maybe<Scalars['String']['output']>;
  /** The reason for the rating */
  reason?: Maybe<Scalars['String']['output']>;
  /** The date and time when the rating was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** The rating value */
  value?: Maybe<Scalars['Int']['output']>;
};

/** The sentiment of a rating: upvote (value >= 0) or downvote (value < 0) */
export enum CBKRatingSentiment {
  Downvote = 'downvote',
  Upvote = 'upvote'
}

export type CBKRecallIntegration = {
  __typename?: 'RecallIntegration';
  /** The blueprint associated with the recall integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the recall integration */
  bot?: Maybe<CBKBot>;
  /** The date and time when the recall integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the recall integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the recall integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the recall integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the recall integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The date and time when the recall integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Lifecycle state for resources that can be toggled on/off without deletion */
export enum CBKResourceState {
  Disabled = 'disabled',
  Enabled = 'enabled'
}

/** Schedule options for trigger integrations */
export enum CBKSchedule {
  Daily = 'daily',
  Halfhourly = 'halfhourly',
  Hourly = 'hourly',
  Monthly = 'monthly',
  Never = 'never',
  Quarterhourly = 'quarterhourly',
  Twicedaily = 'twicedaily',
  Twicemonthly = 'twicemonthly',
  Twiceweekly = 'twiceweekly',
  Weekly = 'weekly'
}

export type CBKSecret = {
  __typename?: 'Secret';
  /** The abilities associated with the secret */
  abilities?: Maybe<CBKSecretAbilitiesConnection>;
  /** The blueprint associated with the secret */
  blueprint?: Maybe<CBKBlueprint>;
  /** The ID of the blueprint associated with the secret */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The configuration of the secret (config.clientSecret is returned as '********' if configured, null otherwise) */
  config?: Maybe<Scalars['JsonObject']['output']>;
  /** The contacts associated with the secret */
  contacts?: Maybe<Array<CBKSecretContact>>;
  /** The date and time when the secret was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the secret */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the secret */
  id?: Maybe<Scalars['ID']['output']>;
  /** The kind of the secret */
  kind?: Maybe<CBKSecretKind>;
  /** The metadata associated with the secret */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the secret */
  name?: Maybe<Scalars['String']['output']>;
  /** The type of the secret */
  type?: Maybe<CBKSecretType>;
  /** The date and time when the secret was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** The verification status of the secret */
  verification: CBKSecretVerification;
};


export type CBKSecretAbilitiesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKSecretContactsArgs = {
  contactIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type CBKSecretAbilitiesConnection = {
  __typename?: 'SecretAbilitiesConnection';
  edges?: Maybe<Array<Maybe<CBKSecretAbilitiesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKSecretAbilitiesConnectionEdge = {
  __typename?: 'SecretAbilitiesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKAbility>;
};

export type CBKSecretContact = {
  __typename?: 'SecretContact';
  /** The email of the contact */
  email?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the contact */
  id: Scalars['String']['output'];
  /** The name of the contact */
  name?: Maybe<Scalars['String']['output']>;
  /** The nickname of the contact */
  nick?: Maybe<Scalars['String']['output']>;
  /** The phone number of the contact */
  phone?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the secret associated with the contact */
  secretId: Scalars['ID']['output'];
  /** The verification status of the contact for the secret */
  verification: CBKSecretContactVerification;
};

export type CBKSecretContactVerification = {
  __typename?: 'SecretContactVerification';
  /** The actions available for the contact verification */
  action?: Maybe<CBKSecretContactVerificationAction>;
  /** The verification status of the contact for the secret */
  status: CBKSecretContactVerificationStatus;
};

export type CBKSecretContactVerificationAction = {
  __typename?: 'SecretContactVerificationAction';
  /** The type of action that can be performed for contact verification */
  type: CBKSecretContactVerificationActionType;
  /** The URL to perform the action for contact verification */
  url?: Maybe<Scalars['String']['output']>;
};

/** The type of action that can be performed for contact verification */
export enum CBKSecretContactVerificationActionType {
  Authenticate = 'authenticate'
}

/** The status of the contact verification for the secret */
export enum CBKSecretContactVerificationStatus {
  Authenticated = 'authenticated',
  Unauthenticated = 'unauthenticated'
}

/** Input parameters for creating a new secret */
export type CBKSecretCreateRequest = {
  /** The alias ID for the secret */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** Additional configuration for the secret */
  config?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The description of the secret */
  description?: InputMaybe<Scalars['String']['input']>;
  /** The kind of secret (personal or organizational) */
  kind?: InputMaybe<CBKSecretKind>;
  /** Additional metadata for the secret */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the secret */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The type of secret (token or other) */
  type?: InputMaybe<CBKSecretType>;
  /** The secret value */
  value?: InputMaybe<Scalars['String']['input']>;
  /** The visibility level of the secret */
  visibility?: InputMaybe<CBKSecretVisibility>;
};

/** Response containing the ID of a newly created secret */
export type CBKSecretCreateResponse = {
  __typename?: 'SecretCreateResponse';
  /** The unique identifier of the created secret */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted secret */
export type CBKSecretDeleteResponse = {
  __typename?: 'SecretDeleteResponse';
  /** The unique identifier of the deleted secret */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Kinds of secrets that can be used in the system */
export enum CBKSecretKind {
  Personal = 'personal',
  Shared = 'shared'
}

/** Response containing the ID of a revoked secret */
export type CBKSecretRevokeResponse = {
  __typename?: 'SecretRevokeResponse';
  /** The unique identifier of the revoked secret */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Types of secrets that can be used in the system */
export enum CBKSecretType {
  Basic = 'basic',
  Bearer = 'bearer',
  Jwt = 'jwt',
  Oauth = 'oauth',
  Plain = 'plain',
  Reference = 'reference',
  Template = 'template'
}

/** Input parameters for updating an existing secret */
export type CBKSecretUpdateRequest = {
  /** The alias ID for the secret */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** Additional configuration for the secret */
  config?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The description of the secret */
  description?: InputMaybe<Scalars['String']['input']>;
  /** The kind of secret (personal or organizational) */
  kind?: InputMaybe<CBKSecretKind>;
  /** Additional metadata for the secret */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the secret */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The type of secret (token or other) */
  type?: InputMaybe<CBKSecretType>;
  /** The secret value */
  value?: InputMaybe<Scalars['String']['input']>;
  /** The visibility level of the secret */
  visibility?: InputMaybe<CBKSecretVisibility>;
};

/** Response containing the ID of an updated secret */
export type CBKSecretUpdateResponse = {
  __typename?: 'SecretUpdateResponse';
  /** The unique identifier of the updated secret */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKSecretVerification = {
  __typename?: 'SecretVerification';
  /** The actions available for the verification */
  action?: Maybe<CBKSecretVerificationAction>;
  /** The verification status of the secret */
  status: CBKSecretVerificationStatus;
};

export type CBKSecretVerificationAction = {
  __typename?: 'SecretVerificationAction';
  /** The type of action that can be performed for verification */
  type: CBKSecretVerificationActionType;
  /** The URL to perform the action for verification */
  url?: Maybe<Scalars['String']['output']>;
};

/** The type of action that can be performed for verification */
export enum CBKSecretVerificationActionType {
  Authenticate = 'authenticate'
}

/** The status of the verification for the secret */
export enum CBKSecretVerificationStatus {
  Authenticated = 'authenticated',
  Unauthenticated = 'unauthenticated'
}

/** Visibility options for secrets */
export enum CBKSecretVisibility {
  Private = 'private',
  Protected = 'protected',
  Public = 'public'
}

export type CBKSitemapIntegration = {
  __typename?: 'SitemapIntegration';
  /** The blueprint associated with the sitemap integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The date and time when the sitemap integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The dataset associated with the sitemap integration */
  dataset?: Maybe<CBKDataset>;
  /** The description of the sitemap integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the sitemap integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The date and time when the sitemap integration was last synced */
  lastSyncedAt?: Maybe<Scalars['DateTime']['output']>;
  /** The metadata associated with the sitemap integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the sitemap integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The sync schedule of the sitemap integration */
  syncSchedule?: Maybe<CBKSchedule>;
  /** The sync status of the sitemap integration */
  syncStatus?: Maybe<Scalars['String']['output']>;
  /** The date and time when the sitemap integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Input parameters for creating a new Sitemap integration */
export type CBKSitemapIntegrationCreateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the dataset to sync to */
  datasetId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Time in milliseconds before the data expires */
  expiresIn?: InputMaybe<Scalars['Int']['input']>;
  /** Glob pattern to filter URLs */
  glob?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable JavaScript rendering */
  javascript?: InputMaybe<Scalars['Boolean']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** CSS selectors to focus on specific parts of the pages */
  selectors?: InputMaybe<Scalars['String']['input']>;
  /** The schedule for automatic synchronization */
  syncSchedule?: InputMaybe<CBKSchedule>;
  /** The URL of the sitemap to crawl */
  url?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of a newly created Sitemap integration */
export type CBKSitemapIntegrationCreateResponse = {
  __typename?: 'SitemapIntegrationCreateResponse';
  /** The unique identifier of the created Sitemap integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Sitemap integration */
export type CBKSitemapIntegrationDeleteResponse = {
  __typename?: 'SitemapIntegrationDeleteResponse';
  /** The unique identifier of the deleted Sitemap integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Sitemap integration */
export type CBKSitemapIntegrationUpdateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the dataset to sync to */
  datasetId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Time in milliseconds before the data expires */
  expiresIn?: InputMaybe<Scalars['Int']['input']>;
  /** Glob pattern to filter URLs */
  glob?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable JavaScript rendering */
  javascript?: InputMaybe<Scalars['Boolean']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** CSS selectors to extract content */
  selectors?: InputMaybe<Scalars['String']['input']>;
  /** The schedule for automatic synchronization */
  syncSchedule?: InputMaybe<CBKSchedule>;
  /** The URL of the sitemap to crawl */
  url?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of an updated Sitemap integration */
export type CBKSitemapIntegrationUpdateResponse = {
  __typename?: 'SitemapIntegrationUpdateResponse';
  /** The unique identifier of the updated Sitemap integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKSkillserverIntegration = {
  __typename?: 'SkillserverIntegration';
  /** The blueprint associated with the skill server integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The date and time when the skill server integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the skill server integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the skill server integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the skill server integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the skill server integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The skillset associated with the skill server integration */
  skillset?: Maybe<CBKSkillset>;
  /** The date and time when the skill server integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Input parameters for creating a new Skill Server integration */
export type CBKSkillserverIntegrationCreateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the skillset to connect */
  skillsetId?: InputMaybe<Scalars['ID']['input']>;
};

/** Response containing the ID of a newly created Skill Server integration */
export type CBKSkillserverIntegrationCreateResponse = {
  __typename?: 'SkillserverIntegrationCreateResponse';
  /** The unique identifier of the created Skill Server integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Skill Server integration */
export type CBKSkillserverIntegrationDeleteResponse = {
  __typename?: 'SkillserverIntegrationDeleteResponse';
  /** The unique identifier of the deleted Skill Server integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Skill Server integration */
export type CBKSkillserverIntegrationUpdateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the skillset to connect */
  skillsetId?: InputMaybe<Scalars['ID']['input']>;
};

/** Response containing the ID of an updated Skill Server integration */
export type CBKSkillserverIntegrationUpdateResponse = {
  __typename?: 'SkillserverIntegrationUpdateResponse';
  /** The unique identifier of the updated Skill Server integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKSkillset = {
  __typename?: 'Skillset';
  /** The abilities associated with the skillset */
  abilities?: Maybe<CBKSkillsetAbilitiesConnection>;
  /** The blueprint associated with the skillset */
  blueprint?: Maybe<CBKBlueprint>;
  /** The ID of the blueprint associated with the skillset */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The bots associated with the skillset */
  bots?: Maybe<CBKSkillsetBotsConnection>;
  /** The date and time when the skillset was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the skillset */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the skillset */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the skillset */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the skillset */
  name?: Maybe<Scalars['String']['output']>;
  /** The lifecycle state of the skillset (enabled/disabled) */
  state?: Maybe<CBKResourceState>;
  /** The date and time when the skillset was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type CBKSkillsetAbilitiesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKSkillsetBotsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type CBKSkillsetAbilitiesConnection = {
  __typename?: 'SkillsetAbilitiesConnection';
  edges?: Maybe<Array<Maybe<CBKSkillsetAbilitiesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKSkillsetAbilitiesConnectionEdge = {
  __typename?: 'SkillsetAbilitiesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKAbility>;
};

/** Input parameters for creating a new skillset ability */
export type CBKSkillsetAbilityCreateRequest = {
  /** The alias ID for the ability */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the ability */
  description?: InputMaybe<Scalars['String']['input']>;
  /** The instruction for the ability */
  instruction?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the bot the ability is linked to */
  linkedBotId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the file the ability is linked to */
  linkedFileId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the secret the ability is linked to */
  linkedSecretId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the space the ability is linked to */
  linkedSpaceId?: InputMaybe<Scalars['ID']['input']>;
  /** Additional metadata for the ability */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the ability */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The lifecycle state of the ability (enabled/disabled) */
  state?: InputMaybe<CBKResourceState>;
};

/** Response containing the ID of a newly created skillset ability */
export type CBKSkillsetAbilityCreateResponse = {
  __typename?: 'SkillsetAbilityCreateResponse';
  /** The unique identifier of the created skillset ability */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted skillset ability */
export type CBKSkillsetAbilityDeleteResponse = {
  __typename?: 'SkillsetAbilityDeleteResponse';
  /** The unique identifier of the deleted skillset ability */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing skillset ability */
export type CBKSkillsetAbilityUpdateRequest = {
  /** The alias ID for the ability */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the ability */
  description?: InputMaybe<Scalars['String']['input']>;
  /** The instruction for the ability */
  instruction?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the bot the ability is linked to */
  linkedBotId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the file the ability is linked to */
  linkedFileId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the secret the ability is linked to */
  linkedSecretId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the space the ability is linked to */
  linkedSpaceId?: InputMaybe<Scalars['ID']['input']>;
  /** Additional metadata for the ability */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the ability */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The lifecycle state of the ability (enabled/disabled) */
  state?: InputMaybe<CBKResourceState>;
};

/** Response containing the ID of an updated skillset ability */
export type CBKSkillsetAbilityUpdateResponse = {
  __typename?: 'SkillsetAbilityUpdateResponse';
  /** The unique identifier of the updated skillset ability */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKSkillsetBotsConnection = {
  __typename?: 'SkillsetBotsConnection';
  edges?: Maybe<Array<Maybe<CBKSkillsetBotsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKSkillsetBotsConnectionEdge = {
  __typename?: 'SkillsetBotsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKBot>;
};

/** Input parameters for creating a new skillset */
export type CBKSkillsetCreateRequest = {
  /** The alias ID for the skillset */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the skillset */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the skillset */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the skillset */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The lifecycle state of the skillset (enabled/disabled) */
  state?: InputMaybe<CBKResourceState>;
  /** The visibility level of the skillset */
  visibility?: InputMaybe<CBKSkillsetVisibility>;
};

/** Response containing the ID of a newly created skillset */
export type CBKSkillsetCreateResponse = {
  __typename?: 'SkillsetCreateResponse';
  /** The unique identifier of the created skillset */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted skillset */
export type CBKSkillsetDeleteResponse = {
  __typename?: 'SkillsetDeleteResponse';
  /** The unique identifier of the deleted skillset */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing skillset */
export type CBKSkillsetUpdateRequest = {
  /** The alias ID for the skillset */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the skillset */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the skillset */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the skillset */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The lifecycle state of the skillset (enabled/disabled) */
  state?: InputMaybe<CBKResourceState>;
  /** The visibility level of the skillset */
  visibility?: InputMaybe<CBKSkillsetVisibility>;
};

/** Response containing the ID of an updated skillset */
export type CBKSkillsetUpdateResponse = {
  __typename?: 'SkillsetUpdateResponse';
  /** The unique identifier of the updated skillset */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Visibility options for skillsets */
export enum CBKSkillsetVisibility {
  Private = 'private',
  Protected = 'protected',
  Public = 'public'
}

export type CBKSlackIntegration = {
  __typename?: 'SlackIntegration';
  /** The allowed senders for the slack integration */
  allowFrom?: Maybe<Scalars['String']['output']>;
  /** Whether attachments are enabled */
  attachments?: Maybe<Scalars['Boolean']['output']>;
  /** The auto respond configuration */
  autoRespond?: Maybe<Scalars['String']['output']>;
  /** The blueprint associated with the slack integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the slack integration */
  bot?: Maybe<CBKBot>;
  /** Whether contact collection is enabled */
  contactCollection?: Maybe<Scalars['Boolean']['output']>;
  /** The date and time when the slack integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the slack integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the slack integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the slack integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the slack integration */
  name?: Maybe<Scalars['String']['output']>;
  /** Whether ratings are enabled */
  ratings?: Maybe<Scalars['Boolean']['output']>;
  /** Whether references are enabled */
  references?: Maybe<Scalars['Boolean']['output']>;
  /** The session duration for the slack integration */
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  /** The date and time when the slack integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** Whether the integration holds every credential it needs to carry traffic, and how to install it if not */
  verification: CBKIntegrationVerification;
  /** The number of visible messages outside of the new thread */
  visibleMessages?: Maybe<Scalars['Int']['output']>;
};

/** Input parameters for creating a new Slack integration */
export type CBKSlackIntegrationCreateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** Newline-or-comma-separated list of allowed senders. Use Slack user IDs (U…/W…), channel IDs (C…/G…/D…), @username, or #channel-name. Use * to allow all. Leave empty to deny all. */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** Auto-respond configuration for the integration */
  autoRespond?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The Slack bot token for API access */
  botToken?: InputMaybe<Scalars['String']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable message ratings */
  ratings?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether to include message references */
  references?: InputMaybe<Scalars['Boolean']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  /** The Slack signing secret for request verification */
  signingSecret?: InputMaybe<Scalars['String']['input']>;
  /** The Slack user token for additional permissions */
  userToken?: InputMaybe<Scalars['String']['input']>;
  /** The number of visible messages in the conversation */
  visibleMessages?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of a newly created Slack integration */
export type CBKSlackIntegrationCreateResponse = {
  __typename?: 'SlackIntegrationCreateResponse';
  /** The unique identifier of the created Slack integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Slack integration */
export type CBKSlackIntegrationDeleteResponse = {
  __typename?: 'SlackIntegrationDeleteResponse';
  /** The unique identifier of the deleted Slack integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Slack integration */
export type CBKSlackIntegrationUpdateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** Newline-or-comma-separated list of allowed senders. Use Slack user IDs (U…/W…), channel IDs (C…/G…/D…), @username, or #channel-name. Use * to allow all. Leave empty to deny all. */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** Auto-respond configuration for the integration */
  autoRespond?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The Slack bot token for API access */
  botToken?: InputMaybe<Scalars['String']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable message ratings */
  ratings?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether to include message references */
  references?: InputMaybe<Scalars['Boolean']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  /** The Slack signing secret for request verification */
  signingSecret?: InputMaybe<Scalars['String']['input']>;
  /** The Slack user token for additional permissions */
  userToken?: InputMaybe<Scalars['String']['input']>;
  /** The number of visible messages in the conversation */
  visibleMessages?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of an updated Slack integration */
export type CBKSlackIntegrationUpdateResponse = {
  __typename?: 'SlackIntegrationUpdateResponse';
  /** The unique identifier of the updated Slack integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKSpace = {
  __typename?: 'Space';
  /** The alias ID for the space */
  alias?: Maybe<Scalars['String']['output']>;
  /** The blueprint associated with the space */
  blueprint?: Maybe<CBKBlueprint>;
  /** The ID of the blueprint associated with the space */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The contact associated with the space */
  contact?: Maybe<CBKContact>;
  /** The ID of the contact associated with the space */
  contactId?: Maybe<Scalars['String']['output']>;
  /** The conversations associated with the space */
  conversations?: Maybe<CBKSpaceConversationsConnection>;
  /** The date and time when the space was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the space */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the space */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the space */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the space */
  name?: Maybe<Scalars['String']['output']>;
  /** The sites associated with the space */
  sites?: Maybe<CBKSpaceSitesConnection>;
  /** The date and time when the space was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** The user associated with the space */
  user?: Maybe<CBKUser>;
};


export type CBKSpaceConversationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKSpaceSitesArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type CBKSpaceConversationsConnection = {
  __typename?: 'SpaceConversationsConnection';
  edges?: Maybe<Array<Maybe<CBKSpaceConversationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKSpaceConversationsConnectionEdge = {
  __typename?: 'SpaceConversationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKConversation>;
};

/** Input parameters for creating a new space */
export type CBKSpaceCreateRequest = {
  /** The alias ID for the space */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the contact to associate */
  contactId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the space */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the space */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the space */
  name?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of a newly created space */
export type CBKSpaceCreateResponse = {
  __typename?: 'SpaceCreateResponse';
  /** The unique identifier of the created space */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted space */
export type CBKSpaceDeleteResponse = {
  __typename?: 'SpaceDeleteResponse';
  /** The unique identifier of the deleted space */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKSpaceSite = {
  __typename?: 'SpaceSite';
  /** The alias ID for the space site */
  alias?: Maybe<Scalars['String']['output']>;
  /** The date and time when the space site was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the space site */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the space site */
  id?: Maybe<Scalars['ID']['output']>;
  /** The directory index filename */
  index?: Maybe<Scalars['String']['output']>;
  /** The metadata associated with the space site */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the space site */
  name?: Maybe<Scalars['String']['output']>;
  /** The not found filename */
  notFound?: Maybe<Scalars['String']['output']>;
  /** The optional folder prefix inside the space to serve from */
  prefix?: Maybe<Scalars['String']['output']>;
  /** The subdomain slug beneath the configured space apex */
  slug?: Maybe<Scalars['String']['output']>;
  /** The space associated with the site */
  space?: Maybe<CBKSpace>;
  /** The date and time when the space site was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Input parameters for creating a new space site */
export type CBKSpaceSiteCreateRequest = {
  /** The alias ID for the space site */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the space site */
  description?: InputMaybe<Scalars['String']['input']>;
  /** The directory index filename */
  index?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the space site */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the space site */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The not found filename */
  notFound?: InputMaybe<Scalars['String']['input']>;
  /** The optional folder prefix inside the space to serve from */
  prefix?: InputMaybe<Scalars['String']['input']>;
  /** The subdomain slug beneath the configured space apex */
  slug: Scalars['String']['input'];
};

/** Response containing the ID of a newly created space site */
export type CBKSpaceSiteCreateResponse = {
  __typename?: 'SpaceSiteCreateResponse';
  /** The unique identifier of the created space site */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted space site */
export type CBKSpaceSiteDeleteResponse = {
  __typename?: 'SpaceSiteDeleteResponse';
  /** The unique identifier of the deleted space site */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing space site */
export type CBKSpaceSiteUpdateRequest = {
  /** The alias ID for the space site */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the space site */
  description?: InputMaybe<Scalars['String']['input']>;
  /** The directory index filename */
  index?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the space site */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the space site */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The not found filename */
  notFound?: InputMaybe<Scalars['String']['input']>;
  /** The optional folder prefix inside the space to serve from */
  prefix?: InputMaybe<Scalars['String']['input']>;
  /** The subdomain slug beneath the configured space apex */
  slug?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of an updated space site */
export type CBKSpaceSiteUpdateResponse = {
  __typename?: 'SpaceSiteUpdateResponse';
  /** The unique identifier of the updated space site */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKSpaceSitesConnection = {
  __typename?: 'SpaceSitesConnection';
  edges?: Maybe<Array<Maybe<CBKSpaceSitesConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKSpaceSitesConnectionEdge = {
  __typename?: 'SpaceSitesConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKSpaceSite>;
};

/** Input parameters for updating an existing space */
export type CBKSpaceUpdateRequest = {
  /** The alias ID for the space */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the contact to associate */
  contactId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the space */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the space */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the space */
  name?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of an updated space */
export type CBKSpaceUpdateResponse = {
  __typename?: 'SpaceUpdateResponse';
  /** The unique identifier of the updated space */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKSupportIntegration = {
  __typename?: 'SupportIntegration';
  /** The alias ID */
  alias?: Maybe<Scalars['String']['output']>;
  /** The blueprint associated with the support integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The ID of the blueprint to use */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The bot associated with the support integration */
  bot?: Maybe<CBKBot>;
  /** The ID of the bot to connect */
  botId?: Maybe<Scalars['String']['output']>;
  /** The date and time when the support integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the support integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The support email address */
  email?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the support integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the support integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the support integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The date and time when the support integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Input parameters for creating a new Support integration */
export type CBKSupportIntegrationCreateRequest = {
  /** The alias ID */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The description */
  description?: InputMaybe<Scalars['String']['input']>;
  /** The support email address */
  email?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name */
  name?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of a newly created Support integration */
export type CBKSupportIntegrationCreateResponse = {
  __typename?: 'SupportIntegrationCreateResponse';
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Support integration */
export type CBKSupportIntegrationDeleteResponse = {
  __typename?: 'SupportIntegrationDeleteResponse';
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Support integration */
export type CBKSupportIntegrationUpdateRequest = {
  /** The alias ID */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The description */
  description?: InputMaybe<Scalars['String']['input']>;
  /** The support email address */
  email?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name */
  name?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of a updated Support integration */
export type CBKSupportIntegrationUpdateResponse = {
  __typename?: 'SupportIntegrationUpdateResponse';
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKTask = {
  __typename?: 'Task';
  /** The ID of the blueprint the task belongs to */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The bot associated with the task */
  bot?: Maybe<CBKBot>;
  /** The ID of the bot the task runs */
  botId?: Maybe<Scalars['String']['output']>;
  /** The contact associated with the task */
  contact?: Maybe<CBKContact>;
  /** The ID of the contact the task is scoped to */
  contactId?: Maybe<Scalars['String']['output']>;
  /** The conversations associated with the task */
  conversations?: Maybe<CBKTaskConversationsConnection>;
  /** The date and time when the task was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the task */
  description?: Maybe<Scalars['String']['output']>;
  /** The executions associated with the task */
  executions?: Maybe<CBKTaskExecutionsConnection>;
  /** The date and time when the task expires */
  expiresAt?: Maybe<Scalars['DateTime']['output']>;
  /** The unique identifier of the task */
  id?: Maybe<Scalars['ID']['output']>;
  /** The last run time for the task */
  lastRunAt?: Maybe<Scalars['DateTime']['output']>;
  /** The maximum tool calls across the whole task run */
  maxCalls?: Maybe<Scalars['Int']['output']>;
  /** The maximum reasoning iterations per execution */
  maxIterations?: Maybe<Scalars['Int']['output']>;
  /** The maximum wall-clock time per execution in milliseconds */
  maxTime?: Maybe<Scalars['Float']['output']>;
  /** The metadata associated with the task */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the task */
  name?: Maybe<Scalars['String']['output']>;
  /** The next scheduled run time for the task */
  nextRunAt?: Maybe<Scalars['DateTime']['output']>;
  /** The outcome of the task */
  outcome?: Maybe<CBKTaskOutcome>;
  /** The schedule for the task */
  schedule?: Maybe<Scalars['String']['output']>;
  /** The session duration for the task */
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  /** The status of the task */
  status?: Maybe<CBKTaskStatus>;
  /** The IANA timezone the schedule is evaluated in */
  timezone?: Maybe<Scalars['String']['output']>;
  /** The date and time when the task was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type CBKTaskConversationsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type CBKTaskExecutionsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type CBKTaskConversationsConnection = {
  __typename?: 'TaskConversationsConnection';
  edges?: Maybe<Array<Maybe<CBKTaskConversationsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKTaskConversationsConnectionEdge = {
  __typename?: 'TaskConversationsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKConversation>;
};

/** Input parameters for creating a new task */
export type CBKTaskCreateRequest = {
  /** The ID of the blueprint to assign the task to */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot the task runs */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the contact to scope the task to */
  contactId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the task */
  description?: InputMaybe<Scalars['String']['input']>;
  /** The timestamp (ms) at which the task expires and is automatically deleted */
  expiresAt?: InputMaybe<Scalars['Float']['input']>;
  /** Maximum tool calls across the whole task run (0 or null for unbounded) */
  maxCalls?: InputMaybe<Scalars['Int']['input']>;
  /** Maximum reasoning iterations per execution */
  maxIterations?: InputMaybe<Scalars['Int']['input']>;
  /** Maximum wall-clock time per execution in milliseconds */
  maxTime?: InputMaybe<Scalars['Float']['input']>;
  /** Additional metadata for the task */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the task */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The schedule: now, a cron expression, a date-time, or an interval keyword such as daily */
  schedule?: InputMaybe<Scalars['String']['input']>;
  /** Session duration in milliseconds controlling conversation reuse across runs */
  sessionDuration?: InputMaybe<Scalars['Float']['input']>;
  /** The IANA timezone the schedule is evaluated in */
  timezone?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of a newly created task */
export type CBKTaskCreateResponse = {
  __typename?: 'TaskCreateResponse';
  /** The unique identifier of the created task */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted task */
export type CBKTaskDeleteResponse = {
  __typename?: 'TaskDeleteResponse';
  /** The unique identifier of the deleted task */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKTaskExecution = {
  __typename?: 'TaskExecution';
  /** The date and time when the task execution completed */
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  /** The conversation associated with this execution */
  conversation?: Maybe<CBKConversation>;
  /** The date and time when the task execution was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the task execution */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the task execution */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the task execution */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the task execution */
  name?: Maybe<Scalars['String']['output']>;
  /** The outcome of the task execution */
  outcome?: Maybe<CBKTaskOutcome>;
  /** The status of the task execution */
  status?: Maybe<CBKTaskStatus>;
  /** The summary of the task execution */
  summary?: Maybe<Scalars['String']['output']>;
  /** The task associated with this execution */
  task?: Maybe<CBKTask>;
  /** The date and time when the task execution was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CBKTaskExecutionsConnection = {
  __typename?: 'TaskExecutionsConnection';
  edges?: Maybe<Array<Maybe<CBKTaskExecutionsConnectionEdge>>>;
  pageInfo: CBKPageInfo;
};

export type CBKTaskExecutionsConnectionEdge = {
  __typename?: 'TaskExecutionsConnectionEdge';
  cursor: Scalars['ID']['output'];
  node?: Maybe<CBKTaskExecution>;
};

/** Outcome of task execution */
export enum CBKTaskOutcome {
  Failure = 'failure',
  Pending = 'pending',
  Success = 'success'
}

/** Status of task execution */
export enum CBKTaskStatus {
  Canceled = 'canceled',
  Idle = 'idle',
  Running = 'running'
}

/** Input parameters for updating an existing task */
export type CBKTaskUpdateRequest = {
  /** The ID of the blueprint to assign the task to */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot the task runs */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the contact to scope the task to */
  contactId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the task */
  description?: InputMaybe<Scalars['String']['input']>;
  /** The timestamp (ms) at which the task expires and is automatically deleted; null clears any expiry */
  expiresAt?: InputMaybe<Scalars['Float']['input']>;
  /** Maximum tool calls across the whole task run (0 or null for unbounded) */
  maxCalls?: InputMaybe<Scalars['Int']['input']>;
  /** Maximum reasoning iterations per execution */
  maxIterations?: InputMaybe<Scalars['Int']['input']>;
  /** Maximum wall-clock time per execution in milliseconds */
  maxTime?: InputMaybe<Scalars['Float']['input']>;
  /** Additional metadata for the task */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the task */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The schedule for the task */
  schedule?: InputMaybe<Scalars['String']['input']>;
  /** Session duration in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Float']['input']>;
  /** The IANA timezone the schedule is evaluated in */
  timezone?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of an updated task */
export type CBKTaskUpdateResponse = {
  __typename?: 'TaskUpdateResponse';
  /** The unique identifier of the updated task */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKTeam = {
  __typename?: 'Team';
  /** The date and time when the team was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the team */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the team */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the team */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the team */
  name?: Maybe<Scalars['String']['output']>;
  /** The date and time when the team was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CBKTelegramIntegration = {
  __typename?: 'TelegramIntegration';
  /** The allowed senders for the telegram integration */
  allowFrom?: Maybe<Scalars['String']['output']>;
  /** Whether attachments are enabled */
  attachments?: Maybe<Scalars['Boolean']['output']>;
  /** The blueprint associated with the telegram integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the telegram integration */
  bot?: Maybe<CBKBot>;
  /** Whether contact collection is enabled */
  contactCollection?: Maybe<Scalars['Boolean']['output']>;
  /** The date and time when the telegram integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the telegram integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the telegram integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the telegram integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the telegram integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The session duration for the telegram integration */
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  /** The date and time when the telegram integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** Whether the integration holds every credential it needs to carry traffic, and how to install it if not */
  verification: CBKIntegrationVerification;
};

/** Input parameters for creating a new Telegram integration */
export type CBKTelegramIntegrationCreateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** Newline-or-comma-separated list of allowed senders. Use @username or @numericId for users, #chatId for groups. Leave empty to allow all. */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable file attachments */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The Telegram bot token for API access */
  botToken?: InputMaybe<Scalars['String']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of a newly created Telegram integration */
export type CBKTelegramIntegrationCreateResponse = {
  __typename?: 'TelegramIntegrationCreateResponse';
  /** The unique identifier of the created Telegram integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Telegram integration */
export type CBKTelegramIntegrationDeleteResponse = {
  __typename?: 'TelegramIntegrationDeleteResponse';
  /** The unique identifier of the deleted Telegram integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Telegram integration */
export type CBKTelegramIntegrationUpdateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** Newline-or-comma-separated list of allowed senders. Use @username or @numericId for users, #chatId for groups. Leave empty to allow all. */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable file attachments */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The Telegram bot token for API access */
  botToken?: InputMaybe<Scalars['String']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of an updated Telegram integration */
export type CBKTelegramIntegrationUpdateResponse = {
  __typename?: 'TelegramIntegrationUpdateResponse';
  /** The unique identifier of the updated Telegram integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKTriggerIntegration = {
  __typename?: 'TriggerIntegration';
  /** Whether authentication is required */
  authenticate?: Maybe<Scalars['Boolean']['output']>;
  /** The blueprint associated with the trigger integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the trigger integration */
  bot?: Maybe<CBKBot>;
  /** The date and time when the trigger integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the trigger integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the trigger integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The date and time when the trigger integration was last triggered */
  lastTriggerAt?: Maybe<Scalars['DateTime']['output']>;
  /** The metadata associated with the trigger integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the trigger integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The schedule for the trigger integration */
  schedule?: Maybe<Scalars['String']['output']>;
  /** The session duration for the trigger integration */
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  /** The date and time when the trigger integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/** Input parameters for creating a new Trigger integration */
export type CBKTriggerIntegrationCreateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to require authentication for the trigger */
  authenticate?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The schedule for automatic trigger execution */
  schedule?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  /** The IANA timezone used to evaluate the trigger schedule */
  timezone?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of a newly created Trigger integration */
export type CBKTriggerIntegrationCreateResponse = {
  __typename?: 'TriggerIntegrationCreateResponse';
  /** The unique identifier of the created Trigger integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Trigger integration */
export type CBKTriggerIntegrationDeleteResponse = {
  __typename?: 'TriggerIntegrationDeleteResponse';
  /** The unique identifier of the deleted Trigger integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Trigger integration */
export type CBKTriggerIntegrationUpdateRequest = {
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to require authentication for the trigger */
  authenticate?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The schedule for automatic trigger execution */
  schedule?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  /** The IANA timezone used to evaluate the trigger schedule */
  timezone?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of an updated Trigger integration */
export type CBKTriggerIntegrationUpdateResponse = {
  __typename?: 'TriggerIntegrationUpdateResponse';
  /** The unique identifier of the updated Trigger integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKTwilioIntegration = {
  __typename?: 'TwilioIntegration';
  /** The blueprint associated with the twilio integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the twilio integration */
  bot?: Maybe<CBKBot>;
  /** Whether contact collection is enabled */
  contactCollection?: Maybe<Scalars['Boolean']['output']>;
  /** The date and time when the twilio integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the twilio integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the twilio integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the twilio integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the twilio integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The session duration for the twilio integration */
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  /** The date and time when the twilio integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** Whether the integration holds every credential it needs to carry traffic, and how to install it if not */
  verification: CBKIntegrationVerification;
};

/** Input parameters for creating a new Twilio integration */
export type CBKTwilioIntegrationCreateRequest = {
  /** The Twilio Account SID */
  accountSid?: InputMaybe<Scalars['String']['input']>;
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The allowed senders for the integration */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** The Twilio auth token */
  authToken?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  /** The Twilio voice configuration */
  voice?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of a newly created Twilio integration */
export type CBKTwilioIntegrationCreateResponse = {
  __typename?: 'TwilioIntegrationCreateResponse';
  /** The unique identifier of the created Twilio integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Twilio integration */
export type CBKTwilioIntegrationDeleteResponse = {
  __typename?: 'TwilioIntegrationDeleteResponse';
  /** The unique identifier of the deleted Twilio integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Twilio integration */
export type CBKTwilioIntegrationUpdateRequest = {
  /** The Twilio Account SID */
  accountSid?: InputMaybe<Scalars['String']['input']>;
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** The allowed senders for the integration */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** The Twilio auth token */
  authToken?: InputMaybe<Scalars['String']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  /** The Twilio voice configuration */
  voice?: InputMaybe<Scalars['String']['input']>;
};

/** Response containing the ID of an updated Twilio integration */
export type CBKTwilioIntegrationUpdateResponse = {
  __typename?: 'TwilioIntegrationUpdateResponse';
  /** The unique identifier of the updated Twilio integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKUser = {
  __typename?: 'User';
  /** The date and time when the user was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the user */
  description?: Maybe<Scalars['String']['output']>;
  /** The email of the user */
  email?: Maybe<Scalars['String']['output']>;
  /** The goal of the user */
  goal?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the user */
  id?: Maybe<Scalars['ID']['output']>;
  /** The image of the user */
  image?: Maybe<Scalars['String']['output']>;
  /** The metadata associated with the user */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the user */
  name?: Maybe<Scalars['String']['output']>;
  /** The date and time when the user was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** The current usage of the user */
  usage?: Maybe<Scalars['JsonObject']['output']>;
};

/** Input parameters for creating a new WhatsApp integration */
export type CBKWhatsAppIntegrationCreateRequest = {
  /** The WhatsApp Business API access token */
  accessToken?: InputMaybe<Scalars['String']['input']>;
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** Newline-or-comma-separated list of allowed senders. Use phone numbers in E.164 format (digits only). Leave empty to block all. Use * to allow everyone. */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** The Meta app secret used to validate webhook signatures */
  appSecret?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable file attachments */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The WhatsApp Business phone number ID */
  phoneNumberId?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of a newly created WhatsApp integration */
export type CBKWhatsAppIntegrationCreateResponse = {
  __typename?: 'WhatsAppIntegrationCreateResponse';
  /** The unique identifier of the created WhatsApp integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted WhatsApp integration */
export type CBKWhatsAppIntegrationDeleteResponse = {
  __typename?: 'WhatsAppIntegrationDeleteResponse';
  /** The unique identifier of the deleted WhatsApp integration */
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing WhatsApp integration */
export type CBKWhatsAppIntegrationUpdateRequest = {
  /** The WhatsApp Business API access token */
  accessToken?: InputMaybe<Scalars['String']['input']>;
  /** The alias ID for the integration */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** Newline-or-comma-separated list of allowed senders. Use phone numbers in E.164 format (digits only). Leave empty to block all. Use * to allow everyone. */
  allowFrom?: InputMaybe<Scalars['String']['input']>;
  /** The Meta app secret used to validate webhook signatures */
  appSecret?: InputMaybe<Scalars['String']['input']>;
  /** Whether to enable file attachments */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description of the integration */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name of the integration */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The WhatsApp Business phone number ID */
  phoneNumberId?: InputMaybe<Scalars['String']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

/** Response containing the ID of an updated WhatsApp integration */
export type CBKWhatsAppIntegrationUpdateResponse = {
  __typename?: 'WhatsAppIntegrationUpdateResponse';
  /** The unique identifier of the updated WhatsApp integration */
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKWhatsappIntegration = {
  __typename?: 'WhatsappIntegration';
  /** The allowed senders for the whatsapp integration */
  allowFrom?: Maybe<Scalars['String']['output']>;
  /** Whether attachments are enabled */
  attachments?: Maybe<Scalars['Boolean']['output']>;
  /** The blueprint associated with the whatsapp integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The bot associated with the whatsapp integration */
  bot?: Maybe<CBKBot>;
  /** Whether contact collection is enabled */
  contactCollection?: Maybe<Scalars['Boolean']['output']>;
  /** The date and time when the whatsapp integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the whatsapp integration */
  description?: Maybe<Scalars['String']['output']>;
  /** The unique identifier of the whatsapp integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The metadata associated with the whatsapp integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the whatsapp integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The session duration for the whatsapp integration */
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  /** The date and time when the whatsapp integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** Whether the integration holds every credential it needs to carry traffic, and how to install it if not */
  verification: CBKIntegrationVerification;
};

export type CBKWidgetIntegration = {
  __typename?: 'WidgetIntegration';
  /** The alias ID */
  alias?: Maybe<Scalars['String']['output']>;
  /** Whether attachments are enabled */
  attachments?: Maybe<Scalars['Boolean']['output']>;
  /** Whether auto-scroll is enabled */
  autoScroll?: Maybe<Scalars['Boolean']['output']>;
  /** The blueprint associated with the widget integration */
  blueprint?: Maybe<CBKBlueprint>;
  /** The ID of the blueprint to use */
  blueprintId?: Maybe<Scalars['String']['output']>;
  /** The bot associated with the widget integration */
  bot?: Maybe<CBKBot>;
  /** The ID of the bot to connect */
  botId?: Maybe<Scalars['String']['output']>;
  /** Whether the carousel is enabled */
  carousel?: Maybe<Scalars['Boolean']['output']>;
  /** Whether contact collection is enabled */
  contactCollection?: Maybe<Scalars['Boolean']['output']>;
  /** The date and time when the widget integration was created */
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  /** The description of the widget integration */
  description?: Maybe<Scalars['String']['output']>;
  /** Whether conversation export is enabled */
  exportConversation?: Maybe<Scalars['Boolean']['output']>;
  /** Whether forms are enabled */
  form?: Maybe<Scalars['Boolean']['output']>;
  /** The unique identifier of the widget integration */
  id?: Maybe<Scalars['ID']['output']>;
  /** The initial message */
  initial?: Maybe<Scalars['String']['output']>;
  /** The widget intro message */
  intro?: Maybe<Scalars['String']['output']>;
  /** The widget language */
  language?: Maybe<Scalars['String']['output']>;
  /** The widget layout */
  layout?: Maybe<Scalars['String']['output']>;
  /** Whether math rendering is enabled */
  math?: Maybe<Scalars['Boolean']['output']>;
  /** Whether the widget can be maximized */
  maximize?: Maybe<Scalars['Boolean']['output']>;
  /** Whether message peek is enabled */
  messagePeek?: Maybe<Scalars['Boolean']['output']>;
  /** The metadata associated with the widget integration */
  meta?: Maybe<Scalars['JsonObject']['output']>;
  /** The name of the widget integration */
  name?: Maybe<Scalars['String']['output']>;
  /** The allowed origin */
  origin?: Maybe<Scalars['String']['output']>;
  /** The input placeholder text */
  placeholder?: Maybe<Scalars['String']['output']>;
  /** The enabled plugins */
  plugins?: Maybe<Scalars['String']['output']>;
  /** Whether the powered-by label is shown */
  poweredBy?: Maybe<Scalars['Boolean']['output']>;
  /** Whether conversation restart is enabled */
  restartConversation?: Maybe<Scalars['Boolean']['output']>;
  /** The session duration for the widget integration */
  sessionDuration?: Maybe<Scalars['Float']['output']>;
  /** Whether to start first */
  startFirst?: Maybe<Scalars['Boolean']['output']>;
  /** Whether to stream responses */
  stream?: Maybe<Scalars['Boolean']['output']>;
  /** The widget theme */
  theme?: Maybe<Scalars['String']['output']>;
  /** The widget title */
  title?: Maybe<Scalars['String']['output']>;
  /** Whether tools are enabled */
  tools?: Maybe<Scalars['Boolean']['output']>;
  /** Whether link unfurling is enabled */
  unfurl?: Maybe<Scalars['Boolean']['output']>;
  /** The date and time when the widget integration was last updated */
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  /** Whether verbose mode is enabled */
  verbose?: Maybe<Scalars['Boolean']['output']>;
  /** Whether the integration holds every credential it needs to carry traffic, and how to install it if not */
  verification: CBKIntegrationVerification;
  /** Whether voice input is enabled */
  voiceIn?: Maybe<Scalars['Boolean']['output']>;
  /** Whether voice output is enabled */
  voiceOut?: Maybe<Scalars['Boolean']['output']>;
};

/** Input parameters for creating a new Widget integration */
export type CBKWidgetIntegrationCreateRequest = {
  /** The alias ID */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** Whether attachments are enabled */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether auto-scroll is enabled */
  autoScroll?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether the carousel is enabled */
  carousel?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Whether conversation export is enabled */
  exportConversation?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether forms are enabled */
  form?: InputMaybe<Scalars['Boolean']['input']>;
  /** The initial message */
  initial?: InputMaybe<Scalars['String']['input']>;
  /** The widget intro message */
  intro?: InputMaybe<Scalars['String']['input']>;
  /** The widget language */
  language?: InputMaybe<Scalars['String']['input']>;
  /** The widget layout */
  layout?: InputMaybe<Scalars['String']['input']>;
  /** Whether math rendering is enabled */
  math?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether the widget can be maximized */
  maximize?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether message peek is enabled */
  messagePeek?: InputMaybe<Scalars['Boolean']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The allowed origin */
  origin?: InputMaybe<Scalars['String']['input']>;
  /** The input placeholder text */
  placeholder?: InputMaybe<Scalars['String']['input']>;
  /** The enabled plugins */
  plugins?: InputMaybe<Scalars['String']['input']>;
  /** Whether the powered-by label is shown */
  poweredBy?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether conversation restart is enabled */
  restartConversation?: InputMaybe<Scalars['Boolean']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  /** Whether to start first */
  startFirst?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether to stream responses */
  stream?: InputMaybe<Scalars['Boolean']['input']>;
  /** The widget theme */
  theme?: InputMaybe<Scalars['String']['input']>;
  /** The widget title */
  title?: InputMaybe<Scalars['String']['input']>;
  /** Whether tools are enabled */
  tools?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether link unfurling is enabled */
  unfurl?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether verbose mode is enabled */
  verbose?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether voice input is enabled */
  voiceIn?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether voice output is enabled */
  voiceOut?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Response containing the ID of a newly created Widget integration */
export type CBKWidgetIntegrationCreateResponse = {
  __typename?: 'WidgetIntegrationCreateResponse';
  id?: Maybe<Scalars['ID']['output']>;
};

/** Response containing the ID of a deleted Widget integration */
export type CBKWidgetIntegrationDeleteResponse = {
  __typename?: 'WidgetIntegrationDeleteResponse';
  id?: Maybe<Scalars['ID']['output']>;
};

/** Input parameters for updating an existing Widget integration */
export type CBKWidgetIntegrationUpdateRequest = {
  /** The alias ID */
  alias?: InputMaybe<Scalars['ID']['input']>;
  /** Whether attachments are enabled */
  attachments?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether auto-scroll is enabled */
  autoScroll?: InputMaybe<Scalars['Boolean']['input']>;
  /** The ID of the blueprint to use */
  blueprintId?: InputMaybe<Scalars['ID']['input']>;
  /** The ID of the bot to connect */
  botId?: InputMaybe<Scalars['ID']['input']>;
  /** Whether the carousel is enabled */
  carousel?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether to collect contact information */
  contactCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** The description */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Whether conversation export is enabled */
  exportConversation?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether forms are enabled */
  form?: InputMaybe<Scalars['Boolean']['input']>;
  /** The initial message */
  initial?: InputMaybe<Scalars['String']['input']>;
  /** The widget intro message */
  intro?: InputMaybe<Scalars['String']['input']>;
  /** The widget language */
  language?: InputMaybe<Scalars['String']['input']>;
  /** The widget layout */
  layout?: InputMaybe<Scalars['String']['input']>;
  /** Whether math rendering is enabled */
  math?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether the widget can be maximized */
  maximize?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether message peek is enabled */
  messagePeek?: InputMaybe<Scalars['Boolean']['input']>;
  /** Additional metadata for the integration */
  meta?: InputMaybe<Scalars['JsonObject']['input']>;
  /** The name */
  name?: InputMaybe<Scalars['String']['input']>;
  /** The allowed origin */
  origin?: InputMaybe<Scalars['String']['input']>;
  /** The input placeholder text */
  placeholder?: InputMaybe<Scalars['String']['input']>;
  /** The enabled plugins */
  plugins?: InputMaybe<Scalars['String']['input']>;
  /** Whether the powered-by label is shown */
  poweredBy?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether conversation restart is enabled */
  restartConversation?: InputMaybe<Scalars['Boolean']['input']>;
  /** The duration of the session in milliseconds */
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  /** Whether to start first */
  startFirst?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether to stream responses */
  stream?: InputMaybe<Scalars['Boolean']['input']>;
  /** The widget theme */
  theme?: InputMaybe<Scalars['String']['input']>;
  /** The widget title */
  title?: InputMaybe<Scalars['String']['input']>;
  /** Whether tools are enabled */
  tools?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether link unfurling is enabled */
  unfurl?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether verbose mode is enabled */
  verbose?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether voice input is enabled */
  voiceIn?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether voice output is enabled */
  voiceOut?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Response containing the ID of a updated Widget integration */
export type CBKWidgetIntegrationUpdateResponse = {
  __typename?: 'WidgetIntegrationUpdateResponse';
  id?: Maybe<Scalars['ID']['output']>;
};

export type CBKAvailableSecretsQueryVariables = Exact<{
  botIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
  contactIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
}>;


export type CBKAvailableSecretsQuery = { __typename?: 'Query', relatedSecrets?: { __typename?: 'QueryRelatedSecretsConnection', edges?: Array<{ __typename?: 'QueryRelatedSecretsConnectionEdge', node?: { __typename?: 'ContextSecret', id?: string | null, name?: string | null, description?: string | null, contacts?: Array<{ __typename?: 'SecretContact', verification: { __typename?: 'SecretContactVerification', status: CBKSecretContactVerificationStatus, action?: { __typename?: 'SecretContactVerificationAction', type: CBKSecretContactVerificationActionType, url?: string | null } | null } }> | null } | null } | null> | null } | null };

export type CBKAvailableSharedSecretsQueryVariables = Exact<{ [key: string]: never; }>;


export type CBKAvailableSharedSecretsQuery = { __typename?: 'Query', secrets?: { __typename?: 'QuerySecretsConnection', edges?: Array<{ __typename?: 'QuerySecretsConnectionEdge', node?: { __typename?: 'Secret', id?: string | null, name?: string | null, description?: string | null, verification: { __typename?: 'SecretVerification', status: CBKSecretVerificationStatus, action?: { __typename?: 'SecretVerificationAction', type: CBKSecretVerificationActionType, url?: string | null } | null } } | null } | null> | null } | null };

export type CBKAvailableSourcesQueryVariables = Exact<{ [key: string]: never; }>;


export type CBKAvailableSourcesQuery = { __typename?: 'Query', datasets?: { __typename?: 'QueryDatasetsConnection', edges?: Array<{ __typename?: 'QueryDatasetsConnectionEdge', node?: { __typename?: 'Dataset', id?: string | null, name?: string | null, description?: string | null, blueprint?: { __typename?: 'Blueprint', id?: string | null } | null } | null } | null> | null } | null, skillsets?: { __typename?: 'QuerySkillsetsConnection', edges?: Array<{ __typename?: 'QuerySkillsetsConnectionEdge', node?: { __typename?: 'Skillset', id?: string | null, name?: string | null, description?: string | null, blueprint?: { __typename?: 'Blueprint', id?: string | null } | null, abilities?: { __typename?: 'SkillsetAbilitiesConnection', edges?: Array<{ __typename?: 'SkillsetAbilitiesConnectionEdge', node?: { __typename?: 'Ability', id?: string | null, name?: string | null, description?: string | null, instruction?: string | null, linkedSecret?: { __typename?: 'Secret', id?: string | null } | null } | null } | null> | null } | null } | null } | null> | null } | null, spaces?: { __typename?: 'QuerySpacesConnection', edges?: Array<{ __typename?: 'QuerySpacesConnectionEdge', node?: { __typename?: 'Space', id?: string | null, name?: string | null, description?: string | null, blueprint?: { __typename?: 'Blueprint', id?: string | null } | null } | null } | null> | null } | null };

export type CBKBlueprintAgentResourcesQueryVariables = Exact<{
  blueprintId: Scalars['ID']['input'];
}>;


export type CBKBlueprintAgentResourcesQuery = { __typename?: 'Query', blueprints?: { __typename?: 'QueryBlueprintsConnection', edges?: Array<{ __typename?: 'QueryBlueprintsConnectionEdge', node?: { __typename?: 'Blueprint', id?: string | null, name?: string | null, description?: string | null, bots?: { __typename?: 'BlueprintBotsConnection', edges?: Array<{ __typename?: 'BlueprintBotsConnectionEdge', node?: { __typename?: 'Bot', id?: string | null, name?: string | null, backstory?: string | null, model?: string | null, skillset?: { __typename?: 'Skillset', id?: string | null, name?: string | null } | null, dataset?: { __typename?: 'Dataset', id?: string | null, name?: string | null } | null } | null } | null> | null } | null, skillsets?: { __typename?: 'BlueprintSkillsetsConnection', edges?: Array<{ __typename?: 'BlueprintSkillsetsConnectionEdge', node?: { __typename?: 'Skillset', id?: string | null, name?: string | null, abilities?: { __typename?: 'SkillsetAbilitiesConnection', edges?: Array<{ __typename?: 'SkillsetAbilitiesConnectionEdge', node?: { __typename?: 'Ability', id?: string | null, name?: string | null, description?: string | null, instruction?: string | null } | null } | null> | null } | null } | null } | null> | null } | null, datasets?: { __typename?: 'BlueprintDatasetsConnection', edges?: Array<{ __typename?: 'BlueprintDatasetsConnectionEdge', node?: { __typename?: 'Dataset', id?: string | null, name?: string | null } | null } | null> | null } | null } | null } | null> | null } | null };

export type CBKConfiguredBotsQueryVariables = Exact<{
  botIds?: InputMaybe<Array<Scalars['ID']['input']> | Scalars['ID']['input']>;
  blueprintIds?: InputMaybe<Array<Scalars['ID']['input']> | Scalars['ID']['input']>;
  includeRelatedBots?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type CBKConfiguredBotsQuery = { __typename?: 'Query', bots?: { __typename?: 'QueryBotsConnection', edges?: Array<{ __typename?: 'QueryBotsConnectionEdge', node?: { __typename?: 'Bot', id?: string | null, name?: string | null, description?: string | null, blueprint?: { __typename?: 'Blueprint', id?: string | null } | null } | null } | null> | null } | null, relatedBots?: { __typename?: 'QueryRelatedBotsConnection', edges?: Array<{ __typename?: 'QueryRelatedBotsConnectionEdge', node?: { __typename?: 'ContextBot', id?: string | null, name?: string | null, description?: string | null } | null } | null> | null } | null };

export type CBKListContactConversationsQueryVariables = Exact<{
  contactIds?: InputMaybe<Array<Scalars['ID']['input']> | Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
}>;


export type CBKListContactConversationsQuery = { __typename?: 'Query', conversations?: { __typename?: 'QueryConversationsConnection', edges?: Array<{ __typename?: 'QueryConversationsConnectionEdge', cursor: string, node?: { __typename?: 'Conversation', id?: string | null, name?: string | null, description?: string | null, meta?: any | null, createdAt?: any | null, updatedAt?: any | null, task?: { __typename?: 'Task', id?: string | null, status?: CBKTaskStatus | null, outcome?: CBKTaskOutcome | null } | null } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null };

export type CBKListContactTasksQueryVariables = Exact<{
  contactIds?: InputMaybe<Array<Scalars['ID']['input']> | Scalars['ID']['input']>;
  taskIds?: InputMaybe<Array<Scalars['ID']['input']> | Scalars['ID']['input']>;
}>;


export type CBKListContactTasksQuery = { __typename?: 'Query', tasks?: { __typename?: 'QueryTasksConnection', edges?: Array<{ __typename?: 'QueryTasksConnectionEdge', cursor: string, node?: { __typename?: 'Task', id?: string | null, name?: string | null, description?: string | null, status?: CBKTaskStatus | null, outcome?: CBKTaskOutcome | null, createdAt?: any | null, updatedAt?: any | null, conversations?: { __typename?: 'TaskConversationsConnection', edges?: Array<{ __typename?: 'TaskConversationsConnectionEdge', node?: { __typename?: 'Conversation', id?: string | null, name?: string | null, description?: string | null, meta?: any | null, createdAt?: any | null, updatedAt?: any | null } | null } | null> | null } | null } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } | null };

export type CBKPortalUrlQueryVariables = Exact<{
  portalIds?: InputMaybe<Array<Scalars['ID']['input']> | Scalars['ID']['input']>;
}>;


export type CBKPortalUrlQuery = { __typename?: 'Query', portals?: { __typename?: 'QueryPortalsConnection', edges?: Array<{ __typename?: 'QueryPortalsConnectionEdge', node?: { __typename?: 'Portal', id?: string | null, url?: string | null } | null } | null> | null } | null };

export type CBKTemplateBlueprintsQueryVariables = Exact<{ [key: string]: never; }>;


export type CBKTemplateBlueprintsQuery = { __typename?: 'Query', relatedBlueprints?: { __typename?: 'QueryRelatedBlueprintsConnection', edges?: Array<{ __typename?: 'QueryRelatedBlueprintsConnectionEdge', node?: { __typename?: 'ContextBlueprint', id?: string | null, name?: string | null, description?: string | null } | null } | null> | null } | null };

export type CBKTemplateSecretsQueryVariables = Exact<{ [key: string]: never; }>;


export type CBKTemplateSecretsQuery = { __typename?: 'Query', relatedSecrets?: { __typename?: 'QueryRelatedSecretsConnection', edges?: Array<{ __typename?: 'QueryRelatedSecretsConnectionEdge', node?: { __typename?: 'ContextSecret', id?: string | null, name?: string | null, description?: string | null } | null } | null> | null } | null };

export type CBKPlatformTemplatesQueryVariables = Exact<{
  platformAbilityIds?: InputMaybe<Array<Scalars['ID']['input']> | Scalars['ID']['input']>;
  platformSecretIds?: InputMaybe<Array<Scalars['ID']['input']> | Scalars['ID']['input']>;
}>;


export type CBKPlatformTemplatesQuery = { __typename?: 'Query', platformAbilities?: { __typename?: 'QueryPlatformAbilitiesConnection', edges?: Array<{ __typename?: 'QueryPlatformAbilitiesConnectionEdge', node?: { __typename?: 'PlatformAbility', id?: string | null, template?: string | null, name?: string | null, description?: string | null, instruction?: string | null, schema?: any | null, bot?: string | null, file?: string | null, secret?: string | null, space?: string | null, provider?: string | null, icon?: string | null, tags?: Array<string> | null, setup?: string | null, commentary?: string | null, createdAt?: any | null, updatedAt?: any | null } | null } | null> | null } | null, platformSecrets?: { __typename?: 'QueryPlatformSecretsConnection', edges?: Array<{ __typename?: 'QueryPlatformSecretsConnectionEdge', node?: { __typename?: 'PlatformSecret', id?: string | null, template?: string | null, name?: string | null, description?: string | null, type?: string | null, kind?: string | null, config?: any | null, icon?: string | null, tags?: Array<string> | null, setup?: string | null, commentary?: string | null, createdAt?: any | null, updatedAt?: any | null } | null } | null> | null } | null };


export const AvailableSecretsDocument = gql`
    query availableSecrets($botIds: [ID!]!, $contactIds: [ID!]!) {
  relatedSecrets(
    last: 100
    botIds: $botIds
    kind: [personal]
    visibility: [protected]
    includeOwn: {kind: [personal], visibility: [public, private, protected]}
  ) {
    edges {
      node {
        id
        name
        description
        contacts(contactIds: $contactIds) {
          verification {
            status
            action {
              type
              url
            }
          }
        }
      }
    }
  }
}
    `;
export const AvailableSharedSecretsDocument = gql`
    query availableSharedSecrets {
  secrets(last: 100, kind: [shared]) {
    edges {
      node {
        id
        name
        description
        verification {
          status
          action {
            type
            url
          }
        }
      }
    }
  }
}
    `;
export const AvailableSourcesDocument = gql`
    query availableSources {
  datasets {
    edges {
      node {
        id
        name
        description
        blueprint {
          id
        }
      }
    }
  }
  skillsets {
    edges {
      node {
        id
        name
        description
        blueprint {
          id
        }
        abilities {
          edges {
            node {
              id
              name
              description
              instruction
              linkedSecret {
                id
              }
            }
          }
        }
      }
    }
  }
  spaces {
    edges {
      node {
        id
        name
        description
        blueprint {
          id
        }
      }
    }
  }
}
    `;
export const BlueprintAgentResourcesDocument = gql`
    query blueprintAgentResources($blueprintId: ID!) {
  blueprints(blueprintIds: [$blueprintId], last: 1) {
    edges {
      node {
        id
        name
        description
        bots(last: 1) {
          edges {
            node {
              id
              name
              backstory
              model
              skillset {
                id
                name
              }
              dataset {
                id
                name
              }
            }
          }
        }
        skillsets(last: 1) {
          edges {
            node {
              id
              name
              abilities(last: 100) {
                edges {
                  node {
                    id
                    name
                    description
                    instruction
                  }
                }
              }
            }
          }
        }
        datasets(last: 1) {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  }
}
    `;
export const ConfiguredBotsDocument = gql`
    query configuredBots($botIds: [ID!], $blueprintIds: [ID!], $includeRelatedBots: Boolean = false) {
  bots(last: 100, botIds: $botIds, blueprintIds: $blueprintIds) {
    edges {
      node {
        id
        name
        description
        blueprint {
          id
        }
      }
    }
  }
  relatedBots(last: 100, botIds: $botIds, visibility: [protected]) @include(if: $includeRelatedBots) {
    edges {
      node {
        id
        name
        description
      }
    }
  }
}
    `;
export const ListContactConversationsDocument = gql`
    query listContactConversations($contactIds: [ID!], $first: Int, $last: Int, $after: ID, $before: ID) {
  conversations(
    contactIds: $contactIds
    first: $first
    last: $last
    after: $after
    before: $before
  ) {
    edges {
      cursor
      node {
        id
        name
        description
        meta
        createdAt
        updatedAt
        task {
          id
          status
          outcome
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
    `;
export const ListContactTasksDocument = gql`
    query listContactTasks($contactIds: [ID!], $taskIds: [ID!]) {
  tasks(contactIds: $contactIds, taskIds: $taskIds, last: 100) {
    edges {
      cursor
      node {
        id
        name
        description
        status
        outcome
        createdAt
        updatedAt
        conversations {
          edges {
            node {
              id
              name
              description
              meta
              createdAt
              updatedAt
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
    `;
export const PortalUrlDocument = gql`
    query portalUrl($portalIds: [ID!]) {
  portals(first: 1, portalIds: $portalIds) {
    edges {
      node {
        id
        url
      }
    }
  }
}
    `;
export const TemplateBlueprintsDocument = gql`
    query templateBlueprints {
  relatedBlueprints(last: 100, visibility: [protected]) {
    edges {
      node {
        id
        name
        description
      }
    }
  }
}
    `;
export const TemplateSecretsDocument = gql`
    query templateSecrets {
  relatedSecrets(last: 100, visibility: [protected]) {
    edges {
      node {
        id
        name
        description
      }
    }
  }
}
    `;
export const PlatformTemplatesDocument = gql`
    query platformTemplates($platformAbilityIds: [ID!], $platformSecretIds: [ID!]) {
  platformAbilities(first: 10000, platformAbilityIds: $platformAbilityIds) {
    edges {
      node {
        id
        template
        name
        description
        instruction
        schema
        bot
        file
        secret
        space
        provider
        icon
        tags
        setup
        commentary
        createdAt
        updatedAt
      }
    }
  }
  platformSecrets(first: 10000, platformSecretIds: $platformSecretIds) {
    edges {
      node {
        id
        template
        name
        description
        type
        kind
        config
        icon
        tags
        setup
        commentary
        createdAt
        updatedAt
      }
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    availableSecrets(variables: CBKAvailableSecretsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CBKAvailableSecretsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<CBKAvailableSecretsQuery>({ document: AvailableSecretsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'availableSecrets', 'query', variables);
    },
    availableSharedSecrets(variables?: CBKAvailableSharedSecretsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CBKAvailableSharedSecretsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<CBKAvailableSharedSecretsQuery>({ document: AvailableSharedSecretsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'availableSharedSecrets', 'query', variables);
    },
    availableSources(variables?: CBKAvailableSourcesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CBKAvailableSourcesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<CBKAvailableSourcesQuery>({ document: AvailableSourcesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'availableSources', 'query', variables);
    },
    blueprintAgentResources(variables: CBKBlueprintAgentResourcesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CBKBlueprintAgentResourcesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<CBKBlueprintAgentResourcesQuery>({ document: BlueprintAgentResourcesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'blueprintAgentResources', 'query', variables);
    },
    configuredBots(variables?: CBKConfiguredBotsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CBKConfiguredBotsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<CBKConfiguredBotsQuery>({ document: ConfiguredBotsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'configuredBots', 'query', variables);
    },
    listContactConversations(variables?: CBKListContactConversationsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CBKListContactConversationsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<CBKListContactConversationsQuery>({ document: ListContactConversationsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'listContactConversations', 'query', variables);
    },
    listContactTasks(variables?: CBKListContactTasksQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CBKListContactTasksQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<CBKListContactTasksQuery>({ document: ListContactTasksDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'listContactTasks', 'query', variables);
    },
    portalUrl(variables?: CBKPortalUrlQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CBKPortalUrlQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<CBKPortalUrlQuery>({ document: PortalUrlDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'portalUrl', 'query', variables);
    },
    templateBlueprints(variables?: CBKTemplateBlueprintsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CBKTemplateBlueprintsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<CBKTemplateBlueprintsQuery>({ document: TemplateBlueprintsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'templateBlueprints', 'query', variables);
    },
    templateSecrets(variables?: CBKTemplateSecretsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CBKTemplateSecretsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<CBKTemplateSecretsQuery>({ document: TemplateSecretsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'templateSecrets', 'query', variables);
    },
    platformTemplates(variables?: CBKPlatformTemplatesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CBKPlatformTemplatesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<CBKPlatformTemplatesQuery>({ document: PlatformTemplatesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'platformTemplates', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;