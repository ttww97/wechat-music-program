// checkAuth 云函数
// AI生成：中央音乐学院实践平台MVP | 日期：2026-02-16
// 功能：校验用户认证状态

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  try {
    // 查询用户信息
    const userRes = await db.collection('users').where({
      _openid: openId
    }).get()

    if (userRes.data.length === 0) {
      return {
        code: 200,
        data: {
          isLoggedIn: false,
          user: null
        }
      }
    }

    const user = userRes.data[0]

    return {
      code: 200,
      data: {
        isLoggedIn: true,
        user: {
          _id: user._id,
          role: user.role,
          realName: user.realName,
          certStatus: user.certStatus,
          createTime: user.createTime
        }
      }
    }

  } catch (err) {
    console.error('checkAuth 异常', err)
    return {
      code: 500,
      msg: '服务器内部错误',
      error: err
    }
  }
}
