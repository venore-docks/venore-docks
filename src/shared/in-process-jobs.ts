// Varreduras periódicas em processo (setInterval) só fazem sentido num servidor de vida longa
// (self-host). Em serverless o agendamento confiável é o endpoint de cron
// (/api/cron/tick — platform/scheduled-jobs); IN_PROCESS_JOBS="false" desliga os timers.
export function inProcessJobsEnabled(): boolean {
  if (process.env.NODE_ENV === "test") return false;
  return process.env.IN_PROCESS_JOBS !== "false";
}
