// submitComment 云函数
// AI生成：中央音乐学院实践平台MVP | 日期：2026-02-16
// 功能：提交评论（仅认证学生可操作）

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  
  const { jobId, rating, content } = event

  // 参数校验
  if (!jobId || !rating || !content) {
    return {
      code: 400,
      msg: '缺少必要参数'
    }
  }

  if (rating < 1 || rating > 5) {
    return {
      code: 400,
      msg: '评分必须在1-5之间'
    }
  }

  if (content.trim().length < 10) {
    return {
      code: 400,
      msg: '评论内容至少10个字'
    }
  }

  try {
    // 1. 校验用户认证状态
    const userRes = await db.collection('users').where({
      _openid: openId
    }).get()

    if (userRes.data.length === 0) {
      return {
        code: 401,
        msg: '用户未登录'
      }
    }

    const user = userRes.data[0]

    // 仅认证学生可评论
    if (user.role !== 'student') {
      return {
        code: 403,
        msg: '仅学生可以评论'
      }
    }

    if (user.certStatus !== 'approved') {
      return {
        code: 403,
        msg: '请先完成学生认证'
      }
    }

    // 2. 检查是否已评论过该需求
    const existComment = await db.collection('comments').where({
      jobId: jobId,
      _openid: openId
    }).get()

    if (existComment.data.length > 0) {
      return {
        code: 400,
        msg: '您已评论过该需求'
      }
    }

    // 3. 提交评论
    const result = await db.collection('comments').add({
      data: {
        jobId: jobId,
        userId: user._id,
        userName: user.realName || '匿名用户',
        rating: rating,
        content: content.trim(),
        status: 'pending', // 待管理员审核
        createTime: db.serverDate()
      }
    })

    return {
      code: 200,
      msg: '评论提交成功，待审核',
      data: {
        commentId: result._id
      }
    }

  } catch (err) {
    console.error('submitComment 异常', err)
    return {
      code: 500,
      msg: '服务器内部错误',
      error: err
    }
  }
}
