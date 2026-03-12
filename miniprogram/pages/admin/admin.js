// admin.js
// 管理后台 - 资质认证审核 + 评论审核
// 仅管理员（admins 集合）和审核员（users.isReviewer）可访问

const app = getApp()

Page({
  data: {
    hasPermission: false,
    loading: false,
    activeTab: 'certs',       // 'certs' | 'comments'
    pendingCerts: [],
    pendingComments: []
  },

  onLoad() {
    this.checkPermission()
  },

  onShow() {
    if (this.data.hasPermission) {
      this.loadData()
    }
  },

  // 检查当前用户是否为管理员或审核员
  async checkPermission() {
    const currentUser = app.globalData.currentUser
    if (!currentUser) {
      this.setData({ hasPermission: false })
      return
    }

    // 方式1：用户本身标记了 isReviewer
    if (currentUser.isReviewer) {
      this.setData({ hasPermission: true })
      this.loadData()
      return
    }

    // 方式2：检查 admins 集合
    try {
      const db = wx.cloud.database()
      const res = await db.collection('admins').where({
        _openid: currentUser._openid
      }).get()
      const isAdmin = res.data.length > 0
      this.setData({ hasPermission: isAdmin })
      if (isAdmin) {
        this.loadData()
      }
    } catch (err) {
      console.error('检查权限失败', err)
      this.setData({ hasPermission: false })
    }
  },

  // 切换 Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  // 加载待审核数据
  async loadData() {
    this.setData({ loading: true })

    try {
      const [certsRes, commentsRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'adminReview', data: { action: 'listPendingCerts' } }),
        wx.cloud.callFunction({ name: 'adminReview', data: { action: 'listPendingComments' } })
      ])

      this.setData({
        pendingCerts: certsRes.result.code === 200 ? certsRes.result.data : [],
        pendingComments: commentsRes.result.code === 200 ? commentsRes.result.data : [],
        loading: false
      })
    } catch (err) {
      console.error('加载审核数据失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 预览认证图片
  previewImage(e) {
    const { urls, current } = e.currentTarget.dataset
    wx.previewImage({ current, urls })
  },

  // 通过认证
  handleApprove(e) {
    const { userId, certType } = e.currentTarget.dataset
    const certLabel = certType === 'talent' ? '人才' : '甲方'

    wx.showModal({
      title: '确认通过',
      content: `确定通过该用户的${certLabel}认证吗？`,
      success: (res) => {
        if (res.confirm) {
          this.doReview('approveCert', { userId, certType })
        }
      }
    })
  },

  // 拒绝认证
  handleReject(e) {
    const { userId, certType } = e.currentTarget.dataset
    const certLabel = certType === 'talent' ? '人才' : '甲方'

    wx.showModal({
      title: '拒绝认证',
      content: `请输入拒绝${certLabel}认证的原因`,
      editable: true,
      placeholderText: '请输入拒绝原因',
      success: (res) => {
        if (res.confirm) {
          this.doReview('rejectCert', {
            userId,
            certType,
            reason: res.content || '材料不符合要求，请重新提交'
          })
        }
      }
    })
  },

  // 通过评论
  handleApproveComment(e) {
    const { commentId } = e.currentTarget.dataset
    wx.showModal({
      title: '确认通过',
      content: '确定通过该评论吗？',
      success: (res) => {
        if (res.confirm) {
          this.doReview('approveComment', { commentId })
        }
      }
    })
  },

  // 拒绝评论
  handleRejectComment(e) {
    const { commentId } = e.currentTarget.dataset
    wx.showModal({
      title: '拒绝评论',
      content: '请输入拒绝原因',
      editable: true,
      placeholderText: '请输入拒绝原因',
      success: (res) => {
        if (res.confirm) {
          this.doReview('rejectComment', {
            commentId,
            reason: res.content || '内容不符合平台规范'
          })
        }
      }
    })
  },

  // 执行审核操作
  async doReview(action, data) {
    wx.showLoading({ title: '处理中...' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'adminReview',
        data: { action, ...data }
      })

      wx.hideLoading()

      if (res.result.code === 200) {
        wx.showToast({ title: res.result.msg, icon: 'success' })
        // 刷新列表
        this.loadData()
      } else {
        wx.showToast({ title: res.result.msg || '操作失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('审核操作失败', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  }
})
