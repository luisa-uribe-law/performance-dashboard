// Simple auth for deep-dive restriction
// Replace with Yuno SSO/OAuth when available

const LEADERSHIP_EMAILS = new Set([
  "luis.uribe@yuno.co",
  // Add other leadership emails here
]);

export function isLeadership(email: string | null | undefined): boolean {
  if (!email) return false;
  return LEADERSHIP_EMAILS.has(email.toLowerCase());
}

// For the MVP, we use a simple query param ?role=leadership
// Replace with real auth when SSO details are available
export function checkAuthFromRequest(request: Request): { isLeader: boolean } {
  const url = new URL(request.url);
  const role = url.searchParams.get("role");
  return { isLeader: role === "leadership" };
}
