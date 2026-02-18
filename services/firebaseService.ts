import { db, auth, isFirebaseConfigured } from './firebase';
import { Student, Session, Payment, UserProfile } from '../types';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

const TUTORS_COLLECTION = 'tutors';
const STUDENTS_SUBCOLLECTION = 'students';
const SESSIONS_SUBCOLLECTION = 'sessions';
const PAYMENTS_SUBCOLLECTION = 'payments';

// Get current user ID
const getUserId = async (): Promise<string | null> => {
  if (!isFirebaseConfigured() || !auth) return null;

  try {
    await new Promise(resolve => {
      const unsubscribe = auth.onAuthStateChanged(() => {
        unsubscribe();
        resolve(true);
      });
    });
    return auth.currentUser?.uid || null;
  } catch {
    return null;
  }
};

// STUDENTS OPERATIONS
export const firebaseService = {
  // Get all students for current user
  async getAllStudents(): Promise<Student[]> {
    if (!isFirebaseConfigured()) return [];

    try {
      const userId = await getUserId();
      if (!userId) return [];

      const studentsRef = collection(db, TUTORS_COLLECTION, userId, STUDENTS_SUBCOLLECTION);
      const querySnapshot = await getDocs(studentsRef);

      const students: Student[] = [];
      for (const docSnap of querySnapshot.docs) {
        const studentData = docSnap.data();

        // Get sessions and payments subcollections
        const sessions = await firebaseService.getSessions(userId, docSnap.id);
        const payments = await firebaseService.getPayments(userId, docSnap.id);

        students.push({
          id: docSnap.id,
          name: studentData.name,
          subject: studentData.subject,
          ratePerSession: studentData.ratePerSession,
          scheduleDays: studentData.scheduleDays,
          scheduleTime: studentData.scheduleTime,
          email: studentData.email,
          active: studentData.active,
          joinedDate: studentData.joinedDate,
          sessions,
          payments,
        });
      }

      return students;
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  },

  // Create a new student
  async createStudent(studentData: Omit<Student, 'id' | 'sessions' | 'payments'>): Promise<Student | null> {
    if (!isFirebaseConfigured()) return null;

    try {
      const userId = await getUserId();
      if (!userId) return null;

      const studentId = crypto.randomUUID();
      const studentRef = doc(db, TUTORS_COLLECTION, userId, STUDENTS_SUBCOLLECTION, studentId);

      const firestoreData = {
        ...studentData,
        joinedDate: new Date().toISOString(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDoc(studentRef, firestoreData);

      return {
        ...studentData,
        id: studentId,
        joinedDate: new Date().toISOString(),
        sessions: [],
        payments: [],
      };
    } catch (error) {
      console.error('Error creating student:', error);
      return null;
    }
  },

  // Update a student
  async updateStudent(studentId: string, updates: Partial<Omit<Student, 'id' | 'sessions' | 'payments'>>): Promise<boolean> {
    if (!isFirebaseConfigured()) return false;

    try {
      const userId = await getUserId();
      if (!userId) return false;

      const studentRef = doc(db, TUTORS_COLLECTION, userId, STUDENTS_SUBCOLLECTION, studentId);

      await updateDoc(studentRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });

      return true;
    } catch (error) {
      console.error('Error updating student:', error);
      return false;
    }
  },

  // Delete a student
  async deleteStudent(studentId: string): Promise<boolean> {
    if (!isFirebaseConfigured()) return false;

    try {
      const userId = await getUserId();
      if (!userId) return false;

      const studentRef = doc(db, TUTORS_COLLECTION, userId, STUDENTS_SUBCOLLECTION, studentId);
      await deleteDoc(studentRef);

      return true;
    } catch (error) {
      console.error('Error deleting student:', error);
      return false;
    }
  },

  // SESSIONS OPERATIONS
  async getSessions(userId: string, studentId: string): Promise<Session[]> {
    try {
      const sessionsRef = collection(
        db,
        TUTORS_COLLECTION,
        userId,
        STUDENTS_SUBCOLLECTION,
        studentId,
        SESSIONS_SUBCOLLECTION
      );

      const querySnapshot = await getDocs(sessionsRef);
      return querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as Session));
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return [];
    }
  },

  // Create a session
  async createSession(studentId: string, sessionData: Omit<Session, 'id'>): Promise<Session | null> {
    if (!isFirebaseConfigured()) return null;

    try {
      const userId = await getUserId();
      if (!userId) return null;

      const sessionId = crypto.randomUUID();
      const sessionRef = doc(
        db,
        TUTORS_COLLECTION,
        userId,
        STUDENTS_SUBCOLLECTION,
        studentId,
        SESSIONS_SUBCOLLECTION,
        sessionId
      );

      const firestoreData = {
        ...sessionData,
        createdAt: Timestamp.now(),
      };

      await setDoc(sessionRef, firestoreData);

      return {
        ...sessionData,
        id: sessionId,
      };
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  },

  // Delete a session
  async deleteSession(studentId: string, sessionId: string): Promise<boolean> {
    if (!isFirebaseConfigured()) return false;

    try {
      const userId = await getUserId();
      if (!userId) return false;

      const sessionRef = doc(
        db,
        TUTORS_COLLECTION,
        userId,
        STUDENTS_SUBCOLLECTION,
        studentId,
        SESSIONS_SUBCOLLECTION,
        sessionId
      );

      await deleteDoc(sessionRef);
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  },

  // PAYMENTS OPERATIONS
  async getPayments(userId: string, studentId: string): Promise<Payment[]> {
    try {
      const paymentsRef = collection(
        db,
        TUTORS_COLLECTION,
        userId,
        STUDENTS_SUBCOLLECTION,
        studentId,
        PAYMENTS_SUBCOLLECTION
      );

      const querySnapshot = await getDocs(paymentsRef);
      return querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as Payment));
    } catch (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
  },

  // Create a payment
  async createPayment(studentId: string, paymentData: Omit<Payment, 'id'>): Promise<Payment | null> {
    if (!isFirebaseConfigured()) return null;

    try {
      const userId = await getUserId();
      if (!userId) return null;

      const paymentId = crypto.randomUUID();
      const paymentRef = doc(
        db,
        TUTORS_COLLECTION,
        userId,
        STUDENTS_SUBCOLLECTION,
        studentId,
        PAYMENTS_SUBCOLLECTION,
        paymentId
      );

      const firestoreData = {
        ...paymentData,
        createdAt: Timestamp.now(),
      };

      await setDoc(paymentRef, firestoreData);

      return {
        ...paymentData,
        id: paymentId,
      };
    } catch (error) {
      console.error('Error creating payment:', error);
      return null;
    }
  },

  // Delete a payment
  async deletePayment(studentId: string, paymentId: string): Promise<boolean> {
    if (!isFirebaseConfigured()) return false;

    try {
      const userId = await getUserId();
      if (!userId) return false;

      const paymentRef = doc(
        db,
        TUTORS_COLLECTION,
        userId,
        STUDENTS_SUBCOLLECTION,
        studentId,
        PAYMENTS_SUBCOLLECTION,
        paymentId
      );

      await deleteDoc(paymentRef);
      return true;
    } catch (error) {
      console.error('Error deleting payment:', error);
      return false;
    }
  },

  // TUTOR PROFILE OPERATIONS
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!isFirebaseConfigured()) return null;

    try {
      const profileRef = doc(db, TUTORS_COLLECTION, userId, 'profile', 'data');
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        return profileSnap.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  },

  async createUserProfile(userId: string, profile: UserProfile): Promise<boolean> {
    if (!isFirebaseConfigured()) return false;

    try {
      const profileRef = doc(db, TUTORS_COLLECTION, userId, 'profile', 'data');
      const profileData: any = {
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Only include optional fields if they are defined
      if (profile.phone) profileData.phone = profile.phone;
      if (profile.bio) profileData.bio = profile.bio;

      await setDoc(profileRef, profileData);
      return true;
    } catch (error) {
      console.error('Error creating user profile:', error);
      return false;
    }
  },

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<boolean> {
    if (!isFirebaseConfigured()) return false;

    try {
      const profileRef = doc(db, TUTORS_COLLECTION, userId, 'profile', 'data');
      await updateDoc(profileRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
      return true;
    } catch (error) {
      console.error('Error updating user profile:', error);
      return false;
    }
  },

  // DATA MIGRATION
  async migrateLocalDataToFirebase(userId: string): Promise<void> {
    try {
      const localStudents = localStorage.getItem('tutortrack_data_v1');
      if (!localStudents) return;

      const students: Student[] = JSON.parse(localStudents);

      for (const student of students) {
        const studentId = crypto.randomUUID();
        const studentRef = doc(
          db,
          TUTORS_COLLECTION,
          userId,
          STUDENTS_SUBCOLLECTION,
          studentId
        );

        // Create student document - only include defined fields
        const studentData: any = {
          name: student.name,
          subject: student.subject,
          ratePerSession: student.ratePerSession,
          scheduleDays: student.scheduleDays,
          scheduleTime: student.scheduleTime,
          active: student.active,
          joinedDate: student.joinedDate,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        // Only include email if defined
        if (student.email) studentData.email = student.email;

        await setDoc(studentRef, studentData);

        // Migrate sessions
        for (const session of student.sessions) {
          const sessionRef = doc(
            db,
            TUTORS_COLLECTION,
            userId,
            STUDENTS_SUBCOLLECTION,
            studentId,
            SESSIONS_SUBCOLLECTION,
            session.id
          );

          const sessionData: any = {
            date: session.date,
            durationMinutes: session.durationMinutes,
            status: session.status,
            createdAt: Timestamp.now(),
          };

          // Only include notes if defined
          if (session.notes) sessionData.notes = session.notes;

          await setDoc(sessionRef, sessionData);
        }

        // Migrate payments
        for (const payment of student.payments) {
          const paymentRef = doc(
            db,
            TUTORS_COLLECTION,
            userId,
            STUDENTS_SUBCOLLECTION,
            studentId,
            PAYMENTS_SUBCOLLECTION,
            payment.id
          );

          const paymentData: any = {
            date: payment.date,
            amount: payment.amount,
            createdAt: Timestamp.now(),
          };

          // Only include notes if defined
          if (payment.notes) paymentData.notes = payment.notes;

          await setDoc(paymentRef, paymentData);
        }
      }

      // Clear localStorage after successful migration
      localStorage.removeItem('tutortrack_data_v1');
    } catch (error) {
      console.error('Error migrating local data:', error);
      throw error;
    }
  },
};
