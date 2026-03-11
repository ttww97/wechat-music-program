// myComments.js
// 功能：当前用户的评论历史（含各状态：pending/approved/rejected）

const app = getApp()

// 评论状态的展示文字和颜色（供 WXML 使用）
const STATUS_CONFIG = {
  pending:  { text: '待审核', color: '#ff9800' },
  approved: { text: '已通过', color: '#4caf50' },
  rejected: { text: '未通过', color: '#f44336' }
}

Page({
  data: {
    commentList: [],
    loading: true,
    isEmpty: false
  },

  onLoad() {
    this.loadMyComments()
  },

  onShow() {
    // 每次显示时刷新（评论状态可能由管理员更新）
    this.loadMyComments()
  },

  // 加载当前用户的所有评论
  loadMyComments() {
    const currentUser = app.globalData.currentUser
    if (!currentUser || !currentUser._openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    const db = wx.cloud.database()

    // 查询当前用户的评论（Cloud DB 中用户只能查到自己创建的记录）
    db.collection('comments')
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        const comments = res.data.map(c => ({
          ...c,
          statusText:  (STATUS_CONFIG[c.status] || STATUS_CONFIG.pending).text,
          statusColor: (STATUS_CONFIG[c.status] || STATUS_CONFIG.pending).color,
          createTimeStr: this.formatTime(c.createTime)
        }))

        this.setData({
          commentList: comments,
          isEmpty: comments.length === 0,
          loading: false
        })
      })
      .catch(err => {
        console.error('加载我的评论失败', err)
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
  },

  // 跳转到对应需求详情
  goJobDetail(e) {
    const jobId = e.currentTarget.dataset.jobId
    if (!jobId) return
    wx.navigateTo({
      url: `/pages/jobDetail/jobDetail?jobId=${jobId}`
    })
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return ''
    const target = new Date(date)
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
  }
})
