import React, { useState, useEffect, useRef } from 'react';
import { Student, Session, Payment, ViewState, DayOfWeek } from './types';
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
import { Bell, BellOff, CloudSync, AlertCircle, LogOut, Settings, MapPin, LayoutDashboard, WalletCards, Wifi, WifiOff } from 'lucide-react';
import { firebaseService } from './services/firebaseService';
import { syncService } from './services/syncService';
import { isFirebaseConfigured } from './services/firebase';
import { useAuth } from './context/AuthContext';
import { startLocationTracking, stopLocationTracking } from './services/locationService.browser'; // Browser-only, no plugins
import { LocationDebugPanel } from './components/LocationDebugPanel';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { BrandLogo } from './components/BrandLogo';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { PersonalFinance } from './components/PersonalFinance';
import { getStudentBilling } from './services/studentBilling';

const STORAGE_KEY = 'tutortrack_data_v1';

const App: React.FC = () => {
  // --- Auth State ---
  const { currentUser, loading: authLoading, logout } = useAuth();

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

    const checkPromises = async () => {
      if (Capacitor.isNativePlatform()) {
        const { display } = await LocalNotifications.checkPermissions();
        if (display === 'granted') {
          setNotificationsEnabled(true);
        }
      } else {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          setNotificationsEnabled(true);
        }
      }
    };
    checkPromises();
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
            const title = `Upcoming Tuition: ${student.name}`;
            const body = `Session starts in ${Math.round(diffMins)} minutes (${student.scheduleTime}). Subject: ${student.subject}`;

            if (Capacitor.isNativePlatform()) {
              LocalNotifications.schedule({
                notifications: [
                  {
                    title,
                    body,
                    id: new Date().getTime(),
                    schedule: { at: new Date() }, // Fire immediately
                  }
                ]
              });
            } else if ('Notification' in window) {
              new Notification(title, {
                body,
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
    if (Capacitor.isNativePlatform()) {
      let permStatus = await LocalNotifications.checkPermissions();
      
      if (permStatus.display === 'prompt') {
        permStatus = await LocalNotifications.requestPermissions();
      }

      if (permStatus.display !== 'granted') {
        alert("Push notification permission denied.");
        return;
      }
      
      setNotificationsEnabled(true);
      await LocalNotifications.schedule({
        notifications: [
          {
            title: "Notifications Enabled",
            body: "You will be reminded 30 minutes before classes.",
            id: new Date().getTime(),
            schedule: { at: new Date() }, // Fire immediately
          }
        ]
      });
    } else {
      if (!("Notification" in window)) {
        alert("This browser does not support desktop notifications");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationsEnabled(true);
        new Notification("Notifications Enabled", { body: "You will be reminded 30 minutes before classes." });
      }
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
    return getStudentBilling(student).outstanding;
  };

  return (
    <>
      {authLoading && (
        <div className="min-h-screen bg-[#f4f1ea] grid place-items-center px-4">
          <div className="text-center">
            <BrandLogo size="lg" showWordmark={false} className="justify-center" />
            <div className="mt-5 mx-auto h-1 w-28 overflow-hidden rounded-full bg-[#ddd9d1]"><div className="h-full w-1/2 rounded-full bg-[#55518f] animate-pulse" /></div>
            <p className="mt-3 text-xs font-semibold text-[#8b8794]">Preparing your workspace…</p>
          </div>
        </div>
      )}

      {!authLoading && !currentUser && currentView === 'login' && (
        <LoginPage onSwitchToRegister={() => setCurrentView('register')} onSwitchToPasswordReset={() => setCurrentView('password-reset')} />
      )}
      {!authLoading && !currentUser && currentView === 'register' && (
        <RegisterPage onSwitchToLogin={() => setCurrentView('login')} />
      )}
      {!authLoading && !currentUser && currentView === 'password-reset' && (
        <PasswordResetPage onSwitchToLogin={() => setCurrentView('login')} />
      )}

      {!authLoading && currentUser && (
        <div className="min-h-screen pb-10 tt-mobile-safe">
          <header className="sticky top-0 z-40 border-b border-[#dfdcd4]/80 bg-[#f6f4ef]/88 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-3">
              <button onClick={handleBackToDashboard} className="shrink-0" aria-label="Go to dashboard">
                <BrandLogo size="sm" />
              </button>

              <nav aria-label="Teacher panel" className="hidden md:flex items-center gap-1 bg-[#ebe8e3] rounded-xl p-1 ml-auto mr-2">
                <button onClick={handleBackToDashboard} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold ${currentView === 'dashboard' || currentView === 'student-detail' ? 'bg-white text-[#34326f] shadow-sm' : 'text-[#7b7586] hover:text-[#34326f]'}`}><LayoutDashboard className="w-3.5 h-3.5" /> Dashboard</button>
                <button onClick={() => setCurrentView('finance')} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold ${currentView === 'finance' ? 'bg-white text-[#34326f] shadow-sm' : 'text-[#7b7586] hover:text-[#34326f]'}`}><WalletCards className="w-3.5 h-3.5" /> Finance</button>
              </nav>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="hidden md:flex items-center gap-2 mr-1">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.08em] ${isOnline ? 'bg-[#edf7f1] text-[#3f7c5e]' : 'bg-[#fff1ee] text-[#a95147]'}`}>
                    {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />} {isOnline ? 'Online' : 'Offline'}
                  </span>
                  {pendingCount > 0 && <span className="rounded-full bg-[#fff5df] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-[#986b25]">{pendingCount} pending</span>}
                  {isFirebaseConfigured() && isOnline && syncing && <span className="h-8 w-8 rounded-full grid place-items-center bg-[#eeecf7] text-[#55518f]" title="Syncing"><CloudSync className="w-3.5 h-3.5 animate-spin" /></span>}
                </div>

                <button onClick={requestNotificationPermission} className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl grid place-items-center transition-colors ${notificationsEnabled ? 'bg-[#eeecf7] text-[#4f4b84]' : 'text-[#878492] hover:bg-[#ece9e2]'}`} title={notificationsEnabled ? 'Notifications active' : 'Enable notifications'}>
                  {notificationsEnabled ? <Bell className="w-[18px] h-[18px]" /> : <BellOff className="w-[18px] h-[18px]" />}
                </button>

                <button onClick={toggleLocationTracking} className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl grid place-items-center transition-colors relative ${locationTrackingEnabled ? 'bg-[#edf7f1] text-[#3f805f]' : 'text-[#878492] hover:bg-[#ece9e2]'}`} title={locationTrackingEnabled ? 'Location tracking active' : 'Enable auto-session location tracking'}>
                  <MapPin className="w-[18px] h-[18px]" />
                  {locationTrackingEnabled && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#55a377] ring-2 ring-[#edf7f1]" />}
                </button>

                <span className="hidden sm:block h-7 w-px bg-[#ddd9d1] mx-0.5" />

                <button onClick={() => setCurrentView('settings')} className={`hidden sm:grid h-10 w-10 rounded-xl place-items-center transition-colors ${currentView === 'settings' ? 'bg-[#eeecf7] text-[#4f4b84]' : 'text-[#878492] hover:bg-[#ece9e2]'}`} title="Profile settings">
                  <Settings className="w-[18px] h-[18px]" />
                </button>

                <div className="hidden lg:block text-right ml-1 mr-1 max-w-40">
                  <p className="text-xs font-bold text-[#3d3a50] truncate">{currentUser.displayName || 'Tutor'}</p>
                  <p className="mt-0.5 text-[10px] text-[#9995a1] truncate">{currentUser.email}</p>
                </div>
                <button onClick={() => setCurrentView('settings')} className="h-9 w-9 sm:h-10 sm:w-10 rounded-[13px] bg-[#34326f] text-white grid place-items-center text-xs font-extrabold shadow-sm" title="Open profile">
                  {(currentUser.displayName || currentUser.email || 'T').charAt(0).toUpperCase()}
                </button>
                <button onClick={logout} className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl grid place-items-center text-[#918d99] hover:bg-[#fff0ed] hover:text-[#aa554b] transition-colors" title="Sign out">
                  <LogOut className="w-[18px] h-[18px]" />
                </button>
              </div>
            </div>
          </header>

          <nav aria-label="Teacher panel" className="md:hidden sticky top-[72px] z-30 bg-[#f6f4ef]/92 backdrop-blur-lg border-b border-[#e4e1da] px-4 py-2 flex gap-2">
            <button onClick={handleBackToDashboard} className={`flex-1 h-9 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 ${currentView === 'dashboard' || currentView === 'student-detail' ? 'bg-[#34326f] text-white' : 'bg-white text-[#6d6978] border border-[#dfdbe2]'}`}><LayoutDashboard className="w-3.5 h-3.5"/> Dashboard</button>
            <button onClick={() => setCurrentView('finance')} className={`flex-1 h-9 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 ${currentView === 'finance' ? 'bg-[#34326f] text-white' : 'bg-white text-[#6d6978] border border-[#dfdbe2]'}`}><WalletCards className="w-3.5 h-3.5"/> Finance</button>
            <button onClick={() => setCurrentView('settings')} className={`flex-1 h-9 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 ${currentView === 'settings' ? 'bg-[#34326f] text-white' : 'bg-white text-[#6d6978] border border-[#dfdbe2]'}`}><Settings className="w-3.5 h-3.5"/> Profile</button>
          </nav>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 lg:py-8">
            {!isOnline && (
              <div className="mb-4 rounded-[16px] bg-[#fff4e8] border border-[#f0dfc8] px-4 py-3 flex items-center gap-3 text-[#805b30]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p className="text-xs font-semibold">You’re offline. Keep working—changes will be queued and synced when your connection returns.</p>
              </div>
            )}

            {locationTrackingEnabled && <div className="mb-4"><LocationDebugPanel students={students} isTracking={locationTrackingEnabled} /></div>}

            {autoSessionPending && (
              <div className="mb-4 rounded-[18px] border border-[#d9e9df] bg-[#f1f8f4] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-white text-[#40805f] grid place-items-center"><MapPin className="w-[18px] h-[18px]" /></div><div><p className="text-sm font-bold text-[#315d47]">Session detected · {students.find(s => s.id === autoSessionPending.studentId)?.name}</p><p className="mt-0.5 text-xs text-[#6d8878]">About {autoSessionPending.duration} minutes at the saved tuition location.</p></div></div>
                <div className="flex gap-2"><Button onClick={confirmAutoSession} size="sm">Log session</Button><Button onClick={dismissAutoSession} variant="ghost" size="sm">Dismiss</Button></div>
              </div>
            )}

            {currentView === 'dashboard' && (
              loading ? <DashboardSkeleton /> : <Dashboard students={students} tutorName={currentUser.displayName} onViewStudent={handleNavigateToStudent} onLogSession={openSessionModal} onAddStudent={() => openStudentForm()} />
            )}

            {currentView === 'student-detail' && selectedStudent && (
              <StudentDetail student={selectedStudent} onBack={handleBackToDashboard} onLogSession={() => openSessionModal(selectedStudent.id)} onLogPayment={() => openPaymentModal(selectedStudent.id)} onEditStudent={() => openStudentForm(selectedStudent.id)} onDeleteStudent={() => handleDeleteStudent(selectedStudent.id)} />
            )}

            {currentView === 'finance' && <PersonalFinance key={currentUser.uid} uid={currentUser.uid} students={students} />}

            {currentView === 'settings' && currentUser && <TutorProfile user={currentUser} onBack={handleBackToDashboard} />}
          </main>

          <StudentFormModal isOpen={isStudentFormModalOpen} onClose={() => setIsStudentFormModalOpen(false)} onSubmit={handleStudentSubmit} student={editingStudentId ? students.find(s => s.id === editingStudentId) : undefined} />
          {modalStudent && (
            <>
              <SessionModal isOpen={isSessionModalOpen} onClose={() => setIsSessionModalOpen(false)} onSubmit={handleSessionSubmit} studentName={modalStudent.name} />
              <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} onSubmit={handlePaymentSubmit} studentName={modalStudent.name} suggestedAmount={getOutstandingBalance(modalStudent)} />
            </>
          )}
        </div>
      )}

      {!authLoading && !currentUser && (currentView === 'dashboard' || currentView === 'student-detail' || currentView === 'finance' || currentView === 'settings') && (
        <LoginPage onSwitchToRegister={() => setCurrentView('register')} onSwitchToPasswordReset={() => setCurrentView('password-reset')} />
      )}
    </>
  );
};

export default App;
