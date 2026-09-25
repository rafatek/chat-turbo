import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { KanbanBoard } from "@/components/crm/kanban-board"
import { Column, Lead, Label } from "@/types/kanban"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default async function CRMPage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        }
      },
    }
  )

  // 0. Verify Session
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // 1. Fetch Columns
  const { data: columnsData, error: columnsError } = await supabase
    .from('kanban_columns')
    .select('*')
    .order('position', { ascending: true })

  if (columnsError) {
    console.error("Error fetching columns:", columnsError)
    return <div className="p-8 text-muted-foreground p-4 bg-red-500/10 border border-red-500/20 rounded-md">
      Erro ao carregar o quadro. {columnsError.message}
    </div>
  }

  // 1.5 Fetch Available Labels
  const { data: labelsData } = await supabase
    .from('labels')
    .select('id, title, color')
    .order('title', { ascending: true })

  const availableLabels: Label[] = labelsData || []


  // 2. Fetch Leads with Labels
  const { data: leadsData, error: leadsError } = await supabase
    .from('leads')
    .select(`
      *,
      lead_labels (
        labels (
          id,
          title,
          color
        )
      )
    `)

  if (leadsError) {
    console.error("Error fetching leads:", leadsError)
  }

  // 3. Transform Data
  const columns: Column[] = (columnsData || []).map((col: any) => ({
    id: col.id,
    title: col.title,
    position: col.position,
    linked_label_id: col.linked_label_id,
    leads: [],
  }))

  const leads: Lead[] = (leadsData || []).map((lead: any) => {
    const labels: Label[] = lead.lead_labels?.map((item: any) => item.labels).filter(Boolean) || []

    return {
      id: lead.id,
      full_name: lead.full_name,
      value: lead.value,
      price: lead.price,
      valor: lead.valor,
      column_id: lead.column_id,
      whatsapp: lead.whatsapp,
      message_sent: lead.message_sent,
      origin: lead.origin,
      labels: labels,
    }
  })

  // Distribute leads to columns
  leads.forEach(lead => {
    const column = columns.find(c => c.id === lead.column_id)
    if (column) {
      column.leads.push(lead)
    }
  })

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0">
        <h1 className="text-3xl font-bold">CRM / Kanban</h1>
        <p className="mt-1 text-muted-foreground">Gerencie seus leads e oportunidades em tempo real.</p>
      </div>

      <div className="flex-1 overflow-hidden bg-background border border-border rounded-xl p-4 shadow-inner">
        <KanbanBoard initialColumns={columns} availableLabels={availableLabels} />
      </div>
    </div>
  )
}

