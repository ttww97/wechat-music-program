/*
【安全校验点】
1. 联系方式显示逻辑：前端+云函数双重校验（防绕过）
2. 评论入口：仅certStatus=approved且role=student用户可见
3. 所有云函数调用增加loading状态
*/

// AI生成：中央音乐学院实践平台MVP | 日期：2026-02-16
// 修改前请确认：已开启云开发环境 | 数据库权限：仅创建者可读写

const app = getApp()

Page({
  data: {
    job: null,
    showContact: false,
    canComment: false,
    loading: true
  },

  onLoad(options) {
    if (options.jobId) {
      this.setData({ jobId: options.jobId })
      this.getJobDetail(options.jobId)
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  onShow() {
    // 刷新认证状态（防页面返回后状态滞后）
    this.refreshUserStatus()
  },

  // 获取需求详情
  getJobDetail(jobId) {
    this.setData({ loading: true })
    wx.showLoading({ title: '加载中...' })

    wx.cloud.callFunction({
      name: 'get_job_detail',
      data: {
        jobId: jobId
      }
    }).then(res => {
      wx.hideLoading()
      this.setData({ loading: false })

      if (res.result.code === 200) {
        const job = res.result.data
        this.setData({ job })
        this.checkPermissions()
      } else if (res.result.code === 404) {
        wx.showToast({
          title: '该需求不存在或已下架',
          icon: 'none'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({
          title: '获取详情失败',
          icon: 'none'
        })
        console.error('get_job_detail error', res)
      }
    }).catch(err => {
      wx.hideLoading()
      this.setData({ loading: false })
      console.error('get_job_detail fail', err)
      wx.showToast({
        title: '网络异常，请重试',
        icon: 'none'
      })
    })
  },

  // 检查权限并更新UI状态
  checkPermissions() {
    const currentUser = app.globalData.currentUser || {}
    const { isTalent, talentCertStatus, _openid } = currentUser
    const job = this.data.job || {}

    // 已认证音乐人才可查看联系方式
    const isTalentApproved = isTalent && talentCertStatus === 'approved'
    
    // 发布者本人也可以查看（甲方查看自己发布的需求）
    const isOwner = _openid && job._openid && _openid === job._openid
    
    const showContact = isTalentApproved || isOwner
    const canComment = isTalentApproved

    this.setData({
      showContact,
      canComment,
      isOwner
    })
  },

  // 刷新用户状态
  refreshUserStatus() {
    // 假设 app.js 中有 refreshUserInfo 方法，或者直接重新检查 globalData
    // 这里简单起见，重新检查 globalData 并更新页面状态
    // 实际项目中可能需要调用云函数刷新用户信息
    if (app.refreshUserInfo) {
        app.refreshUserInfo().then(() => {
            this.checkPermissions()
        })
    } else {
        this.checkPermissions()
    }
  },

  // 跳转认证页面
  goCertify() {
    wx.navigateTo({
      url: '/pages/certification/certification'
    })
  },

  // 跳转评论页面
  goComment() {
    if (!this.data.canComment) return
    wx.navigateTo({
      url: `../comment/comment?jobId=${this.data.jobId}`
    })
  },

  // 发起聊天
  goChat() {
    const { job, isOwner } = this.data
    if (isOwner) {
      wx.showToast({ title: '不能与自己聊天', icon: 'none' })
      return
    }
    if (!job || !job._openid) {
      wx.showToast({ title: '无法获取发布者信息', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/chat/chat?targetUserId=${job._openid}&jobId=${this.data.jobId}`
    })
  }
})
