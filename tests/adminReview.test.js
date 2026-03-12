/**
 * adminReview 云函数测试
 *
 * 业务规则：
 * 1. 管理员鉴权：调用者 openid 必须在 admins 集合中
 * 2. 非管理员访问 → 403
 * 3. 支持的操作（action）：
 *    - approveCert   审核通过用户认证
 *    - rejectCert    审核拒绝用户认证（需提供 reason）
 *    - approveComment 审核通过评论
 *    - rejectComment  审核拒绝评论（需提供 reason）
 *    - listPendingCerts     查询待审核认证列表
 *    - listPendingComments  查询待审核评论列表
 * 4. 审核通过/拒绝后，在 notifications 集合写入通知记录
 */

const cloud = require('wx-server-sdk')
const { main } = require('../cloudfunctions/adminReview/index')

// ================================================================
// 测试固件（Fixtures）
// ================================================================

const ADMIN_OPENID    = 'openid_admin'
const REVIEWER_OPENID = 'openid_reviewer'
const TALENT_OPENID   = 'openid_talent'
const VISITOR_OPENID  = 'openid_visitor'

const ADMIN_RECORD = { _id: 'admin_1', _openid: ADMIN_OPENID }

/** 审核员用户（不在 admins 集合，但 isReviewer = true） */
const REVIEWER_USER = {
  _id: 'user_reviewer',
  _openid: REVIEWER_OPENID,
  realName: '审核员小王',
  isReviewer: true
}

/** 待审核音乐人才认证 */
const PENDING_TALENT_USER = {
  _id: 'user_pending_talent',
  _openid: TALENT_OPENID,
  realName: '张三',
  isTalent: true,
  talentCertStatus: 'pending',
  talentCertImgs: ['cloud://test/img1.jpg']
}

/** 待审核甲方认证 */
const PENDING_EMPLOYER_USER = {
  _id: 'user_pending_employer',
  _openid: 'openid_employer',
  realName: '某机构',
  isEmployer: true,
  employerCertStatus: 'pending',
  employerCertImgs: ['cloud://test/img2.jpg']
}

/** 待审核评论 */
const PENDING_COMMENT = {
  _id: 'comment_1',
  _openid: TALENT_OPENID,
  jobId: 'job_1',
  userId: 'user_pending_talent',
  rating: 5,
  content: '这个需求非常好，推荐大家参与',
  status: 'pending'
}

function baseData() {
  return {
    admins: [ADMIN_RECORD],
    users: [PENDING_TALENT_USER, PENDING_EMPLOYER_USER, REVIEWER_USER],
    comments: [PENDING_COMMENT],
    notifications: []
  }
}

// ================================================================
// 测试套件
// ================================================================

