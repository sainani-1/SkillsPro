import AdminExamSettings from './pages/AdminExamSettings';
import AdminChangeCourse from './pages/AdminChangeCourse';
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import AdminMFASetup from "./pages/AdminMFASetup";
import AdminMFAVerify from "./pages/AdminMFAVerify";
// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import CourseList from './pages/CourseList';
import CourseDetail from './pages/CourseDetail';
import Exam from './pages/Exam';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import VerifyCertificate from './pages/VerifyCertificate';
import RegisterAdmin from './pages/RegisterAdmin';
import RegisterTeacher from './pages/RegisterTeacher';
import CareerGuidance from './pages/CareerGuidance';
import MyCertificates from './pages/MyCertificates';
import AdminDashboard from './pages/AdminDashboard';
import AdminSettings from './pages/AdminSettings';
import AdminCourses from './pages/AdminCourses';
import StudentProgress from './pages/StudentProgress';
import StudentDetail from './pages/StudentDetail';
import ManagePremium from './pages/ManagePremium';
import TeacherAssignment from './pages/TeacherAssignment';
import GuidanceSessions from './pages/GuidanceSessions';
import TeacherLeaves from './pages/TeacherLeaves';
import ChatWithTeacher from './pages/ChatWithTeacher';
import Attendance from './pages/Attendance';
import MyStudents from './pages/MyStudents';
import AssignedClasses from './pages/AssignedClasses';
import Payment from './pages/Payment';
import ClassSchedule from './pages/ClassSchedule';
import AccountManagement from './pages/AccountManagement';
import TeacherChat from './pages/TeacherChat';
import LiveClass from './pages/LiveClass';
import Notifications from './pages/Notifications';
import AdminNotifications from './pages/AdminNotifications';
import SessionReassignments from './pages/SessionReassignments';
import CareerChatbot from './pages/CareerChatbot';
import AILearningPath from './pages/AILearningPath';
import AdminExamOverrides from './pages/AdminExamOverrides';
import InterviewPrep from './pages/InterviewPrep';
import PremiumStatus from './pages/PremiumStatus';
import Offers from './pages/Offers';
import AdminExamRetakes from './pages/AdminExamRetakes';
import AdminActiveCoupons from './pages/AdminActiveCoupons';
import UserManagementPage from './pages/UserManagementPage';
import TeacherProgress from './pages/TeacherProgress';
import ClearDoubts from './pages/ClearDoubts';
import AdminUserIds from './pages/AdminUserIds';
import NotFound from './pages/NotFound';
import AdminSendGift from './pages/AdminSendGift';
import RequestTeacher from './pages/RequestTeacher';
import TeacherRequests from './pages/TeacherRequests';
import AdminTeacherRequests from './pages/AdminTeacherRequests';
import CertificateBlocks from './pages/CertificateBlocks';

const ProtectedRoute = ({ children }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingSpinner message="Initializing your account..." />;
  if (!user) return <Navigate to="/login" />;

  // Check if user is locked
  if (profile?.is_locked) {
    const lockedUntil = new Date(profile.locked_until);
    if (lockedUntil > new Date()) {
      return (
        <div className="h-screen flex items-center justify-center bg-red-50 text-red-800 flex-col">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Account Locked</h1>
            <p>Your account has been locked due to suspicious activity detected during an exam.</p>
            <p className="text-sm">Lock expires on: {lockedUntil.toLocaleDateString('en-IN')}</p>
          </div>
        </div>
      );
    }
  }

  return children;
};

