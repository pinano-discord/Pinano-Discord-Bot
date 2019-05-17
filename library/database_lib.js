module.exports = (client) => {
  let db

  client._setDB = (providedDb) => {
    db = providedDb
  }

  client.loadUserData = async (discordID) => {
    return db.collection('users').findOne({ id: discordID })
  }

  client.writeUserData = async (discordID, obj) => {
    return db.collection('users').update({ id: discordID }, obj, { upsert: true })
  }

  client.createGuild = async (id) => {
    let g = {
      guild: id,
      welcome_toggle: false,
      leave_toggle: false,
      dm_welcome_toggle: false,
      voice_perm_toggle: false,
      welcome_channel: '',
      leave_channel: '',
      welcome_message: '',
      dm_welcome_message: '',
      leave_message: '',
      permitted_channels: []
    }

    return client.writeGuildData(id, g)
  }

  client.loadGuildData = async (guildID) => {
    return db.collection('guilds').findOne({ guild: guildID })
  }

  client.writeGuildData = (guildID, obj) => {
    return db.collection('guilds').update({ guild: guildID }, obj, { upsert: true })
  }

  client.clearWeekResults = async () => {
    let data = await db.collection('users').find({}).toArray()
    await data.forEach(entry => {
      entry.current_session_playtime = 0
    })

    await db.collection('users').remove({})
    await db.collection('users').insert(data)
  }

  client.clearOverallResults = async () => {
    let data = await db.collection('users').find({}).toArray()
    await data.forEach(entry => {
      entry.overall_session_playtime = 0
    })

    await db.collection('users').remove({})
    await db.collection('users').insert(data)
  }
}
