// certification.js
// AI生成：中央音乐学院实践平台MVP - 认证材料上传页 | 日期：2026-02-16

const app = getApp()

Page({
  data: {
    currentUser: null,
    realName: '',
    certImgs: [], // 认证图片列表
    submitting: false,
    maxImgCount: 3, // 最多上传3张图片
    initialized: false, // 标记是否已初始化
    certRole: '', // 当前要认证的角色 'talent' 或 'employer'
    needSelectRole: false, // 是否需要选择角色
    allCertified: false // 是否所有角色都已认证
  },

  onLoad() {
    this.loadUserInfo()
  },

  onShow() {
    // 只在未初始化时加载用户信息，避免覆盖用户输入
    if (!this.data.initialized) {
      this.loadUserInfo()
    }
  },

  loadUserInfo() {
    let currentUser = app.globalData.currentUser
    if (currentUser) {
      // 兼容旧数据结构：如果有role字段但没有isTalent/isEmployer，自动转换
      if (currentUser.role && !currentUser.isTalent && !currentUser.isEmployer) {
        if (currentUser.role === 'student') {
          currentUser.isTalent = true
          currentUser.talentCertStatus = currentUser.certStatus
        } else if (currentUser.role === 'employer') {
          currentUser.isEmployer = true
          currentUser.employerCertStatus = currentUser.certStatus
        }
      }
      
      // 计算需要认证的角色
      const talentNeedCert = currentUser.isTalent && 
        currentUser.talentCertStatus !== 'approved' && 
        currentUser.talentCertStatus !== 'pending'
      const employerNeedCert = currentUser.isEmployer && 
        currentUser.employerCertStatus !== 'approved' && 
        currentUser.employerCertStatus !== 'pending'
      
      // 检查是否所有角色都已认证
      const talentDone = !currentUser.isTalent || currentUser.talentCertStatus === 'approved' || currentUser.talentCertStatus === 'pending'
      const employerDone = !currentUser.isEmployer || currentUser.employerCertStatus === 'approved' || currentUser.employerCertStatus === 'pending'
      const allCertified = talentDone && employerDone
      
      // 判断是否需要选择角色
      const needSelectRole = talentNeedCert && employerNeedCert
      
      // 如果只有一个角色需要认证，自动选中
      let certRole = ''
      if (!needSelectRole) {
        if (talentNeedCert) certRole = 'talent'
        else if (employerNeedCert) certRole = 'employer'
      }
      
      this.setData({
        currentUser: currentUser,
        realName: currentUser.realName || '',
        certImgs: [],
        initialized: true,
        needSelectRole: needSelectRole,
        certRole: certRole,
        allCertified: allCertified
      })
    } else {
      // 未登录，跳转首页
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }, 1500)
    }
  },

  // 选择要认证的角色
  selectCertRole(e) {
    const role = e.currentTarget.dataset.role
    this.setData({ 
      certRole: role,
      certImgs: [] // 清空已选图片
    })
  },

  // 输入真实姓名
  onNameInput(e) {
    this.setData({ realName: e.detail.value })
  },

  // 选择图片
  chooseImage() {
    const remainCount = this.data.maxImgCount - this.data.certImgs.length
    if (remainCount <= 0) {
      wx.showToast({
        title: '最多上传3张图片',
        icon: 'none'
      })
      return
    }

    wx.chooseMedia({
      count: remainCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImgs = res.tempFiles.map(file => ({
          tempPath: file.tempFilePath,
          uploaded: false,
          cloudPath: ''
        }))
        this.setData({
          certImgs: [...this.data.certImgs, ...newImgs]
        })
      }
    })
  },

  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index
    const certImgs = this.data.certImgs
    certImgs.splice(index, 1)
    this.setData({ certImgs })
  },

  // 预览图片
  previewImage(e) {
    const current = e.currentTarget.dataset.url
    const urls = this.data.certImgs.map(img => img.tempPath || img.cloudPath)
    wx.previewImage({
      current: current,
      urls: urls
    })
  },

  // 上传图片到云存储
  async uploadImages() {
    const uploadPromises = this.data.certImgs.map(async (img, index) => {
      if (img.uploaded && img.cloudPath) {
        return img.cloudPath
      }
      
      const cloudPath = `certifications/${app.globalData.currentUser._id}/${Date.now()}_${index}.jpg`
      const result = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: img.tempPath
      })
      return result.fileID
    })

    return Promise.all(uploadPromises)
  },

  // 提交认证
  async submitCertification() {
    // 验证
    if (!this.data.certRole) {
      wx.showToast({
        title: '请选择要认证的身份',
        icon: 'none'
      })
      return
    }

    if (!this.data.realName.trim()) {
      wx.showToast({
        title: '请输入真实姓名',
        icon: 'none'
      })
      return
    }

    if (this.data.certImgs.length === 0) {
      wx.showToast({
        title: '请上传认证材料',
        icon: 'none'
      })
      return
    }

    if (this.data.submitting) return
    this.setData({ submitting: true })

    wx.showLoading({ title: '提交中...' })

    try {
      // 上传图片
      const cloudPaths = await this.uploadImages()

      // 根据认证角色更新不同字段
      const db = wx.cloud.database()
      const updateData = {
        realName: this.data.realName.trim()
      }
      
      if (this.data.certRole === 'talent') {
        updateData.talentCertImgs = cloudPaths
        updateData.talentCertStatus = 'pending'
        updateData.talentCertSubmitTime = db.serverDate()
      } else {
        updateData.employerCertImgs = cloudPaths
        updateData.employerCertStatus = 'pending'
        updateData.employerCertSubmitTime = db.serverDate()
      }

      await db.collection('users').doc(this.data.currentUser._id).update({
        data: updateData
      })

      // 刷新本地用户信息
      await app.refreshUserInfo()

      wx.hideLoading()
      this.setData({ submitting: false })

      const roleText = this.data.certRole === 'talent' ? '音乐人才' : '甲方'
      wx.showModal({
        title: '提交成功',
        content: `您的${roleText}认证材料已提交，请等待管理员审核`,
        showCancel: false,
        success: () => {
          wx.switchTab({
            url: '/pages/profile/profile'
          })
        }
      })
    } catch (err) {
      wx.hideLoading()
      this.setData({ submitting: false })
      console.error('提交认证失败', err)
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      })
    }
  },

  // 返回
  goBack() {
    wx.navigateBack()
  }
})
