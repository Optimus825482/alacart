import { getSessionUser } from "@/actions/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login");
  }

  switch (session.role) {
    case "WAITER":
      redirect("/waiter");
    case "KITCHEN":
      redirect("/kitchen");
    case "CHEF":
      redirect("/chef");
    case "ADMIN":
      redirect("/admin");
    default:
      redirect("/login");
  }
}
