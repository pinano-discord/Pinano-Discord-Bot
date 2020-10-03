const util = require('../library/util')

const MODULE_NAME = 'Subscriptions'

class Subscriptions {
  constructor (moduleManager) {
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager
  }

  resume () {
    const guild = this._moduleManager.getGuild()
    const userRepository = this._moduleManager.getPersistence().getUserRepository(guild.id)
    const policyEnforcer = this._moduleManager.getModule('Policy Enforcer')
    const dispatcher = this._moduleManager.getDispatcher()
    if (policyEnforcer == null) {
      throw new Error('Subscriptions are enabled, but there is no policy enforcer to distribute lock notifications.')
    }

    policyEnforcer.on('lockPracticeRoom', async (userId, name) => {
      const user = await userRepository.get(userId)
      if (user == null || user.subscribers == null || user.subscription_status === 'silent' || user.subscription_status === 'off') {
        return
      }

      // don't send more than one notification in an hour
      const currentTime = Math.floor(Date.now() / 1000)
      if (currentTime - user.last_subscriber_notification < (this._config.get('subscriberSuppressionDelay') || 3600)) {
        return
      }

      for (const id of user.subscribers) {
        const subscriber = guild.member(id)
        if (subscriber != null) {
          subscriber.send(`${name} just started practicing! Use the \`${this._config.get('commandPrefix') || 'p!'}unsubscribe\` command to stop receiving these notifications.`)
            .catch(err => {
              util.log(`Failed to notify ${id} from subscription to ${userId}: ${err.message} This message is safe to ignore.`)
            })
        }
      }

      userRepository.setField(userId, 'last_subscriber_notification', currentTime)
    })

    dispatcher.command('subscribe', guild.id, async (authorMember, tokenized) => {
      const fullyQualifiedName = tokenized.join(' ').trim()
      const member = util.resolveUntaggedMember(guild, fullyQualifiedName)
      if (member.id === authorMember.id) {
        throw new Error('Now, that would be a bit pointless, wouldn\'t it?')
      }

      if (member.user.bot) {
        throw new Error('When the bots take over, you\'ll be the first to know about it.')
      }

      const userRecord = await userRepository.get(member.id)
      if (userRecord != null && userRecord.subscription_status === 'off') {
        throw new Error(`<@${member.id}> has disabled subscriptions.`)
      }

      util.log(`${authorMember.id} subscribing to ${member.id}`)
      // TODO: check if the subscriber is DM-able before agreeing to DM them
      userRepository.addToSet(member.id, 'subscribers', authorMember.id)
      return {
        embed: {
          title: MODULE_NAME,
          description: `Subscribed to <@${member.id}>.`,
          color: this._config.get('embedColor') || 'DEFAULT',
          timestamp: new Date()
        }
      }
    })

    dispatcher.command('unsubscribe', guild.id, (authorMember, tokenized) => {
      const fullyQualifiedName = tokenized.join(' ').trim()
      const member = util.resolveUntaggedMember(guild, fullyQualifiedName)

      util.log(`${authorMember.id} unsubscribing from ${member.id}`)
      userRepository.removeFromSet(member.id, 'subscribers', authorMember.id)
      return {
        embed: {
          title: MODULE_NAME,
          description: `Unsubscribed from <@${member.id}>.`,
          color: this._config.get('embedColor') || 'DEFAULT',
          timestamp: new Date()
        }
      }
    })

    dispatcher.command('subscribers', guild.id, (authorMember, tokenized) => {
      const USAGE = `${this._config.get('commandPrefix') || 'p!'}subscribers [ on | off | silent ]`
      util.requireParameterCount(tokenized, 1, USAGE)
      switch (tokenized[0]) {
        case 'on':
          userRepository.setField(authorMember.id, 'subscription_status', 'on')
          return {
            embed: {
              title: MODULE_NAME,
              description: `Subscriptions are enabled for <@${authorMember.id}>.`,
              color: this._config.get('embedColor') || 'DEFAULT',
              timestamp: new Date()
            }
          }
        case 'off':
          userRepository.setField(authorMember.id, 'subscription_status', 'off')
          return {
            embed: {
              title: MODULE_NAME,
              description: `Subscriptions are disabled for <@${authorMember.id}>.`,
              color: this._config.get('embedColor') || 'DEFAULT',
              timestamp: new Date()
            }
          }
        case 'silent':
          userRepository.setField(authorMember.id, 'subscription_status', 'silent')
          return {
            embed: {
              title: MODULE_NAME,
              description: `<@${authorMember.id}>'s subscribers will not be notified.`,
              color: this._config.get('embedColor') || 'DEFAULT',
              timestamp: new Date()
            }
          }
        default:
          throw new Error(`Usage: \`${USAGE}\``)
      }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableSubscriptions')) return
  return new Subscriptions(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
