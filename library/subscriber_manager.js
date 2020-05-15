const settings = require('../settings/settings.json')

class SubscriberManager {
  constructor (client, userRepository) {
    this.client_ = client
    this.userRepository_ = userRepository
  }

  async notify (member) {
    const user = await this.userRepository_.load(member.id)
    for (const subId of user.subscribers) {
      const sub = this.client_.users.get(subId)
      sub.send(`${member.user.username} just started practicing! Use the ${settings.prefix}unsubscribe command to stop receiving these notifications`)
    }
  }

  async subscribe (subscriber, subscribee) {
    const user = await this.userRepository_.load(subscribee.id)
    this.client_.log(`${subscriber.id} subscribing to ${user.id} ${subscribee.id}`)
    return this.userRepository_.addToField(user, 'subscribers', subscriber.id)
  }

  async unsubscribe (subscriber, subscribee) {
    const user = await this.userRepository_.load(subscribee.id)
    this.client_.log(`${subscriber.id} unsubscribing to ${user.id}`)
    return this.userRepository_.removeFromField(user, 'subscribers', subscriber.id)
  }
}

module.exports = SubscriberManager
