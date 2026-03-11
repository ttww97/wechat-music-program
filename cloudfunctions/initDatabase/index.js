// initDatabase 云函数
// 功能：检查数据库各集合是否存在并返回状态报告
// 安全：仅管理员可调用

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 本项目所有必须存在的集合
const REQUIRED_COLLECTIONS = [
  'users',
  'jobs',
  'comments',
  'conversations',
  'messages',
  'notifications',
  'admins'
]

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  // ── 1. 管理员鉴权 ─────────────────────────────────────────

  const adminRes = await db.collection('admins').where({ _openid: openId }).get()
  if (adminRes.data.length === 0) {
    return { code: 403, msg: '无管理员权限' }
  }

  // ── 2. 逐个检查集合状态（通过 count 获取记录数）────────────

  const results = await Promise.all(
    REQUIRED_COLLECTIONS.map(async (name) => {
      try {
        const countRes = await db.collection(name).get()
        return {
          name,
          count: countRes.data.length,
          status: 'ok'
        }
      } catch (err) {
        // 集合不存在或无权限访问
        return {
          name,
          count: 0,
          status: 'error',
          message: err.message || '集合不存在或无权限'
        }
      }
    })
  )

  return { code: 200, data: results }
}
