module.exports.load = (client) => {
  client.commands['leaderboard'] = {
    run (message) {
      let args = message.content.split(' ').splice(1)
      switch (args[0]) {
        case 'overall':
          client.getOverallLeaderboard(message, data => {
            let msg = new client.discord.RichEmbed()
            msg.setTitle('Overall Leaderboard')
            msg.setDescription(data)
            msg.setColor(client.settings.embed_color)
            msg.setFooter(`To view the weekly leaderboard use ${client.settings.prefix}leaderboard weekly`)
            msg.setTimestamp()
            message.channel.send(msg)
              .then(m => {
                setTimeout(() => {
                  m.delete()
                }, client.settings.res_destruct_time * 1000)
              })
          })

          break

        case 'weekly': // fall through because by default we get weekly LB.
        default:
          client.getWeeklyLeaderboard(message, data => {
            let msg = new client.discord.RichEmbed()
            msg.setTitle('Weekly Leaderboard')
            msg.setDescription(data)
            msg.setFooter(`To view the overall leaderboard use ${client.settings.prefix}leaderboard overall`)
            msg.setColor(client.settings.embed_color)
            msg.setTimestamp()
            message.channel.send(msg)
              .then(m => {
                setTimeout(() => {
                  m.delete()
                }, client.settings.res_destruct_time * 1000)
              })
          })
      }
    }
  }
}
