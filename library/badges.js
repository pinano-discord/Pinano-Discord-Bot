const moment = require('moment')
const { RoomIdentifiers } = require('../library/policy_enforcer')
const settings = require('../settings/settings.json')

function badgesForUser (userInfo, user, isPracticing) {
  const mem = userInfo.mem

  const now = moment().unix()
  let badges = ''

  if (user != null) {
    if (user.rooms_practiced != null) {
      if (_includesAll(user.rooms_practiced, RoomIdentifiers.original)) {
        if (_includesAll(user.rooms_practiced, RoomIdentifiers.onDemand)) {
          badges += ':medal: I\'ve practiced in all the practice rooms\n'
        } else {
          let badge = _pickRandomFromList(RoomIdentifiers.original)
          badges += `${badge} I've practiced in the original four practice rooms\n`
        }
      }

      if (_includesAll(user.rooms_practiced, RoomIdentifiers.rare)) {
        badges += ':airplane: I\'ve practiced all around the world\n'
      }

      if (_includesAll(user.rooms_practiced, RoomIdentifiers.christmas)) {
        badges += ':christmas_tree: [Practising knows no holiday](http://euge.ca/61)\n'
      }

      let fishBadgeAwarded = false
      if (user.rooms_practiced.includes('🐟')) {
        badges += ':fish: Never gonna give 魚 up\n'
        fishBadgeAwarded = true
      }

      if (_includesAll(user.rooms_practiced, RoomIdentifiers.rickroll)) {
        if (!fishBadgeAwarded) {
          badges += ':arrow_up: Never gonna give you :arrow_up:\n'
        }
        badges += ':arrow_down: Never gonna let you :arrow_down:\n'
        badges += ':person_running: Never gonna :person_running: around\n'
        badges += ':desert: And :desert: you\n'
      }
    }

    if (user.max_listeners >= 5) {
      badges += `:loudspeaker: I've had ${user.max_listeners} people listen to me in a practice room\n`
    }

    if (user.max_concurrent >= 10) {
      badges += `:sparkles: I've practiced concurrently with ${user.max_concurrent - 1} other people\n`
    }

    if (user.subscribers != null && user.subscribers.length > 0) {
      badges += `:ear: I have ${user.subscribers.length} subscriber${user.subscribers.length > 1 ? 's' : ''}\n`
    }

    if (user.max_twinning >= 2) {
      switch (user.max_twinning) {
        case 2:
          badges += `:dancers: I've been a practice twin\n`
          break
        case 3:
          badges += `:baby::baby::baby: I've been a practice triplet\n`
          break
        case 4:
          badges += `:baby::baby::baby::baby: I've been a practice quadruplet\n`
          break
        case 5:
          badges += `:baby::baby::baby::baby::baby: I've been a practice quintuplet\n`
          break
        case 6:
          badges += `:baby::baby::baby::baby::baby::baby: I've been a practice sextuplet\n`
          break
        case 7:
          badges += `:baby::baby::baby::baby::baby::baby::baby: I've been a practice septuplet\n`
          break
        case 8:
          badges += `:baby::baby::baby::baby::baby::baby::baby::baby: I've been a practice octuplet\n`
          break
        default:
          badges += `:baby::baby::baby::baby::baby::baby::baby::baby: I've been a practice octuplet\n`
          badges += `:hammer: I like trying to break Pinano Bot\n`
          break
      }
    }

    if (user.quiz_score >= 10) {
      badges += `:question: I've correctly answered ${user.quiz_score} riddles on [#🎶literature-quiz]` +
        '(https://discordapp.com/channels/188345759408717825/505872476903964674)\n'
    }

    if (user.riddles_solved >= 10) {
      badges += `:question: My riddles have been solved ${user.riddles_solved} times on [#🎶literature-quiz]` +
        '(https://discordapp.com/channels/188345759408717825/505872476903964674)\n'
    }

    if (user.recitals != null && user.recitals.length >= 3) {
      // one for each note in the emoji
      badges += `:notes: I've played in ${user.recitals.length} recitals\n`
    }

    if (isPracticing || now - user.last_practiced_time < 7 * 86400) {
      badges += ':calendar: I\'ve practiced within the last week\n'
    } else if (now - user.last_practiced_time < 30 * 86400) {
      badges += ':calendar: I\'ve practiced within the last thirty days\n'
    }
  }

  if (now * 1000 - mem.joinedTimestamp >= 88 * 86400 * 1000) {
    // join date is more than 88 days ago
    badges += ':musical_keyboard: I joined Pinano at least 88 days ago\n'
  }

  if (mem.roles.some(r => r.name === 'Hand Revealed')) {
    badges += ':hand_splayed: I\'ve revealed my hand on [#hand-reveals](https://discordapp.com/channels/188345759408717825/440705391454584834)\n'
  }

  if (settings.contributors.includes(mem.id)) {
    badges += ':robot: I\'ve contributed code to Pinano Bot on [GitHub](https://github.com/pinano-discord/Pinano-Discord-Bot)\n'
  }

  if (userInfo.overallSession >= 500 * 60 * 60) {
    badges += '<:FiveHundredHours:627099475701268480> I\'ve practiced for at least 500 hours\n'
  } else if (userInfo.overallSession >= 250 * 60 * 60) {
    badges += '<:TwoFiftyHours:627099476120829982> I\'ve practiced for at least 250 hours\n'
  } else if (userInfo.overallSession >= 100 * 60 * 60) {
    badges += '<:HundredHours:627099476078755850> I\'ve practiced for at least 100 hours\n'
  } else if (userInfo.overallSession >= 40 * 60 * 60) {
    badges += '<:FortyHours:627099475869171712> I\'ve practiced for at least 40 hours\n'
  }

  let effectiveName = ((mem.nickname == null) ? mem.user.username : mem.nickname).toLowerCase()
  if (effectiveName.endsWith('juice') || effectiveName.endsWith('juwuice')) {
    badges += ':tropical_drink: I miss minijuice\n'
  }

  // thanks for being an awesome tester, Sayee
  if (userInfo.mem.id === '151301657915817984') {
    badges += `:hammer: I like trying to break Pinano Bot\n`
  }

  if (badges === '') {
    badges = '<:wtf:593197993264414751> no badges yet!'
  }

  return badges
}

//
// Helper Functions
//
//
function _includesAll (list, members) {
  return members.every(m => list.includes(m))
}

function _pickRandomFromList (list) {
  return list[Math.floor(Math.random() * list.length)]
}

module.exports = { badgesForUser }
