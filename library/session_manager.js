const moment = require('moment')

class SessionManager {
  constructor (userRepository, logFn) {
    this.userRepository_ = userRepository
    this.logFn_ = logFn
  }

  startSession (member) {
    let username = member.user.username
    let discriminator = member.user.discriminator
    if (member.s_time == null) {
      this.logFn_(`Beginning session for user <@${member.id}> ${username}#${discriminator}`)
      member.s_time = moment().unix()
    }
  }

  getLiveSessionTime (member) {
    if (member.s_time != null) {
      return moment().unix() - member.s_time
    }
  }

  async saveSession (member, team) {
    let username = member.user.username
    let discriminator = member.user.discriminator
    if (member.s_time != null) {
      // if the user doesn't exist then create a user for the person
      let userInfo = await this.userRepository_.load(member.id)
      if (userInfo == null) {
        this.logFn_(`Creating user for ${username}#${discriminator}`)
        userInfo = {
          'id': member.id,
          'current_session_playtime': 0,
          'overall_session_playtime': 0
        }
      }

      const now = moment().unix()
      const delta = now - member.s_time
      userInfo.current_session_playtime += delta
      userInfo.overall_session_playtime += delta
      await this.userRepository_.save(userInfo)

      if (team != null) {
        let teamInfo = await this.userRepository_.load(team.id)
        if (teamInfo == null) {
          this.logFn_(`Creating team for ${team.name}`)
          teamInfo = {
            'id': team.id,
            'team_playtime': 0
          }
        }

        teamInfo.team_playtime += delta
        await this.userRepository_.save(teamInfo)
      }

      this.logFn_(`User <@${member.id}> ${username}#${discriminator} practiced for ${delta} seconds`)
      member.s_time = now
    }
  }

  async endSession (member, team) {
    if (member.s_time != null) {
      await this.saveSession(member, team)
      member.s_time = null
    }
  }
}

module.exports = SessionManager