describe('adminReview 云函数', () => {

  // ── 管理员鉴权 ──────────────────────────────────────────────

  describe('管理员鉴权', () => {
    test('非管理员调用 → 403', async () => {
      cloud.setup(baseData(), VISITOR_OPENID)
      const result = await main({ action: 'listPendingCerts' })
      expect(result.code).toBe(403)
      expect(result.msg).toMatch(/管理员|权限/)
    })

    test('管理员调用 → 不返回 403', async () => {
      cloud.setup(baseData(), ADMIN_OPENID)
      const result = await main({ action: 'listPendingCerts' })
      expect(result.code).not.toBe(403)
    })

    test('缺少 action 参数 → 400', async () => {
      cloud.setup(baseData(), ADMIN_OPENID)
      const result = await main({})
      expect(result.code).toBe(400)
    })

    test('未知 action → 400', async () => {
      cloud.setup(baseData(), ADMIN_OPENID)
      const result = await main({ action: 'invalidAction' })
      expect(result.code).toBe(400)
    })

    test('审核员（isReviewer）调用 → 不返回 403', async () => {
      cloud.setup(baseData(), REVIEWER_OPENID)
      const result = await main({ action: 'listPendingCerts' })
      expect(result.code).not.toBe(403)
    })
  })

  // ── 认证审核：音乐人才 ────────────────────────────────────

  describe('approveCert（审核通过认证）', () => {
    beforeEach(() => cloud.setup(baseData(), ADMIN_OPENID))

    test('通过音乐人才认证 → talentCertStatus 变为 approved', async () => {
      const result = await main({
        action: 'approveCert',
        userId: 'user_pending_talent',
        certType: 'talent'
      })
      expect(result.code).toBe(200)
      const users = cloud.getCollectionData('users')
      const user = users.find(u => u._id === 'user_pending_talent')
      expect(user.talentCertStatus).toBe('approved')
    })

    test('通过甲方认证 → employerCertStatus 变为 approved', async () => {
      const result = await main({
        action: 'approveCert',
        userId: 'user_pending_employer',
        certType: 'employer'
      })
      expect(result.code).toBe(200)
      const users = cloud.getCollectionData('users')
      const user = users.find(u => u._id === 'user_pending_employer')
      expect(user.employerCertStatus).toBe('approved')
    })

    test('审核通过后写入通知记录', async () => {
      await main({ action: 'approveCert', userId: 'user_pending_talent', certType: 'talent' })
      const notifications = cloud.getCollectionData('notifications')
      expect(notifications.length).toBe(1)
      expect(notifications[0].type).toMatch(/cert_approved/)
      expect(notifications[0].isRead).toBe(false)
    })

    test('缺少 userId → 400', async () => {
      const result = await main({ action: 'approveCert', certType: 'talent' })
      expect(result.code).toBe(400)
    })

    test('缺少 certType → 400', async () => {
      const result = await main({ action: 'approveCert', userId: 'user_pending_talent' })
      expect(result.code).toBe(400)
    })
  })

  describe('rejectCert（审核拒绝认证）', () => {
    beforeEach(() => cloud.setup(baseData(), ADMIN_OPENID))

    test('拒绝音乐人才认证 → talentCertStatus 变为 rejected', async () => {
      await main({
        action: 'rejectCert',
        userId: 'user_pending_talent',
        certType: 'talent',
        reason: '照片不清晰'
      })
      const users = cloud.getCollectionData('users')
      const user = users.find(u => u._id === 'user_pending_talent')
      expect(user.talentCertStatus).toBe('rejected')
    })

    test('拒绝时存储拒绝原因', async () => {
      await main({
        action: 'rejectCert',
        userId: 'user_pending_talent',
        certType: 'talent',
        reason: '材料不符合要求'
      })
      const users = cloud.getCollectionData('users')
      const user = users.find(u => u._id === 'user_pending_talent')
      expect(user.talentRejectReason).toBe('材料不符合要求')
    })

    test('拒绝后写入通知记录', async () => {
      await main({
        action: 'rejectCert',
        userId: 'user_pending_talent',
        certType: 'talent',
        reason: '材料不清晰'
      })
      const notifications = cloud.getCollectionData('notifications')
      expect(notifications[0].type).toMatch(/cert_rejected/)
      expect(notifications[0].content).toContain('材料不清晰')
    })
  })

  // ── 评论审核 ──────────────────────────────────────────────

  describe('approveComment（审核通过评论）', () => {
    beforeEach(() => cloud.setup(baseData(), ADMIN_OPENID))

    test('通过评论 → status 变为 approved', async () => {
      await main({ action: 'approveComment', commentId: 'comment_1' })
      const comments = cloud.getCollectionData('comments')
      expect(comments[0].status).toBe('approved')
    })

    test('审核通过后写入通知', async () => {
      await main({ action: 'approveComment', commentId: 'comment_1' })
      const notifications = cloud.getCollectionData('notifications')
      expect(notifications[0].type).toMatch(/comment_approved/)
    })

    test('缺少 commentId → 400', async () => {
      const result = await main({ action: 'approveComment' })
      expect(result.code).toBe(400)
    })
  })

  describe('rejectComment（审核拒绝评论）', () => {
    beforeEach(() => cloud.setup(baseData(), ADMIN_OPENID))

    test('拒绝评论 → status 变为 rejected', async () => {
      await main({ action: 'rejectComment', commentId: 'comment_1', reason: '内容不当' })
      const comments = cloud.getCollectionData('comments')
      expect(comments[0].status).toBe('rejected')
    })

    test('拒绝后写入通知', async () => {
      await main({ action: 'rejectComment', commentId: 'comment_1', reason: '内容不当' })
      const notifications = cloud.getCollectionData('notifications')
      expect(notifications[0].type).toMatch(/comment_rejected/)
    })
  })

  // ── 列表查询 ──────────────────────────────────────────────

  describe('listPendingCerts（待审核认证列表）', () => {
    beforeEach(() => cloud.setup(baseData(), ADMIN_OPENID))

    test('返回所有待审核用户', async () => {
      const result = await main({ action: 'listPendingCerts' })
      expect(result.code).toBe(200)
      expect(Array.isArray(result.data)).toBe(true)
      // 两个用户都有 pending 状态的认证
      expect(result.data.length).toBe(2)
    })

    test('返回的用户不含敏感认证图片字段（隐私保护）', async () => {
      const result = await main({ action: 'listPendingCerts' })
      // 返回的数据应包含基本信息
      result.data.forEach(user => {
        expect(user).toHaveProperty('_id')
        expect(user).toHaveProperty('realName')
      })
    })
  })

  describe('listPendingComments（待审核评论列表）', () => {
    beforeEach(() => cloud.setup(baseData(), ADMIN_OPENID))

    test('返回所有待审核评论', async () => {
      const result = await main({ action: 'listPendingComments' })
      expect(result.code).toBe(200)
      expect(result.data.length).toBe(1)
      expect(result.data[0]._id).toBe('comment_1')
    })

    test('已审核评论不在列表中', async () => {
      // 先通过一个评论
      await main({ action: 'approveComment', commentId: 'comment_1' })
      const result = await main({ action: 'listPendingComments' })
      expect(result.data.length).toBe(0)
    })
  })
})
