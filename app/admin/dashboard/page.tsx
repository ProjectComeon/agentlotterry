import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AdminDashboardClient from "./AdminDashboardClient";

export const metadata = { title: "Admin Dashboard | หวยออนไลน์" };

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  return <AdminDashboardClient username={session!.user.username} />;
}
