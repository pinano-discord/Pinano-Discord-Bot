const Leaderboard = require('./leaderboard')

class MockRepository {
  loadPositive (keyName) {
    if (keyName === 'key_column') {
      return [
        { id: '35035', key_column: 3500, not_key_column: 0 },
        { id: '22022', key_column: 5000, not_key_column: 10000 },
        { id: '33033', key_column: 4000, not_key_column: 4000 },
        { id: '10010', key_column: 1000, not_key_column: 6000 },
        { id: '99099', key_column: 2000, not_key_column: 2500 },
        { id: '80080', key_column: 2500, not_key_column: 9999 },
        { id: '75075', key_column: 9999, not_key_column: 9999 },
        { id: '11011', key_column: 9998, not_key_column: 9999 },
        { id: '55055', key_column: 5555, not_key_column: 6789 },
        { id: '70070', key_column: 5555, not_key_column: 9876 },
        { id: '74074', key_column: 1111, not_key_column: 3000 }
      ]
    }
  }
}

function verifyPage (page, startRank, length, maxValue = 0) {
  expect(page.startRank).toBe(startRank)
  expect(page.data.length).toBe(length)
  if (maxValue !== 0) { expect(page.data[0].time).toBeLessThanOrEqual(maxValue) }
  for (let i = 0; i < length - 1; i++) {
    expect(page.data[i].time).toBeGreaterThanOrEqual(page.data[i + 1].time)
  }
  expect(page.data[length - 1].time).toBeGreaterThan(0)
}

let lb
beforeEach(async () => {
  lb = new Leaderboard(new MockRepository(), 'key_column', /* pageLength */ 4)
})

test('no data results in empty leaderboard', async () => {
  lb._repository.loadPositive = async (keyName) => {
    return []
  }

  await lb.refresh(new Map())

  const page = lb.getPageData()
  expect(page.startRank).toBe(1)
  expect(page.data.length).toBe(0)

  lb.incrementPage()
  expect(lb.getPageData().startRank).toBe(1)
})

test('single entry in storage', async () => {
  lb._repository.loadPositive = async (keyName) => {
    return [{ id: '12345', key_column: 3456, not_key_column: 3333 }]
  }

  await lb.refresh(new Map())

  const page = lb.getPageData()
  expect(page.data.length).toBe(1)
  expect(page.data[0]).toStrictEqual({ id: '12345', time: 3456 })
})

test('single entry in live data', async () => {
  lb._repository.loadPositive = async (keyName) => {
    return []
  }

  await lb.refresh(new Map([
    ['12345', 10000]
  ]))

  const page = lb.getPageData()
  expect(page.data.length).toBe(1)
  expect(page.data[0]).toStrictEqual({ id: '12345', time: 10000 })
})

test('entries with same id merge', async () => {
  lb._repository.loadPositive = async (keyName) => {
    return [{ id: '12345', key_column: 3456, not_key_column: 3333 }]
  }

  await lb.refresh(new Map([
    ['12345', 10000]
  ]))

  const page = lb.getPageData()
  expect(page.data.length).toBe(1)
  expect(page.data[0]).toStrictEqual({ id: '12345', time: 13456 })
})

test('entries with different ids do not merge', async () => {
  lb._repository.loadPositive = async (keyName) => {
    return [{ id: '12345', key_column: 3456, not_key_column: 3333 }]
  }

  await lb.refresh(new Map([
    ['54321', 10000]
  ]))

  const page = lb.getPageData()
  expect(page.data.length).toBe(2)
  expect(page.data[0]).toStrictEqual({ id: '54321', time: 10000 })
  expect(page.data[1]).toStrictEqual({ id: '12345', time: 3456 })
})

test('can scroll through pages and whole leaderboard is sorted', async () => {
  let page = lb.getPageData()
  verifyPage(page, /* startRank */ 1, /* length */ 4)
  let lastTime = page.data[3].time

  lb.incrementPage()
  page = lb.getPageData()
  verifyPage(page, /* startRank */ 5, /* length */ 4, lastTime)
  lastTime = page.data[3].time

  lb.incrementPage()
  page = lb.getPageData()
  verifyPage(page, /* startRank */ 9, /* length */ 3, lastTime)
})

test('no blank pages when evenly divided', async () => {
  lb._pageLength = 11
  const page = lb.getPageData()
  expect(page.startRank).toBe(1)
  expect(page.data.length).toBe(11)

  // go to the next page, should get the same page
  lb.incrementPage()
  expect(lb.getPageData().startRank).toBe(1)
})

test('no stored data results in live times only', async () => {
  lb._repository.loadPositive = async (keyName) => {
    return []
  }

  // keep these values < 1000
  await lb.refresh(new Map([
    ['33033', 246],
    ['22222', 135],
    ['44444', 567],
    ['55555', 900],
    ['11011', 111],
    ['12345', 123]
  ]))

  let page = lb.getPageData()
  verifyPage(page, /* startRank */ 1, /* length */ 4, 999)
  const lastTime = page.data[3].time

  lb.incrementPage()
  page = lb.getPageData()
  verifyPage(page, /* startRank */ 5, /* length */ 2, lastTime)
})

