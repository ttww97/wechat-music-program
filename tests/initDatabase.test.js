/**
 * initDatabase 云函数测试
 *
 * 业务规则：
 * 1. 仅管理员可调用
 * 2. 检查所有必要集合是否存在且可访问
 * 3. 返回每个集合的状态（记录数或 'empty'）
 */

const cloud = require('wx-server-sdk')
const { main } = require('../cloudfunctions/initDatabase/index')

const ADMIN_OPENID   = 'openid_admin'
const VISITOR_OPENID = 'openid_visitor'

describe('initDatabase 云函数', () => {

  test('非管理员调用 → 403', async () => {
    cloud.setup({ admins: [{ _id: 'a1', _openid: ADMIN_OPENID }] }, VISITOR_OPENID)
    const result = await main({})
    expect(result.code).toBe(403)
  })

  test('管理员调用 → 200，返回各集合状态', async () => {
    cloud.setup({
      admins: [{ _id: 'a1', _openid: ADMIN_OPENID }],
      users:         [{ _id: 'u1', _openid: 'x' }],
      jobs:          [{ _id: 'j1', status: 'active' }],
      comments:      [],
      conversations: [],
      messages:      [],
      notifications: [],
    }, ADMIN_OPENID)

    const result = await main({})
    expect(result.code).toBe(200)
    expect(result.data).toBeDefined()
  })

  test('返回数据包含所有必要集合名称', async () => {
    cloud.setup({ admins: [{ _id: 'a1', _openid: ADMIN_OPENID }] }, ADMIN_OPENID)
    const result = await main({})
    const collectionNames = result.data.map(c => c.name)
    const required = ['users', 'jobs', 'comments', 'conversations', 'messages', 'notifications']
    required.forEach(name => {
      expect(collectionNames).toContain(name)
    })
  })

  test('返回每个集合的记录数', async () => {
    cloud.setup({
      admins: [{ _id: 'a1', _openid: ADMIN_OPENID }],
      users:  [{ _id: 'u1' }, { _id: 'u2' }],
      jobs:   [{ _id: 'j1' }],
      comments: [],
    }, ADMIN_OPENID)

    const result = await main({})
    const usersStatus  = result.data.find(c => c.name === 'users')
    const jobsStatus   = result.data.find(c => c.name === 'jobs')
    const commentsStatus = result.data.find(c => c.name === 'comments')

    expect(usersStatus.count).toBe(2)
    expect(jobsStatus.count).toBe(1)
    expect(commentsStatus.count).toBe(0)
  })
})
