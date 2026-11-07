import { ReportsView } from "@/components/reports/reports-view";
import { StaffShell } from "@/components/staff-shell";
import { apiFetch, requireUser } from "@/lib/api";
import { shiftDay, todayBrt } from "@/lib/format";
import type { ReportFilters, ReportOverview, ReportTicketsPage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireUser("admin", "analyst");
  const to = todayBrt();
  const filters: ReportFilters = { from: shiftDay(to, -29), to };
  const qs = new URLSearchParams({ from: filters.from, to: filters.to });
  const [overview, tickets] = await Promise.all([
    apiFetch<ReportOverview>(`/reports/overview?${qs}`),
    apiFetch<ReportTicketsPage>(`/reports/tickets?${qs}&pageSize=10`),
  ]);
  return (
    <StaffShell user={user} active="reports">
      <ReportsView initialFilters={filters} initialOverview={overview} initialTickets={tickets} />
    </StaffShell>
  );
}