test('new live times add new entries and pages to leaderboard', async () => {
  await lb.refresh(new Map([
    ['33033', 246],
    ['22222', 135], // new
    ['44444', 567], // new
    ['55555', 900], // new
    ['11011', 111],
    ['12345', 123] // new
  ]))

  let page = lb.getPageData()
  verifyPage(page, /* startRank */ 1, /* length */ 4)
  let lastTime = page.data[3].time

  lb.incrementPage()
  page = lb.getPageData()
  verifyPage(page, /* startRank */ 5, /* length */ 4, lastTime)
  lastTime = page.data[3].time

  lb.incrementPage()
  page = lb.getPageData()
  verifyPage(page, /* startRank */ 9, /* length */ 4, lastTime)
  lastTime = page.data[3].time

  lb.incrementPage()
  page = lb.getPageData()
  verifyPage(page, /* startRank */ 13, /* length */ 3, lastTime)
})

test('no blank pages when live entries cause even page divisions', async () => {
  await lb.refresh(new Map([
    ['33033', 246],
    ['22222', 135] // new
  ]))

  lb._page = 3
  const page = lb.getPageData()
  verifyPage(page, /* startRank */ 9, /* length */ 4)

  lb.incrementPage()
  expect(lb.getPageData().startRank).toBe(9)
})

test('live times cause ranking changes', async () => {
  await lb.refresh(new Map([
    ['55055', 10000]
  ]))

  const page = lb.getPageData()
  expect(page.data[0]).toStrictEqual({ id: '55055', time: 15555 })
  expect(page.data[1]).toStrictEqual({ id: '75075', time: 9999 })
})

test('live times cause ranking changes across page boundaries', async () => {
  await lb.refresh(new Map([
    ['99099', 3001],
    ['35035', 250],
    ['80080', 100]
  ]))

  lb._page = 2
  let page = lb.getPageData()
  expect(page.data[0]).toStrictEqual({ id: '99099', time: 5001 })
  expect(page.data[1]).toStrictEqual({ id: '22022', time: 5000 })
  expect(page.data[3]).toStrictEqual({ id: '35035', time: 3750 })

  lb.incrementPage()
  page = lb.getPageData()
  expect(page.data[0]).toStrictEqual({ id: '80080', time: 2600 })
  expect(page.data[1]).toStrictEqual({ id: '74074', time: 1111 })
})

test('new live times cause ranking changes', async () => {
  await lb.refresh(new Map([
    ['77777', 50000],
    ['98765', 40000],
    ['00100', 6000],
    ['55055', 1000] // existing
  ]))

  let page = lb.getPageData()
  expect(page.data[0]).toStrictEqual({ id: '77777', time: 50000 })
  expect(page.data[1]).toStrictEqual({ id: '98765', time: 40000 })
  expect(page.data[2]).toStrictEqual({ id: '75075', time: 9999 })

  lb.incrementPage()
  page = lb.getPageData()
  expect(page.data[0]).toStrictEqual({ id: '55055', time: 6555 })
  expect(page.data[1]).toStrictEqual({ id: '00100', time: 6000 })
  expect(page.data[2]).toStrictEqual({ id: '70070', time: 5555 })
})

test('data from subsequent refresh is used', async () => {
  await lb.refresh(new Map([
    ['40004', 40000],
    ['50005', 50000]
  ]))

  let page = lb.getPageData()
  expect(page.data[0]).toStrictEqual({ id: '50005', time: 50000 })
  expect(page.data[1]).toStrictEqual({ id: '40004', time: 40000 })

  await lb.refresh(new Map([
    ['40004', 56789]
  ]))

  page = lb.getPageData()
  expect(page.data[0]).toStrictEqual({ id: '40004', time: 56789 })
  expect(page.data[1]).toStrictEqual({ id: '75075', time: 9999 })
})

test('weekly reset scenario', async () => {
  await lb.refresh(new Map([
    ['99099', 3001],
    ['35035', 250],
    ['80080', 100]
  ]))

  expect(lb.getPageData().data.length).toBe(4)

  lb._repository.loadPositive = async (keyName) => {
    return []
  }

  await lb.refresh(new Map([
    ['99099', 3101],
    ['35035', 350],
    ['80080', 200]
  ]))

  const page = lb.getPageData()
  expect(page.data.length).toBe(3)
  expect(page.data[0]).toStrictEqual({ id: '99099', time: 3101 })
  expect(page.data[1]).toStrictEqual({ id: '35035', time: 350 })
  expect(page.data[2]).toStrictEqual({ id: '80080', time: 200 })
})

test('reset page resets to first page', async () => {
  lb.page_ = 2
  lb.resetPage()
  expect(lb._page).toBe(1)
})

test('cannot decrement past page 1', async () => {
  lb.resetPage()
  lb.decrementPage()
  expect(lb._page).toBe(1)
})

test('cannot increment past last page', async () => {
  lb.page_ = 3
  lb.incrementPage()
  expect(lb.page_).toBe(3)
})
