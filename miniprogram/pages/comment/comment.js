// comment.js
// AI生成：中央音乐学院实践平台MVP - 评论页面 | 日期：2026-02-16

const app = getApp()

Page({
  data: {
    jobId: '',
    jobTitle: '',
    currentUser: null,
    canComment: false,
    
    rating: 5, // 评分 1-5
    content: '', // 评论内容
    submitting: false
  },

  onLoad(options) {
    if (options.jobId) {
      this.setData({ jobId: options.jobId })
      this.loadJobInfo(options.jobId)
    }
    this.checkCommentPermission()
  },

  // 加载需求信息
  loadJobInfo(jobId) {
    const db = wx.cloud.database()
    db.collection('jobs').doc(jobId).get().then(res => {
      this.setData({ jobTitle: res.data.title })
    }).catch(err => {
      console.error('获取需求信息失败', err)
    })
  },

  // 检查评论权限
  checkCommentPermission() {
    const currentUser = app.globalData.currentUser
    
    if (!currentUser) {
      this.setData({
        currentUser: null,
        canComment: false
      })
      return
    }

    // 仅已认证学生可评论
    const canComment = currentUser.isTalent && currentUser.talentCertStatus === 'approved'
    
    this.setData({
      currentUser: currentUser,
      canComment: canComment
    })
  },

  // 选择评分
  selectRating(e) {
    const rating = e.currentTarget.dataset.rating
    this.setData({ rating: rating })
  },

  // 输入评论内容
  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  // 提交评论
  async submitComment() {
    if (!this.data.content.trim()) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }

    if (this.data.content.trim().length < 10) {
      wx.showToast({ title: '评论内容至少10个字', icon: 'none' })
      return
    }

    if (this.data.submitting) return
    this.setData({ submitting: true })

    wx.showLoading({ title: '提交中...' })

    try {
      const db = wx.cloud.database()
      await db.collection('comments').add({
        data: {
          jobId: this.data.jobId,
          rating: this.data.rating,
          content: this.data.content.trim(),
          status: 'pending', // 待审核
          createTime: db.serverDate()
        }
      })

      wx.hideLoading()
      this.setData({ submitting: false })

      wx.showModal({
        title: '提交成功',
        content: '您的评论已提交，待管理员审核后显示',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    } catch (err) {
      wx.hideLoading()
      this.setData({ submitting: false })
      console.error('提交评论失败', err)
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    }
  },

  // 去认证
  goCertify() {
    wx.navigateTo({
      url: '/pages/certification/certification'
    })
  }
})
