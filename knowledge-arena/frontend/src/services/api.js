import axios from 'axios'
import { getApiBase, errorMessage } from '../utils/config'

const api = axios.create({
  baseURL: getApiBase(),
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const detail = err.response?.data?.detail
    const code = typeof detail === 'string' ? detail : detail?.[0]?.msg
    err.friendlyMessage = errorMessage(code) || err.message
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('admin_token')
      if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(err)
  },
)

export const authApi = {
  login: (username, password) => api.post('/api/auth/login', { username, password }),
  me: () => api.get('/api/auth/me'),
  changePassword: (current_password, new_password) =>
    api.post('/api/auth/change-password', { current_password, new_password }),
}

export const examApi = {
  list: () => api.get('/api/exams'),
  get: (id) => api.get(`/api/exams/${id}`),
  create: (data) => api.post('/api/exams', data),
  update: (id, data) => api.put(`/api/exams/${id}`, data),
  remove: (id) => api.delete(`/api/exams/${id}`),
}

export const questionApi = {
  list: (examId) => api.get('/api/questions', { params: examId ? { exam_id: examId } : {} }),
  create: (data) => api.post('/api/questions', data),
  update: (id, data) => api.put(`/api/questions/${id}`, data),
  remove: (id) => api.delete(`/api/questions/${id}`),
  reorder: (examId, order) => api.post(`/api/questions/reorder?exam_id=${examId}`, order),
}

export const bankApi = {
  list: (params = {}) => api.get('/api/bank/questions', { params }),
  get: (id) => api.get(`/api/bank/questions/${id}`),
  create: (data) => api.post('/api/bank/questions', data),
  update: (id, data) => api.put(`/api/bank/questions/${id}`, data),
  remove: (id) => api.delete(`/api/bank/questions/${id}`),
  addToExam: (examId, bank_question_ids) =>
    api.post(`/api/bank/questions/add-to-exam/${examId}`, { bank_question_ids }),
}

export const roomApi = {
  list: () => api.get('/api/rooms'),
  get: (code) => api.get(`/api/rooms/${code}`),
  create: (exam_id) => api.post('/api/rooms', { exam_id }),
  remove: (code) => api.delete(`/api/rooms/${code}`),
  join: (code, name) => api.post(`/api/rooms/${code}/join`, { name }),
  start: (code) => api.post(`/api/rooms/${code}/start`),
  next: (code) => api.post(`/api/rooms/${code}/next`),
  pause: (code) => api.post(`/api/rooms/${code}/pause`),
  resume: (code) => api.post(`/api/rooms/${code}/resume`),
  finish: (code) => api.post(`/api/rooms/${code}/finish`),
  players: (code) => api.get(`/api/rooms/${code}/players`),
  results: (code) => api.get(`/api/rooms/${code}/results`),
  state: (code) => api.get(`/api/rooms/${code}/state`),
  submissions: (code) => api.get(`/api/rooms/${code}/submissions`),
  grade: (code, submissionId, data) =>
    api.post(`/api/rooms/${code}/grade/${submissionId}`, data),
}

export const dashboardApi = {
  stats: () => api.get('/api/dashboard/stats'),
  settings: () => api.get('/api/settings'),
  updateSettings: (data) => api.put('/api/settings', data),
  lanIp: () => api.get('/api/lan-ip'),
}

export const uploadApi = {
  upload: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/api/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export default api
