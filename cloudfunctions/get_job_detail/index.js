// get_job_detail 云函数
// 功能：安全获取需求详情，根据调用者权限动态过滤联系方式
// 修改记录：
//   2026-02-16 - 初始版本
//   2026-03-11 - 修复：甲方认证检查同时支持新字段(employerCertStatus)和旧字段(certStatus)

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { jobId } = event

  if (!jobId) {
    return { code: 400, msg: '缺少参数 jobId' }
  }

  try {
    // ── 1. 查询需求详情 ──────────────────────────────────────

    const jobRes = await db.collection('jobs').doc(jobId).get()
    const job = jobRes.data

    if (job.status !== 'active') {
      return { code: 404, msg: '需求不存在或已下架' }
    }

    // ── 2. 获取调用者的认证状态（用于判断是否可见联系方式）──

    let callerIsTalent = false
    let callerTalentCertStatus = 'unverified'

    try {
      const userRes = await db.collection('users').where({ _openid: openId }).get()
      if (userRes.data.length > 0) {
        const user = userRes.data[0]
        // 兼容新旧字段
        callerIsTalent = user.isTalent === true || user.role === 'student'
        callerTalentCertStatus = user.talentCertStatus
          || (user.role === 'student' ? user.certStatus : 'unverified')
      }
    } catch (err) {
      // 查询失败视为未认证，继续处理
      console.error('获取调用者信息失败', err)
    }

    // ── 3. 联系方式显示规则 ──────────────────────────────────
    //
    // 可见条件（满足其一即可）：
    //   a. 已认证音乐人才：isTalent=true 且 talentCertStatus='approved'
    //   b. 发布者本人：调用者 openid === 需求发布者 openid

    const isTalentApproved = callerIsTalent && callerTalentCertStatus === 'approved'
    const isOwner = openId && job._openid && openId === job._openid

    if (!isTalentApproved && !isOwner) {
      job.contact = '完成央音认证后可见'
    }

    // ── 4. 获取甲方认证状态（用于展示认证徽章）────────────

    let isEmployerCertified = false

    if (job._openid) {
      try {
        const employerRes = await db.collection('users').where({ _openid: job._openid }).get()
        if (employerRes.data.length > 0) {
          const employer = employerRes.data[0]
          // 兼容新旧字段：优先读 employerCertStatus，降级到 certStatus
          isEmployerCertified = employer.employerCertStatus === 'approved'
            || (employer.employerCertStatus === undefined && employer.certStatus === 'approved')
        }
      } catch (err) {
        console.error('获取甲方信息失败', err)
      }
    }

    return {
      code: 200,
      data: {
        ...job,
        employer: { isCertified: isEmployerCertified }
      }
    }

  } catch (err) {
    console.error('get_job_detail 异常', err)
    // doc().get() 记录不存在时抛出异常，视为 404
    if (err.errCode === -502005 || err.message === 'record not found') {
      return { code: 404, msg: '需求不存在' }
    }
    return { code: 500, msg: '服务器内部错误', error: err }
  }
}
