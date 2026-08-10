import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import HomePage from './pages/HomePage'
import JoinPage from './pages/JoinPage'
import PlayPage from './pages/PlayPage'
import PresentationPage from './pages/PresentationPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import ExamsPage from './pages/admin/ExamsPage'
import ExamDetailPage from './pages/admin/ExamDetailPage'
import QuestionsBankPage from './pages/admin/QuestionsBankPage'
import RoomsPage from './pages/admin/RoomsPage'
import RoomControlPage from './pages/admin/RoomControlPage'
import ResultsPage from './pages/admin/ResultsPage'
import SettingsPage from './pages/admin/SettingsPage'

function RequireAdmin({ children }) {
  const token = localStorage.getItem('admin_token')
  if (!token) return <Navigate to="/admin/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/join/:code" element={<JoinPage />} />
      <Route path="/play/:code" element={<PlayPage />} />
      <Route path="/present/:code" element={<PresentationPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="exams/:id" element={<ExamDetailPage />} />
        <Route path="questions" element={<QuestionsBankPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="rooms/:code" element={<RoomControlPage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
