import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import CustomerDashboardClient from "./CustomerDashboardClient";

export const metadata = { title: "ลูกค้า Dashboard | หวยออนไลน์" };

export default async function CustomerDashboardPage() {
  const session = await getServerSession(authOptions);
  return <CustomerDashboardClient username={session!.user.username} />;
}
