// AI生成：中央音乐学院实践平台MVP | 日期：2026-02-16
// 修改前请确认：已开启云开发环境 | 数据库权限：仅创建者可读写

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const jobId = event.jobId
  const openId = wxContext.OPENID

  if (!jobId) {
    return {
      code: 400,
      msg: '缺少参数 jobId'
    }
  }

  try {
    // 1. 查询需求详情
    const jobRes = await db.collection('jobs').doc(jobId).get()
    const job = jobRes.data

    // 检查需求状态
    if (job.status !== 'active') {
      return {
        code: 404,
        msg: '需求不存在或已下架'
      }
    }

    // 2. 查询调用者用户信息（获取认证状态）
    let callerIsTalent = false
    let callerTalentCertStatus = 'unverified'
    
    // 尝试获取用户信息，如果不存在则默认为未认证
    try {
      const userRes = await db.collection('users').where({
        _openid: openId
      }).get()

      if (userRes.data.length > 0) {
        const user = userRes.data[0]
        callerIsTalent = user.isTalent || false
        callerTalentCertStatus = user.talentCertStatus || 'unverified'
      }
    } catch (err) {
      console.error('获取调用者信息失败', err)
      // 继续执行，视为未认证用户
    }

    // 3. 处理联系方式显示逻辑
    // 规则：
    // - 若调用者为已认证音乐人才(isTalent + talentCertStatus=approved) → 返回完整contact
    // - 若调用者为发布者本人 → 返回完整contact
    // - 否则隐藏
    let showContact = false
    const isOwner = openId && job._openid && openId === job._openid
    const isTalentApproved = callerIsTalent && callerTalentCertStatus === 'approved'
    
    if (isTalentApproved || isOwner) {
      showContact = true
    }

    if (!showContact) {
      job.contact = "完成央音认证后可见"
    }

    // 4. 获取发布者认证信息（可选，如果job中没有存储发布者认证状态，可能需要额外查询发布者信息）
    // 假设 job 数据中包含 employerId，或者直接在 job 中存储了 isCertified
    // 这里为了 MVP 简化，假设 job 数据结构中已经包含了发布者的基本信息，或者我们需要去 users 表查一下发布者
    // 根据需求描述：返回数据包含 employer认证徽章标识（isCertified: true/false）
    
    let isEmployerCertified = false
    if (job._openid) {
        try {
            const employerRes = await db.collection('users').where({
                _openid: job._openid
            }).get()
            if (employerRes.data.length > 0) {
                isEmployerCertified = (employerRes.data[0].certStatus === 'approved')
            }
        } catch (e) {
            console.error('获取发布者信息失败', e)
        }
    }

    // 组装返回数据
    return {
      code: 200,
      data: {
        ...job,
        employer: {
            isCertified: isEmployerCertified
        }
      }
    }

  } catch (err) {
    console.error('get_job_detail 异常', err)
    return {
      code: 500,
      msg: '服务器内部错误',
      error: err
    }
  }
}
