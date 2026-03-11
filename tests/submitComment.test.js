/**
 * submitComment 云函数测试
 *
 * 业务规则：
 * 1. 必须提供 jobId、rating、content
 * 2. rating 范围 1-5
 * 3. content 至少 10 字
 * 4. 调用者必须是已注册用户（users 集合有记录）
 * 5. 调用者必须是音乐人才（isTalent=true 或旧字段 role='student'）
 * 6. 音乐人才认证必须已通过（talentCertStatus='approved' 或旧字段 certStatus='approved'）
 * 7. 同一用户对同一需求只能评论一次
 * 8. 成功：评论以 status='pending' 写入数据库，等待管理员审核
 */

const cloud = require('wx-server-sdk')
const { main } = require('../cloudfunctions/submitComment/index')

// ================================================================
// 测试固件（Fixtures）
// ================================================================

/** 已认证音乐人才（新字段） */
const APPROVED_TALENT = {
  _id: 'user_talent',
  _openid: 'openid_talent',
  isTalent: true,
  talentCertStatus: 'approved',
  realName: '张三'
}

/** 已认证音乐人才（旧字段 - 兼容性测试） */
const APPROVED_TALENT_LEGACY = {
  _id: 'user_talent_legacy',
  _openid: 'openid_talent_legacy',
  role: 'student',
  certStatus: 'approved',
  realName: '李四'
}

/** 音乐人才 - 审核中 */
const PENDING_TALENT = {
  _id: 'user_pending',
  _openid: 'openid_pending',
  isTalent: true,
  talentCertStatus: 'pending',
  realName: '王五'
}

/** 仅甲方身份（无音乐人才角色） */
const EMPLOYER_ONLY = {
  _id: 'user_employer',
  _openid: 'openid_employer',
  isEmployer: true,
  employerCertStatus: 'approved',
  realName: '赵六'
}

/** 有效需求 */
const ACTIVE_JOB = {
  _id: 'job_1',
  _openid: 'openid_employer',
  title: '招募钢琴教师',
  status: 'active'
}

/** 有效评论内容（>= 10 字） */
const VALID_CONTENT = '这个需求描述很详细，非常适合我的技能'

// ================================================================
// 测试套件
// ================================================================

