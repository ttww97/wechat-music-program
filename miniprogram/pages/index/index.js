// index.js
// AI生成：中央音乐学院实践平台MVP - 需求列表页 | 日期：2026-02-16
// 风格参考：Boss直聘

// 修改记录：2026-03-11 - 添加关键词搜索功能

const app = getApp()

Page({
  data: {
    jobList: [],
    loading: true,
    hasMore: true,
    page: 0,
    pageSize: 10,

    // 筛选条件
    filterCertified: false,
    sortOrder: 'desc', // desc=最新优先, asc=最早发布
    selectedSkill: '',  // 选中的技能标签

    // 搜索关键词（按标题搜索，Cloud DB RegExp 查询）
    searchKeyword: '',   // 输入框当前值（实时绑定）
    activeKeyword: '',   // 已提交生效的关键词

    // 技能选项
    skillOptions: ['钢琴', '小提琴', '大提琴', '声乐', '古筝', '二胡', '琴童', '合唱', '伴奏', '乐理', '作曲'],

    // 排序选项
    sortOptions: [
      { value: 'desc', label: '最新发布' },
      { value: 'asc', label: '最早发布' }
    ],
    showSortPicker: false,

    currentUser: null
  },

  onLoad() {
    this.loadJobList(true)
  },

  onShow() {
    console.log('首页 onShow 触发')
    this.setData({
      currentUser: app.globalData.currentUser
    })
    // 刷新列表（确保显示最新状态）
    this.loadJobList(true)
  },

  onPullDownRefresh() {
    this.loadJobList(true)
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadJobList(false)
    }
  },

  // 加载需求列表
  loadJobList(refresh = false) {
    if (refresh) {
      this.setData({ page: 0, jobList: [], hasMore: true })
    }
    
    this.setData({ loading: true })
    
    const db = wx.cloud.database()
    const _ = db.command
    
    // 构建查询条件
    let whereCondition = {
      status: 'active'
    }
    
    // 如果筛选认证甲方
    if (this.data.filterCertified) {
      whereCondition.employerCertified = true
    }
    
    // 如果筛选技能标签
    if (this.data.selectedSkill) {
      const _ = db.command
      whereCondition.skills = _.elemMatch(_.eq(this.data.selectedSkill))
    }

    // 关键词搜索：通过 Cloud DB 正则表达式匹配标题（不区分大小写）
    // Cloud DB 支持 db.RegExp，对标题做模糊匹配
    const keyword = this.data.activeKeyword.trim()
    if (keyword) {
      whereCondition.title = db.RegExp({
        regexp: keyword,
        options: 'i'  // 忽略大小写
      })
    }

    // 根据排序选项排序
    const orderDirection = this.data.sortOrder

    console.log('查询条件:', whereCondition)

    db.collection('jobs')
      .where(whereCondition)
      .orderBy('createTime', orderDirection)
      .skip(this.data.page * this.data.pageSize)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        console.log('查询结果:', res.data)
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
        console.error('获取需求列表失败', err)
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

  // 切换认证筛选
  toggleCertifiedFilter() {
    this.setData({
      filterCertified: !this.data.filterCertified
    })
    this.loadJobList(true)
  },

  // 显示排序选择器
  showSortOptions() {
    this.setData({ showSortPicker: true })
  },

  // 隐藏排序选择器
  hideSortPicker() {
    this.setData({ showSortPicker: false })
  },

  // 选择排序方式
  selectSort(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      sortOrder: value,
      showSortPicker: false
    })
    this.loadJobList(true)
  },

  // 选择技能筛选
  selectSkillFilter(e) {
    const skill = e.currentTarget.dataset.skill
    this.setData({ selectedSkill: skill })
    this.loadJobList(true)
  },

  // 跳转需求详情
  goJobDetail(e) {
    const jobId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/jobDetail/jobDetail?jobId=${jobId}`
    })
  },

  // ── 搜索相关方法 ─────────────────────────────────────────────

  // 输入框实时变化（仅更新 searchKeyword，不触发查询）
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  // 点击搜索按钮 / 键盘回车 → 触发搜索
  submitSearch() {
    const keyword = this.data.searchKeyword.trim()
    this.setData({ activeKeyword: keyword })
    this.loadJobList(true)
  },

  // 清空搜索
  clearSearch() {
    this.setData({ searchKeyword: '', activeKeyword: '' })
    this.loadJobList(true)
  },

  // ── 登录 ─────────────────────────────────────────────────────

  handleLogin() {
    wx.showLoading({ title: '登录中...' })
    app.login().then(result => {
      wx.hideLoading()
      if (result.needRegister) {
        wx.navigateTo({
          url: `/pages/roleSelect/roleSelect?openid=${result.openid}`
        })
      } else {
        this.setData({ currentUser: result })
        wx.showToast({ title: '登录成功', icon: 'success' })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('登录失败', err)
      wx.showToast({ title: '登录失败', icon: 'none' })
    })
  }
})
