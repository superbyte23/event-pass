import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoute from '@/components/AdminRoute';
import AdminLayout from '@/components/AdminLayout';
import Home from '@/views/Home';
import Events from '@/views/Events';
import EventDetail from '@/views/EventDetail';
import Register from '@/views/Register';
import Login from '@/views/Login';
import MyEvents from '@/views/MyEvents';
import Ticket from '@/views/Ticket';
import FindTicket from '@/views/FindTicket';
import Profile from '@/views/Profile';
import AdminDashboard from '@/views/admin/AdminDashboard';
import AdminEvents from '@/views/admin/AdminEvents';
import AdminEventCreate from '@/views/admin/AdminEventCreate';
import AdminEventDetail from '@/views/admin/AdminEventDetail';
import AdminEventEdit from '@/views/admin/AdminEventEdit';
import AdminRegistrations from '@/views/admin/AdminRegistrations';
import AdminCheckIn from '@/views/admin/AdminCheckIn';
import CheckInUrl from '@/views/CheckInUrl';
import AdminRegistrationDetail from '@/views/admin/AdminRegistrationDetail';
import AdminSettings from '@/views/admin/AdminSettings';

function LoginRedirect() {
  const location = useLocation();
  return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />
      <Route path="/events" element={<Events />} />
      <Route path="/events/:slug" element={<EventDetail />} />
      <Route path="/register/:slug" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/find-ticket" element={<FindTicket />} />

      {/* Guest (authenticated) */}
      <Route element={<ProtectedRoute unauthenticatedElement={<LoginRedirect />} />}>
        <Route path="/my-events" element={<MyEvents />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* Tickets are public — accessed by registration id; RLS gates the record */}
      <Route path="/tickets/:registration" element={<Ticket />} />

      {/* Admin */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/events" element={<AdminEvents />} />
          <Route path="/admin/events/create" element={<AdminEventCreate />} />
          <Route path="/admin/events/:event" element={<AdminEventDetail />} />
          <Route path="/admin/events/:event/edit" element={<AdminEventEdit />} />
          <Route path="/admin/events/:event/registrations" element={<AdminRegistrations />} />
          <Route path="/admin/registrations/:registration" element={<AdminRegistrationDetail />} />
          <Route path="/admin/checkin" element={<AdminCheckIn />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>
        {/* Standalone admin-gated page that the ticket QR's `/checkin/<token>` URL lands on */}
        <Route path="/checkin/:qrToken" element={<CheckInUrl />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App