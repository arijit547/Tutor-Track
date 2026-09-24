import React from 'react';
import { CalendarCheck2, WalletCards, WifiOff, ShieldCheck } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({ eyebrow, title, subtitle, children }) => (
  <div className="min-h-screen bg-[#f4f1ea] lg:grid lg:grid-cols-[1.05fr_.95fr]">
    <section className="relative hidden lg:flex overflow-hidden bg-[#29285d] text-white p-10 xl:p-14 flex-col justify-between">
      <div className="absolute inset-0 tt-grid-bg opacity-[.22]" />
      <div className="absolute -top-28 -right-24 h-72 w-72 rounded-full border-[54px] border-white/[.03]" />
      <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-[#f4bd68]/10 blur-3xl" />

      <div className="relative"><BrandLogo size="md" light /></div>

      <div className="relative max-w-xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-xs font-semibold text-white/70">
          A focused workspace for independent tutors
        </span>
        <h1 className="mt-6 text-[2.7rem] xl:text-[3.35rem] font-extrabold tracking-[-.055em] leading-[1.03]">Less admin.<br/><span className="text-[#f4c875]">More teaching.</span></h1>
        <p className="mt-5 max-w-lg text-[15px] leading-7 text-white/62">Keep students, class history, schedules and payments together—without turning your tutoring work into spreadsheet work.</p>

        <div className="mt-8 grid grid-cols-2 gap-3 max-w-lg">
          {[
            [CalendarCheck2, 'Session history', 'Keep every class organized'],
            [WalletCards, 'Payment tracking', 'Know exactly what is due'],
            [WifiOff, 'Offline friendly', 'Keep working without internet'],
            [ShieldCheck, 'Private by account', 'Firebase-backed access'],
          ].map(([Icon, heading, copy]: any) => (
            <div key={heading} className="rounded-[18px] border border-white/[.08] bg-white/[.055] p-4">
              <Icon className="w-[18px] h-[18px] text-[#f4c875]" />
              <p className="mt-3 text-sm font-bold">{heading}</p>
              <p className="mt-1 text-xs leading-5 text-white/45">{copy}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="relative text-xs text-white/35">TutorTrack · Simple teaching operations</p>
    </section>

    <main className="min-h-screen lg:min-h-0 flex items-center justify-center p-4 sm:p-8 lg:p-12">
      <div className="w-full max-w-[460px]">
        <div className="lg:hidden mb-8"><BrandLogo size="md" /></div>
        <div className="mb-7">
          <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#7c78a2]">{eyebrow}</p>
          <h2 className="mt-2 text-[2rem] font-extrabold tracking-[-.045em] text-[#27263d] leading-tight">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#777483]">{subtitle}</p>
        </div>
        <div className="tt-surface rounded-[26px] p-5 sm:p-7">{children}</div>
        <p className="mt-6 text-center text-[11px] leading-5 text-[#9a96a2]">Secure account access · Your tutoring data stays connected to your profile</p>
      </div>
    </main>
  </div>
);
