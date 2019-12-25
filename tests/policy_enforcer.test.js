const { PolicyEnforcer, RoomIdentifiers } = require('../library/policy_enforcer')

let policyEnforcer
beforeEach(() => {
  policyEnforcer = new PolicyEnforcer(console.log)
})

describe('RoomIdentifiers', () => {
  test('has room lists', () => {
    expect(RoomIdentifiers.original).not.toHaveLength(0)
    expect(RoomIdentifiers.onDemand).not.toHaveLength(0)
    expect(RoomIdentifiers.rare).not.toHaveLength(0)
  })
  test('has all meta property', () => {
    expect(RoomIdentifiers.all.length).toBeGreaterThan(RoomIdentifiers.original.length)
  })
})

describe('PolicyEnforcer', () => {
  test('can be constructed', () => {
    expect(policyEnforcer).not.toBeNull()
  })
})
