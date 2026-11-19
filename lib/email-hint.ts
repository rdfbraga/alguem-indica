/** Hotmail, Outlook, Live e MSN (.com, .com.br, .fr, .co.uk…): a Microsoft costuma atrasar ou mandar para o lixo e-mails de domínios novos. */
export function isMicrosoftMail(email: string): boolean {
  return /@(hotmail|outlook|live|msn)\.(com(\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2})$/i.test(email.trim());
}
