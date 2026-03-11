// publish.js
// AI生成：中央音乐学院实践平台MVP - 发布需求页 | 日期：2026-02-16

const app = getApp()

Page({
  data: {
    currentUser: null,
    canPublish: false, // 是否可以发布（已认证甲方）
    
    // 表单数据
    title: '',
    description: '',
    salary: '',
    contact: '',
    skills: [],
    skillInput: '',
    
    // 技能标签预设
    skillOptions: ['钢琴', '小提琴', '声乐', '作曲', '指挥', '吉他', '大提琴', '长笛', '萨克斯', '打击乐'],
    
    submitting: false
  },

  onLoad() {
    this.checkPublishPermission()
  },

  onShow() {
    this.checkPublishPermission()
  },

  // 检查发布权限
  checkPublishPermission() {
    const currentUser = app.globalData.currentUser
    
    if (!currentUser) {
      this.setData({
        currentUser: null,
        canPublish: false
      })
      return
    }

    // 仅已认证甲方可发布
    const canPublish = currentUser.isEmployer && currentUser.employerCertStatus === 'approved'
    
    this.setData({
      currentUser: currentUser,
      canPublish: canPublish
    })
  },

  // 输入事件
  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value })
  },

  onSalaryInput(e) {
    this.setData({ salary: e.detail.value })
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value })
  },

  onSkillInput(e) {
    this.setData({ skillInput: e.detail.value })
  },

  // 添加技能标签
  addSkill() {
    const skill = this.data.skillInput.trim()
    if (!skill) return
    if (this.data.skills.includes(skill)) {
      wx.showToast({ title: '标签已存在', icon: 'none' })
      return
    }
    if (this.data.skills.length >= 5) {
      wx.showToast({ title: '最多添加5个标签', icon: 'none' })
      return
    }
    this.setData({
      skills: [...this.data.skills, skill],
      skillInput: ''
    })
  },

  // 选择预设技能
  selectSkillOption(e) {
    const skill = e.currentTarget.dataset.skill
    if (this.data.skills.includes(skill)) return
    if (this.data.skills.length >= 5) {
      wx.showToast({ title: '最多添加5个标签', icon: 'none' })
      return
    }
    this.setData({
      skills: [...this.data.skills, skill]
    })
  },

  // 删除技能标签
  removeSkill(e) {
    const index = e.currentTarget.dataset.index
    const skills = this.data.skills
    skills.splice(index, 1)
    this.setData({ skills })
  },

  // 提交需求
  async submitJob() {
    // 验证
    if (!this.data.title.trim()) {
      wx.showToast({ title: '请输入需求标题', icon: 'none' })
      return
    }
    if (!this.data.description.trim()) {
      wx.showToast({ title: '请输入需求详情', icon: 'none' })
      return
    }
    if (!this.data.salary.trim()) {
      wx.showToast({ title: '请输入实践补贴', icon: 'none' })
      return
    }
    if (!this.data.contact.trim()) {
      wx.showToast({ title: '请输入联系方式', icon: 'none' })
      return
    }
    if (this.data.skills.length === 0) {
      wx.showToast({ title: '请添加至少一个技能标签', icon: 'none' })
      return
    }

    if (this.data.submitting) return
    this.setData({ submitting: true })

    wx.showLoading({ title: '发布中...' })

    try {
      const db = wx.cloud.database()
      await db.collection('jobs').add({
        data: {
          title: this.data.title.trim(),
          description: this.data.description.trim(),
          salary: this.data.salary.trim(),
          contact: this.data.contact.trim(),
          skills: this.data.skills,
          status: 'active',
          employerCertified: true, // 发布者已认证
          createTime: db.serverDate()
        }
      })

      wx.hideLoading()
      this.setData({ submitting: false })

      wx.showModal({
        title: '发布成功',
        content: '您的需求已成功发布',
        showCancel: false,
        success: () => {
          // 清空表单
          this.setData({
            title: '',
            description: '',
            salary: '',
            contact: '',
            skills: [],
            skillInput: ''
          })
          // 跳转到首页
          wx.switchTab({
            url: '/pages/index/index'
          })
        }
      })
    } catch (err) {
      wx.hideLoading()
      this.setData({ submitting: false })
      console.error('发布失败', err)
      wx.showToast({ title: '发布失败，请重试', icon: 'none' })
    }
  },

  // 去登录
  goLogin() {
    wx.showLoading({ title: '登录中...' })
    app.login().then(result => {
      wx.hideLoading()
      if (result.needRegister) {
        wx.navigateTo({
          url: `/pages/roleSelect/roleSelect?openid=${result.openid}`
        })
      } else {
        this.checkPublishPermission()
      }
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '登录失败', icon: 'none' })
    })
  },

  // 去认证
  goCertify() {
    wx.navigateTo({
      url: '/pages/certification/certification'
    })
  }
})
