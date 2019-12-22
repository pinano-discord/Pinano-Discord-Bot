const { MongoClient } = require('mongodb')

function connect (url = 'mongodb://localhost:27017', dbName = 'pinano', options = {}) {
  options.useNewUrlParser = true
  options.useUnifiedTopology = true
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

  async loadRowsWithNonZeroKeyValue (key) {
    return this.collection.aggregate([
      { $match: { [key]: { $gt: 0 } } }
    ]).toArray()
  }

  async _loadTopBy (n, key) {
    return this.collection.aggregate([
      { $match: { [key]: { $gt: 0 } } },
      { $sort: { [key]: -1 } },
      { $limit: n }
    ]).toArray()
  }

  async addToField (user, field, value) {
    return this.collection.updateOne({ id: user.id }, { $addToSet: { [field]: value } })
  }

  async removeFromField (user, field, value) {
    return this.collection.updateOne({ id: user.id }, { $pull: { [field]: value } })
  }

  async incrementField (userId, field, value = 1) {
    return this.collection.updateOne({ id: userId }, { $inc: { [field]: value } })
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

module.exports = { connect, makeUser }
