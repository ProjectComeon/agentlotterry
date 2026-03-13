import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import DealerDashboardClient from "./DealerDashboardClient";

export const metadata = { title: "เจ้ามือ Dashboard | หวยออนไลน์" };

export default async function DealerDashboardPage() {
  const session = await getServerSession(authOptions);
  return <DealerDashboardClient username={session!.user.username} />;
}
