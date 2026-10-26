import React, { useState, useEffect } from 'react';
import { Student, Session, Payment, ViewState } from './types';
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
import { useLocationTracking } from './hooks/useLocationTracking';
import { usePushNotifications } from './hooks/usePushNotifications';
import { registerPushServiceWorker } from './services/pushService';
import { LocationDebugPanel } from './components/LocationDebugPanel';
import { BrandLogo } from './components/BrandLogo';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { PersonalFinance } from './components/PersonalFinance';
import { getStudentBilling } from './services/studentBilling';

const App: React.FC = () => {
  // --- Auth State ---
  const { currentUser, loading: authLoading, logout } = useAuth();

  // --- State ---
  const [students, setStudents] = useState<Student[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const storageKey = currentUser ? `tutortrack_data_v1_${currentUser.uid}` : null;
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Firebase & Sync States
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  // Modal States
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isStudentFormModalOpen, setIsStudentFormModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // If a modal is open, which student is it for?
  const [modalStudentId, setModalStudentId] = useState<string | null>(null);

  const [autoSessionPending, setAutoSessionPending] = useState<{ studentId: string; duration: number } | null>(null);

  const push = usePushNotifications(currentUser?.uid);
  const location = useLocationTracking(currentUser?.uid, loadedUid === currentUser?.uid ? students : [], (studentId, duration) => {
    setAutoSessionPending({ studentId, duration });
  });
  const notificationsEnabled = push.enabled;
  const locationTrackingEnabled = location.enabled;

  useEffect(() => {
    void registerPushServiceWorker().catch(() => {
      // Registration errors are surfaced when the user enables push.
    });
  }, []);

  useEffect(() => { setAutoSessionPending(null); }, [currentUser?.uid]);

  // Notification links wait for authentication and the student's synced data.
  useEffect(() => {
    if (!currentUser || loading || loadedUid !== currentUser.uid) return;
    const studentId = new URL(window.location.href).searchParams.get('student');
    if (studentId && students.some(student => student.id === studentId)) {
      setSelectedStudentId(studentId);
      setCurrentView('student-detail');
      const url = new URL(window.location.href);
      url.searchParams.delete('student');
      window.history.replaceState(null, '', url);
    }
  }, [currentUser?.uid, loadedUid, loading, students]);

  // --- Effects ---

  // Isolate cached student locations and reject loads from a previous account.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadedUid(null);
    setStudents([]);
    setSelectedStudentId(null);
    setCurrentView('dashboard');
    setIsSessionModalOpen(false);
    setIsPaymentModalOpen(false);
    setIsStudentFormModalOpen(false);
    const loadData = async () => {
      if (!currentUser || !storageKey) { setLoading(false); return; }
      const cached = () => {
        try {
          const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
          return Array.isArray(value) ? value as Student[] : [];
        } catch { return []; }
      };
      try {
        const cloud = isFirebaseConfigured() ? await firebaseService.getAllStudents() : null;
        if (cancelled) return;
        const saved = cached();
        setStudents(cloud?.length ? cloud : saved.length ? saved : cloud ? [] : MOCK_STUDENTS);
      } catch {
        if (!cancelled) setStudents(cached());
      } finally {
        if (!cancelled) { setLoadedUid(currentUser.uid); setLoading(false); }
      }
    };
    void loadData();
    return () => { cancelled = true; };
  }, [currentUser?.uid, storageKey]);

  useEffect(() => {
    if (!storageKey || loading || loadedUid !== currentUser?.uid) return;
    try { localStorage.setItem(storageKey, JSON.stringify(students)); }
    catch { setError('Browser storage is full or unavailable. Keep your connection on so changes can sync.'); }
  }, [students, storageKey, loadedUid, currentUser?.uid, loading]);

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

  // --- Handlers ---

  const handleNavigateToStudent = (id: string) => {
    setSelectedStudentId(id);
    setCurrentView('student-detail');
  };

  const handleBackToDashboard = () => {
    setSelectedStudentId(null);
    setCurrentView('dashboard');
  };

  const requestNotificationPermission = () => {
    if (push.enabled) setCurrentView('settings');
    else void push.enable();
  };

  const handleLogout = async () => {
    try { await logout(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Sign out failed. Please try again.'); }
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

                <button onClick={requestNotificationPermission} disabled={push.busy} aria-label={notificationsEnabled ? "Notification settings" : "Enable notifications"} aria-pressed={notificationsEnabled} className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl grid place-items-center transition-colors ${notificationsEnabled ? 'bg-[#eeecf7] text-[#4f4b84]' : 'text-[#878492] hover:bg-[#ece9e2]'}`} title={notificationsEnabled ? 'Notifications active' : 'Enable notifications'}>
                  {notificationsEnabled ? <Bell className="w-[18px] h-[18px]" /> : <BellOff className="w-[18px] h-[18px]" />}
                </button>

                <button onClick={location.toggle} disabled={location.busy} aria-label={locationTrackingEnabled ? "Disable location tracking" : "Enable location tracking"} aria-pressed={locationTrackingEnabled} className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl grid place-items-center transition-colors relative ${locationTrackingEnabled ? 'bg-[#edf7f1] text-[#3f805f]' : 'text-[#878492] hover:bg-[#ece9e2]'}`} title={locationTrackingEnabled ? 'Location tracking active' : 'Enable auto-session location tracking'}>
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
                <button onClick={handleLogout} className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl grid place-items-center text-[#918d99] hover:bg-[#fff0ed] hover:text-[#aa554b] transition-colors" title="Sign out">
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

            {(push.message || push.error || error) && (
              <div role={push.error || error ? 'alert' : 'status'} className="mb-4 rounded-[16px] border border-[#ddd8eb] bg-white px-4 py-3 flex items-start justify-between gap-3">
                <p className="text-xs leading-5 text-[#55516b]">{push.error || error || push.message}</p>
                <button className="text-xs font-bold text-[#55518f] shrink-0" onClick={() => { push.dismissMessage(); setError(null); }}>Dismiss</button>
              </div>
            )}

            {location.error && currentView !== 'settings' && (
              <div role="alert" className="mb-4 rounded-[16px] border border-[#ddd8eb] bg-white px-4 py-3 flex items-start justify-between gap-3">
                <p className="text-xs leading-5 text-[#55516b]">{location.error}</p>
                <button className="text-xs font-bold text-[#55518f] shrink-0" onClick={() => setCurrentView('settings')}>Location settings</button>
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

            {currentView === 'settings' && currentUser && <TutorProfile user={currentUser} onBack={handleBackToDashboard} tracking={{ push, location }} />}
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
