class Leaderboard {
  constructor (repository, key, pageLength) {
    this.repository_ = repository
    this.key_ = key
    this.pageLength_ = pageLength
    this.resetPage()
    this.refresh(new Map())
  }

  // refresh the cache based on a pull from repository + provided liveness data
  async refresh (liveData) {
    let storedData = await this.repository_.loadRowsWithNonZeroKeyValue(this.key_)
    let pushed = new Set()
    this.cache_ = []
    storedData.forEach(row => {
      let totalTime = row[this.key_]
      let liveTime = liveData.get(row.id)
      if (liveTime != null) {
        totalTime += liveTime
        pushed.add(row.id)
      }

      this.cache_.push({ id: row.id, time: totalTime })
    })

    liveData.forEach((value, key) => {
      if (!pushed.has(key)) {
        this.cache_.push({ id: key, time: value })
      }
    })

    this.cache_.sort((a, b) => b.time - a.time)
  }

  resetPage () {
    this.page_ = 1
  }

  incrementPage () {
    this.page_++
    this._checkPageOutOfRange()
  }

  decrementPage () {
    this.page_--
    this._checkPageOutOfRange()
  }

  getPageData () {
    let begin = this.pageLength_ * (this.page_ - 1)
    let end = this.pageLength_ * this.page_
    return { startRank: begin + 1, data: this.cache_.slice(begin, end) }
  }

  _checkPageOutOfRange () {
    let totalPages = Math.ceil(this.cache_.length / this.pageLength_)
    if (this.page_ > totalPages) {
      this.page_ = totalPages
    }

    // in the post-reset case where lb is empty, this gets us onto page 1.
    if (this.page_ < 1) {
      this.page_ = 1
    }
  }
}

module.exports = Leaderboard
