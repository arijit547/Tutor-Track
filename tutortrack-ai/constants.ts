import { DayOfWeek, Student } from './types';

export const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MOCK_STUDENTS: Student[] = [
  {
    id: '1',
    name: 'Alex Johnson',
    subject: 'Mathematics',
    scheduleDays: ['Mon', 'Wed', 'Fri'],
    scheduleTime: '16:00',
    ratePerSession: 40,
    email: 'alex.j@example.com',
    active: true,
    joinedDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    sessions: [
        { id: 's1', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), durationMinutes: 60, status: 'completed' },
        { id: 's2', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), durationMinutes: 60, status: 'completed' },
        { id: 's3', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), durationMinutes: 60, status: 'missed' },
    ],
    payments: [
        { id: 'p1', date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), amount: 100 },
    ]
  },
  {
    id: '2',
    name: 'Sarah Williams',
    subject: 'Physics',
    scheduleDays: ['Tue', 'Thu'],
    scheduleTime: '17:30',
    ratePerSession: 50,
    email: 'sarah.w@example.com',
    active: true,
    joinedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    sessions: [
        { id: 's4', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), durationMinutes: 90, status: 'completed' },
    ],
    payments: []
  }
];
