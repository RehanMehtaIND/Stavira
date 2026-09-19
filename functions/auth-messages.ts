import type { CustomMessageTriggerEvent } from 'aws-lambda';
const entities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const escape = (value: string) => value.replace(/[&<>"']/g, (c) => entities[c]);
export async function handler(event: CustomMessageTriggerEvent) {
  if (event.triggerSource !== 'CustomMessage_ForgotPassword') return event;
  const origin = process.env.APP_ORIGIN ?? '';
  const email = event.request.userAttributes.email ?? '';
  const link = `${origin}/reset-password?email=${encodeURIComponent(email)}&code=${event.request.codeParameter}`;
  event.response.emailSubject = 'Reset your Stavira password';
  event.response.emailMessage = [
    '<p>You asked to reset the password for your Stavira account.</p>',
    `<p><a href="${escape(link)}">Choose a new password</a></p>`,
    '<p>This link expires in one hour and can be used once. If you did not ask for it, you can ignore this email — nothing has changed.</p>',
    `<p style="color:#6b7481;font-size:12px">If the link does not open, paste this code into the reset page: ${event.request.codeParameter}</p>`,
  ].join('');
  return event;
}
