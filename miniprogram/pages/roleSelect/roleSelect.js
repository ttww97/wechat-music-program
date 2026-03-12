// roleSelect.js
// AI生成：中央音乐学院实践平台MVP - 角色选择页 | 日期：2026-02-16

const app = getApp()

Page({
  data: {
    openid: '',
    isTalent: false,   // 是否为音乐人才
    isEmployer: false, // 是否为甲方
    isReviewer: false, // 是否为审核员
    submitting: false
  },

  onLoad(options) {
    if (options.openid) {
      this.setData({ openid: options.openid })
    } else {
      // 如果没有openid，返回上一页
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  // 切换角色（多选）
  toggleRole(e) {
    const role = e.currentTarget.dataset.role
    if (role === 'talent') {
      this.setData({ isTalent: !this.data.isTalent })
    } else if (role === 'employer') {
      this.setData({ isEmployer: !this.data.isEmployer })
    } else if (role === 'reviewer') {
      this.setData({ isReviewer: !this.data.isReviewer })
    }
  },

  // 确认注册
  confirmRegister() {
    if (!this.data.isTalent && !this.data.isEmployer && !this.data.isReviewer) {
      wx.showToast({
        title: '请至少选择一个身份',
        icon: 'none'
      })
      return
    }

    if (this.data.submitting) return
    this.setData({ submitting: true })

    wx.showLoading({ title: '注册中...' })

    // 调用app.js中的注册方法
    app.registerUser({
      isTalent: this.data.isTalent,
      isEmployer: this.data.isEmployer,
      isReviewer: this.data.isReviewer,
      realName: '',
      certImgs: [],
      talentCertStatus: this.data.isTalent ? 'unverified' : null,
      employerCertStatus: this.data.isEmployer ? 'unverified' : null
    }).then(user => {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({
        title: '注册成功',
        icon: 'success'
      })
      
      // 跳转到认证页面
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/certification/certification'
        })
      }, 1500)
    }).catch(err => {
      wx.hideLoading()
      this.setData({ submitting: false })
      console.error('注册失败', err)
      wx.showToast({
        title: '注册失败，请重试',
        icon: 'none'
      })
    })
  },

  // 跳过，直接进入首页
  skipRegister() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  }
})
