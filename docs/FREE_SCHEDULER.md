# GitHub Actions reminder scheduler

The workflow in [push-reminders.yml](../.github/workflows/push-reminders.yml) calls the Vercel backend with an authenticated `POST /api/push/reminders`. It requests a sweep at minutes 2, 7, 12, and so on through 57 of every hour, using UTC. The backend determines class times and billing dates in `Asia/Dhaka`.

## Enable it

1. Deploy the Vercel backend and configure its server-only `CRON_SECRET`. Use a long randomly generated value; do not use a `VITE_` variable or commit the value.
2. In the GitHub repository, open **Settings → Secrets and variables → Actions → Secrets → New repository secret**. Add `CRON_SECRET` with exactly the same value as Vercel.
3. The default destination is `https://tutor-track-ten.vercel.app/api/push/reminders`. For a different deployment, add both repository **Variables**: `REMINDER_ENDPOINT` with the complete HTTPS endpoint, and `REMINDER_ALLOWED_HOST` with its exact lowercase hostname, without a scheme, port or path. Changing these variables sends the bearer credential to that approved deployment, so use a deployment you control. Neither variable contains credentials.
4. Merge the workflow onto the repository's **default branch**. Scheduled workflows do not run from a testing branch. This workflow has no push or pull-request trigger.
5. Open **Actions → Send TutorTrack reminders → Run workflow**, choose the branch whose workflow you want to validate, then click **Run workflow**. GitHub makes this manual-run button available after the workflow exists on the default branch. A successful run reports only an HTTP status; it does not print the secret or response body.
6. Confirm delivery with the app's test notification and a scheduled class on a registered device. A green workflow proves the endpoint accepted the sweep; device delivery still depends on registration, browser permission and the backend's send results.
7. After the manual check succeeds, add the repository **Variable** `PUSH_REMINDERS_ENABLED` with the value `true`. Scheduled jobs stay dormant until this flag is set. Manual runs remain available before enabling the schedule and fail with an actionable message if the secret or endpoint is invalid.

The workflow follows no redirects, validates the endpoint and approved hostname before sending credentials, uses no checkout or third-party actions, and allows one active invocation at a time. A failed HTTP response, network failure or 90-second timeout fails the run. The next scheduled run can retry pending work through the backend's deduplication logic.

## Free use and scheduling limits

- GitHub standard hosted runners are free for public repositories. This workflow deliberately skips its job when the repository is private, including manual runs. Private repositories have a plan-dependent monthly allowance; a continuous five-minute schedule is not a safe fit for GitHub Free's 2,000 minutes. The workflow uploads no artifacts and creates no Actions caches. See [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
- Scheduled runs execute the latest workflow on the default branch. GitHub may delay them during high load and may drop queued runs. The minute offset reduces exposure to the busy start of the hour; it does not guarantee delivery every five minutes. Public-repository scheduled workflows are automatically disabled after 60 days without repository activity. Re-enable a disabled workflow from its Actions page. See [GitHub scheduled-workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
- This scheduler is suitable for approximate reminders. It does not provide an exact 30-minute-before-class guarantee. Check the Actions page periodically, especially after inactivity or deployment changes.
- GitHub's free runner policy covers the scheduler. Vercel, Firebase and messaging remain subject to their own service quotas; the backend setup guide describes the billing-free deployment configuration.

To stop automatic sweeps, set `PUSH_REMINDERS_ENABLED` to `false`, or open the workflow in **Actions**, open its menu, and choose **Disable workflow**. To rotate the credential, update Vercel and the GitHub repository secret together, redeploy if Vercel requires it, and run the manual workflow once.
