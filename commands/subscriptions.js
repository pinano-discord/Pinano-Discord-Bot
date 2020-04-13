const {
  memberFromQualifiedName,
  selfDestructMessage
} = require('./helpers')

async function subscribe (client, message) {
  const args = message.content.split(' ').splice(1)
  const subscribee = memberFromQualifiedName(args, message.guild.members)
  if (subscribee == null) {
    throw new Error('Must subscribe to a user!')
  }
  await client.subscriberManager.subscribe(message.author, subscribee)
  selfDestructMessage(() => message.reply(`subscribed to ${subscribee.username}`))
}

async function unsubscribe (client, message) {
  const args = message.content.split(' ').splice(1)
  const subscribee = memberFromQualifiedName(args, message.guild.members)
  if (subscribee == null) {
    throw new Error('Must unsubscribe to a user!')
  }
  await client.subscriberManager.unsubscribe(message.author, subscribee)
  selfDestructMessage(() => message.reply(`unsubscribed to ${subscribee.username}`))
}

module.exports = { subscribe, unsubscribe }
