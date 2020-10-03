class ModuleManager {
  constructor (client, guild, dispatcher, persistence, config) {
    this._client = client
    this._guild = guild
    this._dispatcher = dispatcher
    this._persistence = persistence
    this._config = config
    this._modules = new Map()
  }

  registerModule (name, module) {
    this._modules.set(name, module)
  }

  getClient () {
    return this._client
  }

  getGuild () {
    return this._guild
  }

  getDispatcher () {
    return this._dispatcher
  }

  getPersistence () {
    return this._persistence
  }

  getConfig () {
    return this._config
  }

  getModule (name) {
    return this._modules.get(name)
  }

  completeInitialization () {
    this._modules.forEach(module => { module.resume() })
  }
}

function createModuleManager (client, guild, dispatcher, persistence, config) {
  return new ModuleManager(client, guild, dispatcher, persistence, config)
}

module.exports = createModuleManager