describe('submitComment 云函数', () => {

  // ── 参数校验 ──────────────────────────────────────────────────

  describe('参数校验', () => {
    beforeEach(() => {
      cloud.setup({ users: [APPROVED_TALENT], jobs: [ACTIVE_JOB], comments: [] }, 'openid_talent')
    })

    test('缺少 jobId → 400', async () => {
      const result = await main({ rating: 5, content: VALID_CONTENT })
      expect(result.code).toBe(400)
      expect(result.msg).toMatch(/jobId|缺少/)
    })

    test('缺少 rating → 400', async () => {
      const result = await main({ jobId: 'job_1', content: VALID_CONTENT })
      expect(result.code).toBe(400)
    })

    test('缺少 content → 400', async () => {
      const result = await main({ jobId: 'job_1', rating: 5 })
      expect(result.code).toBe(400)
    })

    test('rating = 0（低于范围）→ 400', async () => {
      const result = await main({ jobId: 'job_1', rating: 0, content: VALID_CONTENT })
      expect(result.code).toBe(400)
      expect(result.msg).toMatch(/1-5|评分/)
    })

    test('rating = 6（超出范围）→ 400', async () => {
      const result = await main({ jobId: 'job_1', rating: 6, content: VALID_CONTENT })
      expect(result.code).toBe(400)
    })

    test('content 不足 10 字 → 400', async () => {
      const result = await main({ jobId: 'job_1', rating: 5, content: '太短了' })
      expect(result.code).toBe(400)
      expect(result.msg).toMatch(/10|字/)
    })

    test('content 恰好 10 字（边界值）→ 不因长度被拒绝', async () => {
      const result = await main({ jobId: 'job_1', rating: 5, content: '1234567890' })
      // 内容满足长度要求，不应返回长度相关 400
      expect(result.code).not.toBe(400)
    })
  })

  // ── 用户权限校验 ──────────────────────────────────────────────

  describe('用户权限校验', () => {
    test('用户未注册（users 中无记录）→ 401', async () => {
      cloud.setup({ users: [], jobs: [ACTIVE_JOB], comments: [] }, 'openid_unknown')
      const result = await main({ jobId: 'job_1', rating: 5, content: VALID_CONTENT })
      expect(result.code).toBe(401)
    })

    test('仅甲方身份（非音乐人才）→ 403', async () => {
      cloud.setup({ users: [EMPLOYER_ONLY], jobs: [ACTIVE_JOB], comments: [] }, 'openid_employer')
      const result = await main({ jobId: 'job_1', rating: 5, content: VALID_CONTENT })
      expect(result.code).toBe(403)
      expect(result.msg).toMatch(/音乐人才|学生/)
    })

    test('音乐人才认证审核中（pending）→ 403', async () => {
      cloud.setup({ users: [PENDING_TALENT], jobs: [ACTIVE_JOB], comments: [] }, 'openid_pending')
      const result = await main({ jobId: 'job_1', rating: 5, content: VALID_CONTENT })
      expect(result.code).toBe(403)
      expect(result.msg).toMatch(/认证|approved/)
    })

    test('旧字段 role=student 且 certStatus=approved（兼容）→ 允许评论', async () => {
      cloud.setup({ users: [APPROVED_TALENT_LEGACY], jobs: [ACTIVE_JOB], comments: [] }, 'openid_talent_legacy')
      const result = await main({ jobId: 'job_1', rating: 4, content: VALID_CONTENT })
      // 应该成功，而非因角色被拒绝
      expect(result.code).toBe(200)
    })
  })

  // ── 业务逻辑校验 ──────────────────────────────────────────────

  describe('业务逻辑校验', () => {
    beforeEach(() => {
      cloud.setup({ users: [APPROVED_TALENT], jobs: [ACTIVE_JOB], comments: [] }, 'openid_talent')
    })

    test('重复评论同一需求 → 400', async () => {
      // 先成功提交一次
      await main({ jobId: 'job_1', rating: 5, content: VALID_CONTENT })
      // 再次提交同一需求
      const result = await main({ jobId: 'job_1', rating: 3, content: VALID_CONTENT })
      expect(result.code).toBe(400)
      expect(result.msg).toMatch(/已评论|重复/)
    })

    test('成功提交评论 → 200，返回 commentId', async () => {
      const result = await main({ jobId: 'job_1', rating: 5, content: VALID_CONTENT })
      expect(result.code).toBe(200)
      expect(result.data).toHaveProperty('commentId')
      expect(typeof result.data.commentId).toBe('string')
    })

    test('成功提交的评论 status=pending（待审核）', async () => {
      await main({ jobId: 'job_1', rating: 5, content: VALID_CONTENT })
      const comments = cloud.getCollectionData('comments')
      expect(comments.length).toBe(1)
      expect(comments[0].status).toBe('pending')
    })

    test('成功提交的评论包含正确字段', async () => {
      await main({ jobId: 'job_1', rating: 4, content: VALID_CONTENT })
      const comments = cloud.getCollectionData('comments')
      const comment = comments[0]
      expect(comment.jobId).toBe('job_1')
      expect(comment.rating).toBe(4)
      expect(comment.content).toBe(VALID_CONTENT)
      expect(comment.status).toBe('pending')
      // 评论应关联到用户 ID
      expect(comment.userId).toBe('user_talent')
    })

    test('评论内容中的首尾空白被去除', async () => {
      await main({ jobId: 'job_1', rating: 5, content: '  ' + VALID_CONTENT + '  ' })
      const comments = cloud.getCollectionData('comments')
      expect(comments[0].content).toBe(VALID_CONTENT)
    })

    test('rating=1（最低分）可以成功提交', async () => {
      const result = await main({ jobId: 'job_1', rating: 1, content: VALID_CONTENT })
      expect(result.code).toBe(200)
    })

    test('rating=5（最高分）可以成功提交', async () => {
      const result = await main({ jobId: 'job_1', rating: 5, content: VALID_CONTENT })
      expect(result.code).toBe(200)
    })
  })
})
