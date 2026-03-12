// adminReview 云函数
// 功能：管理员审核操作（认证审核 + 评论审核）
// 安全：调用者 openid 须存在于 admins 集合，否则返回 403
// 审核操作完成后，同步向被审核用户写入通知记录

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const adminOpenId = wxContext.OPENID
  const { action } = event

  // ── 1. 管理员 / 审核员鉴权 ────────────────────────────────

  const [adminRes, reviewerRes] = await Promise.all([
    db.collection('admins').where({ _openid: adminOpenId }).get(),
    db.collection('users').where({ _openid: adminOpenId, isReviewer: true }).get()
  ])
  if (adminRes.data.length === 0 && reviewerRes.data.length === 0) {
    return { code: 403, msg: '无管理员权限，操作被拒绝' }
  }

  // ── 2. action 校验 ────────────────────────────────────────

  const validActions = [
    'approveCert', 'rejectCert',
    'approveComment', 'rejectComment',
    'listPendingCerts', 'listPendingComments'
  ]

  if (!action) {
    return { code: 400, msg: '缺少参数 action' }
  }
  if (!validActions.includes(action)) {
    return { code: 400, msg: `未知操作：${action}，支持的操作：${validActions.join('、')}` }
  }

  // ── 3. 执行各操作 ─────────────────────────────────────────

  try {
    switch (action) {
      case 'approveCert':   return await approveCert(event)
      case 'rejectCert':    return await rejectCert(event)
      case 'approveComment': return await approveComment(event)
      case 'rejectComment':  return await rejectComment(event)
      case 'listPendingCerts':    return await listPendingCerts()
      case 'listPendingComments': return await listPendingComments()
    }
  } catch (err) {
    console.error(`adminReview [${action}] 异常`, err)
    return { code: 500, msg: '服务器内部错误', error: err }
  }
}

// ============================================================
// 操作实现
// ============================================================

/**
 * 审核通过用户认证
 * @param {object} event - { userId, certType: 'talent'|'employer' }
 */
async function approveCert({ userId, certType }) {
  if (!userId)   return { code: 400, msg: '缺少参数 userId' }
  if (!certType) return { code: 400, msg: '缺少参数 certType（talent 或 employer）' }
  if (!['talent', 'employer'].includes(certType)) {
    return { code: 400, msg: 'certType 必须为 talent 或 employer' }
  }

  // 根据 certType 决定更新哪个字段
  const updateData = certType === 'talent'
    ? { talentCertStatus: 'approved' }
    : { employerCertStatus: 'approved' }

  await db.collection('users').doc(userId).update({ data: updateData })

  // 查询用户 openid，用于写通知
  const userRes = await db.collection('users').doc(userId).get()
  const user = userRes.data
  const certLabel = certType === 'talent' ? '音乐人才' : '甲方'

  await writeNotification({
    openId: user._openid,
    type: 'cert_approved',
    content: `您的${certLabel}认证已审核通过，现可使用全部功能`,
    relatedId: userId
  })

  return { code: 200, msg: `${certLabel}认证已审核通过` }
}

/**
 * 审核拒绝用户认证
 * @param {object} event - { userId, certType, reason }
 */
async function rejectCert({ userId, certType, reason = '请重新提交认证材料' }) {
  if (!userId)   return { code: 400, msg: '缺少参数 userId' }
  if (!certType) return { code: 400, msg: '缺少参数 certType' }
  if (!['talent', 'employer'].includes(certType)) {
    return { code: 400, msg: 'certType 必须为 talent 或 employer' }
  }

  // 对应字段名：talent → talentCertStatus + talentRejectReason
  const statusField = certType === 'talent' ? 'talentCertStatus'   : 'employerCertStatus'
  const reasonField = certType === 'talent' ? 'talentRejectReason' : 'employerRejectReason'

  await db.collection('users').doc(userId).update({
    data: {
      [statusField]: 'rejected',
      [reasonField]: reason
    }
  })

  const userRes = await db.collection('users').doc(userId).get()
  const user = userRes.data
  const certLabel = certType === 'talent' ? '音乐人才' : '甲方'

  await writeNotification({
    openId: user._openid,
    type: 'cert_rejected',
    content: `您的${certLabel}认证未通过：${reason}，请修改材料后重新提交`,
    relatedId: userId
  })

  return { code: 200, msg: `${certLabel}认证已拒绝` }
}

/**
 * 审核通过评论
 * @param {object} event - { commentId }
 */
async function approveComment({ commentId }) {
  if (!commentId) return { code: 400, msg: '缺少参数 commentId' }

  await db.collection('comments').doc(commentId).update({ data: { status: 'approved' } })

  // 通知评论作者
  const commentRes = await db.collection('comments').doc(commentId).get()
  const comment = commentRes.data

  await writeNotification({
    openId: comment._openid,
    type: 'comment_approved',
    content: '您的评论已审核通过，现已公开显示',
    relatedId: commentId
  })

  return { code: 200, msg: '评论已审核通过' }
}

/**
 * 审核拒绝评论
 * @param {object} event - { commentId, reason }
 */
async function rejectComment({ commentId, reason = '内容不符合平台规范' }) {
  if (!commentId) return { code: 400, msg: '缺少参数 commentId' }

  await db.collection('comments').doc(commentId).update({
    data: { status: 'rejected', rejectReason: reason }
  })

  const commentRes = await db.collection('comments').doc(commentId).get()
  const comment = commentRes.data

  await writeNotification({
    openId: comment._openid,
    type: 'comment_rejected',
    content: `您的评论未通过审核：${reason}`,
    relatedId: commentId
  })

  return { code: 200, msg: '评论已拒绝' }
}

/**
 * 获取待审核认证列表
 * 返回所有 talentCertStatus=pending 或 employerCertStatus=pending 的用户
 */
async function listPendingCerts() {
  const [talentRes, employerRes] = await Promise.all([
    db.collection('users').where({ talentCertStatus: 'pending' }).get(),
    db.collection('users').where({ employerCertStatus: 'pending' }).get()
  ])

  // 合并并去重（同一用户可能两个认证都是 pending）
  const allUsers = [...talentRes.data, ...employerRes.data]
  const seen = new Set()
  const uniqueUsers = allUsers.filter(u => {
    if (seen.has(u._id)) return false
    seen.add(u._id)
    return true
  })

  // 返回必要信息（不返回认证图片 URL，前端需要另行请求）
  const result = uniqueUsers.map(u => ({
    _id:                u._id,
    _openid:            u._openid,
    realName:           u.realName || '未填写',
    isTalent:           u.isTalent || false,
    isEmployer:         u.isEmployer || false,
    talentCertStatus:   u.talentCertStatus,
    employerCertStatus: u.employerCertStatus,
    talentCertImgs:     u.talentCertImgs || [],
    employerCertImgs:   u.employerCertImgs || [],
    createTime:         u.createTime
  }))

  return { code: 200, data: result }
}

/**
 * 获取待审核评论列表
 */
async function listPendingComments() {
  const res = await db.collection('comments').where({ status: 'pending' }).get()
  return { code: 200, data: res.data }
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 写入通知记录
 * @param {object} params - { openId, type, content, relatedId }
 */
async function writeNotification({ openId, type, content, relatedId }) {
  await db.collection('notifications').add({
    data: {
      _openid: openId,    // 通知接收者的 openid（便于查询自己的通知）
      type,               // 通知类型
      content,            // 通知内容
      relatedId,          // 关联 ID（userId 或 commentId）
      isRead: false,      // 初始未读
      createTime: db.serverDate()
    }
  })
}
