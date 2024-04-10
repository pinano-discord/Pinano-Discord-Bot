class Leaderboard {
  constructor (repository, key, pageLength, title, timeTracked) {
    this.title = title

    this._repository = repository
    this._key = key
    this._pageLength = pageLength
    this._timeTracked = timeTracked
    this.resetPage()
    this.refresh()
  }

  // refresh the cache based on a pull from repository + provided liveness data
  async refresh (liveData = new Map(), filter = _ => true) {
    const storedData = await this._repository.loadPositive(this._key)
    const pushed = new Set()
    this._cache = []
    storedData.forEach(row => {
      if (!filter(row.id)) return

      let totalTime = row[this._key]
      const liveTime = liveData.get(row.id)
      if (liveTime != null) {
        totalTime += liveTime
        pushed.add(row.id)
      }

      this._cache.push({ id: row.id, time: totalTime })
    })

    liveData.forEach((value, key) => {
      if (!filter(key)) return
      if (!pushed.has(key)) {
        this._cache.push({ id: key, time: value })
      }
    })

    this._cache.sort((a, b) => b.time - a.time)
  }

  resetPage () {
    this._page = 1
  }

  incrementPage () {
    ++this._page
    this._checkPageOutOfRange()
  }

  decrementPage () {
    --this._page
    this._checkPageOutOfRange()
  }

  getPageData () {
    const begin = this._pageLength * (this._page - 1)
    const end = this._pageLength * this._page
    return { startRank: begin + 1, data: this._cache.slice(begin, end), formatAsTime: this._timeTracked }
  }

  endPage () {
    this._page = Math.ceil(this._cache.length / this._pageLength)
  }

  _checkPageOutOfRange () {
    const totalPages = Math.ceil(this._cache.length / this._pageLength)
    if (this._page > totalPages) {
      this._page = totalPages
    }

    // in the post-reset case where lb is empty, this gets us onto page 1.
    if (this._page < 1) {
      this._page = 1
    }
  }
}

module.exports = Leaderboard
