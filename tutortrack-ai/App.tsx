import React, { useState, useEffect, useRef } from 'react';
import { AppState, Student, Session, Payment, ViewState, DayOfWeek } from './types';
import { MOCK_STUDENTS } from './constants';
import { Dashboard } from './components/Dashboard';
import { StudentDetail } from './components/StudentDetail';
import { SessionModal } from './components/SessionModal';
import { PaymentModal } from './components/PaymentModal';
import { StudentFormModal } from './components/StudentFormModal';
import { TutorProfile } from './components/TutorProfile';
import { Button } from './components/Button';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PasswordResetPage } from './pages/PasswordResetPage';
import { GraduationCap, Bell, BellOff, CloudSync, AlertCircle, LogOut, Settings, MapPin } from 'lucide-react';
import { firebaseService } from './services/firebaseService';
import { syncService } from './services/syncService';
import { isFirebaseConfigured } from './services/firebase';
import { useAuth } from './context/AuthContext';
import { startLocationTracking, stopLocationTracking } from './services/locationService.browser'; // Browser-only, no plugins
import { LocationDebugPanel } from './components/LocationDebugPanel';

const STORAGE_KEY = 'tutortrack_data_v1';

const App: React.FC = () => {
  // --- Auth State ---
  const { currentUser, loading: authLoading, logout } = useAuth();
  console.log("authLoading:", authLoading, "currentUser:", currentUser);


  // --- State ---
  const [students, setStudents] = useState<Student[]>([]);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Firebase & Sync States
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(false);

  // Modal States
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isStudentFormModalOpen, setIsStudentFormModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // If a modal is open, which student is it for?
  const [modalStudentId, setModalStudentId] = useState<string | null>(null);

  // Track notified sessions for the current session to avoid spamming
  const notifiedSessions = useRef<Set<string>>(new Set());
  const [autoSessionPending, setAutoSessionPending] = useState<{ studentId: string; duration: number } | null>(null);

  // --- Effects ---

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (!currentUser) {
          setStudents([]);
          return;
        }

        if (isFirebaseConfigured()) {
          const firebaseStudents = await firebaseService.getAllStudents();
          if (firebaseStudents.length > 0) {
            setStudents(firebaseStudents);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(firebaseStudents));
          } else {
            // No data in Firebase, try localStorage
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
              setStudents(JSON.parse(saved));
            } else {
              setStudents(MOCK_STUDENTS);
            }
          }
        } else {
          // Firebase not configured, use localStorage
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            setStudents(JSON.parse(saved));
          } else {
            setStudents(MOCK_STUDENTS);
          }
        }
      } catch (e) {
        console.error('Error loading data:', e);
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setStudents(JSON.parse(saved));
        } else {
          setStudents(MOCK_STUDENTS);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, [currentUser]);

  // Save data on change (localStorage + Firebase sync)
  useEffect(() => {
    if (students.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    }
  }, [students]);

  // Online/Offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setError(null);
      // Process pending operations when coming online
      setTimeout(() => {
        syncService.processPendingOperations().then(() => {
          setPendingCount(syncService.getPendingCount());
        });
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update pending count periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(syncService.getPendingCount());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Notification Check Loop
  useEffect(() => {
    if (!notificationsEnabled) return;

    const checkSchedule = () => {
      const now = new Date();
      const dayNames: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const currentDay = dayNames[now.getDay()];

      students.forEach(student => {
        if (student.active && student.scheduleDays.includes(currentDay) && student.scheduleTime) {
          // Parse Schedule Time
          const [hours, minutes] = student.scheduleTime.split(':').map(Number);
          const classTime = new Date();
          classTime.setHours(hours, minutes, 0, 0);

          const diffMs = classTime.getTime() - now.getTime();
          const diffMins = diffMs / 60000;

          // Unique key for today's session: ID + DateString
          const sessionKey = `${student.id}-${now.toDateString()}`;

          // Notify if within 30 mins AND not yet notified today
          if (diffMins > 0 && diffMins <= 30 && !notifiedSessions.current.has(sessionKey)) {
            if ('Notification' in window) {
              new Notification(`Upcoming Tuition: ${student.name}`, {
                body: `Session starts in ${Math.round(diffMins)} minutes (${student.scheduleTime}). Subject: ${student.subject}`,
                icon: '/favicon.ico' // Fallback icon
              });
            }

            notifiedSessions.current.add(sessionKey);
          }
        }
      });
    };

    // Check every minute
    const interval = setInterval(checkSchedule, 60000);
    // Initial check
    checkSchedule();

    return () => clearInterval(interval);
  }, [students, notificationsEnabled]);

  // Location Tracking for Auto Sessions
  useEffect(() => {
    if (!locationTrackingEnabled || !currentUser) return;

    startLocationTracking(students, (studentId, duration) => {
      setAutoSessionPending({ studentId, duration });
    });

    return () => {
      stopLocationTracking();
    };
  }, [locationTrackingEnabled, students, currentUser]);

  // --- Handlers ---

  const handleNavigateToStudent = (id: string) => {
    setSelectedStudentId(id);
    setCurrentView('student-detail');
  };

  const handleBackToDashboard = () => {
    setSelectedStudentId(null);
    setCurrentView('dashboard');
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notifications");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      new Notification("Notifications Enabled", { body: "You will be reminded 30 minutes before classes." });
    }
  };

  const toggleLocationTracking = () => {
    setLocationTrackingEnabled(!locationTrackingEnabled);
  };

  const confirmAutoSession = () => {
    if (!autoSessionPending) return;
    openSessionModal(autoSessionPending.studentId);
    setAutoSessionPending(null);
  };

  const dismissAutoSession = () => {
    setAutoSessionPending(null);
  };

  // Session Logging
  const openSessionModal = (studentId: string) => {
    setModalStudentId(studentId);
    setIsSessionModalOpen(true);
  };

  const handleSessionSubmit = async (sessionData: Omit<Session, 'id'>) => {
    if (!modalStudentId) return;

    const newSession: Session = {
      ...sessionData,
      id: crypto.randomUUID(),
    };

    // Optimistic update
    setStudents(prev => prev.map(s => {
      if (s.id !== modalStudentId) return s;
      return {
        ...s,
        sessions: [...s.sessions, newSession]
      };
    }));

    // Sync to Firebase in background
    if (isFirebaseConfigured() && isOnline) {
      try {
        await firebaseService.createSession(modalStudentId, sessionData);
      } catch (err) {
        console.error('Error syncing session:', err);
        syncService.queueOperation({
          type: 'createSession',
          studentId: modalStudentId,
          data: sessionData
        });
      }
    } else {
      // Queue for later sync
      syncService.queueOperation({
        type: 'createSession',
        studentId: modalStudentId,
        data: sessionData
      });
      setPendingCount(syncService.getPendingCount());
    }
  };

  // Payment Logging
  const openPaymentModal = (studentId: string) => {
    setModalStudentId(studentId);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (paymentData: Omit<Payment, 'id'>) => {
    if (!modalStudentId) return;

    const newPayment: Payment = {
      ...paymentData,
      id: crypto.randomUUID(),
    };

    // Optimistic update
    setStudents(prev => prev.map(s => {
      if (s.id !== modalStudentId) return s;
      return {
        ...s,
        payments: [...s.payments, newPayment]
      };
    }));

    // Sync to Firebase in background
    if (isFirebaseConfigured() && isOnline) {
      try {
        await firebaseService.createPayment(modalStudentId, paymentData);
      } catch (err) {
        console.error('Error syncing payment:', err);
        syncService.queueOperation({
          type: 'createPayment',
          studentId: modalStudentId,
          data: paymentData
        });
      }
    } else {
      // Queue for later sync
      syncService.queueOperation({
        type: 'createPayment',
        studentId: modalStudentId,
        data: paymentData
      });
      setPendingCount(syncService.getPendingCount());
    }
  };

  // Student Management
  const openStudentForm = (studentId?: string) => {
    setEditingStudentId(studentId || null);
    setIsStudentFormModalOpen(true);
  };

  const handleStudentSubmit = async (studentData: Omit<Student, 'id' | 'sessions' | 'payments' | 'joinedDate'>) => {
    if (editingStudentId) {
      // Edit existing student
      setStudents(prev => prev.map(s => {
        if (s.id !== editingStudentId) return s;
        return {
          ...s,
          ...studentData
        };
      }));

      // Sync to Firebase
      if (isFirebaseConfigured() && isOnline) {
        try {
          await firebaseService.updateStudent(editingStudentId, studentData);
        } catch (err) {
          console.error('Error syncing student:', err);
          syncService.queueOperation({
            type: 'updateStudent',
            studentId: editingStudentId,
            data: { ...studentData, joinedDate: new Date().toISOString() }
          });
        }
      } else {
        syncService.queueOperation({
          type: 'updateStudent',
          studentId: editingStudentId,
          data: studentData
        });
        setPendingCount(syncService.getPendingCount());
      }
    } else {
      // Create new student
      const newStudent: Student = {
        ...studentData,
        id: crypto.randomUUID(),
        sessions: [],
        payments: [],
        joinedDate: new Date().toISOString()
      };
      setStudents(prev => [...prev, newStudent]);

      // Sync to Firebase
      if (isFirebaseConfigured() && isOnline) {
        try {
          await firebaseService.createStudent({
            ...studentData,
            joinedDate: newStudent.joinedDate
          });
        } catch (err) {
          console.error('Error syncing student:', err);
          syncService.queueOperation({
            type: 'createStudent',
            data: { ...studentData, joinedDate: new Date().toISOString() }
          });
        }
      } else {
        syncService.queueOperation({
          type: 'createStudent',
          data: studentData
        });
        setPendingCount(syncService.getPendingCount());
      }
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (confirm('Are you sure you want to delete this student? All sessions and payments will be lost.')) {
      setStudents(prev => prev.filter(s => s.id !== studentId));
      handleBackToDashboard();

      // Sync to Firebase
      if (isFirebaseConfigured() && isOnline) {
        try {
          await firebaseService.deleteStudent(studentId);
        } catch (err) {
          console.error('Error syncing delete:', err);
          syncService.queueOperation({
            type: 'deleteStudent',
            studentId
          });
        }
      } else {
        syncService.queueOperation({
          type: 'deleteStudent',
          studentId
        });
        setPendingCount(syncService.getPendingCount());
      }
    }
  };

  // Helper to get active modal student details
  const modalStudent = students.find(s => s.id === modalStudentId);
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // Calculate outstanding for payment modal default
  const getOutstandingBalance = (student?: Student) => {
    if (!student) return 0;
    const totalSessions = student.sessions.filter(s => s.status === 'completed' || s.status === 'missed').length;
    const totalDue = totalSessions * student.ratePerSession;
    const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, totalDue - totalPaid);
  };

  return (
    <>
      {/* Loading spinner while checking auth state */}
      {authLoading && (
        <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-semibold">Loading...</p>
          </div>
        </div>
      )}

      {/* Auth Pages */}
      {!authLoading && !currentUser && currentView === 'login' && (
        <LoginPage onSwitchToRegister={() => setCurrentView('register')} onSwitchToPasswordReset={() => setCurrentView('password-reset')} />
      )}

      {!authLoading && !currentUser && currentView === 'register' && (
        <RegisterPage onSwitchToLogin={() => setCurrentView('login')} />
      )}

      {!authLoading && !currentUser && currentView === 'password-reset' && (
        <PasswordResetPage onSwitchToLogin={() => setCurrentView('login')} />
      )}

      {/* Dashboard - only show if authenticated */}
      {!authLoading && currentUser && (
        <div className="min-h-screen bg-slate-50 pb-10">
          {/* Navigation Bar */}
          <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center cursor-pointer" onClick={handleBackToDashboard}>
                  <div className="bg-indigo-600 p-2 rounded-lg mr-3">
                    <GraduationCap className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                    Tutortrack
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  {/* Sync Status Indicator */}
                  {isFirebaseConfigured() && (
                    <div className="flex items-center gap-2">
                      {!isOnline && (
                        <button
                          title="Offline mode - changes will sync when online"
                          className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                        >
                          <AlertCircle className="w-5 h-5" />
                        </button>
                      )}
                      {isOnline && syncing && (
                        <button
                          title="Syncing changes to Firebase..."
                          className="p-2 rounded-full text-indigo-600 bg-indigo-50 animate-pulse"
                        >
                          <CloudSync className="w-5 h-5" />
                        </button>
                      )}
                      {pendingCount > 0 && (
                        <span
                          title={`${pendingCount} change${pendingCount > 1 ? 's' : ''} pending sync`}
                          className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full"
                        >
                          {pendingCount} pending
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={requestNotificationPermission}
                    className={`p-2 rounded-full transition-colors ${notificationsEnabled ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                    title={notificationsEnabled ? "Notifications Active" : "Enable Notifications"}
                  >
                    {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={toggleLocationTracking}
                    className={`p-2 rounded-full transition-colors relative ${locationTrackingEnabled ? 'text-green-600 bg-green-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                    title={locationTrackingEnabled ? "Auto-Session Tracking Active" : "Enable Auto-Session Tracking"}
                  >
                    <MapPin className="w-5 h-5" />
                    {locationTrackingEnabled && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                    )}
                  </button>

                  {/* User Info and Logout */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center flex-col text-right hidden sm:flex">
                      <span className="text-sm font-medium text-slate-900">{currentUser.displayName}</span>
                      <span className="text-xs text-slate-500">{currentUser.email}</span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                      {currentUser.displayName?.charAt(0).toUpperCase()}
                    </div>
                    <button
                      onClick={logout}
                      className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      title="Logout"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setCurrentView('settings')}
                      className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      title="Settings"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Debug Panel - Remove in production */}
            {locationTrackingEnabled && (
              <div className="mb-6">
                <LocationDebugPanel students={students} isTracking={locationTrackingEnabled} />
              </div>
            )}

            {/* Auto Session Notification Banner */}
            {autoSessionPending && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">
                      Session Detected: {students.find(s => s.id === autoSessionPending.studentId)?.name}
                    </p>
                    <p className="text-sm text-green-700">
                      {autoSessionPending.duration} minutes at tuition location
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={confirmAutoSession} size="sm">Log Session</Button>
                  <Button onClick={dismissAutoSession} variant="ghost" size="sm">Dismiss</Button>
                </div>
              </div>
            )}

            {currentView === 'dashboard' && (
              <Dashboard
                students={students}
                onViewStudent={handleNavigateToStudent}
                onLogSession={openSessionModal}
                onAddStudent={() => openStudentForm()}
              />
            )}

            {currentView === 'student-detail' && selectedStudent && (
              <StudentDetail
                student={selectedStudent}
                onBack={handleBackToDashboard}
                onLogSession={() => openSessionModal(selectedStudent.id)}
                onLogPayment={() => openPaymentModal(selectedStudent.id)}
                onEditStudent={() => openStudentForm(selectedStudent.id)}
                onDeleteStudent={() => handleDeleteStudent(selectedStudent.id)}
              />
            )}

            {currentView === 'settings' && currentUser && (
              <TutorProfile
                user={currentUser}
                onBack={handleBackToDashboard}
              />
            )}
          </main>

          {/* Modals */}
          <StudentFormModal
            isOpen={isStudentFormModalOpen}
            onClose={() => setIsStudentFormModalOpen(false)}
            onSubmit={handleStudentSubmit}
            student={editingStudentId ? students.find(s => s.id === editingStudentId) : undefined}
          />

          {modalStudent && (
            <>
              <SessionModal
                isOpen={isSessionModalOpen}
                onClose={() => setIsSessionModalOpen(false)}
                onSubmit={handleSessionSubmit}
                studentName={modalStudent.name}
              />
              <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onSubmit={handlePaymentSubmit}
                studentName={modalStudent.name}
                suggestedAmount={getOutstandingBalance(modalStudent)}
              />
            </>
          )}
        </div>
      )}

      {/* Default to login if not authenticated */}
      {!authLoading && !currentUser && (currentView === 'dashboard' || currentView === 'student-detail' || currentView === 'settings') && (
        <LoginPage onSwitchToRegister={() => setCurrentView('register')} onSwitchToPasswordReset={() => setCurrentView('password-reset')} />
      )}
    </>
  );
};

export default App;