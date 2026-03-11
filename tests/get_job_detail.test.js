/**
 * get_job_detail 云函数测试
 *
 * 业务规则：
 * 1. jobId 必须提供
 * 2. 需求必须存在且 status='active'（否则 404）
 * 3. 联系方式显示规则：
 *    - 已认证音乐人才（isTalent=true, talentCertStatus='approved'）→ 显示
 *    - 发布者本人（job._openid === 调用者 openid）→ 显示
 *    - 其他用户 → 隐藏，替换为提示文字
 * 4. 甲方认证徽章（employer.isCertified）：
 *    - 读 employerCertStatus（新字段）或 certStatus（旧字段）
 * 5. 未登录/未注册用户视为未认证（不报错，正常处理为隐藏联系方式）
 */

const cloud = require('wx-server-sdk')
const { main } = require('../cloudfunctions/get_job_detail/index')

// ================================================================
// 测试固件（Fixtures）
// ================================================================

const EMPLOYER_OPENID = 'openid_employer'
const TALENT_OPENID   = 'openid_talent'
const VISITOR_OPENID  = 'openid_visitor'

/** 已认证甲方（新字段） */
const CERTIFIED_EMPLOYER = {
  _id: 'emp_1',
  _openid: EMPLOYER_OPENID,
  isEmployer: true,
  employerCertStatus: 'approved'
}

/** 已认证甲方（旧字段 - 兼容性测试） */
const CERTIFIED_EMPLOYER_LEGACY = {
  _id: 'emp_legacy',
  _openid: 'openid_employer_legacy',
  role: 'employer',
  certStatus: 'approved'
}

/** 已认证音乐人才 */
const APPROVED_TALENT = {
  _id: 'talent_1',
  _openid: TALENT_OPENID,
  isTalent: true,
  talentCertStatus: 'approved'
}

/** 活跃需求 */
const ACTIVE_JOB = {
  _id: 'job_active',
  _openid: EMPLOYER_OPENID,
  title: '招募钢琴教师',
  description: '需要有五年以上教学经验',
  salary: '200-300元/课时',
  contact: '18812345678',
  skills: ['钢琴'],
  status: 'active'
}

/** 已下架需求 */
const INACTIVE_JOB = {
  _id: 'job_inactive',
  _openid: EMPLOYER_OPENID,
  title: '已下架需求',
  contact: '18800000000',
  status: 'inactive'
}

// ================================================================
// 测试套件
// ================================================================

