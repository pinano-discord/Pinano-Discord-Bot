const SettingTypes = {
  ARRAY: 'ARRAY',
  STRING: 'STRING',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN'
}

// TODO: make more configuration settings modifiable without restart
const keys = [
  { name: 'allowlist', type: SettingTypes.ARRAY },
  { name: 'alwaysAutoquiz', type: SettingTypes.BOOLEAN },
  { name: 'autoquizHintTimeout', type: SettingTypes.INTEGER },
  { name: 'autoquizSkipTimeout', type: SettingTypes.INTEGER },
  { name: 'bitrate', type: SettingTypes.INTEGER },
  { name: 'blocklist', type: SettingTypes.ARRAY },
  { name: 'enableAutoquiz', type: SettingTypes.BOOLEAN },
  { name: 'enableExclusiveTokens', type: SettingTypes.BOOLEAN },
  { name: 'forumHoldTimeoutSeconds', type: SettingTypes.INTEGER },
  { name: 'maxConcurrentRiddles', type: SettingTypes.INTEGER },
  { name: 'nagTimeoutInSeconds', type: SettingTypes.INTEGER },
  { name: 'ranks', type: SettingTypes.ARRAY },
  { name: 'recitalUpperBoundId', type: SettingTypes.STRING },
  { name: 'recitalLowerBoundId', type: SettingTypes.STRING },
  { name: 'rejectedRiddleAction', type: SettingTypes.STRING, values: ['reject', 'ignore'] },
  { name: 'riddleAcceptancePolicy', type: SettingTypes.STRING, values: ['blocklist', 'allowlist'] },
  { name: 'quizSuccessTimeout', type: SettingTypes.INTEGER },
  { name: 'skipTimeoutInSeconds', type: SettingTypes.INTEGER }
]

class ConfigManager {
  constructor (repository, id) {
    this._repository = repository
    this._id = id
  }

  async loadFromRepository () {
    this._cache = await this._repository.get(this._id)
    return this._cache != null
  }

  get (key) {
    return this._cache[key]
  }

  add (key, value) {
    const setting = keys.find(k => k.name === key)
    if (setting == null) {
      throw new Error(`Cannot find configuration key \`${key}\`.`)
    }
    if (setting.type !== SettingTypes.ARRAY) {
      throw new Error(`Cannot add to configuration key \`${key}\` because it does not describe a setting of type ARRAY.`)
    }

    this._repository.addToSet(this._id, key, value).then(result => { this._cache = result })
  }

  remove (key, value) {
    const setting = keys.find(k => k.name === key)
    if (setting == null) {
      throw new Error(`Cannot find configuration key \`${key}\`.`)
    }
    if (setting.type !== SettingTypes.ARRAY) {
      throw new Error(`Cannot remove from configuration key \`${key}\` because it does not describe a setting of type ARRAY.`)
    }

    this._repository.removeFromSet(this._id, key, value).then(result => { this._cache = result })
  }

  set (key, value) {
    const setting = keys.find(k => k.name === key)
    if (setting == null) {
      throw new Error(`Cannot find configuration key \`${key}\`.`)
    }
    if (setting.type === SettingTypes.ARRAY) {
      throw new Error(`Cannot set configuration key \`${key}\` because it describes a setting of type ARRAY.`)
    }
    if (setting.type === SettingTypes.INTEGER) {
      value = parseInt(value)
      if (!Number.isInteger(value)) {
        throw new Error(`Cannot set configuration key \`${key}\` to \`${value}\`. The value must be of type INTEGER.`)
      }
    } else if (setting.type === SettingTypes.BOOLEAN) {
      if (value === 'true') {
        value = true
      } else if (value === 'false') {
        value = false
      } else {
        throw new Error(`Cannot set configuration key \`${key}\` to \`${value}\`. The value must be of type BOOLEAN.`)
      }
    }
    if (setting.values != null && !setting.values.includes(value)) {
      throw new Error(`Cannot set configuration key \`${key}\` to \`${value}\`. Possible values are: \`${setting.values}\``)
    }

    this._repository.setField(this._id, key, value).then(result => { this._cache = result })
  }

  unset (key) {
    const setting = keys.find(k => k.name === key)
    if (setting == null) {
      throw new Error(`Cannot find configuration key \`${key}\`.`)
    }
    if (setting.type === SettingTypes.ARRAY) {
      throw new Error(`Cannot set configuration key \`${key}\` because it describes a setting of type ARRAY.`)
    }

    this._repository.unsetField(this._id, key).then(result => { this._cache = result })
  }
}

module.exports = ConfigManager
