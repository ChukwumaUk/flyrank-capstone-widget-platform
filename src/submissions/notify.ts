// A stand-in for a real email/webhook notification. In production this would call
// an email API; here it just logs — and can be made to throw, to prove isolation.
export async function notifyOwner(ownerId: string, submissionId: string): Promise<void> {
  // Simulate a flaky external service. Flip FAIL to true to test failure handling.
  const FAIL = false;
  if (FAIL) {
    throw new Error("Email service unavailable");
  }
  console.log(`[notify] emailed owner ${ownerId} about submission ${submissionId}`);
}