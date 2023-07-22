const MODULE_NAME = 'Frequently Asked Questions'

class FAQ {
  constructor (moduleManager, config) {
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager
  }

  resume () {
    const guild = this._moduleManager.getGuild()
    const dispatcher = this._moduleManager.getDispatcher()
    dispatcher.command('faq', guild.id, (message, tokenized) => {
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
      const fields = []
      if (entry.answer.length > 1024) {
        // Split up the answer into different fields
        const paragraphs = entry.answer.split('\n\n')
        fields.push({
          name: entry.question,
          value: paragraphs[0]
        })
        for (let i = 1; i < paragraphs.length; ++i) {
          fields.push({
            name: '\u200B',
            value: paragraphs[i]
          })
        }
      } else {
        fields.push({
          name: entry.question,
          value: entry.answer
        })
      }
      return {
        embeds: [{
          title: MODULE_NAME,
          description: `From ${this._config.get('faqSourceLink') || 'the FAQ'}:`,
          fields: fields,
          color: this._config.get('embedColor') || 0,
          timestamp: new Date()
        }]
      }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableFaq')) return
  return new FAQ(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
