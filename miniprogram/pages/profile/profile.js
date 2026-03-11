// profile.js
// AI生成：中央音乐学院实践平台MVP - 个人中心页 | 日期：2026-02-16

const app = getApp()

Page({
  data: {
    currentUser: null,
    isLoggedIn: false,
    needCertify: false,  // 是否需要认证
    unreadCount: 0       // 未读消息数
  },

  onLoad() {
    this.loadUserInfo()
  },

  onShow() {
    this.loadUserInfo()
    this.loadUnreadCount()
  },

  // 加载用户信息
  loadUserInfo() {
    let currentUser = app.globalData.currentUser
    const isLoggedIn = app.globalData.isLoggedIn
    
    // 兼容旧数据结构：如果有role字段但没有isTalent/isEmployer，自动转换
    if (currentUser && currentUser.role && !currentUser.isTalent && !currentUser.isEmployer) {
      if (currentUser.role === 'student') {
        currentUser.isTalent = true
        currentUser.talentCertStatus = currentUser.certStatus
      } else if (currentUser.role === 'employer') {
        currentUser.isEmployer = true
        currentUser.employerCertStatus = currentUser.certStatus
      }
    }
    
    // 计算是否需要认证（任一角色未认证即需要）
    let needCertify = false
    if (currentUser) {
      const talentNeedCert = currentUser.isTalent && currentUser.talentCertStatus !== 'approved'
      const employerNeedCert = currentUser.isEmployer && currentUser.employerCertStatus !== 'approved'
      needCertify = talentNeedCert || employerNeedCert
      
      // 如果没有选择任何角色，也需要去认证/选择角色
      if (!currentUser.isTalent && !currentUser.isEmployer) {
        needCertify = true
      }
    }
    
    this.setData({
      currentUser: currentUser,
      isLoggedIn: isLoggedIn,
      needCertify: needCertify
    })
  },

  // 登录
  handleLogin() {
    wx.showLoading({ title: '登录中...' })
    app.login().then(result => {
      wx.hideLoading()
      if (result.needRegister) {
        wx.navigateTo({
          url: `/pages/roleSelect/roleSelect?openid=${result.openid}`
        })
      } else {
        this.setData({
          currentUser: result,
          isLoggedIn: true
        })
        wx.showToast({ title: '登录成功', icon: 'success' })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('登录失败', err)
      wx.showToast({ title: '登录失败', icon: 'none' })
    })
  },

  // 去认证
  goCertify() {
    wx.navigateTo({
      url: '/pages/certification/certification'
    })
  },

  // 查看消息
  goMessages() {
    wx.navigateTo({
      url: '/pages/chatList/chatList'
    })
  },

  // 加载未读消息数
  async loadUnreadCount() {
    const currentUser = app.globalData.currentUser
    if (!currentUser || !currentUser._openid) return

    try {
      const db = wx.cloud.database()
      const _ = db.command

      // 获取当前用户参与的所有会话
      const convRes = await db.collection('conversations')
        .where({
          participants: currentUser._openid
        })
        .get()

      let totalUnread = 0

      // 计算每个会话的未读消息数
      for (const conv of convRes.data) {
        const lastReadTime = conv.lastReadTime?.[currentUser._openid]
        
        let unreadRes
        if (lastReadTime) {
          unreadRes = await db.collection('messages')
            .where({
              conversationId: conv._id,
              senderId: _.neq(currentUser._openid),
              createdAt: _.gt(lastReadTime)
            })
            .count()
        } else {
          unreadRes = await db.collection('messages')
            .where({
              conversationId: conv._id,
              senderId: _.neq(currentUser._openid)
            })
            .count()
        }
        totalUnread += unreadRes.total || 0
      }

      this.setData({ unreadCount: totalUnread })

      // 设置 tabBar 红点提示
      if (totalUnread > 0) {
        wx.setTabBarBadge({
          index: 2,
          text: totalUnread > 99 ? '99+' : String(totalUnread)
        })
      } else {
        wx.removeTabBarBadge({
          index: 2
        })
      }
    } catch (err) {
      console.error('加载未读消息数失败', err)
    }
  },

  // 查看我的发布（甲方）
  goMyJobs() {
    wx.navigateTo({
      url: '/pages/myJobs/myJobs'
    })
  },

  // 查看我的评论
  goMyComments() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout()
          this.setData({
            currentUser: null,
            isLoggedIn: false
          })
          wx.showToast({ title: '已退出登录', icon: 'success' })
        }
      }
    })
  },

  // 获取认证状态文字
  getCertStatusText(status) {
    const statusMap = {
      'unverified': '未认证',
      'pending': '审核中',
      'approved': '已认证',
      'rejected': '认证失败'
    }
    return statusMap[status] || '未认证'
  },

  // 获取角色文字
  getRoleText(user) {
    const roles = []
    if (user.isTalent) roles.push('音乐人才')
    if (user.isEmployer) roles.push('甲方')
    return roles.join(' / ') || '未知'
  }
})
