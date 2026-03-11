// getComments 云函数
// 功能：获取指定需求的已审核评论列表（含平均评分）

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { jobId, page = 0, pageSize = 10 } = event

  if (!jobId) {
    return { code: 400, msg: '缺少参数 jobId' }
  }

  try {
    // 只查已审核通过的评论（approved），pending/rejected 对普通用户不可见
    const commentsRes = await db.collection('comments')
      .where({ jobId, status: 'approved' })
      .orderBy('createTime', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()

    const comments = commentsRes.data

    // 计算总数（不受分页影响）
    const allApprovedRes = await db.collection('comments')
      .where({ jobId, status: 'approved' })
      .get()

    const total = allApprovedRes.data.length

    // 计算平均评分（精确到一位小数）
    const avgRating = total === 0
      ? 0
      : Math.round(
          allApprovedRes.data.reduce((sum, c) => sum + (c.rating || 0), 0) / total * 10
        ) / 10

    return {
      code: 200,
      data: {
        comments,
        total,
        avgRating,
        hasMore: (page + 1) * pageSize < total
      }
    }

  } catch (err) {
    console.error('getComments 异常', err)
    return { code: 500, msg: '服务器内部错误', error: err }
  }
}