describe('get_job_detail 云函数', () => {

  // ── 参数校验 ──────────────────────────────────────────────────

  describe('参数校验', () => {
    test('缺少 jobId → 400', async () => {
      cloud.setup({ jobs: [ACTIVE_JOB], users: [APPROVED_TALENT] }, TALENT_OPENID)
      const result = await main({})
      expect(result.code).toBe(400)
    })
  })

  // ── 需求状态校验 ──────────────────────────────────────────────

  describe('需求状态校验', () => {
    test('需求不存在（jobId无效）→ 返回错误', async () => {
      cloud.setup({ jobs: [ACTIVE_JOB], users: [APPROVED_TALENT] }, TALENT_OPENID)
      const result = await main({ jobId: 'nonexistent_job_id' })
      // 需求不存在时，doc().get() 抛异常，应返回 404 或 500
      expect([404, 500]).toContain(result.code)
    })

    test('需求已下架（status=inactive）→ 404', async () => {
      cloud.setup({ jobs: [INACTIVE_JOB], users: [APPROVED_TALENT] }, TALENT_OPENID)
      const result = await main({ jobId: 'job_inactive' })
      expect(result.code).toBe(404)
    })
  })

  // ── 联系方式显示规则 ──────────────────────────────────────────

  describe('联系方式显示规则', () => {
    test('已认证音乐人才 → 可见完整联系方式', async () => {
      cloud.setup(
        { jobs: [ACTIVE_JOB], users: [APPROVED_TALENT, CERTIFIED_EMPLOYER] },
        TALENT_OPENID
      )
      const result = await main({ jobId: 'job_active' })
      expect(result.code).toBe(200)
      expect(result.data.contact).toBe('18812345678')
    })

    test('发布者本人 → 可见完整联系方式', async () => {
      cloud.setup(
        { jobs: [ACTIVE_JOB], users: [CERTIFIED_EMPLOYER] },
        EMPLOYER_OPENID   // 发布者本人
      )
      const result = await main({ jobId: 'job_active' })
      expect(result.code).toBe(200)
      expect(result.data.contact).toBe('18812345678')
    })

    test('普通访客（未登录/未认证）→ 联系方式被隐藏', async () => {
      cloud.setup(
        { jobs: [ACTIVE_JOB], users: [] },  // 无用户记录
        VISITOR_OPENID
      )
      const result = await main({ jobId: 'job_active' })
      expect(result.code).toBe(200)
      expect(result.data.contact).not.toBe('18812345678')
      expect(result.data.contact).toMatch(/认证|可见/)
    })

    test('未认证用户 → 联系方式被隐藏', async () => {
      const unverifiedTalent = {
        _id: 'unverified',
        _openid: VISITOR_OPENID,
        isTalent: true,
        talentCertStatus: 'pending'  // 审核中，未通过
      }
      cloud.setup(
        { jobs: [ACTIVE_JOB], users: [unverifiedTalent] },
        VISITOR_OPENID
      )
      const result = await main({ jobId: 'job_active' })
      expect(result.code).toBe(200)
      expect(result.data.contact).not.toBe('18812345678')
    })
  })

  // ── 甲方认证徽章 ──────────────────────────────────────────────

  describe('甲方认证徽章（employer.isCertified）', () => {
    test('甲方 employerCertStatus=approved（新字段）→ isCertified=true', async () => {
      cloud.setup(
        { jobs: [ACTIVE_JOB], users: [CERTIFIED_EMPLOYER, APPROVED_TALENT] },
        TALENT_OPENID
      )
      const result = await main({ jobId: 'job_active' })
      expect(result.code).toBe(200)
      expect(result.data.employer.isCertified).toBe(true)
    })

    test('甲方旧字段 certStatus=approved → isCertified=true（兼容）', async () => {
      const legacyJob = { ...ACTIVE_JOB, _id: 'job_legacy', _openid: 'openid_employer_legacy' }
      cloud.setup(
        { jobs: [legacyJob], users: [CERTIFIED_EMPLOYER_LEGACY, APPROVED_TALENT] },
        TALENT_OPENID
      )
      const result = await main({ jobId: 'job_legacy' })
      expect(result.code).toBe(200)
      expect(result.data.employer.isCertified).toBe(true)
    })

    test('甲方未认证 → isCertified=false', async () => {
      const uncertifiedEmployer = {
        _id: 'emp_uncert',
        _openid: 'openid_emp_uncert',
        isEmployer: true,
        employerCertStatus: 'pending'
      }
      const uncertifiedJob = {
        ...ACTIVE_JOB,
        _id: 'job_uncert',
        _openid: 'openid_emp_uncert'
      }
      cloud.setup(
        { jobs: [uncertifiedJob], users: [uncertifiedEmployer, APPROVED_TALENT] },
        TALENT_OPENID
      )
      const result = await main({ jobId: 'job_uncert' })
      expect(result.code).toBe(200)
      expect(result.data.employer.isCertified).toBe(false)
    })

    test('甲方在 users 中不存在 → isCertified=false，不报错', async () => {
      cloud.setup(
        { jobs: [ACTIVE_JOB], users: [APPROVED_TALENT] },  // 无甲方记录
        TALENT_OPENID
      )
      const result = await main({ jobId: 'job_active' })
      expect(result.code).toBe(200)
      expect(result.data.employer.isCertified).toBe(false)
    })
  })

  // ── 成功响应结构 ──────────────────────────────────────────────

  describe('成功响应结构', () => {
    beforeEach(() => {
      cloud.setup(
        { jobs: [ACTIVE_JOB], users: [APPROVED_TALENT, CERTIFIED_EMPLOYER] },
        TALENT_OPENID
      )
    })

    test('成功返回需求完整字段', async () => {
      const result = await main({ jobId: 'job_active' })
      expect(result.code).toBe(200)
      expect(result.data).toMatchObject({
        title: '招募钢琴教师',
        description: '需要有五年以上教学经验',
        salary: '200-300元/课时',
        skills: ['钢琴'],
        status: 'active'
      })
    })

    test('响应包含 employer.isCertified 字段', async () => {
      const result = await main({ jobId: 'job_active' })
      expect(result.data).toHaveProperty('employer')
      expect(result.data.employer).toHaveProperty('isCertified')
    })
  })
})
