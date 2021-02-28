const PeriodicBadges = {
  christmas: {
    config: 'collectionBadgeChristmas',
    isHappening: (current) => (current.getMonth() === 11 && current.getDate() >= 20)
  },
  halloween: {
    config: 'collectionBadgeHalloween',
    isHappening: (current) => (current.getMonth() === 9 && current.getDate() > 24)
  },
  rickroll: {
    config: 'collectionBadgeRickroll',
    isHappening: (current) => (current.getMonth() === 3 && current.getDate() <= 7)
  },
  valentines: {
    config: 'collectionBadgeValentines',
    isHappening: (current) => (
      current.getMonth() === 1 &&
      current.getDate() >= 13 &&
      current.getDate() < 20
    )
  },
  lunarNewYear: {
    config: 'collectionBadgeLunarNewYear',
    isHappening: (current) => {
      switch (current.getFullYear()) {
        case 2021:
          // 12 Feb - 26 Feb
          return current.getMonth() === 1 && current.getDate() >= 12 && current.getDate() <= 26
        case 2022:
          // 01 Feb - 15 Feb
          return current.getMonth() === 1 && current.getDate() >= 1 && current.getDate() <= 15
        case 2023:
          // 22 Jan - 5 Feb
          return (current.getMonth() === 0 && current.getDate() >= 22) || (current.getMonth() === 1 && current.getDate() <= 5)
        case 2024:
          // 10 Feb - 24 Feb
          return current.getMonth() === 1 && current.getDate() >= 10 && current.getDate() <= 24
        case 2025:
          // 29 Jan - 12 Feb
          return (current.getMonth() === 0 && current.getDate() >= 29) || (current.getMonth() === 1 && current.getDate() <= 12)
        case 2026:
          // 17 Feb - 3 Mar
          return (current.getMonth() === 1 && current.getDate() >= 17) || (current.getMonth() === 2 && current.getDate() <= 3)
        case 2027:
          // 6 Feb - 20 Feb
          return current.getMonth() === 1 && current.getDate() >= 6 && current.getDate() <= 20
        case 2028:
          // 26 Jan - 9 Feb
          return (current.getMonth() === 0 && current.getDate() >= 26) || (current.getMonth() === 1 && current.getDate() <= 9)
        case 2029:
          // 13 Feb - 27 Feb
          return current.getMonth() === 1 && current.getDate() >= 13 && current.getDate() <= 27
        case 2030:
          // 3 Feb - 17 Feb
          return current.getMonth() === 1 && current.getDate() >= 3 && current.getDate() <= 17
        default:
          // I hope I'm not still coding this thing by then
          return false
      }
    }
  }
}
Object.freeze(PeriodicBadges)

module.exports = PeriodicBadges
