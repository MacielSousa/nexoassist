import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  redirect(!user ? "/login" : user.role === "analyst" ? "/console" : "/chat");
}
