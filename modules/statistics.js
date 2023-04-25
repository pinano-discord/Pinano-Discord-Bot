const Discord = require('discord.js')
const hd = require('humanize-duration')
const { resolveUntaggedMember } = require('../library/util')
const RoomIdentifiers = require('../library/room_identifiers')

const MODULE_NAME = 'User Statistics'

function abbreviateTime (playtime) {
  return hd(playtime * 1000, { units: ['h', 'm', 's'], round: true })
    .replace('hours', 'h')
    .replace('minutes', 'm')
    .replace('seconds', 's')
    .replace('hour', 'h')
    .replace('minute', 'm')
    .replace('second', 's')
}

class Statistics {
  constructor (moduleManager) {
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager
  }

  resume () {
    const guild = this._moduleManager.getGuild()
    const userRepository = this._moduleManager.getPersistence().getUserRepository(guild.id)
    const pracman = this._moduleManager.getModule('Practice Manager')
    const badges = this._moduleManager.getModule('Badges')
    const dispatcher = this._moduleManager.getDispatcher()
    dispatcher.command('stats', guild.id, async (message, tokenized, channel) => {
      authorMember = message.member
      let target = authorMember
      if (tokenized.length > 0) {
        const fullyQualifiedName = tokenized.join(' ').trim()
        target = resolveUntaggedMember(guild, fullyQualifiedName)
      }

      const now = new Date()
      const embed = new Discord.EmbedBuilder()
        .setTitle(`${target.user.username}#${target.user.discriminator}`)
        .setColor(this._config.get('embedColor') || 'Default')
        .setTimestamp(now)

      const userRecord = await userRepository.get(target.id) || {}
      let roomsSeen = userRecord.rooms_practiced || []
      let livePraccDelta = 0
      let liveListenDelta = 0
      let hasUnsavedLongSession = false
      if (pracman != null) {
        const liveInfo = Object.values(pracman._tracker)
          .map(channel => { return { token: channel.token, entry: channel.live.find(entry => entry.id === target.id) } })
          .find(info => info.entry != null)
        if (liveInfo != null) {
          livePraccDelta = Math.floor(Date.now() / 1000) - liveInfo.entry.since
          hasUnsavedLongSession = (livePraccDelta >= this._config.get('minimumSessionTimeToEarnToken'))
          if (RoomIdentifiers.timeBased.includes(liveInfo.token)) {
            const secondsSinceHourInterval = Math.floor(Date.now() / 1000) % 3600
            hasUnsavedLongSession &= (secondsSinceHourInterval >= this._config.get('minimumSessionTimeToEarnToken'))
          }
          if (this._config.get('enableTokenCollecting') && hasUnsavedLongSession) {
            if (!roomsSeen.includes(liveInfo.token)) {
              roomsSeen.push(liveInfo.token)
            }
          }
        } else {
          const liveListenInfo = Object.values(pracman._tracker)
            .map(channel => { return { pracker: channel.live[0], listener: channel.listening.find(entry => entry.id === target.id), token: channel.token } })
            .find(info => info.listener != null && info.pracker != null)
          if (liveListenInfo != null) {
            liveListenDelta = Math.floor(Date.now() / 1000) - Math.max(liveListenInfo.listener.since, liveListenInfo.pracker.since)
          }
        }
      }

      roomsSeen = roomsSeen.filter(token => !RoomIdentifiers.invisible.includes(token))
      if (RoomIdentifiers.timeBased.every(token => roomsSeen.includes(token))) {
        roomsSeen = roomsSeen.filter(token => !RoomIdentifiers.timeBased.includes(token))
      }

      if (roomsSeen.length === 0) {
        roomsSeen.push(':shrug:')
      }

      if (userRecord != null && userRecord.daily_reset_hour != null) {
        embed.addFields({ name: 'Daily Time', value: `\`${abbreviateTime((userRecord.daily_session_playtime || 0) + livePraccDelta)}\``, inline: true })
      }

      embed.addFields(
        { name: 'Weekly Time', value: `\`${abbreviateTime((userRecord.current_session_playtime || 0) + livePraccDelta)}\``, inline: true },
        { name: 'Overall Time', value: `\`${abbreviateTime((userRecord.overall_session_playtime || 0) + livePraccDelta)}\``, inline: true },
        { name: 'Listening Time', value: `\`${abbreviateTime((userRecord.listening_time || 0) + liveListenDelta)}\``, inline: true }
      )

      if (userRecord != null && userRecord.daily_reset_hour != null) {
        const dailyStreak = (userRecord.daily_streak || 0) + (userRecord.practiced_today || hasUnsavedLongSession ? 1 : 0)
        embed.addFields({ name: 'Daily Streak', value: `\`${dailyStreak}\``, inline: true })
      }

      const joinDate = target.joinedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      const isAnniversary = target.joinedAt.getMonth() === now.getMonth() && target.joinedAt.getDate() === now.getDate()
      embed.addFields(
        { name: this._config.get('statsAnniversaryLabel') || 'Pinanoversary', value: isAnniversary ? `${joinDate} 🎂` : joinDate, inline: true },
        { name: 'Tokens Earned', value: roomsSeen.join('') }
      )
      embed.setThumbnail(target.user.displayAvatarURL())

      if (badges != null) {
        const badgesCollection = badges.badgesForUser(userRecord, target, livePraccDelta)
        const badgesPerPage = this._config.get('badgesPerPage') || 12
        if (badgesCollection.length <= badgesPerPage) {
          embed.addFields({ name: 'Badges', value: badgesCollection.reduce((acc, badge) => `${acc}\n${badge}`, '') })
        } else {
          let page = 1
          const generatePageData = function () {
            let begin = (page - 1) * badgesPerPage
            let end = page * badgesPerPage
            if (end > badgesCollection.length) {
              end = badgesCollection.length
              begin = end - badgesPerPage
            }
            return badgesCollection.slice(begin, end).reduce((acc, badge) => `${acc}\n${badge}`, '')
          }

          embed.addFields({ name: 'Badges (use 🔼🔽 to scroll)', value: generatePageData() })
          const reacts = {
            '🔓': (_, helpers) => helpers.lock(),
            '❌': (_, helpers) => helpers.close(),
            '🔼': interaction => {
              --page
              if (page < 1) {
                page = 1
              }
              embed.spliceFields(embed.fields.length - 1, 1, {
                name: 'Badges (use 🔼🔽 to scroll)',
                value: generatePageData()
              })
              interaction.update({ embeds: [embed] })
            },
            '🔽': interaction => {
              ++page
              const totalPages = Math.ceil(badgesCollection.length / badgesPerPage)
              if (page > totalPages) {
                page = totalPages
              }
              embed.spliceFields(embed.fields.length - 1, 1, {
                name: 'Badges (use 🔼🔽 to scroll)',
                value: generatePageData()
              })
              interaction.update({ embeds: [embed] })
            }
          }

          return { embeds: [embed], reacts: reacts }
        }
      }

      return { embeds: [embed] }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enablePStats')) return
  return new Statistics(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
