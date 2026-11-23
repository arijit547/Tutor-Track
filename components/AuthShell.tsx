import React from 'react';
import { CalendarCheck2, WalletCards, BookOpenText, ArrowUpRight } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({ eyebrow, title, subtitle, children }) => (
  <div className="min-h-screen bg-[#f6f7f3] lg:grid lg:grid-cols-[1.02fr_.98fr]">
    <section className="hidden lg:flex relative overflow-hidden bg-[#223b2d] text-[#f4f5eb] px-10 py-10 xl:px-16 xl:py-12 flex-col justify-between">
      <BrandLogo size="md" light />
      <div className="max-w-[590px] py-12">
        <p className="text-xs text-[#b6d0b7] font-medium">A workspace for independent tutors</p>
        <h1 className="tt-display mt-5 text-[3.5rem] xl:text-[4.5rem] leading-[1.05] tracking-[-.04em]">Make room for<br /><em className="font-normal not-italic text-[#c6e0b9]">teaching.</em></h1>
        <p className="mt-6 max-w-[390px] text-[15px] leading-7 text-[#b6c8b8]">Keep lesson schedules, student records and tuition payments in order, without the extra paperwork.</p>

        <div className="mt-10 max-w-[480px] rounded-xl overflow-hidden border border-white/15 bg-[#2c4737]">
          <div className="px-5 py-4 flex items-center justify-between border-b border-white/10">
            <span className="text-xs font-medium text-[#e9efe4]">Your tutoring ledger</span>
            <span className="text-xs text-[#a8c6ab]">In one place</span>
          </div>
          {[
            [BookOpenText, 'Student records', 'Profiles and tuition details'],
            [CalendarCheck2, 'Session history', 'Lessons recorded by date'],
            [WalletCards, 'Payments', 'Income and outstanding balances'],
          ].map(([Icon, heading, copy]: any) => (
            <div key={heading} className="px-5 py-4 flex items-center gap-4 border-b border-white/10 last:border-b-0">
              <div className="h-9 w-9 shrink-0 grid place-items-center rounded-lg border border-white/15 text-[#c7dcc5]"><Icon size={18} strokeWidth={1.6} /></div>
              <div className="min-w-0 flex-1"><p className="text-[13px] font-medium text-[#f2f4ed]">{heading}</p><p className="mt-1 text-xs text-[#a7bca9]">{copy}</p></div>
              <ArrowUpRight size={15} strokeWidth={1.6} className="text-[#8faa94]" />
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-[#93ad97]">TutorTrack / Made for teaching days</p>
    </section>

    <main className="min-h-screen lg:min-h-0 flex items-center justify-center p-5 sm:p-8 lg:p-12">
      <div className="w-full max-w-[440px]">
        <div className="lg:hidden mb-10"><BrandLogo size="md" /></div>
        <div className="mb-7">
          <p className="tt-kicker">{eyebrow}</p>
          <h2 className="tt-display mt-2 text-[35px] leading-tight tracking-[-.025em] text-[#263a2c]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#79867c]">{subtitle}</p>
        </div>
        <div className="tt-card rounded-2xl p-5 sm:p-7">{children}</div>
        <p className="mt-6 text-center text-xs leading-5 text-[#65796c]">Your records stay connected to your account</p>
      </div>
    </main>
  </div>
);
