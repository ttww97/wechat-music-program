// myJobs.js
// 我的发布页面

const app = getApp()

Page({
  data: {
    jobList: [],
    loading: true,
    hasMore: true,
    page: 0,
    pageSize: 10
  },

  onLoad() {
    this.loadMyJobs(true)
  },

  onShow() {
    // 每次显示时刷新列表
    this.loadMyJobs(true)
  },

  onPullDownRefresh() {
    this.loadMyJobs(true)
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMyJobs(false)
    }
  },

  // 加载我的发布列表
  loadMyJobs(refresh = false) {
    const currentUser = app.globalData.currentUser
    if (!currentUser || !currentUser._openid) {
      this.setData({ loading: false, jobList: [] })
      return
    }

    if (refresh) {
      this.setData({ page: 0, jobList: [], hasMore: true })
    }

    this.setData({ loading: true })

    const db = wx.cloud.database()
    
    // 查询当前用户发布的所有需求（按创建时间倒序）
    db.collection('jobs')
      .where({
        _openid: currentUser._openid
      })
      .orderBy('createTime', 'desc')
      .skip(this.data.page * this.data.pageSize)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        console.log('我的发布:', res.data)
        
        // 格式化时间
        const formattedList = res.data.map(item => ({
          ...item,
          createTimeStr: this.formatTime(item.createTime)
        }))
        
        const newList = refresh ? formattedList : [...this.data.jobList, ...formattedList]
        this.setData({
          jobList: newList,
          loading: false,
          hasMore: res.data.length === this.data.pageSize,
          page: this.data.page + 1
        })
        if (refresh) wx.stopPullDownRefresh()
      })
      .catch(err => {
        console.error('获取我的发布失败', err)
        this.setData({ loading: false })
        if (refresh) wx.stopPullDownRefresh()
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return '刚刚发布'
    const now = new Date()
    const target = new Date(date)
    const diff = now - target
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 30) return `${days}天前`
    return `${target.getMonth() + 1}月${target.getDate()}日`
  },

  // 跳转需求详情
  goJobDetail(e) {
    const jobId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/jobDetail/jobDetail?jobId=${jobId}`
    })
  },

  // 去发布
  goPublish() {
    wx.switchTab({
      url: '/pages/publish/publish'
    })
  },

  // 编辑需求（暂未实现）
  editJob(e) {
    const jobId = e.currentTarget.dataset.id
    wx.showToast({ title: '编辑功能开发中', icon: 'none' })
  },

  // 上架/下架
  toggleStatus(e) {
    const jobId = e.currentTarget.dataset.id
    const currentStatus = e.currentTarget.dataset.status
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const actionText = newStatus === 'active' ? '上架' : '下架'

    console.log('当前状态:', currentStatus, '新状态:', newStatus)

    wx.showModal({
      title: '确认操作',
      content: `确定要${actionText}这条需求吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          
          const db = wx.cloud.database()
          db.collection('jobs').doc(jobId).update({
            data: {
              status: newStatus
            }
          }).then((updateRes) => {
            console.log('更新结果:', updateRes)
            wx.hideLoading()
            wx.showToast({ title: `${actionText}成功`, icon: 'success' })
            this.loadMyJobs(true)
          }).catch(err => {
            wx.hideLoading()
            console.error('更新状态失败', err)
            wx.showToast({ title: '操作失败', icon: 'none' })
          })
        }
      }
    })
  },

  // 阻止事件冒泡
  stopPropagation() {}
})
