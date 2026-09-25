import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"
import { getAdminProfiles } from "@/lib/actions/admin"
import { AdminClient } from "./admin-client"

export const metadata = {
  title: "Administração | Legado",
  description: "Gerenciamento de usuários do sistema",
}

export default async function AdminPage() {
  // 1. Verify if the current user is an admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    // Non-admins shouldn't access this page
    redirect("/dashboard")
  }

  // 2. Fetch all profiles using the secure admin server action
  const { success, data: profiles, error } = await getAdminProfiles()

  if (!success) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-red-500">Erro ao carregar usuários</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col space-y-6 p-1 animate-in fade-in zoom-in duration-500 overflow-y-auto pb-20 custom-scrollbar">
      <div>
        <h1 className="text-3xl font-black tracking-tight uppercase text-white drop-shadow-[0_0_15px_rgba(0,163,255,0.2)]">
          Painel Administrativo
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Gerencie acessos, status de assinatura e privilégios dos usuários do sistema.
        </p>
      </div>

      <AdminClient initialProfiles={profiles || []} />
    </div>
  )
}
