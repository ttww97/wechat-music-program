// app.js
// AI生成：中央音乐学院实践平台MVP | 日期：2026-02-16
App({
  globalData: {
    // env 参数说明：请填入环境 ID
    env: "cloud1-6grr5kb09db73e6c",
    // 当前用户信息
    currentUser: null,
    // 用户是否已登录
    isLoggedIn: false
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      return;
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true,
    });
    // 尝试自动登录
    this.autoLogin();
  },

  // 自动登录：检查本地缓存的用户信息
  autoLogin: function() {
    const userInfo = wx.getStorageSync('currentUser');
    // 检查 _openid 或 openid（兼容两种字段名）
    if (userInfo && (userInfo._openid || userInfo.openid)) {
      this.globalData.currentUser = userInfo;
      this.globalData.isLoggedIn = true;
      // 刷新用户最新状态
      this.refreshUserInfo();
    }
  },

  // 用户登录（获取openid并查询/创建用户记录）
  login: function() {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getOpenId' }
      }).then(res => {
        const openid = res.result.openid;
        // 查询用户是否存在
        this.checkUserExists(openid).then(user => {
          if (user) {
            this.globalData.currentUser = user;
            this.globalData.isLoggedIn = true;
            wx.setStorageSync('currentUser', user);
            resolve(user);
          } else {
            // 用户不存在，需要先选择角色注册
            resolve({ needRegister: true, openid: openid });
          }
        });
      }).catch(reject);
    });
  },

  // 检查用户是否存在
  checkUserExists: function(openid) {
    const db = wx.cloud.database();
    return db.collection('users').where({
      _openid: openid
    }).get().then(res => {
      return res.data.length > 0 ? res.data[0] : null;
    });
  },

  // 刷新用户信息
  refreshUserInfo: function() {
    if (!this.globalData.currentUser) return Promise.resolve(null);
    const db = wx.cloud.database();
    const currentUser = this.globalData.currentUser;
    
    // 优先用 _id 查询（更可靠），否则用 _openid
    let query;
    if (currentUser._id) {
      query = db.collection('users').doc(currentUser._id).get().then(res => {
        return { data: [res.data] };
      });
    } else {
      query = db.collection('users').where({
        _openid: currentUser._openid || currentUser.openid
      }).get();
    }
    
    return query.then(res => {
      if (res.data && res.data.length > 0) {
        const user = res.data[0];
        this.globalData.currentUser = user;
        wx.setStorageSync('currentUser', user);
        return user;
      }
      return null;
    });
  },

  // 注册新用户
  registerUser: function(userData) {
    const db = wx.cloud.database();
    return db.collection('users').add({
      data: {
        ...userData,
        certStatus: 'unverified', // 未认证
        createTime: db.serverDate()
      }
    }).then(res => {
      // 重新从数据库查询以获取完整用户信息（包括_openid）
      return db.collection('users').doc(res._id).get().then(userRes => {
        const newUser = userRes.data;
        this.globalData.currentUser = newUser;
        this.globalData.isLoggedIn = true;
        wx.setStorageSync('currentUser', newUser);
        return newUser;
      });
    });
  },

  // 退出登录
  logout: function() {
    this.globalData.currentUser = null;
    this.globalData.isLoggedIn = false;
    wx.removeStorageSync('currentUser');
  }
});
