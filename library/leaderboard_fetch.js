const hd = require('humanize-duration')
const moment = require('moment')

module.exports = (client, db) => {
  /**
     * Let me provide some context for this monstrosity of a library entry
     * It was 2 am and i had to get the leaderboard finished to publish
     * the bot on christmas night, so plz no be mean :c Going to re-write
     * this entire file in the upcoming days
    */

  client.findCurrentPrackers = async (guild, callback) => {
    // playtimes only get updated when a user leaves/mutes a channel. Therefore, in order to keep up-to-date statistics,
    // find out what users are currently in permitted voice channels, then add their times as if current.
    let guildInfo = await client.loadGuildData(guild)
    let currentPrackers = new Map()
    await Promise.all(guildInfo.permitted_channels.map(async (channel) => {
      let vc = client.guilds.get(guild).channels.get(channel)
      if (vc != null) {
        vc.members.forEach(member => {
          // these conditions should be equivalent but maybe they were already pracking when the bot came up.
          if (!member.mute && member.s_time != null) {
            currentPrackers.set(member.user.id, moment().unix() - member.s_time)
          }
        })
      }
    }))

    callback(currentPrackers)
  }

  client.getOverallLeaderboard = (message, callback) => {
    client.findCurrentPrackers(message.guild.id, (currentPrackers) => {
      let scoreArray = []
      let msgStr = ''
      db.collection('users').find({}).toArray()
        .then(async res => {
          await res.forEach(doc => {
            let time = doc.overall_session_playtime
            if (currentPrackers.get(doc.id) != null) {
              time += currentPrackers.get(doc.id)
            }

            if (time > 0) {
              let string = `${doc.id}|${time}`
              scoreArray.push(string)
            }
          })
          await con()
        })
      function con () {
        scoreArray.sort((a, b) => {
          a = a.split('|').splice(1).join('')
          b = b.split('|').splice(1).join('')
          return b - a
        })
        for (let j = 0; j < client.settings.leaderboard_size; j++) {
          if (!scoreArray[j]) {
            msgStr += ``
          } else {
            let user = scoreArray[j].split('|')[0]
            let time = hd(scoreArray[j].split('|')[1] * 1000, { units: ['h', 'm', 's'] })
            if (client.users.get(user)) {
              msgStr += `**${j + 1}. ${client.users.get(user).username}#${client.users.get(user).discriminator}**\n \`${time}\`\n`
            } else {
              msgStr += `**${j + 1}.** *${user}* \n \`${time}\`\n`
            }
          }
        }

        client.fetchOverallLeaderboardPos(message.guild.id, message.author.id, pos => {
          msgStr = `**${message.author.username}**, you are rank ${pos}\n ${msgStr}`
          callback(msgStr)
        })
      }
    })
  }

  client.getWeeklyLeaderboard = (message, callback) => {
    client.findCurrentPrackers(message.guild.id, (currentPrackers) => {
      let scoreArray = []
      let msgStr = ''
      db.collection('users').find({}).toArray()
        .then(async res => {
          await res.forEach(doc => {
            let time = doc.current_session_playtime
            if (currentPrackers.get(doc.id) != null) {
              time += currentPrackers.get(doc.id)
            }

            if (time > 0) {
              let string = `${doc.id}|${time}`
              scoreArray.push(string)
            }
          })
          await con()
        })
      function con () {
        scoreArray.sort((a, b) => {
          a = a.split('|').splice(1).join('')
          b = b.split('|').splice(1).join('')
          return b - a
        })
        for (let j = 0; j < client.settings.leaderboard_size; j++) {
          if (!scoreArray[j]) {
            msgStr += ``
          } else {
            let user = scoreArray[j].split('|')[0]
            let time = hd(scoreArray[j].split('|')[1] * 1000, { units: ['h', 'm', 's'] })
            if (client.users.get(user)) {
              msgStr += `**${j + 1}. ${client.users.get(user).username}#${client.users.get(user).discriminator}**\n \`${time}\`\n`
            } else {
              msgStr += `**${j + 1}.** *${user}* \n \`${time}\`\n`
            }
          }
        }

        if (message != null) {
          client.fetchWeeklyLeaderboardPos(message.guild.id, message.author.id, pos => {
            msgStr = `**${message.author.username}**, you are rank ${pos}\n ${msgStr}`
            callback(msgStr)
          })
        } else {
          callback(msgStr)
        }
      }
    })
  }

  client.fetchWeeklyLeaderboardPos = (guildId, userId, callback) => {
    client.findCurrentPrackers(guildId, (currentPrackers) => {
      let scoreArray = []
      let msgStr = ''
      db.collection('users').find({}).toArray()
        .then(async res => {
          await res.forEach(doc => {
            let time = doc.current_session_playtime
            if (currentPrackers.get(doc.id) != null) {
              time += currentPrackers.get(doc.id)
            }

            if (time > 0) {
              let string = `${doc.id}|${time}`
              scoreArray.push(string)
            }
          })
          await con()
        })
      function con () {
        scoreArray.sort((a, b) => {
          a = a.split('|').splice(1).join('')
          b = b.split('|').splice(1).join('')
          return b - a
        })

        let pos = 0
        let trueJ = 0
        for (let i = 0; i <= scoreArray.length; i++) {
          if (scoreArray[i]) {
            let user = scoreArray[i].split('|')[0]
            if (user === userId) { pos = trueJ + 1 }
            trueJ++
          }
        }

        if (pos > 0) {
          msgStr = `\`${pos}\` / \`${trueJ}\``
        } else {
          msgStr = 'N / A'
        }

        callback(msgStr)
      }
    })
  }

  client.fetchOverallLeaderboardPos = (guildId, userId, callback) => {
    client.findCurrentPrackers(guildId, (currentPrackers) => {
      let scoreArray = []
      let msgStr = ''
      db.collection('users').find({}).toArray()
        .then(async res => {
          await res.forEach(doc => {
            let time = doc.overall_session_playtime
            if (currentPrackers.get(doc.id) != null) {
              time += currentPrackers.get(doc.id)
            }

            if (time > 0) {
              let string = `${doc.id}|${time}`
              scoreArray.push(string)
            }
          })
          await con()
        })
      function con () {
        scoreArray.sort((a, b) => {
          a = a.split('|').splice(1).join('')
          b = b.split('|').splice(1).join('')
          return b - a
        })

        let pos = 0
        let trueJ = 0
        for (let i = 0; i <= scoreArray.length; i++) {
          if (scoreArray[i]) {
            let user = scoreArray[i].split('|')[0]
            if (user === userId) { pos = trueJ + 1 }
            trueJ++
          }
        }

        if (pos > 0) {
          msgStr = `\`${pos}\` / \`${trueJ}\``
        } else {
          msgStr = 'N / A'
        }

        callback(msgStr)
      }
    })
  }

  client.submitweek = () => {
    client.getWeeklyLeaderboard(null, data => {
      let msg = new client.discord.RichEmbed()
      msg.setTitle('Weekly Leaderboard')
      msg.setDescription(data)
      msg.setColor(client.settings.embed_color)
      msg.setTimestamp()
      client.fetchUser(client.settings.submit_id, true).then(m => {
        m.send(msg)
      })
    })
  }
}
