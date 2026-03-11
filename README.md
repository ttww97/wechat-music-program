# 中央音乐学院音乐人才对接小程序

> MVP版本 | 基于微信云开发

## 🎯 项目简介

本项目是中央音乐学院音乐人才对接平台的MVP版本，聚焦「认证-发需求-看联系方式-评论」核心主流程。

## ✅ 已实现功能

### 前端页面
| 页面 | 路径 | 状态 | 说明 |
|------|------|------|------|
| 需求广场(首页) | pages/index | ✅ 完成 | 需求列表、筛选认证甲方、下拉刷新 |
| 需求详情 | pages/jobDetail | ✅ 完成 | 联系方式动态显示（仅认证学生可见） |
| 角色选择 | pages/roleSelect | ✅ 完成 | 注册时选择学生/甲方身份 |
| 实名认证 | pages/certification | ✅ 完成 | 上传认证材料、显示审核状态 |
| 发布需求 | pages/publish | ✅ 完成 | 仅认证甲方可发布、技能标签 |
| 发表评论 | pages/comment | ✅ 完成 | 仅认证学生可评论、1-5星评分 |
| 个人中心 | pages/profile | ✅ 完成 | 登录/登出、认证状态、功能入口 |

### 云函数
| 云函数 | 状态 | 说明 |
|---------|------|------|
| quickstartFunctions | ✅ 完成 | 获取OpenID、数据库操作 |
| get_job_detail | ✅ 完成 | 需求详情（含联系方式动态过滤） |
| checkAuth | ✅ 完成 | 校验用户认证状态 |
| submitComment | ✅ 完成 | 提交评论（含权限校验） |

### 数据库集合设计
| 集合 | 关键字段 | 说明 |
|------|---------|------|
| users | openid, role, realName, certImgs[], certStatus, createTime | 用户信息 |
| jobs | title, description, salary, skills[], contact, status, employerCertified, createTime | 需求信息 |
| comments | jobId, userId, rating, content, status(pending/approved), createTime | 评论信息 |

## ⚠️ 待完善功能

### P1 - 建议优先完善
- [ ] **tabBar图标替换** - 当前使用占位图标，需替换为真实设计图
- [ ] **数据库集合初始化** - 需在云开发控制台创建 users/jobs/comments 集合
- [ ] **数据库权限配置** - 配置安全规则防止非法访问
- [ ] **管理后台审核流程** - 使用云开发控制台审核认证材料和评论

### P2 - 可后续迭代
- [ ] 我的发布列表（甲方查看自己发布的需求）
- [ ] 我的评论列表（学生查看自己的评论）
- [ ] 需求详情页显示评论列表
- [ ] 需求搜索功能
- [ ] 消息通知（认证结果、评论审核结果）

### 已砍掉的功能（非MVP）
- 简历编辑器
- 作品上传
- 申请记录
- 站内信
- 支付功能

## 🚀 快速开始

### 1. 环境配置
1. 打开微信开发者工具
2. 点击右上角「云开发」按钮，开通云开发
3. 复制环境ID
4. 在 `miniprogram/app.js` 中配置 `env` 参数

### 2. 初始化数据库
在云开发控制台创建以下集合：
- `users` - 用户集合
- `jobs` - 需求集合
- `comments` - 评论集合

### 3. 部署云函数
在微信开发者工具中，对 `cloudfunctions` 目录下的每个云函数文件夹右键，选择「上传并部署 - 云端安装依赖」

### 4. 配置数据库权限
建议在云开发控制台为每个集合配置合适的安全规则：
- users: 仅创建者可读写
- jobs: 所有用户可读，仅创建者可写
- comments: 所有用户可读，仅创建者可写

## 📁 项目结构

```
miniprogram-1/
├── cloudfunctions/          # 云函数
│   ├── checkAuth/           # 校验认证状态
│   ├── get_job_detail/      # 获取需求详情
│   ├── submitComment/       # 提交评论
│   └── quickstartFunctions/ # 基础功能
└── miniprogram/             # 小程序前端
    ├── pages/
    │   ├── index/           # 需求广场(首页)
    │   ├── jobDetail/       # 需求详情
    │   ├── roleSelect/      # 角色选择
    │   ├── certification/   # 实名认证
    │   ├── publish/         # 发布需求
    │   ├── comment/         # 发表评论
    │   └── profile/         # 个人中心
    ├── app.js               # 全局配置、登录逻辑
    ├── app.json             # 页面路由、tabBar
    └── app.wxss             # 全局样式
```

## 🛡️ 安全设计

1. **联系方式保护** - 前端+云函数双重校验，仅认证学生可见
2. **评论审核** - 所有评论默认 pending 状态，需管理员审核
3. **认证材料** - 上传至云存储，仅管理员可访问

---

> 技术栈：微信小程序 + 微信云开发  
> 生成日期：2026-02-16