const AdminRoute = ({ children }) => {

  const { profile, loading } = useAuth();

  if (loading)
    return <LoadingSpinner message="Loading dashboard..." />;

  if (profile?.role !== "admin")
    return <Navigate to="/app" />;

  // ✅ MFA SESSION CHECK
  const mfaVerified =
    sessionStorage.getItem("admin_mfa_verified");

  if (!mfaVerified) {
    return <Navigate to="/admin-mfa-verify" />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password-confirm" element={<ResetPassword />} />
        <Route path="/register-admin" element={<RegisterAdmin />} />
        <Route path="/register-teacher" element={<RegisterTeacher />} />
        <Route path="/verify/:id" element={<VerifyCertificate />} />
        <Route path="/verify" element={<VerifyCertificate />} />
        <Route path="*" element={<NotFound />} />

        {/* Protected Routes */}
        <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="admin/exam-settings" element={<AdminRoute><AdminExamSettings /></AdminRoute>} />
          <Route index element={<Dashboard />} />
          <Route path="courses" element={<CourseList />} />
          <Route path="course/:courseId" element={<CourseDetail />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="payment" element={<Payment />} />
          <Route path="guidance" element={<CareerGuidance />} />
          <Route path="guidance-sessions" element={<GuidanceSessions />} />
          <Route path="clear-doubts" element={<ClearDoubts />} />
          <Route path="my-certificates" element={<MyCertificates />} />
          <Route path="verify" element={<VerifyCertificate />} />
          <Route path="chat" element={<ChatWithTeacher />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="my-students" element={<MyStudents />} />
          <Route path="assigned-classes" element={<AssignedClasses />} />
          <Route path="class-schedule" element={<ClassSchedule />} />
          <Route path="career-chatbot" element={<CareerChatbot />} />
          <Route path="learning-path" element={<AILearningPath />} />
          <Route path="interview-prep" element={<InterviewPrep />} />
          <Route path="premium-status" element={<PremiumStatus />} />
          <Route path="offers" element={<Offers />} />
          <Route path="request-teacher" element={<RequestTeacher />} />
          <Route path="teacher-requests" element={<TeacherRequests />} />
          <Route path="mycertificates" element={<Navigate to="/app/my-certificates" replace />} />
          <Route path="leaves" element={<TeacherLeaves />} />
          <Route path="session-reassignments" element={<SessionReassignments />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="teacher-chat" element={<TeacherChat />} />
          <Route path="admin/users" element={<AdminRoute><AdminDashboard initialTab="users" /></AdminRoute>} />
          <Route path="admin/leaves" element={<AdminRoute><AdminDashboard initialTab="leaves" /></AdminRoute>} />
          <Route path="admin/user-management" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
          <Route path="admin/user-ids" element={<AdminRoute><AdminUserIds /></AdminRoute>} />
          <Route path="admin/teacher-progress" element={<AdminRoute><TeacherProgress /></AdminRoute>} />
          <Route path="admin/courses" element={<AdminRoute><AdminCourses /></AdminRoute>} />
          <Route path="admin/student-progress" element={<AdminRoute><StudentProgress /></AdminRoute>} />
          <Route path="admin/student/:studentId" element={<AdminRoute><StudentDetail /></AdminRoute>} />
          <Route path="admin/manage-premium" element={<AdminRoute><ManagePremium /></AdminRoute>} />
          <Route path="admin/teacher-assignment" element={<AdminRoute><TeacherAssignment /></AdminRoute>} />
          <Route path="admin/teacher-requests" element={<AdminRoute><AdminTeacherRequests /></AdminRoute>} />
          <Route path="admin/certificate-blocks" element={<AdminRoute><CertificateBlocks /></AdminRoute>} />
          <Route path="admin/accounts" element={<AdminRoute><AccountManagement /></AdminRoute>} />
          <Route path="admin/notifications" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
          <Route path="admin/exam-overrides" element={<AdminRoute><AdminExamOverrides /></AdminRoute>} />
          <Route path="admin/exam-retakes" element={<AdminRoute><AdminExamRetakes /></AdminRoute>} />
          <Route path="admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
          <Route path="admin/send-gift" element={<AdminRoute><AdminSendGift /></AdminRoute>} />
          <Route path="admin/active-coupons" element={<AdminRoute><AdminActiveCoupons /></AdminRoute>} />
          <Route path="admin/change-course" element={<AdminRoute><AdminChangeCourse /></AdminRoute>} />
        </Route>

        {/* Exam is outside layout for fullscreen enforcement */}
        <Route path="/exam/:courseId" element={<ProtectedRoute><Exam /></ProtectedRoute>} />

        {/* Live Class is outside layout for fullscreen */}
        <Route path="/live-class/:sessionId" element={<ProtectedRoute><LiveClass /></ProtectedRoute>} />
        <Route path="/admin-mfa-setup" element={<AdminMFASetup />} />
        <Route path="/admin-mfa-verify" element={<AdminMFAVerify />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;