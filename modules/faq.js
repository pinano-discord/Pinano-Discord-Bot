const MODULE_NAME = 'Frequently Asked Questions'

class FAQ {
  constructor (moduleManager, config) {
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager
  }

  resume () {
    const guild = this._moduleManager.getGuild()
    const dispatcher = this._moduleManager.getDispatcher()
    dispatcher.command('faq', guild.id, (authorMember, tokenized) => {
      if (tokenized[0] == null) {
        throw new Error(`Usage: \`${this._config.commandPrefix || 'p!'}faq KEYWORD\``)
      }

      if (this._config.get('faqEntries') == null) {
        throw new Error(`Could not find an FAQ entry for the keyword \`${tokenized[0]}\`.`)
      }

      const entry = this._config.get('faqEntries').find(entry => entry.tags.includes(tokenized[0].toLowerCase()))
      if (entry == null) {
        throw new Error(`Could not find an FAQ entry for the keyword \`${tokenized[0]}\`.`)
      }
      return {
        embed: {
          title: MODULE_NAME,
          description: `From ${this._config.get('faqSourceLink') || 'the FAQ'}:`,
          fields: [{
            name: entry.question,
            value: entry.answer
          }],
          color: this._config.get('embedColor') || 'DEFAULT',
          timestamp: new Date()
        }
      }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableFaq')) return
  return new FAQ(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
