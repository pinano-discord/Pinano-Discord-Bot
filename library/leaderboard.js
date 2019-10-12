const settings = require('../settings/settings.json')

class Leaderboard {
  constructor (repository, key) {
    this.repository = repository
    this.key = key
    this.resetPage()
    this.refresh(new Map())
  }

  // refresh the cache based on a pull from repository + provided liveness data
  async refresh (liveData) {
    this.cache = []
    let storedData = await this.repository.loadRowsWithNonZeroKeyValue(this.key)
    let pushed = new Set()
    storedData.forEach(row => {
      let totalTime = row[this.key]
      let liveTime = liveData.get(row.id)
      if (liveTime != null) {
        totalTime += liveTime
        pushed.add(row.id)
      }

      this.cache.push({ id: row.id, time: totalTime })
    })

    liveData.forEach((value, key) => {
      if (!pushed.has(key)) {
        this.cache.push({ id: key, time: value })
      }
    })

    this.cache.sort((a, b) => b.time - a.time)
  }

  resetPage () {
    this.page = 1
  }

  incrementPage () {
    this.page++
    this._checkPageOutOfRange()
  }

  decrementPage () {
    this.page--
    this._checkPageOutOfRange()
  }

  getPageData () {
    let begin = settings.leaderboard_size * (this.page - 1)
    let end = settings.leaderboard_size * this.page
    return { startRank: begin + 1, data: this.cache.slice(begin, end) }
  }

  _checkPageOutOfRange () {
    let totalPages = Math.ceil(this.cache.length / settings.leaderboard_size)
    if (this.page > totalPages) {
      this.page = totalPages
    }

    // in the post-reset case where lb is empty, this gets us onto page 1.
    if (this.page < 1) {
      this.page = 1
    }
  }
}

module.exports = Leaderboard
