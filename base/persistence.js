const MongoClient = require('mongodb')

const log = require('../library/util').log

async function connect (config) {
  const client = await MongoClient.connect(config.url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })

  return new Persistence(client, config.dbName)
}

class Persistence {
  constructor (client, dbName) {
    this._client = client
    this._dbName = dbName
  }

  getConfigRepository () {
    return new MongoConfigRepository(this._client.db(this._dbName).collection('config'))
  }

  getUserRepository (guildId) {
    return new MongoUserRepository(this._client.db(this._dbName).collection(`users_${guildId}`))
  }

  getQuizRepository (guildId) {
    return new MongoQuizRepository(this._client.db(this._dbName).collection(`quiz_${guildId}`))
  }

  getGraphRepository (guildId) {
    return new MongoListeningGraphRepository(this._client.db(this._dbName).collection(`graph_${guildId}`))
  }
}

class MongoConfigRepository {
  constructor (collection) {
    this._collection = collection
    this._collection.createIndex({ id: 1 }, { unique: true })
  }

  get (id) {
    return this._collection.findOne({ id: id })
  }

  async addToSet (id, field, value, upsert = true) {
    const result = await this._collection.findOneAndUpdate(
      { id: id },
      { $addToSet: { [field]: value } },
      { upsert: upsert, returnOriginal: false })
    return result.value
  }

  async removeFromSet (id, field, value) {
    const result = await this._collection.findOneAndUpdate(
      { id: id },
      { $pull: { [field]: value } },
      { returnOriginal: false })
    return result.value
  }

  async setField (id, fieldName, value, upsert = true) {
    const result = await this._collection.findOneAndUpdate(
      { id: id },
      { $set: { [fieldName]: value } },
      { upsert: upsert, returnOriginal: false })
    return result.value
  }

  async unsetField (id, fieldName) {
    const result = await this._collection.findOneAndUpdate(
      { id: id },
      { $unset: { [fieldName]: true } },
      { returnOriginal: false })
    return result.value
  }
}

class MongoUserRepository {
  constructor (collection) {
    this._collection = collection
    this._collection.createIndex({ id: 1 }, { unique: true })
  }

  get (id) {
    return this._collection.findOne({ id: id })
  }

  async setField (id, fieldName, value, upsert = true) {
    const result = await this._collection.findOneAndUpdate(
      { id: id },
      { $set: { [fieldName]: value } },
      { upsert: upsert, returnOriginal: false })
    return result.value
  }

  async setFieldIfNotExists (id, fieldName, value, upsert = true) {
    const result = await this._collection.findOneAndUpdate(
      { id: id, [fieldName]: { $exists: false } },
      { $set: { [fieldName]: value } },
      { upsert: upsert, returnOriginal: false })
    return result.value
  }

  async incrementField (id, fieldName, increment = 1, upsert = true) {
    const result = await this._collection.findOneAndUpdate(
      { id: id },
      { $inc: { [fieldName]: increment } },
      { upsert: upsert, returnOriginal: false })
    return result.value
  }

  async incrementSessionPlaytimes (id, increment, upsert = true) {
    const result = await this._collection.findOneAndUpdate(
      { id: id },
      [{
        $set: {
          current_session_playtime: { $sum: ['$current_session_playtime', increment] },
          overall_session_playtime: { $sum: ['$overall_session_playtime', increment] },
          daily_session_playtime: { $sum: ['$daily_session_playtime', { $cond: [{ $or: [{ $eq: ['$daily_reset_hour', 0] }, '$daily_reset_hour'] }, increment, 0] }] }
        }
      }],
      { upsert: upsert, returnOriginal: false }
    )

    if (result.value != null) {
      log(`--- incrementSessionPlaytimes ${id} ${increment}`)
    }
    return result.value
  }

  async decrementSessionPlaytimes (id, decrement, upsert = false) {
    const result = await this._collection.findOneAndUpdate(
      { id: id },
      [{
        $set: {
          current_session_playtime: { $max: [{ $subtract: ['$current_session_playtime', decrement] }, 0] },
          overall_session_playtime: { $max: [{ $subtract: ['$overall_session_playtime', decrement] }, 0] },
          daily_session_playtime: { $max: [{ $subtract: ['$daily_session_playtime', decrement] }, 0] }
        }
      }],
      { upsert: upsert, returnOriginal: false }
    )
    return result.value
  }

  async incrementListeningTime (id, increment, upsert = true) {
    log(`--- incrementListeningTime ${id} ${increment}`)
    const result = await this._collection.findOneAndUpdate(
      { id: id },
      { $inc: { listening_time: increment } },
      { upsert: upsert, returnOriginal: false })
    return result.value
  }

  async addToSet (id, field, value, upsert = true) {
    const result = await this._collection.findOneAndUpdate(
      { id: id },
      { $addToSet: { [field]: value } },
      { upsert: upsert, returnOriginal: false })
    return result.value
  }

