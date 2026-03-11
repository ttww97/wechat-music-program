/**
 * getComments 云函数测试
 *
 * 业务规则：
 * 1. 必须提供 jobId
 * 2. 只返回 status='approved' 的评论
 * 3. 支持分页（page、pageSize，默认第 0 页，每页 10 条）
 * 4. 返回评论列表、总数、平均评分
 * 5. 评论按 createTime 倒序排列（最新在前）
 */

const cloud = require('wx-server-sdk')
const { main } = require('../cloudfunctions/getComments/index')

// 测试固件
const APPROVED_COMMENTS = [
  { _id: 'c1', jobId: 'job_1', userName: '张三', rating: 5, content: '非常好的机会！', status: 'approved', createTime: new Date('2026-03-01') },
  { _id: 'c2', jobId: 'job_1', userName: '李四', rating: 3, content: '一般般，待遇偏低', status: 'approved', createTime: new Date('2026-03-02') },
  { _id: 'c3', jobId: 'job_1', userName: '王五', rating: 4, content: '整体不错，推荐', status: 'approved', createTime: new Date('2026-03-03') }
]

const PENDING_COMMENT  = { _id: 'c4', jobId: 'job_1', userName: '赵六', rating: 2, content: '不推荐', status: 'pending', createTime: new Date('2026-03-04') }
const REJECTED_COMMENT = { _id: 'c5', jobId: 'job_1', userName: '孙七', rating: 1, content: '有问题的需求', status: 'rejected', createTime: new Date('2026-03-05') }
const OTHER_JOB_COMMENT = { _id: 'c6', jobId: 'job_2', userName: '周八', rating: 5, content: '另一个需求的评论', status: 'approved', createTime: new Date('2026-03-06') }

describe('getComments 云函数', () => {

  describe('参数校验', () => {
    test('缺少 jobId → 400', async () => {
      cloud.setup({ comments: [] }, 'any_openid')
      const result = await main({})
      expect(result.code).toBe(400)
    })
  })

  describe('数据过滤', () => {
    beforeEach(() => {
      cloud.setup({
        comments: [...APPROVED_COMMENTS, PENDING_COMMENT, REJECTED_COMMENT, OTHER_JOB_COMMENT]
      }, 'any_openid')
    })

    test('只返回 status=approved 的评论', async () => {
      const result = await main({ jobId: 'job_1' })
      expect(result.code).toBe(200)
      result.data.comments.forEach(c => {
        expect(c.status).toBe('approved')
      })
    })

    test('pending 和 rejected 评论不在结果中', async () => {
      const result = await main({ jobId: 'job_1' })
      const ids = result.data.comments.map(c => c._id)
      expect(ids).not.toContain('c4')  // pending
      expect(ids).not.toContain('c5')  // rejected
    })

    test('只返回指定 jobId 的评论', async () => {
      const result = await main({ jobId: 'job_1' })
      result.data.comments.forEach(c => {
        expect(c.jobId).toBe('job_1')
      })
      const ids = result.data.comments.map(c => c._id)
      expect(ids).not.toContain('c6')  // job_2 的评论
    })

    test('返回评论总数', async () => {
      const result = await main({ jobId: 'job_1' })
      expect(result.data.total).toBe(3)  // 3 条 approved
    })

    test('返回平均评分（精确到一位小数）', async () => {
      // 评分：5 + 3 + 4 = 12，平均 4.0
      const result = await main({ jobId: 'job_1' })
      expect(result.data.avgRating).toBeCloseTo(4.0, 1)
    })
  })

  describe('空结果处理', () => {
    test('无评论时返回空列表和 0 平均分', async () => {
      cloud.setup({ comments: [] }, 'any_openid')
      const result = await main({ jobId: 'job_1' })
      expect(result.code).toBe(200)
      expect(result.data.comments).toEqual([])
      expect(result.data.total).toBe(0)
      expect(result.data.avgRating).toBe(0)
    })
  })
})
