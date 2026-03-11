/**
 * wx-server-sdk Mock
 *
 * 用于单元测试的云开发 SDK 模拟实现。
 * 此文件通过 Jest moduleNameMapper 替换 wx-server-sdk，
 * 所有云函数 require('wx-server-sdk') 都会得到此 mock。
 *
 * 使用方法（在测试文件的 beforeEach 中）：
 *   const cloud = require('wx-server-sdk')
 *   cloud.setup({ users: [...], jobs: [...] }, 'test_openid')
 */

// 可变的全局状态，在 beforeEach 中重置
const _state = {
  openId: 'mock_openid',
  data: {}        // 集合数据：{ collectionName: [documents] }
}

/**
 * 配置 mock 数据（在测试 beforeEach 中调用）
 * @param {Object} data - 初始数据，格式：{ collectionName: [docs] }
 * @param {string} openId - 当前调用者的 openid
 */
function setup(data = {}, openId = 'mock_openid') {
  _state.openId = openId
  _state.data = {}
  // 深拷贝，避免测试间数据污染
  Object.entries(data).forEach(([name, docs]) => {
    _state.data[name] = docs.map(doc => ({ ...doc }))
  })
}

/**
 * 获取集合的当前数据（用于测试断言：验证数据库是否正确写入）
 * @param {string} name - 集合名称
 * @returns {Array}
 */
function getCollectionData(name) {
  return _state.data[name] || []
}

// ===========================================================
// 内部 mock 逻辑
// ===========================================================

/**
 * 匹配单个字段的条件
 * 支持普通等值比较、数组包含检查（WeChat Cloud DB 特性）、以及命令运算符
 */
function matchCondition(itemVal, condition) {
  if (condition === undefined || condition === null) {
    return itemVal === condition
  }

  // 命令运算符：{ __t: 'neq'|'gt'|'lt'|'gte'|'lte'|'in', v: value }
  if (typeof condition === 'object' && condition !== null && '__t' in condition) {
    const { __t, v } = condition
    if (__t === 'neq') return itemVal !== v
    if (__t === 'gt')  return itemVal > v
    if (__t === 'lt')  return itemVal < v
    if (__t === 'gte') return itemVal >= v
    if (__t === 'lte') return itemVal <= v
    if (__t === 'in')  return Array.isArray(v) && v.includes(itemVal)
  }

  // 数组包含检查：WeChat Cloud DB 中 .where({arr: 'val'}) 匹配 arr 数组包含 'val'
  if (Array.isArray(itemVal) && typeof condition === 'string') {
    return itemVal.includes(condition)
  }

  return itemVal === condition
}

/**
 * 对一条文档执行多组 where 条件（AND 逻辑）
 */
function matchFilters(item, filters) {
  return filters.every(filter =>
    Object.entries(filter).every(([key, val]) => matchCondition(item[key], val))
  )
}

/**
 * 创建集合的链式查询对象（每次 collection() 调用返回新链，互不干扰）
 */
function createChain(name) {
  const filters = []  // 当前链的 where 条件

  const chain = {
    // --- 链式方法（返回 this 以支持链式调用）---
    where(conditions) {
      filters.push(conditions)
      return chain
    },
    orderBy() { return chain },
    skip()    { return chain },
    limit()   { return chain },

    // --- 查询方法 ---
    async get() {
      const items = _state.data[name] || []
      return { data: items.filter(item => matchFilters(item, filters)) }
    },

    async count() {
      const items = _state.data[name] || []
      return { total: items.filter(item => matchFilters(item, filters)).length }
    },

    // --- 文档级操作 ---
    doc(id) {
      return {
        async get() {
          const items = _state.data[name] || []
          const item = items.find(d => d._id === id)
          if (!item) throw Object.assign(new Error('record not found'), { errCode: -502005 })
          return { data: item }
        },

        async update({ data: updateData }) {
          const items = _state.data[name] || []
          const idx = items.findIndex(d => d._id === id)
          if (idx >= 0) {
            items[idx] = { ...items[idx], ...updateData }
            return { stats: { updated: 1 } }
          }
          return { stats: { updated: 0 } }
        }
      }
    },

    // --- 集合级写操作 ---
    async add({ data: newData }) {
      if (!_state.data[name]) _state.data[name] = []
      const id = 'mock_' + name + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
      const doc = { ...newData, _id: id, _openid: _state.openId }
      _state.data[name].push(doc)
      return { _id: id }
    },

    async update({ data: updateData }) {
      const items = _state.data[name] || []
      let updated = 0
      items.forEach((item, i) => {
        if (matchFilters(item, filters)) {
          items[i] = { ...item, ...updateData }
          updated++
        }
      })
      return { stats: { updated } }
    }
  }

  return chain
}

// ===========================================================
// Mock 数据库对象（唯一实例，通过 _state 动态读取数据）
// ===========================================================
const db = {
  collection: (name) => createChain(name),

  // serverDate 返回固定时间（方便断言）
  serverDate: () => new Date('2026-03-11T00:00:00Z'),

  // 命令运算符
  command: {
    eq:  (v)   => v,                           // 等值（默认就是等值）
    neq: (v)   => ({ __t: 'neq', v }),
    gt:  (v)   => ({ __t: 'gt',  v }),
    lt:  (v)   => ({ __t: 'lt',  v }),
    gte: (v)   => ({ __t: 'gte', v }),
    lte: (v)   => ({ __t: 'lte', v }),
    in:  (arr) => ({ __t: 'in',  v: arr }),
    elemMatch: (v) => v  // 简化：elemMatch 在 mock 中不做深层匹配
  }
}

// ===========================================================
// Mock cloud 对象（drop-in 替代 wx-server-sdk）
// ===========================================================
const cloud = {
  init: () => {},  // no-op
  DYNAMIC_CURRENT_ENV: 'test_env',

  // 返回调用者的 openid（从 _state 读取，可被 setup() 修改）
  getWXContext: () => ({
    OPENID:  _state.openId,
    APPID:   'mock_appid',
    UNIONID: 'mock_unionid'
  }),

  // 始终返回同一个 db 对象（db.collection() 动态读取 _state）
  database: () => db,

  // 供测试文件调用的配置接口
  setup,
  getCollectionData
}

module.exports = cloud