  async removeFromSet (id, field, value) {
    const result = await this._collection.findOneAndUpdate(
      { id: id },
      { $pull: { [field]: value } },
      { returnOriginal: false })
    return result.value
  }

  async clearFromAllExcept (field, value, userId) {
    return this._collection.updateMany(
      { [field]: value, id: { $ne: userId } },
      { $pull: { [field]: value } }
    )
  }

  async hatchCustomToken (id, newValue, upsert = true) {
    if (newValue == null) {
      const result = await this._collection.findOneAndUpdate(
        { id: id },
        { $pull: { rooms_practiced: '🥚' }, $unset: { egg_hatch_time: '' } },
        { upsert: upsert, returnOriginal: false })
      return result.value
    } else {
      const result = await this._collection.findOneAndUpdate(
        { id: id },
        [{ $set: { rooms_practiced: { $setDifference: [{ $setUnion: ['$rooms_practiced', [newValue]] }, ['🥚']] } } },
          { $unset: 'egg_hatch_time' }
        ],
        { upsert: upsert, returnOriginal: false }
      )
      return result.value
    }
  }

  resetDailyTimes (hour) {
    return this._collection.updateMany(
      { daily_reset_hour: hour },
      [{ $set: { daily_streak: { $cond: ['$practiced_today', { $sum: ['$daily_streak', 1] }, 0] } } },
        { $set: { max_daily_streak: { $max: ['$max_daily_streak', '$daily_streak'] } } },
        { $set: { practiced_today: false, daily_session_playtime: 0 } }]
    )
  }

  loadPositive (key) {
    return this._collection.find({ [key]: { $gt: 0 } }).toArray()
  }

  resetSessionTimes () {
    return this._collection.updateMany(
      { current_session_playtime: { $gt: 0 } },
      { $set: { current_session_playtime: 0 } })
  }

  pandemicStarted () {
    return this._collection.find({ virus_visible_at: { $exists: true } }).hasNext()
  }
}

class MongoQuizRepository {
  constructor (collection) {
    this._collection = collection
  }

  getActiveQueue () {
    return this._collection.find({ overflow: false, ignore: false }).toArray()
  }

  addRiddle (riddle) {
    return this._collection.insertOne(riddle)
  }

  removeRiddle (id) {
    return this._collection.deleteOne({ id: id })
  }

  async promoteRiddle (quizzerId, priority) {
    const result = await this._collection.findOneAndUpdate(
      { quizzerId: quizzerId, overflow: true, ignore: false },
      { $set: { overflow: false, priority: priority } },
      { sort: { id: 1 }, returnOriginal: false })
    return result.value
  }
}

class MongoListeningGraphRepository {
  constructor (collection) {
    this._collection = collection
  }

  updateDirectListeningStat (listenerId, prackerId, delta, upsert = true) {
    return this._collection.findOneAndUpdate(
      { listenerId: listenerId, prackerId: prackerId },
      { $inc: { time: delta } },
      { upsert: upsert }
    )
  }

  async getListenerChoiceMap (cutoff = 18000) {
    const map = new Map()
    const result = await this._collection.aggregate([
      { $sort: { time: -1 } },
      { $group: { _id: '$listenerId', total: { $sum: '$time' }, prackerId: { $first: '$prackerId' } } },
      { $match: { total: { $gte: cutoff } } }
    ]).toArray()
    result.forEach(entry => {
      map.set(entry._id, entry.prackerId)
    })
    return map
  }

  async getDistinctListenerMap (cutoff = 3600) {
    const map = new Map()
    const result = await this._collection.aggregate([
      { $match: { time: { $gte: cutoff } } },
      { $group: { _id: '$listenerId', count: { $sum: 1 } } }
    ]).toArray()
    result.forEach(entry => {
      map.set(entry._id, entry.count)
    })
    return map
  }

  async getTopListenerMap (cutoff = 18000) {
    const map = new Map()
    const result = await this._collection.aggregate([
      { $match: { time: { $gte: cutoff } } },
      { $sort: { time: -1 } },
      { $group: { _id: '$prackerId', listenerId: { $first: '$listenerId' } } }
    ]).toArray()
    result.forEach(entry => {
      map.set(entry._id, entry.listenerId)
    })
    return map
  }

  async getUltimateTopListener () {
    const result = await this._collection.find().sort({ time: -1 }).next()
    return result.listenerId
  }

  async getTopListeners (id, limit = 5) {
    return this._collection
      .find({ prackerId: id })
      .sort({ time: -1 })
      .limit(limit)
      .toArray()
  }

  async getTopListenedTo (id, limit = 5) {
    return this._collection
      .find({ listenerId: id })
      .sort({ time: -1 })
      .limit(limit)
      .toArray()
  }
}

module.exports = connect
