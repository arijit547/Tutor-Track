TUTOR-TRACK: MONTHLY TUITION & BILLING MODE UPDATE
Target: test-finance-firebase branch (based on the earlier Tutor-Track-Personal-Finance-Updated.zip sources)

SUMMARY
- Add Student: monthly salary (required) replaces editable per-session rate.
- Choose: (1) fixed number of COMPLETED sessions per calendar month, or (2) fixed calendar-month billing.
- Fixed sessions: monthlySalary / requiredSessions; partial charges accumulate as sessions are completed, capped at one monthly salary each month. Missed and cancelled sessions do not count.
- Fixed calendar month: full month's salary becomes billable only AFTER the calendar month has ended. Sessions are attendance only. Planned sessions are optional, and equivalent per-session rate is informational.
- Billing starts on chosen date; first calendar month is billed in full, not prorated.
- Changing an established student's salary/billing type with recorded history takes effect next calendar month; prior legacy session billing remains on the original rate.
- Marking a student inactive pauses FUTURE calendar months (current month still counts); resuming preserves paused months.
- Existing per-session students keep their old billing until edited and saved.
- Dashboard, student cards, details and payment suggestion now use the same shared billing function.
- Student Firestore reads and local-to-cloud migration include monthly billing fields.

SAFEST INSTALL: USE GIT PATCH
1) In your local GitHub checkout of test-finance-firebase, make a backup/commit first.
2) Copy monthly-tuition.patch to the root of your project.
3) In PowerShell:
     git apply --check monthly-tuition.patch
     git apply monthly-tuition.patch
   If check reports conflicts, STOP and do not copy the old whole App.tsx or firebaseService.ts blindly.
4) Remove the patch from project root if not needed:
     Remove-Item monthly-tuition.patch
5) Run:
     npm run build
     npm audit
     npm run dev
6) Test with NEW and EXISTING students, in both billing modes. Inspect Firestore student documents after saving.
7) Check git diff, then commit and push to test-finance-firebase.

ALTERNATIVE: replacement files
You can copy the eight files preserving their folder paths. However, replacing files from a different code revision can overwrite newer edits, so prefer git apply.

IMPORTANT LIMITATIONS
- We used a previously provided project ZIP as the code baseline; we could not download every file of the latest branch.
- TS/JSX syntax verified and billing arithmetic unit tests passed; a full Vite build was NOT performed here because project npm dependencies are unavailable.
- Automatic calendar billing follows calendar months; there is no prorated first month or automatic invoicing.
- New billing fields rely on your existing student Firestore write permissions. This patch does NOT change Firestore rules.
