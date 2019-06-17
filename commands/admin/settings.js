module.exports.load = (client) => {
  client.commands['settings'] = {
    async run (message) {
      if (!message.member.roles.find(r => r.name === 'Bot Manager')) {
        return client.errorMessage(message, 'You require the bot manager role to use this command.')
      }

      return client.errorMessage(message, `This command has been retired; use \`${client.settings.prefix}rooms [ add | del | delete] <#CHANNEL_ID>\` to register and unregister practice channels.`)
    }
  }
}
