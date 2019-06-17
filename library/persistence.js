const { MongoClient } = require('mongodb')

function connect (url = 'mongodb://localhost:27017', dbName = 'pinano', options = {}) {
  options.useNewUrlParser = true
  return MongoClient.connect(url, options).then(client => {
    return new MongoManager(client, dbName)
  })
}

class MongoManager {
  constructor (client, dbName) {
    this.client = client
    this.dbName = dbName
    this.db = this.client.db(this.dbName)
  }

  dropDatabase () {
    return this.db.dropDatabase()
  }

  newUserRepository () {
    return new MongoUserRepository({ userCollection: this.db.collection('users') })
  }

  newGuildRepository () {
    return new MongoGuildRepository({ guildCollection: this.db.collection('guilds') })
  }

  async shutdown () {
    await this.client.close()
  }
}

function makeUser (userId) {
  return {
    id: userId,
    current_session_playtime: 0,
    overall_session_playtime: 0
  }
}

class MongoUserRepository {
  constructor ({ userCollection }) {
    this.collection = userCollection
  }

  async load (userId) {
    return this.collection.findOne({ id: userId })
  }

  async loadTopSession (n) {
    return this._loadTopBy(n, 'current_session_playtime')
  }

  async loadTopOverall (n) {
    return this._loadTopBy(n, 'overall_session_playtime')
  }

  async _loadTopBy (n, key) {
    return this.collection.aggregate([
      { $match: { [key]: { $gt: 0 } } },
      { $sort: { [key]: -1 } },
      { $limit: n }
    ]).toArray()
  }

  async save (user) {
    return this.collection.updateOne({ id: user.id }, { $set: user }, { upsert: true })
  }

  async resetSessionTimes () {
    return this.collection.updateMany(
      { current_session_playtime: { $gt: 0 } },
      { $set: { current_session_playtime: 0 } })
  }

  async getOverallRank (userId) {
    let rank = await this._getRankBy(userId, 'overall_session_playtime')
    return (rank === undefined) ? rank : rank + 1
  }

  async getOverallRankByTime (time) {
    return await this._getRankByTime(time, 'overall_session_playtime') + 1
  }

  async getSessionRank (userId) {
    let rank = await this._getRankBy(userId, 'current_session_playtime')
    return (rank === undefined) ? rank : rank + 1
  }

  async getSessionRankByTime (time) {
    return await this._getRankByTime(time, 'current_session_playtime') + 1
  }

  async getOverallCount () {
    return this.collection.find({ overall_session_playtime: { $gt: 0 } }).count()
  }

  async getSessionCount () {
    return this.collection.find({ current_session_playtime: { $gt: 0 } }).count()
  }

  async _getRankBy (userId, key) {
    try {
      var rankedCursor = await this.collection.find({ [key]: { $gt: 0 } }).sort({ [key]: -1 })
      let rank = await this._getRankFromCursor(user => user.id === userId, rankedCursor)
      return rank
    } finally {
      rankedCursor.close()
    }
  }

  async _getRankByTime (time, key, cursor) {
    try {
      var rankedCursor = await this.collection.find({ [key]: { $gt: 0 } }).sort({ [key]: -1 })
      let rank = await this._getRankFromCursor(user => user[key] <= time, rankedCursor)
      return rank
    } finally {
      rankedCursor.close()
    }
  }

  async _getRankFromCursor (stoppingFn, cursor) {
    let rank = 0
    let user = await cursor.next()
    while (user != null) {
      if (stoppingFn(user)) {
        return rank
      }
      rank++
      user = await cursor.next()
    }
    return undefined
  }
}

function makeGuild (guildId) {
  return {
    guild: guildId,
    welcome_toggle: false,
    leave_toggle: false,
    dm_welcome_toggle: false,
    welcome_channel: '',
    leave_channel: '',
    welcome_message: '',
    dm_welcome_message: '',
    leave_message: '',
    permitted_channels: []
  }
}

class MongoGuildRepository {
  constructor ({ guildCollection }) {
    this.collection = guildCollection
  }

  async load (groupId) {
    return this.collection.findOne({ guild: groupId })
  }

  async save (group) {
    return this.collection.update({ guild: group.guild }, group, { upsert: true })
  }
}

module.exports = { connect, makeUser, makeGuild }
