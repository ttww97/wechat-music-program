// chatList.js
// 聊天列表页

const app = getApp()

Page({
  data: {
    conversations: [],
    loading: true,
    currentUser: null
  },

  onLoad() {
    const currentUser = app.globalData.currentUser
    if (!currentUser) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    this.setData({ currentUser })
  },

  onShow() {
    if (this.data.currentUser) {
      this.loadConversations()
    }
  },

  // 加载会话列表
  async loadConversations() {
    const db = wx.cloud.database()
    const _ = db.command
    const { currentUser } = this.data

    this.setData({ loading: true })

    try {
      // 获取当前用户参与的所有会话
      const res = await db.collection('conversations')
        .where({
          participants: currentUser._openid
        })
        .orderBy('lastMessageTime', 'desc')
        .get()

      // 并行查询每个会话的未读消息数
      const conversationsWithUnread = await Promise.all(
        res.data.map(async (conv) => {
          // 获取对方信息
          const otherUser = conv.participantsInfo?.find(p => p.openid !== currentUser._openid) || {}
          
          // 获取当前用户的最后阅读时间
          const lastReadTime = conv.lastReadTime?.[currentUser._openid]
          
          let unreadCount = 0
          if (lastReadTime) {
            // 查询最后阅读时间之后的未读消息
            const unreadRes = await db.collection('messages')
              .where({
                conversationId: conv._id,
                senderId: _.neq(currentUser._openid),
                createdAt: _.gt(lastReadTime)
              })
              .count()
            unreadCount = unreadRes.total || 0
          } else {
            // 没有阅读记录，统计所有对方发的消息
            const unreadRes = await db.collection('messages')
              .where({
                conversationId: conv._id,
                senderId: _.neq(currentUser._openid)
              })
              .count()
            unreadCount = unreadRes.total || 0
          }
          
          return {
            ...conv,
            otherUser,
            unreadCount,
            timeStr: this.formatTime(conv.lastMessageTime)
          }
        })
      )

      this.setData({ 
        conversations: conversationsWithUnread,
        loading: false 
      })
    } catch (err) {
      console.error('加载会话失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 跳转聊天详情
  goChat(e) {
    const conversation = e.currentTarget.dataset.conversation
    wx.navigateTo({
      url: `/pages/chat/chat?targetUserId=${conversation.otherUser.openid}`
    })
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    const now = new Date()
    const diff = now - d
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (d >= today) {
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }
    
    const yesterday = new Date(today - 86400000)
    if (d >= yesterday) {
      return '昨天'
    }
    
    if (d.getFullYear() === now.getFullYear()) {
      return `${d.getMonth() + 1}/${d.getDate()}`
    }
    
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
  }
})
