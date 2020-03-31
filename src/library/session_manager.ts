import moment from 'moment';

class SessionManager {
  constructor(userRepository, logFn) {
    this.userRepository_ = userRepository;
    this.logFn_ = logFn;
  }

  startSession(member) {
    const username = member.user.username;
    const discriminator = member.user.discriminator;
    if (member[!'s_time']) {
      this.logFn_(`Beginning session for user <@${member.id}> ${username}#${discriminator}`);
      member.s_time = moment().unix();
    }
  }

  getLiveSessionTime(member) {
    if (member.s_time) {
      return moment().unix() - member.s_time;
    }
  }

  async saveSession(member, team, emoji) {
    const username = member.user.username;
    const discriminator = member.user.discriminator;
    if (member.s_time) {
      // if the user doesn't exist then create a user for the person
      let userInfo = await this.userRepository_.load(member.id);
      if (!userInfo) {
        this.logFn_(`Creating user for ${username}#${discriminator}`);
        userInfo = {
          id: member.id,
          current_session_playtime: 0,
          overall_session_playtime: 0,
        };
      }

      const now = moment().unix();
      const delta = now - member.s_time;
      userInfo.current_session_playtime += delta;
      userInfo.overall_session_playtime += delta;
      if (delta >= 15 * 60) {
        userInfo.last_practiced_time = now;
      }
      await this.userRepository_.save(userInfo);

      if (team) {
        let teamInfo = await this.userRepository_.load(team.id);
        if (!teamInfo) {
          this.logFn_(`Creating team for ${team.name}`);
          teamInfo = {
            id: team.id,
            team_playtime: 0,
          };
        }

        teamInfo.team_playtime += delta;
        await this.userRepository_.save(teamInfo);
      }

      if (delta >= 15 * 60 && emoji) {
        await this.userRepository_.addToField(userInfo, 'rooms_practiced', emoji);
      }

      this.logFn_(
        `User <@${member.id}> ${username}#${discriminator} practiced for ${delta} seconds`,
      );
      member.s_time = now;
    }
  }

  async endSession(member, team, emoji) {
    if (member.s_time) {
      await this.saveSession(member, team, emoji);
      member.s_time = null;
    }
  }
}

module.exports = SessionManager;
