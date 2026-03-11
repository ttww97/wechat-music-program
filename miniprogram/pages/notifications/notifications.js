// notifications.js
// 功能：显示当前用户的所有通知（认证审核结果、评论审核结果）
// 通知来源：adminReview 云函数在审核时写入 notifications 集合

const app = getApp()

// 通知类型对应的图标
const TYPE_ICONS = {
  cert_approved:    '✅',
  cert_rejected:    '❌',
  comment_approved: '💬',
  comment_rejected: '🚫'
}

Page({
  data: {
    notificationList: [],
    loading: true,
    isEmpty: false,
    unreadCount: 0
  },

  onLoad() {
    this.loadNotifications()
  },

  onShow() {
    this.loadNotifications()
  },

  // 加载通知列表并标记全部已读
  async loadNotifications() {
    const currentUser = app.globalData.currentUser
    if (!currentUser || !currentUser._openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    const db = wx.cloud.database()

    try {
      // Cloud DB 数据库权限：用户只能查询自己的记录（按 _openid 过滤）
      const res = await db.collection('notifications')
        .orderBy('createTime', 'desc')
        .get()

      const notifications = res.data.map(n => ({
        ...n,
        icon: TYPE_ICONS[n.type] || '📢',
        createTimeStr: this.formatTime(n.createTime)
      }))

      const unreadCount = notifications.filter(n => !n.isRead).length

      this.setData({
        notificationList: notifications,
        unreadCount,
        isEmpty: notifications.length === 0,
        loading: false
      })

      // 批量标记为已读
      if (unreadCount > 0) {
        this.markAllRead()
      }

      // 清除 profile 页面的通知数量徽章
      wx.removeTabBarBadge({ index: 2 })

    } catch (err) {
      console.error('加载通知失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 批量标记未读通知为已读
  async markAllRead() {
    const db = wx.cloud.database()
    try {
      await db.collection('notifications')
        .where({ isRead: false })
        .update({ data: { isRead: true } })
    } catch (err) {
      console.error('标记已读失败', err)
    }
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return ''
    const now = new Date()
    const target = new Date(date)
    const diff = now - target
    const minutes = Math.floor(diff / 60000)
    const hours   = Math.floor(diff / 3600000)
    const days    = Math.floor(diff / 86400000)

    if (minutes < 1)  return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24)   return `${hours}小时前`
    if (days < 30)    return `${days}天前`
    return `${target.getMonth() + 1}月${target.getDate()}日`
  }
})
