/*
【安全校验点】
1. 联系方式显示逻辑：前端+云函数双重校验（防绕过）
2. 评论入口：仅 isTalent=true && talentCertStatus=approved 用户可见
3. 所有云函数调用增加 loading 状态
*/

// AI生成：中央音乐学院实践平台MVP | 日期：2026-02-16
// 修改记录：2026-03-11 - 添加评论列表功能（调用 getComments 云函数）

const app = getApp()

Page({
  data: {
    job: null,
    jobId: null,
    showContact: false,
    canComment: false,
    isOwner: false,
    loading: true,

    // 评论列表
    commentList: [],
    totalComments: 0,
    avgRating: 0,
    loadingComments: false,
    commentPage: 0,
    commentPageSize: 5,
    hasMoreComments: true
  },

  onLoad(options) {
    if (options.jobId) {
      this.setData({ jobId: options.jobId })
      this.getJobDetail(options.jobId)
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  onShow() {
    // 刷新认证状态（防页面返回后状态滞后）
    this.refreshUserStatus()
  },

  // ── 获取需求详情 ─────────────────────────────────────────────

  getJobDetail(jobId) {
    this.setData({ loading: true })
    wx.showLoading({ title: '加载中...' })

    wx.cloud.callFunction({
      name: 'get_job_detail',
      data: { jobId }
    }).then(res => {
      wx.hideLoading()
      this.setData({ loading: false })

      if (res.result.code === 200) {
        this.setData({ job: res.result.data })
        this.checkPermissions()
        // 详情加载完后加载评论
        this.loadComments(jobId, true)
      } else if (res.result.code === 404) {
        wx.showToast({ title: '该需求不存在或已下架', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1500)
      } else {
        wx.showToast({ title: '获取详情失败', icon: 'none' })
        console.error('get_job_detail error', res)
      }
    }).catch(err => {
      wx.hideLoading()
      this.setData({ loading: false })
      console.error('get_job_detail fail', err)
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    })
  },

  // ── 加载评论列表 ─────────────────────────────────────────────

  loadComments(jobId, refresh = false) {
    if (this.data.loadingComments) return
    if (!refresh && !this.data.hasMoreComments) return

    const page = refresh ? 0 : this.data.commentPage

    this.setData({ loadingComments: true })

    wx.cloud.callFunction({
      name: 'getComments',
      data: {
        jobId: jobId || this.data.jobId,
        page,
        pageSize: this.data.commentPageSize
      }
    }).then(res => {
      if (res.result.code === 200) {
        const { comments, total, avgRating, hasMore } = res.result.data
        const existing = refresh ? [] : this.data.commentList

        this.setData({
          commentList: [...existing, ...comments],
          totalComments: total,
          avgRating,
          hasMoreComments: hasMore,
          commentPage: page + 1,
          loadingComments: false
        })
      } else {
        this.setData({ loadingComments: false })
      }
    }).catch(err => {
      console.error('getComments fail', err)
      this.setData({ loadingComments: false })
    })
  },

  // 上拉加载更多评论
  loadMoreComments() {
    this.loadComments(this.data.jobId, false)
  },

  // ── 权限校验 ─────────────────────────────────────────────────

  checkPermissions() {
    const currentUser = app.globalData.currentUser || {}
    const { isTalent, talentCertStatus, _openid } = currentUser
    const job = this.data.job || {}

    // 已认证音乐人才可查看联系方式 + 发表评论
    const isTalentApproved = isTalent && talentCertStatus === 'approved'
    // 发布者本人也可查看联系方式
    const isOwner = _openid && job._openid && _openid === job._openid

    this.setData({
      showContact: isTalentApproved || isOwner,
      canComment:  isTalentApproved,
      isOwner
    })
  },

  // 刷新用户状态（onShow 调用，防止认证后回到此页面权限仍旧）
  refreshUserStatus() {
    if (app.refreshUserInfo) {
      app.refreshUserInfo().then(() => this.checkPermissions())
    } else {
      this.checkPermissions()
    }
  },

  // ── 页面跳转 ─────────────────────────────────────────────────

  goCertify() {
    wx.navigateTo({ url: '/pages/certification/certification' })
  },

  goComment() {
    if (!this.data.canComment) return
    wx.navigateTo({ url: `../comment/comment?jobId=${this.data.jobId}` })
  },

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
