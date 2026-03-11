// chat.js
// 聊天详情页

const app = getApp()

Page({
  data: {
    conversationId: '',
    targetUserId: '',
    jobId: '',
    currentUser: null,
    otherUser: {},
    messages: [],
    inputValue: '',
    canSend: false,
    scrollToView: '',
    hasMore: false,
    page: 0,
    pageSize: 20,
    keyboardHeight: 0,
    watcher: null
  },

  onLoad(options) {
    const currentUser = app.globalData.currentUser
    if (!currentUser) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    this.setData({ 
      currentUser,
      targetUserId: options.targetUserId,
      jobId: options.jobId || ''
    })

    // 获取或创建会话
    this.getOrCreateConversation()

    // 监听键盘高度
    wx.onKeyboardHeightChange(res => {
      this.setData({ keyboardHeight: res.height })
      if (res.height > 0) {
        this.scrollToBottom()
      }
    })
  },

  onUnload() {
    // 关闭实时监听
    if (this.data.watcher) {
      this.data.watcher.close()
    }
  },

  // 获取或创建会话
  async getOrCreateConversation() {
    const db = wx.cloud.database()
    const _ = db.command
    const { currentUser, targetUserId, jobId } = this.data

    wx.showLoading({ title: '加载中...' })

    try {
      // 查找已存在的会话
      const res = await db.collection('conversations').where({
        participants: _.all([currentUser._openid, targetUserId])
      }).get()

      let conversationId
      
      if (res.data.length > 0) {
        // 已存在会话
        conversationId = res.data[0]._id
        this.setData({ 
          conversationId,
          otherUser: res.data[0].participantsInfo?.find(p => p.openid !== currentUser._openid) || {}
        })
      } else {
        // 创建新会话
        // 先获取对方用户信息
        const otherUserRes = await db.collection('users').where({
          _openid: targetUserId
        }).get()
        
        const otherUser = otherUserRes.data[0] || {}
        
        const createRes = await db.collection('conversations').add({
          data: {
            participants: [currentUser._openid, targetUserId],
            participantsInfo: [
              { openid: currentUser._openid, realName: currentUser.realName || '用户' },
              { openid: targetUserId, realName: otherUser.realName || '用户' }
            ],
            jobId: jobId,
            lastMessage: '',
            lastMessageTime: db.serverDate(),
            createdAt: db.serverDate()
          }
        })
        
        conversationId = createRes._id
        this.setData({ 
          conversationId,
          otherUser: { openid: targetUserId, realName: otherUser.realName || '用户' }
        })
      }

      // 设置导航栏标题
      wx.setNavigationBarTitle({
        title: this.data.otherUser.realName || '聊天'
      })

      // 加载消息
      await this.loadMessages(true)
      
      // 标记消息为已读
      this.markMessagesAsRead()
      
      // 开始实时监听
      this.startWatching()

      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      console.error('获取会话失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 加载消息
  async loadMessages(refresh = false) {
    const db = wx.cloud.database()
    const { conversationId, pageSize } = this.data

    if (!conversationId) return

    if (refresh) {
      this.setData({ page: 0, messages: [] })
    }

    try {
      const res = await db.collection('messages')
        .where({ conversationId })
        .orderBy('createdAt', 'desc')
        .skip(this.data.page * pageSize)
        .limit(pageSize)
        .get()

      const newMessages = res.data.reverse().map(msg => ({
        ...msg,
        timeStr: this.formatTime(msg.createdAt)
      }))

      const messages = refresh ? newMessages : [...newMessages, ...this.data.messages]

      this.setData({
        messages,
        hasMore: res.data.length === pageSize,
        page: this.data.page + 1
      })

      if (refresh) {
        this.scrollToBottom()
      }
    } catch (err) {
      console.error('加载消息失败', err)
    }
  },

  // 标记消息为已读（更新会话的最后阅读时间）
  async markMessagesAsRead() {
    const db = wx.cloud.database()
    const { conversationId, currentUser } = this.data

    console.log('标记已读 - conversationId:', conversationId, 'openid:', currentUser._openid)

    if (!conversationId) {
      console.log('标记已读失败: conversationId为空')
      return
    }

    try {
      // 更新当前用户的最后阅读时间
      const updateData = {}
      updateData[`lastReadTime.${currentUser._openid}`] = db.serverDate()
      
      console.log('更新数据:', updateData)
      
      const result = await db.collection('conversations').doc(conversationId).update({
        data: updateData
      })
      
      console.log('标记已读成功:', result)
    } catch (err) {
      console.error('标记已读失败:', err)
      // 如果更新失败，可能是权限问题，尝试使用 _ command 更新
    }
  },

  // 加载更早消息
  loadMoreMessages() {
    this.loadMessages(false)
  },

  // 开始实时监听新消息
  startWatching() {
    const db = wx.cloud.database()
    const { conversationId } = this.data

    const watcher = db.collection('messages')
      .where({ conversationId })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .watch({
        onChange: (snapshot) => {
          if (snapshot.type === 'init') return
          
          // 有新消息
          if (snapshot.docs.length > 0) {
            const newMsg = snapshot.docs[0]
            // 检查是否已存在
            const exists = this.data.messages.some(m => m._id === newMsg._id)
            
            if (!exists) {
              const messages = [...this.data.messages, {
                ...newMsg,
                timeStr: this.formatTime(newMsg.createdAt)
              }]
              this.setData({ messages })
              this.scrollToBottom()
            }
          }
        },
        onError: (err) => {
          console.error('监听失败', err)
        }
      })

    this.setData({ watcher })
  },

  // 发送消息
  async sendMessage() {
    const { inputValue, conversationId, currentUser } = this.data
    const content = inputValue.trim()

    if (!content) return

    // 先清空输入框
    this.setData({ inputValue: '' })

    const db = wx.cloud.database()

    try {
      // 发送消息到数据库，不在本地添加，由watcher统一处理
      await db.collection('messages').add({
        data: {
          conversationId,
          senderId: currentUser._openid,
          content,
          type: 'text',
          createdAt: db.serverDate(),
          read: false
        }
      })

      // 更新会话最后消息
      await db.collection('conversations').doc(conversationId).update({
        data: {
          lastMessage: content,
          lastMessageTime: db.serverDate()
        }
      })

    } catch (err) {
      console.error('发送失败', err)
      wx.showToast({ title: '发送失败', icon: 'none' })
      // 恢复输入内容
      this.setData({ inputValue: content })
    }
  },

  // 输入事件
  onInput(e) {
    const value = e.detail.value
    this.setData({ 
      inputValue: value,
      canSend: value.trim().length > 0
    })
  },

  // 滚动到底部
  scrollToBottom() {
    setTimeout(() => {
      this.setData({ scrollToView: 'bottom' })
    }, 100)
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
      return `昨天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }
    
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
})
