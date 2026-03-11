// submitComment 云函数
// 功能：提交评论（仅已认证音乐人才可操作）
// 修改记录：
//   2026-02-16 - 初始版本
//   2026-03-11 - 修复：同时支持新字段(isTalent/talentCertStatus)和旧字段(role/certStatus)

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  const { jobId, rating, content } = event

  // ── 1. 参数校验 ──────────────────────────────────────────────

  // 注意：rating=0 为无效值但不算"缺少"，用 == null 判断是否未传
  if (!jobId || rating == null || !content) {
    return { code: 400, msg: '缺少必要参数（需要 jobId、rating、content）' }
  }

  if (rating < 1 || rating > 5) {
    return { code: 400, msg: '评分必须在 1-5 之间' }
  }

  const trimmedContent = content.trim()
  if (trimmedContent.length < 10) {
    return { code: 400, msg: '评论内容至少 10 个字' }
  }

  try {
    // ── 2. 查询调用者用户信息 ──────────────────────────────────

    const userRes = await db.collection('users').where({ _openid: openId }).get()

    if (userRes.data.length === 0) {
      return { code: 401, msg: '用户未登录或未注册' }
    }

    const user = userRes.data[0]

    // ── 3. 权限校验：必须是已认证音乐人才 ────────────────────
    //
    // 兼容两套字段：
    //   新字段：isTalent=true, talentCertStatus='approved'
    //   旧字段：role='student', certStatus='approved'
    //
    // 只要满足任意一套，即视为已认证音乐人才

    const isTalent = user.isTalent === true || user.role === 'student'

    if (!isTalent) {
      return { code: 403, msg: '仅认证音乐人才可以评论' }
    }

    // 优先读新字段，再降级到旧字段
    const talentCertStatus = user.talentCertStatus || (user.role === 'student' ? user.certStatus : 'unverified')

    if (talentCertStatus !== 'approved') {
      return { code: 403, msg: '请先完成音乐人才认证后再评论（当前状态：' + (talentCertStatus || 'unverified') + '）' }
    }

    // ── 4. 防重：同一用户对同一需求只能评论一次 ───────────────

    const existComment = await db.collection('comments')
      .where({ jobId, _openid: openId })
      .get()

    if (existComment.data.length > 0) {
      return { code: 400, msg: '您已评论过该需求，不可重复评论' }
    }

    // ── 5. 写入评论（默认 pending，等待管理员审核）────────────

    const result = await db.collection('comments').add({
      data: {
        jobId,
        userId: user._id,
        userName: user.realName || '匿名用户',
        rating,
        content: trimmedContent,
        status: 'pending',       // 待管理员审核
        createTime: db.serverDate()
      }
    })

    return {
      code: 200,
      msg: '评论提交成功，待审核后公开显示',
      data: { commentId: result._id }
    }

  } catch (err) {
    console.error('submitComment 异常', err)
    return { code: 500, msg: '服务器内部错误', error: err }
  }
}
