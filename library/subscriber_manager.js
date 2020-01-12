class SubscriberManager {
  constructor (client, sessionManager, userRepository) {
    this.client_ = client
    this.sessionManager_ = sessionManager
    this.userRepository_ = userRepository

    this.sessionManager_.on('startPractice', (member) => this.handleStartPractice(member))
  }

  async handleStartPractice (member) {
    const user = await this.userRepository_.load(member.id)
    for (const subId of user.subscribers) {
      const sub = this.client_.users.get(subId)
      sub.send(`${member.user.username} just started practicing!`)
    }
  }

  async subscribe (subscriber, subscribee) {
    const user = await this.userRepository_.load(subscribee.id)
    this.client.log(`${subscriber.id} subscribing to ${user.id} ${subscribee.id}`)
    return this.userRepository_.addToField(user, 'subscribers', subscriber.id)
  }

  async unsubscribe (subscriber, subscribee) {
    const user = await this.userRepository_.load(subscribee.id)
    this.client.log(`${subscriber.id} unsubscribing to ${user.id}`)
    return this.userRepository_.removeFromField(user, 'subscribers', subscriber.id)
  }
}

module.exports = SubscriberManager
