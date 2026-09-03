export interface EventConfigEntry {
  type: string
  name: string
  description: string
  trigger: boolean
}

const events = [
  {
    type: 'conversation.idle',
    name: 'Conversation Idle',
    description:
      'Triggered when the conversation enters idle state after inactivity.',
    trigger: true,
  },
  {
    type: 'bot.create',
    name: 'Bot Create',
    description: 'A new bot was created in the system',
    trigger: false,
  },
  {
    type: 'bot.update',
    name: 'Bot Update',
    description: 'Bot configuration or settings were modified',
    trigger: false,
  },
  {
    type: 'bot.delete',
    name: 'Bot Delete',
    description: 'A bot was permanently removed from the system',
    trigger: false,
  },
  {
    type: 'conversation.create',
    name: 'Conversation Create',
    description: 'A new conversation session was initiated',
    trigger: false,
  },
  {
    type: 'conversation.update',
    name: 'Conversation Update',
    description: 'Conversation metadata or state was updated',
    trigger: false,
  },
  {
    type: 'conversation.delete',
    name: 'Conversation Delete',
    description: 'A conversation was removed from the system',
    trigger: false,
  },
  {
    type: 'message.create',
    name: 'Message Create',
    description: 'A new message was sent in a conversation',
    trigger: false,
  },
  {
    type: 'message.update',
    name: 'Message Update',
    description: 'Message content or metadata was modified',
    trigger: false,
  },
  {
    type: 'message.delete',
    name: 'Message Delete',
    description: 'A message was removed from the conversation',
    trigger: false,
  },
  {
    type: 'user.login',
    name: 'User Login',
    description: 'User successfully authenticated and logged in',
    trigger: false,
  },
  {
    type: 'user.logout',
    name: 'User Logout',
    description: 'User session was terminated',
    trigger: false,
  },
  {
    type: 'user.create',
    name: 'User Create',
    description: 'A new user account was created',
    trigger: false,
  },
  {
    type: 'user.update',
    name: 'User Update',
    description: 'User profile or account settings were updated',
    trigger: false,
  },
  {
    type: 'user.delete',
    name: 'User Delete',
    description: 'A user account was permanently removed',
    trigger: false,
  },
  {
    type: 'file.upload',
    name: 'File Upload',
    description: 'A file was uploaded to the system',
    trigger: false,
  },
  {
    type: 'file.download',
    name: 'File Download',
    description: 'A file was downloaded from the system',
    trigger: false,
  },
  {
    type: 'file.delete',
    name: 'File Delete',
    description: 'A file was removed from storage',
    trigger: false,
  },
  {
    type: 'integration.connect',
    name: 'Integration Connect',
    description: 'External service integration was established',
    trigger: false,
  },
  {
    type: 'integration.disconnect',
    name: 'Integration Disconnect',
    description: 'External service integration was removed',
    trigger: false,
  },
  {
    type: 'integration.sync',
    name: 'Integration Sync',
    description: 'Data synchronization with external service occurred',
    trigger: false,
  },
  {
    type: 'webhook.trigger',
    name: 'Webhook Trigger',
    description: 'A webhook endpoint was called',
    trigger: false,
  },
  {
    type: 'webhook.create',
    name: 'Webhook Create',
    description: 'A new webhook was configured',
    trigger: false,
  },
  {
    type: 'webhook.delete',
    name: 'Webhook Delete',
    description: 'A webhook configuration was removed',
    trigger: false,
  },
  {
    type: 'api.request',
    name: 'API Request',
    description: 'API endpoint was accessed',
    trigger: false,
  },
  {
    type: 'api.error',
    name: 'API Error',
    description: 'API request resulted in an error',
    trigger: false,
  },
  {
    type: 'system.maintenance',
    name: 'System Maintenance',
    description: 'System maintenance activity was performed',
    trigger: false,
  },
  {
    type: 'system.backup',
    name: 'System Backup',
    description: 'System backup operation was executed',
    trigger: false,
  },
  {
    type: 'system.error',
    name: 'System Error',
    description: 'System error or exception occurred',
    trigger: false,
  },
  {
    type: 'dataset.search',
    name: 'Dataset Search',
    description: 'A dataset search operation was performed',
    trigger: false,
  },
  {
    type: 'dataset.import.job.start',
    name: 'Dataset Import Job Start',
    description: 'A dataset import job has started',
    trigger: false,
  },
  {
    type: 'dataset.import.job.finish',
    name: 'Dataset Import Job Finish',
    description: 'A dataset import job has completed',
    trigger: false,
  },
  {
    type: 'action.search',
    name: 'Action Search',
    description:
      'Triggered when a search action is executed to retrieve information from datasets or external sources.',
    trigger: false,
  },
  {
    type: 'action.fetch',
    name: 'Action Fetch',
    description:
      'Triggered when a fetch action is executed to retrieve data from external APIs or web resources.',
    trigger: false,
  },
  {
    type: 'action.email',
    name: 'Action Email',
    description:
      'Triggered when an email action is executed to send email messages through the system.',
    trigger: false,
  },
  {
    type: 'action.echo',
    name: 'Action Echo',
    description:
      'Triggered when an echo action is executed to return input as output for testing or debugging.',
    trigger: false,
  },
  {
    type: 'action.abort',
    name: 'Action Abort',
    description:
      'Triggered when an abort action is executed to stop or cancel ongoing operations.',
    trigger: false,
  },
  {
    type: 'action.view',
    name: 'Action View',
    description:
      'Triggered when a view action is executed to render or display content to users.',
    trigger: false,
  },
  {
    type: 'action.listen',
    name: 'Action Listen',
    description:
      'Triggered when a listen action is executed to process audio input or speech recognition.',
    trigger: false,
  },
  {
    type: 'action.bot',
    name: 'Action Bot',
    description:
      'Triggered when a bot action is executed to interact with or control chatbot operations.',
    trigger: false,
  },
  {
    type: 'action.dataset',
    name: 'Action Dataset',
    description:
      'Triggered when a dataset action is executed to manipulate or query dataset information.',
    trigger: false,
  },
  {
    type: 'action.file',
    name: 'Action File',
    description:
      'Triggered when a file action is executed to process, upload, or manage file operations.',
    trigger: false,
  },
  {
    type: 'action.attachment',
    name: 'Action Attachment',
    description:
      'Triggered when an attachment action is executed to handle file attachments in conversations.',
    trigger: false,
  },
  {
    type: 'action.text',
    name: 'Action Text',
    description:
      'Triggered when a text action is executed to process or transform text content.',
    trigger: false,
  },
  {
    type: 'action.image',
    name: 'Action Image',
    description:
      'Triggered when an image action is executed to generate, edit, or process images.',
    trigger: false,
  },
  {
    type: 'action.form',
    name: 'Action Form',
    description:
      'Triggered when a form action is executed to process form submissions or collect user input.',
    trigger: false,
  },
  {
    type: 'action.shell',
    name: 'Action Shell',
    description:
      'Triggered when a shell action is executed to run system commands or scripts.',
    trigger: false,
  },
  {
    type: 'action.browser',
    name: 'Action Browser',
    description:
      'Triggered when a browser action is executed to interact with web pages or perform web automation.',
    trigger: false,
  },
  {
    type: 'action.conversation',
    name: 'Action Conversation',
    description:
      'Triggered when a conversation action is executed to manage or manipulate conversation state.',
    trigger: false,
  },
  {
    type: 'action.task',
    name: 'Action Task',
    description:
      'Triggered when a task action is executed to perform background operations or scheduled tasks.',
    trigger: false,
  },
  {
    type: 'action.pack',
    name: 'Action Pack',
    description:
      'Triggered when a pack action is executed to run a collection of abilities or actions together.',
    trigger: false,
  },
  {
    type: 'action.agent',
    name: 'Action Agent',
    description:
      'Triggered when an agent action is executed to perform autonomous agent operations or workflows.',
    trigger: false,
  },
  {
    type: 'action.agent.spawn',
    name: 'Action Agent Spawn',
    description:
      'Triggered when an agent spawn action is executed to start a sub-agent workflow.',
    trigger: false,
  },
  {
    type: 'action.attachment.read',
    name: 'Action Attachment Read',
    description: 'Triggered when an attachment read action is executed.',
    trigger: false,
  },
  {
    type: 'action.blueprint.bulletin.create',
    name: 'Action Blueprint Bulletin Create',
    description:
      'Triggered when a blueprint bulletin create action is executed.',
    trigger: false,
  },
  {
    type: 'action.blueprint.bulletin.list',
    name: 'Action Blueprint Bulletin List',
    description: 'Triggered when a blueprint bulletin list action is executed.',
    trigger: false,
  },
  {
    type: 'action.blueprint.note.list',
    name: 'Action Blueprint Note List',
    description: 'Triggered when a blueprint note list action is executed.',
    trigger: false,
  },
  {
    type: 'action.blueprint.resource.list',
    name: 'Action Blueprint Resource List',
    description: 'Triggered when a blueprint resource list action is executed.',
    trigger: false,
  },
  {
    type: 'action.bot.ask',
    name: 'Action Bot Ask',
    description: 'Triggered when a bot ask action is executed.',
    trigger: false,
  },
  {
    type: 'action.bot.call',
    name: 'Action Bot Call',
    description: 'Triggered when a bot call action is executed.',
    trigger: false,
  },
  {
    type: 'action.bot.apply',
    name: 'Action Bot Apply',
    description: 'Triggered when a bot apply action is executed.',
    trigger: false,
  },
  {
    type: 'action.browser.dispatch',
    name: 'Action Browser Dispatch',
    description: 'Triggered when a browser dispatch action is executed.',
    trigger: false,
  },
  {
    type: 'action.conversation.fetch',
    name: 'Action Conversation Fetch',
    description: 'Triggered when a conversation fetch action is executed.',
    trigger: false,
  },
  {
    type: 'action.conversation.list',
    name: 'Action Conversation List',
    description: 'Triggered when a conversation list action is executed.',
    trigger: false,
  },
  {
    type: 'action.conversation.search',
    name: 'Action Conversation Search',
    description: 'Triggered when a conversation search action is executed.',
    trigger: false,
  },
  {
    type: 'action.dataset.create',
    name: 'Action Dataset Create',
    description: 'Triggered when a dataset create action is executed.',
    trigger: false,
  },
  {
    type: 'action.dataset.list',
    name: 'Action Dataset List',
    description: 'Triggered when a dataset list action is executed.',
    trigger: false,
  },
  {
    type: 'action.dataset.record.create',
    name: 'Action Dataset Record Create',
    description: 'Triggered when a dataset record create action is executed.',
    trigger: false,
  },
  {
    type: 'action.dataset.record.delete',
    name: 'Action Dataset Record Delete',
    description: 'Triggered when a dataset record delete action is executed.',
    trigger: false,
  },
  {
    type: 'action.dataset.search',
    name: 'Action Dataset Search',
    description: 'Triggered when a dataset search action is executed.',
    trigger: false,
  },
  {
    type: 'action.email.send',
    name: 'Action Email Send',
    description: 'Triggered when an email send action is executed.',
    trigger: false,
  },
  {
    type: 'action.file.append',
    name: 'Action File Append',
    description: 'Triggered when a file append action is executed.',
    trigger: false,
  },
  {
    type: 'action.file.prepend',
    name: 'Action File Prepend',
    description: 'Triggered when a file prepend action is executed.',
    trigger: false,
  },
  {
    type: 'action.file.read',
    name: 'Action File Read',
    description: 'Triggered when a file read action is executed.',
    trigger: false,
  },
  {
    type: 'action.file.replace',
    name: 'Action File Replace',
    description: 'Triggered when a file replace action is executed.',
    trigger: false,
  },
  {
    type: 'action.file.rw',
    name: 'Action File Rw',
    description: 'Triggered when a file read-write action is executed.',
    trigger: false,
  },
  {
    type: 'action.file.write',
    name: 'Action File Write',
    description: 'Triggered when a file write action is executed.',
    trigger: false,
  },
  {
    type: 'action.image.create',
    name: 'Action Image Create',
    description: 'Triggered when an image create action is executed.',
    trigger: false,
  },
  {
    type: 'action.image.edit',
    name: 'Action Image Edit',
    description: 'Triggered when an image edit action is executed.',
    trigger: false,
  },
  {
    type: 'action.list.push',
    name: 'Action List Push',
    description: 'Triggered when a list push action is executed.',
    trigger: false,
  },
  {
    type: 'action.list.pop',
    name: 'Action List Pop',
    description: 'Triggered when a list pop action is executed.',
    trigger: false,
  },
  {
    type: 'action.list.read',
    name: 'Action List Read',
    description: 'Triggered when a list read action is executed.',
    trigger: false,
  },
  {
    type: 'action.mcp.install',
    name: 'Action Mcp Install',
    description: 'Triggered when an MCP install action is executed.',
    trigger: false,
  },
  {
    type: 'action.memory.create',
    name: 'Action Memory Create',
    description: 'Triggered when a memory create action is executed.',
    trigger: false,
  },
  {
    type: 'action.memory.delete',
    name: 'Action Memory Delete',
    description: 'Triggered when a memory delete action is executed.',
    trigger: false,
  },
  {
    type: 'action.memory.list',
    name: 'Action Memory List',
    description: 'Triggered when a memory list action is executed.',
    trigger: false,
  },
  {
    type: 'action.memory.search',
    name: 'Action Memory Search',
    description: 'Triggered when a memory search action is executed.',
    trigger: false,
  },
  {
    type: 'action.memory.update',
    name: 'Action Memory Update',
    description: 'Triggered when a memory update action is executed.',
    trigger: false,
  },
  {
    type: 'action.pack.install',
    name: 'Action Pack Install',
    description: 'Triggered when a pack install action is executed.',
    trigger: false,
  },
  {
    type: 'action.search.dataset',
    name: 'Action Search Dataset',
    description: 'Triggered when a dataset-backed search action is executed.',
    trigger: false,
  },
  {
    type: 'action.search.web',
    name: 'Action Search Web',
    description: 'Triggered when a web search action is executed.',
    trigger: false,
  },
  {
    type: 'action.shell.eval',
    name: 'Action Shell Eval',
    description: 'Triggered when a shell eval action is executed.',
    trigger: false,
  },
  {
    type: 'action.shell.exec',
    name: 'Action Shell Exec',
    description: 'Triggered when a shell exec action is executed.',
    trigger: false,
  },
  {
    type: 'action.shell.import',
    name: 'Action Shell Import',
    description: 'Triggered when a shell import action is executed.',
    trigger: false,
  },
  {
    type: 'action.shell.read',
    name: 'Action Shell Read',
    description: 'Triggered when a shell read action is executed.',
    trigger: false,
  },
  {
    type: 'action.shell.rw',
    name: 'Action Shell Rw',
    description: 'Triggered when a shell read-write action is executed.',
    trigger: false,
  },
  {
    type: 'action.shell.skillset-install',
    name: 'Action Shell Skillset Install',
    description: 'Triggered when a shell skillset-install action is executed.',
    trigger: false,
  },
  {
    type: 'action.shell.write',
    name: 'Action Shell Write',
    description: 'Triggered when a shell write action is executed.',
    trigger: false,
  },
  {
    type: 'action.shell.replace',
    name: 'Action Shell Replace',
    description: 'Triggered when a shell find-and-replace action is executed.',
    trigger: false,
  },
  {
    type: 'action.skillset.install',
    name: 'Action Skillset Install',
    description: 'Triggered when a skillset install action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.create',
    name: 'Action Space Create',
    description: 'Triggered when a space create action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.delete',
    name: 'Action Space Delete',
    description: 'Triggered when a space delete action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.fetch',
    name: 'Action Space Fetch',
    description: 'Triggered when a space fetch action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.list',
    name: 'Action Space List',
    description: 'Triggered when a space list action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.storage.copy',
    name: 'Action Space Storage Copy',
    description: 'Triggered when a space storage copy action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.storage.delete',
    name: 'Action Space Storage Delete',
    description: 'Triggered when a space storage delete action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.storage.import',
    name: 'Action Space Storage Import',
    description: 'Triggered when a space storage import action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.storage.link',
    name: 'Action Space Storage Link',
    description: 'Triggered when a space storage link action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.storage.list',
    name: 'Action Space Storage List',
    description: 'Triggered when a space storage list action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.storage.move',
    name: 'Action Space Storage Move',
    description: 'Triggered when a space storage move action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.storage.read',
    name: 'Action Space Storage Read',
    description: 'Triggered when a space storage read action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.storage.rw',
    name: 'Action Space Storage Rw',
    description:
      'Triggered when a space storage read-write action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.storage.search',
    name: 'Action Space Storage Search',
    description: 'Triggered when a space storage search action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.storage.write',
    name: 'Action Space Storage Write',
    description: 'Triggered when a space storage write action is executed.',
    trigger: false,
  },
  {
    type: 'action.space.update',
    name: 'Action Space Update',
    description: 'Triggered when a space update action is executed.',
    trigger: false,
  },
  {
    type: 'action.task.execute.failure',
    name: 'Action Task Execute Failure',
    description: 'Triggered when a task execute action fails.',
    trigger: false,
  },
  {
    type: 'action.todo.read',
    name: 'Action Todo Read',
    description: 'Triggered when a todo read action is executed.',
    trigger: false,
  },
  {
    type: 'action.todo.write',
    name: 'Action Todo Write',
    description: 'Triggered when a todo write action is executed.',
    trigger: false,
  },
  {
    type: 'action.blueprint.meta.fetch',
    name: 'Action Blueprint Meta Fetch',
    description: 'Triggered when a blueprint meta fetch action is executed.',
    trigger: false,
  },
  {
    type: 'action.bot.backstory.write',
    name: 'Action Bot Backstory Write',
    description: 'Triggered when a bot backstory write action is executed.',
    trigger: false,
  },
  {
    type: 'action.mcp.uninstall',
    name: 'Action Mcp Uninstall',
    description: 'Triggered when an MCP uninstall action is executed.',
    trigger: false,
  },
  {
    type: 'action.mcpserver.tool.call',
    name: 'Action Mcpserver Tool Call',
    description: 'Triggered when an MCP server tool call action is executed.',
    trigger: false,
  },
  {
    type: 'action.skillserver.ability.invoke',
    name: 'Action Skillserver Ability Invoke',
    description:
      'Triggered when a skill server ability is invoked over its HTTP API.',
    trigger: false,
  },
  {
    type: 'action.pack.uninstall',
    name: 'Action Pack Uninstall',
    description: 'Triggered when a pack uninstall action is executed.',
    trigger: false,
  },
  {
    type: 'action.shell.script',
    name: 'Action Shell Script',
    description: 'Triggered when a shell script action is executed.',
    trigger: false,
  },
  {
    type: 'action.skillset.uninstall',
    name: 'Action Skillset Uninstall',
    description: 'Triggered when a skillset uninstall action is executed.',
    trigger: false,
  },
  {
    type: 'action.time.now',
    name: 'Action Time Now',
    description: 'Triggered when a time now action is executed.',
    trigger: false,
  },
  {
    type: 'error.metric',
    name: 'Error Metric',
    description: 'Triggered when an error metric event is recorded.',
    trigger: false,
  },
  {
    type: 'integration.discord.blocked',
    name: 'Integration Discord Blocked',
    description: 'Triggered when a Discord integration interaction is blocked.',
    trigger: false,
  },
  {
    type: 'integration.discord.configuration.error',
    name: 'Integration Discord Configuration Error',
    description:
      'Triggered when a Discord integration configuration error occurs.',
    trigger: false,
  },
  {
    type: 'integration.discord.api.error',
    name: 'Integration Discord API Error',
    description: 'Triggered when a Discord provider API request fails.',
    trigger: false,
  },
  {
    type: 'integration.discord.failed',
    name: 'Integration Discord Failed',
    description: 'Triggered when a Discord integration interaction fails.',
    trigger: false,
  },
  {
    type: 'integration.discord.interact.aborted',
    name: 'Integration Discord Interact Aborted',
    description: 'Triggered when a Discord integration interaction is aborted.',
    trigger: false,
  },
  {
    type: 'integration.email.blocked',
    name: 'Integration Email Blocked',
    description: 'Triggered when an email integration interaction is blocked.',
    trigger: false,
  },
  {
    type: 'integration.email.failed',
    name: 'Integration Email Failed',
    description: 'Triggered when an email integration interaction fails.',
    trigger: false,
  },
  {
    type: 'integration.email.interact.aborted',
    name: 'Integration Email Interact Aborted',
    description: 'Triggered when an email integration interaction is aborted.',
    trigger: false,
  },
  {
    type: 'integration.email.sent',
    name: 'Integration Email Sent',
    description: 'Triggered when an email is sent via the email integration.',
    trigger: false,
  },
  {
    type: 'integration.extract.request',
    name: 'Integration Extract Request',
    description: 'Triggered when an extract integration request is received.',
    trigger: false,
  },
  {
    type: 'integration.extract.request.error',
    name: 'Integration Extract Request Error',
    description:
      'Triggered when an extract integration request results in an error.',
    trigger: false,
  },
  {
    type: 'integration.googlechat.addedToSpace',
    name: 'Integration Googlechat Added To Space',
    description: 'Triggered when the bot is added to a Google Chat space.',
    trigger: false,
  },
  {
    type: 'integration.googlechat.blocked',
    name: 'Integration Googlechat Blocked',
    description:
      'Triggered when a Google Chat integration interaction is blocked.',
    trigger: false,
  },
  {
    type: 'integration.googlechat.configuration.error',
    name: 'Integration Googlechat Configuration Error',
    description:
      'Triggered when a Google Chat integration configuration error occurs.',
    trigger: false,
  },
  {
    type: 'integration.googlechat.api.error',
    name: 'Integration Googlechat API Error',
    description: 'Triggered when a Google Chat provider API request fails.',
    trigger: false,
  },
  {
    type: 'integration.googlechat.failed',
    name: 'Integration Googlechat Failed',
    description: 'Triggered when a Google Chat integration interaction fails.',
    trigger: false,
  },
  {
    type: 'integration.googlechat.interact.aborted',
    name: 'Integration Googlechat Interact Aborted',
    description:
      'Triggered when a Google Chat integration interaction is aborted.',
    trigger: false,
  },
  {
    type: 'integration.googlechat.removed_from_space',
    name: 'Integration Googlechat Removed From Space',
    description: 'Triggered when the bot is removed from a Google Chat space.',
    trigger: false,
  },
  {
    type: 'integration.instagram.callback.notification',
    name: 'Integration Instagram Callback Notification',
    description:
      'Triggered when an Instagram callback notification is received.',
    trigger: false,
  },
  {
    type: 'integration.instagram.callback.subscribe',
    name: 'Integration Instagram Callback Subscribe',
    description:
      'Triggered when an Instagram callback subscription is processed.',
    trigger: false,
  },
  {
    type: 'integration.instagram.failed',
    name: 'Integration Instagram Failed',
    description: 'Triggered when an Instagram integration interaction fails.',
    trigger: false,
  },
  {
    type: 'integration.instagram.api.error',
    name: 'Integration Instagram API Error',
    description: 'Triggered when an Instagram provider API request fails.',
    trigger: false,
  },
  {
    type: 'integration.instagram.interact.aborted',
    name: 'Integration Instagram Interact Aborted',
    description:
      'Triggered when an Instagram integration interaction is aborted.',
    trigger: false,
  },
  {
    type: 'integration.messenger.callback.notification',
    name: 'Integration Messenger Callback Notification',
    description:
      'Triggered when a Messenger callback notification is received.',
    trigger: false,
  },
  {
    type: 'integration.messenger.callback.subscribe',
    name: 'Integration Messenger Callback Subscribe',
    description:
      'Triggered when a Messenger callback subscription is processed.',
    trigger: false,
  },
  {
    type: 'integration.messenger.failed',
    name: 'Integration Messenger Failed',
    description: 'Triggered when a Messenger integration interaction fails.',
    trigger: false,
  },
  {
    type: 'integration.messenger.api.error',
    name: 'Integration Messenger API Error',
    description: 'Triggered when a Messenger provider API request fails.',
    trigger: false,
  },
  {
    type: 'integration.messenger.interact.aborted',
    name: 'Integration Messenger Interact Aborted',
    description:
      'Triggered when a Messenger integration interaction is aborted.',
    trigger: false,
  },
  {
    type: 'integration.notion.sync.fix',
    name: 'Integration Notion Sync Fix',
    description: 'Triggered when a Notion integration sync fix is applied.',
    trigger: false,
  },
  {
    type: 'integration.sitemap.sync.fix',
    name: 'Integration Sitemap Sync Fix',
    description: 'Triggered when a sitemap integration sync fix is applied.',
    trigger: false,
  },
  {
    type: 'integration.github.api.error',
    name: 'Integration GitHub Api Error',
    description: 'Triggered when a GitHub integration API error occurs.',
    trigger: false,
  },
  {
    type: 'integration.github.configuration.error',
    name: 'Integration GitHub Configuration Error',
    description:
      'Triggered when a GitHub integration configuration error occurs.',
    trigger: false,
  },
  {
    type: 'integration.github.failed',
    name: 'Integration GitHub Failed',
    description: 'Triggered when a GitHub integration interaction fails.',
    trigger: false,
  },
  {
    type: 'integration.github.blocked',
    name: 'Integration GitHub Blocked',
    description: 'Triggered when a GitHub integration interaction is blocked.',
    trigger: false,
  },
  {
    type: 'integration.slack.api.error',
    name: 'Integration Slack Api Error',
    description: 'Triggered when a Slack integration API error occurs.',
    trigger: false,
  },
  {
    type: 'integration.slack.auth.error',
    name: 'Integration Slack Auth Error',
    description:
      'Triggered when a Slack integration authentication error occurs.',
    trigger: false,
  },
  {
    type: 'integration.slack.blocked',
    name: 'Integration Slack Blocked',
    description: 'Triggered when a Slack integration interaction is blocked.',
    trigger: false,
  },
  {
    type: 'integration.slack.config.error',
    name: 'Integration Slack Config Error',
    description: 'Triggered when a Slack integration config error occurs.',
    trigger: false,
  },
  {
    type: 'integration.slack.configuration.error',
    name: 'Integration Slack Configuration Error',
    description:
      'Triggered when a Slack integration configuration error occurs.',
    trigger: false,
  },
  {
    type: 'integration.slack.failed',
    name: 'Integration Slack Failed',
    description: 'Triggered when a Slack integration interaction fails.',
    trigger: false,
  },
  {
    type: 'integration.slack.interact.aborted',
    name: 'Integration Slack Interact Aborted',
    description: 'Triggered when a Slack integration interaction is aborted.',
    trigger: false,
  },
  {
    type: 'integration.microsoftteams.blocked',
    name: 'Integration Microsoft Teams Blocked',
    description:
      'Triggered when a Microsoft Teams integration interaction is blocked.',
    trigger: false,
  },
  {
    type: 'integration.microsoftteams.callback.message',
    name: 'Integration Microsoft Teams Callback Message',
    description:
      'Triggered when a Microsoft Teams callback message is received.',
    trigger: false,
  },
  {
    type: 'integration.microsoftteams.callback.unauthorized',
    name: 'Integration Microsoft Teams Callback Unauthorized',
    description:
      'Triggered when a Microsoft Teams callback request is unauthorized.',
    trigger: false,
  },
  {
    type: 'integration.microsoftteams.callback.conversationUpdate',
    name: 'Integration Microsoft Teams Callback Conversation Update',
    description:
      'Triggered when a Microsoft Teams callback conversation update is received.',
    trigger: false,
  },
  {
    type: 'integration.microsoftteams.callback.installationUpdate',
    name: 'Integration Microsoft Teams Callback Installation Update',
    description:
      'Triggered when a Microsoft Teams callback installation update is received.',
    trigger: false,
  },
  {
    type: 'integration.microsoftteams.configuration.error',
    name: 'Integration Microsoft Teams Configuration Error',
    description:
      'Triggered when a Microsoft Teams integration configuration error occurs.',
    trigger: false,
  },
  {
    type: 'integration.microsoftteams.failed',
    name: 'Integration Microsoft Teams Failed',
    description:
      'Triggered when a Microsoft Teams integration interaction fails.',
    trigger: false,
  },
  {
    type: 'integration.microsoftteams.api.error',
    name: 'Integration Microsoft Teams API Error',
    description: 'Triggered when a Microsoft Teams provider API request fails.',
    trigger: false,
  },
  {
    type: 'integration.microsoftteams.interact.aborted',
    name: 'Integration Microsoft Teams Interact Aborted',
    description:
      'Triggered when a Microsoft Teams integration interaction is aborted.',
    trigger: false,
  },
  {
    type: 'integration.recall.configuration.error',
    name: 'Integration Recall Configuration Error',
    description:
      'Triggered when a Recall integration configuration error occurs.',
    trigger: false,
  },
  {
    type: 'integration.telegram.configuration.error',
    name: 'Integration Telegram Configuration Error',
    description:
      'Triggered when a Telegram integration configuration error occurs.',
    trigger: false,
  },
  {
    type: 'integration.telegram.blocked',
    name: 'Integration Telegram Blocked',
    description:
      'Triggered when a Telegram integration interaction is blocked.',
    trigger: false,
  },
  {
    type: 'integration.telegram.failed',
    name: 'Integration Telegram Failed',
    description: 'Triggered when a Telegram integration interaction fails.',
    trigger: false,
  },
  {
    type: 'integration.telegram.api.error',
    name: 'Integration Telegram API Error',
    description: 'Triggered when a Telegram provider API request fails.',
    trigger: false,
  },
  {
    type: 'integration.telegram.interact.aborted',
    name: 'Integration Telegram Interact Aborted',
    description:
      'Triggered when a Telegram integration interaction is aborted.',
    trigger: false,
  },
  {
    type: 'integration.trigger.interact',
    name: 'Integration Trigger Interact',
    description: 'Triggered when a trigger integration interaction occurs.',
    trigger: false,
  },
  {
    type: 'integration.messenger.configuration.error',
    name: 'Integration Messenger Configuration Error',
    description:
      'Triggered when a Messenger integration configuration error occurs.',
    trigger: false,
  },
  {
    type: 'integration.instagram.configuration.error',
    name: 'Integration Instagram Configuration Error',
    description:
      'Triggered when an Instagram integration configuration error occurs.',
    trigger: false,
  },
  {
    type: 'integration.twilio.configuration.error',
    name: 'Integration Twilio Configuration Error',
    description:
      'Triggered when a Twilio integration configuration error occurs.',
    trigger: false,
  },
  {
    type: 'integration.twilio.blocked',
    name: 'Integration Twilio Blocked',
    description: 'Triggered when a Twilio integration interaction is blocked.',
    trigger: false,
  },
  {
    type: 'integration.twilio.failed',
    name: 'Integration Twilio Failed',
    description: 'Triggered when a Twilio integration interaction fails.',
    trigger: false,
  },
  {
    type: 'integration.twilio.sms.received',
    name: 'Integration Twilio Sms Received',
    description: 'Triggered when a Twilio integration receives an inbound SMS.',
    trigger: false,
  },
  {
    type: 'integration.twilio.call.received',
    name: 'Integration Twilio Call Received',
    description:
      'Triggered when a Twilio integration receives an inbound call.',
    trigger: false,
  },
  {
    type: 'integration.twilio.sent',
    name: 'Integration Twilio Sent',
    description: 'Triggered when a Twilio integration message is sent.',
    trigger: false,
  },
  {
    type: 'integration.twilio.interact.aborted',
    name: 'Integration Twilio Interact Aborted',
    description: 'Triggered when a Twilio integration interaction is aborted.',
    trigger: false,
  },
  {
    type: 'integration.whatsapp.api.error',
    name: 'Integration Whatsapp Api Error',
    description: 'Triggered when a WhatsApp integration API error occurs.',
    trigger: false,
  },
  {
    type: 'integration.whatsapp.configuration.error',
    name: 'Integration Whatsapp Configuration Error',
    description:
      'Triggered when a WhatsApp integration configuration error occurs.',
    trigger: false,
  },
  {
    type: 'integration.whatsapp.blocked',
    name: 'Integration Whatsapp Blocked',
    description:
      'Triggered when a WhatsApp integration interaction is blocked.',
    trigger: false,
  },
  {
    type: 'integration.whatsapp.callback.notification',
    name: 'Integration Whatsapp Callback Notification',
    description: 'Triggered when a WhatsApp callback notification is received.',
    trigger: false,
  },
  {
    type: 'integration.whatsapp.callback.subscribe',
    name: 'Integration Whatsapp Callback Subscribe',
    description:
      'Triggered when a WhatsApp callback subscription is processed.',
    trigger: false,
  },
  {
    type: 'integration.whatsapp.failed',
    name: 'Integration Whatsapp Failed',
    description: 'Triggered when a WhatsApp integration interaction fails.',
    trigger: false,
  },
  {
    type: 'integration.whatsapp.interact.aborted',
    name: 'Integration Whatsapp Interact Aborted',
    description:
      'Triggered when a WhatsApp integration interaction is aborted.',
    trigger: false,
  },
  {
    type: 'message.sent',
    name: 'Message Sent',
    description: 'A message was successfully sent in a conversation.',
    trigger: false,
  },
  {
    type: 'metric.test',
    name: 'Metric Test',
    description: 'A test metric event was recorded.',
    trigger: false,
  },
  {
    type: 'page.view',
    name: 'Page View',
    description: 'A page view event was recorded.',
    trigger: false,
  },
  {
    type: 'response.time',
    name: 'Response Time',
    description: 'A response time metric event was recorded.',
    trigger: false,
  },
  {
    type: 'task.execution.fix',
    name: 'Task Execution Fix',
    description: 'Triggered when a task execution fix is applied.',
    trigger: false,
  },
  {
    type: 'task.fix',
    name: 'Task Fix',
    description: 'Triggered when a task fix is applied.',
    trigger: false,
  },
  {
    type: 'task.interact',
    name: 'Task Interact',
    description: 'Triggered when a task interaction occurs.',
    trigger: false,
  },
  {
    type: 'task.interact.aborted',
    name: 'Task Interact Aborted',
    description: 'Triggered when a task interaction is aborted.',
    trigger: false,
  },
  {
    type: 'task.interact.completed',
    name: 'Task Interact Completed',
    description: 'Triggered when a task interaction completes.',
    trigger: false,
  },
  {
    type: 'task.interact.skipped',
    name: 'Task Interact Skipped',
    description: 'Triggered when a task interaction is skipped.',
    trigger: false,
  },
  {
    type: 'user.error',
    name: 'User Error',
    description: 'Triggered when a user error event occurs.',
    trigger: false,
  },
  {
    type: 'webhook.request',
    name: 'Webhook Request',
    description: 'Triggered when a webhook request is received.',
    trigger: false,
  },
] as const satisfies readonly EventConfigEntry[]

export type EventConfig = typeof events
export type EventConfigEvent = EventConfig[number]
export type EventConfigEventType = EventConfigEvent['type']
export type TriggerableEventConfigEvent = Extract<
  EventConfigEvent,
  { trigger: true }
>
export type TriggerableEventConfigEventType =
  TriggerableEventConfigEvent['type']

export default events
