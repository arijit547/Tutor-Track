import React from 'react';
import { Bell, MapPin } from 'lucide-react';
import { Button } from './Button';
import { ReminderPreferences, usePushNotifications } from '../hooks/usePushNotifications';

interface Props {
  push: ReturnType<typeof usePushNotifications>;
  location: { enabled: boolean; busy: boolean; error: string | null; toggle: () => Promise<void> };
}

const reminderOptions: { key: keyof ReminderPreferences; label: string; description: string }[] = [
  { key: 'classReminders', label: 'Upcoming classes', description: 'About 30 minutes before class, using Bangladesh time.' },
  { key: 'paymentReminders', label: 'Payment due', description: 'A weekly reminder when an active student has an unpaid balance.' },
  { key: 'monthlySalaryReminders', label: 'Unpaid monthly salary', description: 'A monthly reminder based on earned salary and recorded payments.' },
];

export function TrackingPreferences({ push, location }: Props) {
  return (
    <section className="tt-card rounded-[24px] p-5 sm:p-6" aria-labelledby="tracking-preferences-heading">
      <div className="flex items-center gap-3 pb-5 border-b border-[#eeece6]">
        <div className="h-10 w-10 rounded-[13px] bg-[#eeecf7] text-[#55518f] grid place-items-center"><Bell className="w-[18px] h-[18px]" /></div>
        <div><h3 id="tracking-preferences-heading" className="font-extrabold text-[#323047]">Notifications & location</h3><p className="mt-0.5 text-xs text-[#8d8997]">Choose your reminders and automatic session detection</p></div>
      </div>
      <div className="py-5 border-b border-[#eeece6] space-y-3">
        <div><p className="text-sm font-bold text-[#39354c]">Push on this device: {push.enabled ? 'On' : 'Off'}</p><p className="mt-1 text-xs leading-5 text-[#807c8b]">Supported browsers can receive reminders while TutorTrack is closed. On iPhone or iPad, install TutorTrack on your Home Screen first (iOS 16.4+).</p></div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={push.busy} onClick={push.enabled ? push.disable : push.enable}>{push.busy ? 'Please wait…' : push.enabled ? 'Disable on this device' : 'Enable notifications'}</Button>
          <Button size="sm" variant="secondary" disabled={!push.enabled || push.busy} onClick={() => void push.test()}>Send test notification</Button>
          <Button size="sm" variant="outline" disabled={!push.enabled || push.busy} onClick={() => void push.test(true)}>Test after closing app</Button>
        </div>
      </div>
      <fieldset disabled={push.busy || !push.settingsReady} className="py-1 disabled:opacity-60">
        <legend className="pt-4 text-xs font-bold text-[#666374]">Reminders on all your devices</legend>
        {reminderOptions.map(option => (
          <label key={option.key} className="flex items-start gap-3 py-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#34326f]" checked={push.preferences[option.key]} onChange={event => void push.updatePreference(option.key, event.target.checked)} />
            <span><span className="block text-sm font-semibold text-[#39354c]">{option.label}</span><span className="mt-1 block text-xs leading-5 text-[#807c8b]">{option.description}</span></span>
          </label>
        ))}
      </fieldset>
      <div className="pt-5 border-t border-[#eeece6] space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#39354c]"><MapPin className="w-4 h-4" /> Auto-session location: {location.enabled ? 'On' : 'Off'}</div>
        <p className="text-xs leading-5 text-[#807c8b]">Your choice is remembered for this account on this device. Tracking resumes when location permission is already allowed. Keep TutorTrack open for session detection; closing the website stops GPS tracking.</p>
        <Button size="sm" variant="secondary" disabled={location.busy} onClick={location.toggle}>{location.busy ? 'Checking location…' : location.enabled ? 'Turn location off' : 'Enable location'}</Button>
        {location.error && <p role="alert" className="text-xs leading-5 text-[#a84d43]">{location.error}</p>}
      </div>
    </section>
  );
}
