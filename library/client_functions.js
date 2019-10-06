const Discord = require('discord.js')
const hd = require('humanize-duration')
const moment = require('moment')
const settings = require('../settings/settings.json')

module.exports = client => {
  client.log = (string) => {
    console.log(`${moment().format('MMMM Do YYYY, h:mm:ss a')} :: ${string}`)
  }

  client.loadCommands = async () => {
    let loadCommands = require('../commands.js')
    loadCommands(client)

    require('../eval.js').load(client)
  }

  client.errorMessage = async (message, response) => {
    let m = await message.channel.send({
      embed: {
        title: 'Error',
        description: response,
        color: settings.embed_color,
        timestamp: new Date()
      }
    })

    setTimeout(() => m.delete(), settings.res_destruct_time * 1000)
  }

  client.unlockPracticeRoom = async (guild, userId, channel) => {
    if (channel.unlocked_name != null) {
      await channel.setName(channel.unlocked_name)
    }

    // remove permissions overrides
    let everyone = guild.roles.find(r => r.name === '@everyone')
    await channel.overwritePermissions(everyone, { SPEAK: null })

    let personalOverride = channel.permissionOverwrites.get(userId)
    // existingOverride shouldn't be null unless someone manually deletes the override, but if for some reason it's gone, no big deal, just move on.
    if (personalOverride != null) {
      if (personalOverride.allowed.bitfield === Discord.Permissions.FLAGS.SPEAK && personalOverride.denied.bitfield === 0) { // the only permission was allow SPEAK
        await personalOverride.delete()
      } else {
        await channel.overwritePermissions(userId, { SPEAK: null })
      }
    }

    try {
      await Promise.all(channel.members.map(async m => {
        if (!m.deleted && !m.roles.some(r => r.name === 'Temp Muted')) {
          return m.setMute(false)
        }
      }))
    } catch (err) {
      // this is likely an issue with trying to mute a user who has already left the channel
      client.log(err)
    }

    channel.locked_by = null
  }

  client.saveUserTime = async (member) => {
    // if the user doesn't exist then create a user for the person
    let userInfo = await client.userRepository.load(member.user.id)
    if (userInfo == null) {
      userInfo = {
        'id': member.user.id,
        'current_session_playtime': 0,
        'overall_session_playtime': 0
      }
      await client.userRepository.save(userInfo)
      client.log(`User created for ${member.user.username}#${member.user.discriminator}`)
    }

    const now = moment().unix()
    const playtime = now - member.s_time
    userInfo.current_session_playtime += playtime
    userInfo.overall_session_playtime += playtime
    await client.userRepository.save(userInfo)
    client.log(`User ${member.user.username}#${member.user.discriminator} practiced for ${playtime} seconds`)

    member.s_time = now
  }

  client.saveAllUsersTime = async (guild) => {
    let guildInfo = await client.guildRepository.load(guild.id)
    await Promise.all(
      guildInfo.permitted_channels
        .map(chanId => guild.channels.get(chanId))
        .filter(chan => chan != null)
        .map(chan =>
          Promise.all(chan.members
            .filter(member => !member.mute && member.s_time != null && !member.deleted)
            .map(member => client.saveUserTime(member)))))
  }

  client.updateInformation = async (guild) => {
    let infoChan = guild.channels.find(c => c.name === 'information')
    let messages = await infoChan.fetchMessages()
    let guildInfo = await client.guildRepository.load(guild.id)
    let weeklyData = await client.getWeeklyLeaderboard(guild)
    let overallData = await client.getOverallLeaderboard(guild)
    let currentTime = moment().unix()
    let endOfWeek = moment().endOf('isoWeek').unix()
    let timeUntilReset = hd((endOfWeek - currentTime) * 1000, { units: [ 'd', 'h', 'm' ], maxDecimalPoints: 0 })

    let rooms = ''
    guildInfo.permitted_channels
      .map(chanId => guild.channels.get(chanId))
      .filter(chan => chan != null && chan.members.some(m => !m.deleted))
      .sort((x, y) => x.position > y.position)
      .forEach(chan => {
        let displayName = (chan.locked_by != null && chan.isTempRoom) ? chan.unlocked_name : chan.name
        rooms += `\n\n${displayName.replace(' (64kbps)', '')}`
        if (!chan.name.endsWith('(64kbps)')) { // don't bother with video links for low-bitrate rooms
          rooms += ` | [Video](http://www.discordapp.com/channels/${guild.id}/${chan.id})`
        }

        if (chan.locked_by != null) {
          rooms += ` | LOCKED by <@${chan.locked_by}>`
        }

        chan.members.forEach(m => {
          rooms += `\n<@${m.id}>`
          if (m.deleted) {
            rooms += ' :ghost:'
          }

          if (m.s_time != null) {
            rooms += ' :microphone2:'
          }
        })
      })

    let pinnedPostUrl = 'https://discordapp.com/channels/188345759408717825/411657964198428682/518693148877258776'
    let embed = new Discord.RichEmbed()
      .setTitle('Practice Rooms')
      .setColor(settings.embed_color)
      .setDescription(`${rooms}\n\u200B`) // stupid formatting hack
      .addField('Weekly Leaderboard', weeklyData, true)
      .addField('Overall Leaderboard', overallData, true)
      .addField(`Weekly leaderboard resets in ${timeUntilReset}`,
        `\u200B\nClick [here](${pinnedPostUrl}) for optimal Discord voice settings\n\
Use \`p!stats\` for individual statistics\n\u200B`)
      .setTimestamp(Date.now())

    let toEdit = messages.find(m => m.embeds != null && m.embeds.some(e => e.title === 'Practice Rooms'))
    if (toEdit == null) {
      infoChan.send(embed)
    } else {
      toEdit.edit({ embed: embed })
    }

    setTimeout(() => client.updateInformation(guild), 15 * 1000)
  }
}
