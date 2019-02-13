const { MongoClient } = require('mongodb')

let client
let db

function connect (url = 'mongodb://localhost:27017', dbName = 'pinano') {
  return MongoClient.connect(url, { useNewUrlParser: true }).then(newClient => {
    client = newClient
    db = client.db(dbName)
    let userRepository = new MongoUserRepository({ userCollection: db.collection('users') })
    let guildRepository = new MongoGuildRepository({ guildCollection: db.collection('guilds') })
    return { userRepository, guildRepository }
  })
}

function _getDatabase () {
  return db
}

async function shutdown () {
  if (client) {
    await client.close()
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
    return this.collection.aggregate([
      { $sort: { current_session_playtime: -1 } },
      { $limit: n }
    ]).toArray()
  }

  async loadTopOverall (n) {
    return this.collection.aggregate([
      { $sort: { overall_session_playtime: -1 } },
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

  async getOverallPos (userId) {
    return this._getRankBy(userId, 'overall_session_playtime')
  }

  async getSessionPos (userId) {
    return this._getRankBy(userId, 'current_session_playtime')
  }

  async _getRankBy (userId, key) {
    try {
      var rankedCursor = await this.collection.find().sort({ [key]: -1 })
      let rank = await this._getRankFromCursor(userId, rankedCursor)
      return rank
    } finally {
      rankedCursor.close()
    }
  }

  async _getRankFromCursor (userId, cursor) {
    let rank = 0
    let user = await cursor.next()
    while (user != null) {
      if (user.id === userId) {
        return rank
      }
      rank++
      user = await cursor.next()
    }
    return null
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
    return this.collection.findOne({ id: groupId })
  }

  async save (group) {
    return this.collection.update({ id: group.id }, group, { upsert: true })
  }
}

module.exports = { connect, shutdown, makeUser, makeGuild, client, _getDatabase }
