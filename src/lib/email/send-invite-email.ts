// FR-013 — sends the actual invite email via SendGrid's v3 HTTP API. This is
// separate from Supabase Auth's SMTP config (also SendGrid, but that only
// powers Supabase's own signup-confirm/password-reset emails, not emails our
// own backend sends). Uses plain fetch rather than @sendgrid/mail to avoid
// an extra dependency for a single API call.
export async function sendInviteEmail({
  toEmail,
  teamName,
}: {
  toEmail: string;
  teamName: string;
}): Promise<void> {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const senderEmail = process.env.EMAIL_SENDER_ADDRESS;

  if (!apiKey || !senderEmail) {
    console.error(
      "EMAIL_PROVIDER_API_KEY or EMAIL_SENDER_ADDRESS not set — invite email not sent",
    );
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteUrl = `${siteUrl}/invites`;

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: senderEmail, name: "TechValley Jira Lite" },
      subject: `You've been invited to join ${teamName}`,
      content: [
        {
          type: "text/plain",
          value: `You've been invited to join "${teamName}" on TechValley Jira Lite.\n\nLog in (or sign up with this email address) and visit ${inviteUrl} to accept. This invite expires in 7 days.`,
        },
        {
          type: "text/html",
          value: `<p>You've been invited to join <b>${teamName}</b> on TechValley Jira Lite.</p><p>Log in (or sign up with this email address) and visit <a href="${inviteUrl}">${inviteUrl}</a> to accept. This invite expires in 7 days.</p>`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Failed to send invite email via SendGrid", res.status, body);
  }
}
