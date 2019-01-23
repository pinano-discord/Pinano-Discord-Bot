module.exports.load = (client) => {
    client.commands['eval'] = {
        run(message){
            if(client.settings.bot_devs.includes(message.author.id)){
                const args = message.content.split(" ").slice(1);
                const clean = text => {
                    if (typeof(text) === "string")
                      return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
                    else
                        return text;
                  }
                try {
                  const code = args.join(" ")
                  let evaled = eval(code)
                  if (typeof evaled !== "string")
                    evaled = require("util").inspect(evaled)
                  message.channel.send(clean(evaled), {code:"xl"})
                } catch (err) {
                  message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``)
                }
            } else {
                message.reply('You must be a developer to use this.').catch(e => client.cannon.fire('Error sending message.'))
            }
        }
    }
}