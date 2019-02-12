const { MongoClient } = require('mongodb')

let client
let db

function connect (url = 'mongodb://localhost:27017', dbName = 'pinano') {
  return MongoClient.connect(url, { useNewUrlParser: true }).then(client => {
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
    overall_session_playtime: 0,
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
}

function makeGuild (guildId) {
  return {
    guild: id,
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
