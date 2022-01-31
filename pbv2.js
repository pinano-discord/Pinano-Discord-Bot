const Discord = require('discord.js')
const fs = require('fs')

const globalConfig = require('./config.json')

const ConfigManager = require('./base/config_manager')
const EventDispatcher = require('./base/event_dispatcher')
const createModuleManager = require('./base/module_manager')
const util = require('./library/util')

const modules = [
  // must be initialized first; a bunch of other modules (e.g. policy enforcer)
  // depend on data structures in the PM.
  require('./modules/practice_adapter'),
  require('./modules/practice_manager'),

  require('./modules/badges'),
  require('./modules/config'),
  require('./modules/daily_time'),
  require('./modules/faq'),
  require('./modules/help'),
  require('./modules/listening_graph'),
  require('./modules/virus'),
  require('./modules/policy_enforcer'),
  require('./modules/quiz_adapter'),
  require('./modules/quiz_master'),
  require('./modules/raiding'),
  require('./modules/restart'),
  require('./modules/roles'),
  require('./modules/stage_manager'),
  require('./modules/statistics'),
  require('./modules/subscriptions'),
  require('./modules/token_collecting'),
  require('./modules/user_management')
]

for (const filename of fs.readdirSync('./modules/custom/')) {
  if (filename.endsWith('.js')) {
    modules.push(require(`./modules/custom/${filename}`))
  }
}

const moduleManagers = new Map()
const connect = require('./base/persistence')
connect(globalConfig).then(persistence => {
  const client = new Discord.Client({
    fetchAllMembers: true,
    intents: [
      Discord.Intents.FLAGS.GUILDS,
      Discord.Intents.FLAGS.GUILD_MEMBERS,
      Discord.Intents.FLAGS.GUILD_MESSAGES,
      Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
      Discord.Intents.FLAGS.GUILD_VOICE_STATES
    ]
  })
  const dispatcher = new EventDispatcher(client, moduleManagers)
  const configRepository = persistence.getConfigRepository()

  if (globalConfig.logDiscordDebugEvents) {
    client.on('debug', info => util.log(info))
    client.on('warn', info => util.log(info))
    client.on('rateLimit', info => util.log(`rateLimit timeout=${info.timeout}ms limit=${info.limit} method=${info.method} path=${info.path} route=${info.route}`))
  }
  client.once('ready', async () => {
    util.log('Connected to Discord.')
    if (globalConfig.activity != null) {
      client.user.setActivity(globalConfig.activity, { type: 'PLAYING' })
    }

    client.guilds.cache.forEach(async guild => {
      const config = new ConfigManager(configRepository, guild.id)
      const exists = await config.loadFromRepository()
      if (!exists) return

      if (moduleManagers.get(guild.id) == null) {
        moduleManagers.set(guild.id, createModuleManager(client, guild, dispatcher, persistence, config))
      }

      const moduleManager = moduleManagers.get(guild.id)
      modules.forEach(moduleSpec => {
        try {
          if (moduleManager.getModule(moduleSpec.name) == null) {
            const module = moduleSpec.makeModule(moduleManager)
            if (module != null) {
              moduleManager.registerModule(moduleSpec.name, module)
              util.log(`Initialized module ${moduleSpec.name} for guild ${guild.id}`)
            }
          }
        } catch (err) {
          util.logError(`Failed to initialize ${moduleSpec.name} for guild ${guild.id}:`)
          util.logError(err.message)
        }
      })

      moduleManager.completeInitialization()
    })
  })

  client.login(globalConfig.token)
})
