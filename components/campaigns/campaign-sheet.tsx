"use client"

import { useEffect, useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet"
import { toast } from "sonner"
import { createCampaign, updateCampaign, getCampaignLeads } from "@/lib/actions/campaigns"
import { Loader2, Users, Filter, Paperclip, Image as ImageIcon, Video, X } from "lucide-react"
import { LeadSelector } from "@/components/campaigns/lead-selector"
import { supabase } from "@/lib/supabase"

const campaignSchema = z.object({
    name: z.string().min(3, "Nome muito curto"),
    text_campanha: z.string().optional(),
    ia_generation: z.boolean().default(false),
    folder_name: z.string().optional(),
    schedule_days: z.array(z.string()).min(1, "Selecione pelo menos um dia"),
    schedule_start_time: z.string().min(1, "Início obrigatório"),
    schedule_end_time: z.string().min(1, "Fim obrigatório"),
    min_interval_seconds: z.coerce.number().min(5),
    max_interval_seconds: z.coerce.number().min(5),
    link_midia: z.string().optional(),
    tipo_midia: z.string().optional(),
})

type CampaignForm = z.infer<typeof campaignSchema>

interface CampaignSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    campaignToEdit?: any
}

const DAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"]

export function CampaignSheet({ open, onOpenChange, onSuccess, campaignToEdit }: CampaignSheetProps) {
    const [submitting, setSubmitting] = useState(false)
    const [isSelectorOpen, setIsSelectorOpen] = useState(false)
    const [selectedLeadsCount, setSelectedLeadsCount] = useState(0)
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
    const [lockedLeadIds, setLockedLeadIds] = useState<Set<string>>(new Set())

    const [isUploadingMedia, setIsUploadingMedia] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Convert API days (1-7) to UI days STRINGS
    const mapDaysToUI = (days?: number[]) => {
        if (!days) return ["SEG", "TER", "QUA", "QUI", "SEX"]
        const dayMap: Record<number, string> = { 1: "SEG", 2: "TER", 3: "QUA", 4: "QUI", 5: "SEX", 6: "SAB", 7: "DOM" }
        return days.map(d => dayMap[d]).filter(Boolean)
    }

    const form = useForm<CampaignForm>({
        resolver: zodResolver(campaignSchema),
        defaultValues: {
            name: "",
            text_campanha: "",
            ia_generation: false,
            folder_name: "",
            schedule_days: ["SEG", "TER", "QUA", "QUI", "SEX"],
            schedule_start_time: "09:00",
            schedule_end_time: "18:00",
            min_interval_seconds: 5,
            max_interval_seconds: 20,
            link_midia: "",
            tipo_midia: "",
        },
    })

    // Reset form when opening or changing edit mode
    useEffect(() => {
        if (open) {
            if (campaignToEdit) {
                // Formatting for Edit
                form.reset({
                    name: campaignToEdit.name,
                    text_campanha: campaignToEdit.text_campanha || "",
                    ia_generation: campaignToEdit.ia_generation || false,
                    folder_name: campaignToEdit.folder_name || "",
                    schedule_days: mapDaysToUI(campaignToEdit.schedule_days),
                    schedule_start_time: campaignToEdit.start_time,
                    schedule_end_time: campaignToEdit.end_time,
                    min_interval_seconds: campaignToEdit.min_interval_min || 5, // Careful with naming convention mismatch (min/sec)
                    max_interval_seconds: campaignToEdit.max_interval_min || 20,
                    link_midia: campaignToEdit.link_midia || "",
                    tipo_midia: campaignToEdit.tipo_midia || "",
                })

                // Fetch existing leads for this campaign
                const fetchLeads = async () => {
                    try {
                        const leads = await getCampaignLeads(campaignToEdit.id)
                        // leads: { lead_id, status }[]
                        // We extract all IDs for "selected"
                        const ids = leads.map((l: any) => l.lead_id)
                        // We extract non-pending/error for "locked"
                        const locked = leads.filter((l: any) => l.status !== 'pending' && l.status !== 'error').map((l: any) => l.lead_id)

                        setSelectedLeadIds(ids)
                        setSelectedLeadsCount(ids.length)
                        setLockedLeadIds(new Set(locked))
                        console.log("Fetched leads:", ids.length, "Locked:", locked.length)
                    } catch (err) {
                        console.error("Failed to fetch campaign leads", err)
                    }
                }
                fetchLeads()

            } else {
                // Create Mode
                form.reset({
                    name: "",
                    text_campanha: "",
                    ia_generation: false,
                    folder_name: "",
                    schedule_days: ["SEG", "TER", "QUA", "QUI", "SEX"],
                    schedule_start_time: "09:00",
                    schedule_end_time: "18:00",
                    min_interval_seconds: 5,
                    max_interval_seconds: 20,
                    link_midia: "",
                    tipo_midia: "",
                })
                setSelectedLeadIds([])
                setSelectedLeadsCount(0)
                setLockedLeadIds(new Set())
            }
        }
    }, [open, campaignToEdit, form])

    const handleLeadsSelected = (ids: string[], folderName: string) => {
        setSelectedLeadIds(ids)
        setSelectedLeadsCount(ids.length)
        form.setValue("folder_name", folderName)
    }

    const linkMidia = form.watch("link_midia")
    const tipoMidia = form.watch("tipo_midia")

    // Enforce logic: if media is present, IA cannot be enabled
    useEffect(() => {
        if (linkMidia) {
            form.setValue("ia_generation", false)
        }
    }, [linkMidia, form])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 15 * 1024 * 1024) {
            toast.error("O arquivo deve ter no máximo 15MB")
            return
        }

        let mediaType = 'document'
        if (file.type.startsWith('image/')) mediaType = 'image'
        else if (file.type.startsWith('video/')) mediaType = 'video'

        if (mediaType !== 'image' && mediaType !== 'video') {
            toast.error("Apenas imagens e vídeos são permitidos para campanhas.")
            return
        }

        setIsUploadingMedia(true)
        try {
            const rawExt = file.name.split('.').pop()?.toLowerCase() || ''
            const cleanExt = rawExt.replace(/[^a-z0-9]/g, '')
            const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'avi']
            if (!allowedExts.includes(cleanExt)) {
                toast.error("Extensão de mídia não suportada.")
                return
            }

            const fileName = `campaigns/${Date.now()}-${Math.random().toString(36).substring(2)}.${cleanExt}`

            const { error: uploadError } = await supabase.storage
                .from('chat_media')
                .upload(fileName, file, { upsert: false })

            if (uploadError) {
                if (uploadError.message.includes('Bucket not found')) {
                    toast.error("Bucket 'chat_media' não encontrado no Supabase.")
                    return
                }
                throw uploadError
            }

            const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName)

            form.setValue("link_midia", publicUrl)
            form.setValue("tipo_midia", mediaType)
            form.setValue("ia_generation", false)
        } catch (err: any) {
            toast.error(`Erro ao enviar arquivo: ${err.message}`)
        } finally {
            setIsUploadingMedia(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const removeMedia = () => {
        form.setValue("link_midia", "")
        form.setValue("tipo_midia", "")
    }

    const onSubmit = async (data: CampaignForm) => {
        if (!campaignToEdit && selectedLeadIds.length === 0 && !confirm("Nenhum lead selecionado manualmente. Deseja criar a campanha mesmo assim? (Pode não ter leads se a pasta estiver vazia)")) {
            return
        }

        setSubmitting(true)
        try {
            const payload = {
                ...data,
                folder_name: data.folder_name || "Todas",
                selected_lead_ids: selectedLeadIds
            }

            let result
            if (campaignToEdit) {
                result = await updateCampaign({ ...payload, id: campaignToEdit.id })
            } else {
                result = await createCampaign(payload)
            }

            if (result.success) {
                toast.success(campaignToEdit ? "Campanha atualizada!" : `Campanha criada com ${result.count} leads!`)
                onSuccess()
                onOpenChange(false)
                if (!campaignToEdit) form.reset()
                setSelectedLeadIds([])
                setSelectedLeadsCount(0)
            } else {
                toast.error("Erro ao salvar campanha: " + result.error)
            }
        } catch (error) {
            console.error(error)
            toast.error("Erro inesperado")
        } finally {
            setSubmitting(false)
        }
    }

    const toggleDay = (day: string) => {
        const current = form.getValues("schedule_days")
        if (current.includes(day)) {
            form.setValue("schedule_days", current.filter(d => d !== day))
        } else {
            form.setValue("schedule_days", [...current, day])
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-[calc(100%-16rem)] max-w-none sm:max-w-none border-l border-white/10 bg-[#0A0A0C]/90 backdrop-blur-xl p-0 shadow-2xl transition-all duration-500 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
                style={{ marginLeft: '16rem' }}
            >
                <div className="h-full overflow-y-auto p-6 scrollbar-hide">
                    <SheetHeader className="mb-8 border-b border-white/5 pb-6">
                        <SheetTitle className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            {campaignToEdit ? "Editar Campanha" : "Nova Campanha"}
                        </SheetTitle>
                        <SheetDescription className="text-lg mt-1">
                            {campaignToEdit ? "Atualize as configurações da campanha." : "Configure os dias e horários e selecione os leads para envio."}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="max-w-4xl mx-auto">
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
                            <div className="space-y-2">
                                <Label>Nome da Campanha</Label>
                                <Input {...form.register("name")} placeholder="Ex: Prospecção Imobiliária" />
                                {form.formState.errors.name && <span className="text-red-500 text-xs">{form.formState.errors.name.message}</span>}
                            </div>

                            <div className="space-y-2">
                                <Label>Mensagem do Disparo</Label>
                                <Textarea {...form.register("text_campanha")} placeholder="Olá, tudo bem? Vi que você..." className="h-32 resize-none bg-black/20 border-white/10" />
                                
                                {/* Anexo de Mídia */}
                                <div className="mt-2">
                                    <input 
                                        type="file" 
                                        accept="image/*,video/*" 
                                        className="hidden" 
                                        ref={fileInputRef} 
                                        onChange={handleFileUpload} 
                                    />
                                    
                                    {!linkMidia ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="border-white/10 bg-white/5 hover:bg-white/10 text-xs text-muted-foreground"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploadingMedia}
                                        >
                                            {isUploadingMedia ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Paperclip className="h-4 w-4 mr-2" />
                                            )}
                                            Anexar Imagem ou Vídeo
                                        </Button>
                                    ) : (
                                        <div className="relative inline-block mt-2 rounded-lg border border-white/10 bg-black/20 p-2 overflow-hidden max-w-[200px]">
                                            <Button 
                                                type="button" 
                                                variant="destructive" 
                                                size="icon" 
                                                className="absolute top-1 right-1 h-6 w-6 z-10 rounded-full" 
                                                onClick={removeMedia}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                            {tipoMidia === 'image' ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={linkMidia} alt="Preview" className="w-full h-auto rounded-md object-cover" />
                                            ) : (
                                                <div className="flex items-center justify-center bg-black/40 h-24 rounded-md">
                                                    <Video className="h-8 w-8 text-blue-400" />
                                                </div>
                                            )}
                                            <div className="text-[10px] text-center mt-1 text-muted-foreground truncate">
                                                Mídia anexada ({tipoMidia})
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-white/10 p-4 bg-white/5">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-white">Modo IA</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Gere as mensagens de prospecção usando Inteligência Artificial.
                                        {linkMidia && (
                                            <span className="block text-red-400 text-xs mt-1">
                                                * Desativado pois há uma mídia anexada.
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <Switch
                                    checked={form.watch("ia_generation")}
                                    onCheckedChange={(checked) => form.setValue("ia_generation", checked)}
                                    disabled={!!linkMidia}
                                    className="data-[state=checked]:bg-blue-600"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Público Alvo (Leads)</Label>
                                <div className="flex items-center gap-4 p-4 border border-white/10 rounded-lg bg-white/5 transition-colors hover:bg-white/10">
                                    <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                        <Users className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-medium text-white">Selecionar Leads</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedLeadsCount > 0
                                                ? `${selectedLeadsCount} leads selecionados`
                                                : campaignToEdit
                                                    ? "Nenhum lead vinculado."
                                                    : "Nenhum lead selecionado. Clique em Escolher."}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={() => setIsSelectorOpen(true)}
                                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg shadow-blue-500/20"
                                    >
                                        <Filter className="mr-2 h-4 w-4" />
                                        Escolher Leads
                                    </Button>
                                </div>
                                <Input type="hidden" {...form.register("folder_name")} />
                            </div>

                            <div className="space-y-2">
                                <Label>Dias de Envio</Label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS.map(day => {
                                        const isSelected = form.watch("schedule_days")?.includes(day)
                                        return (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => toggleDay(day)}
                                                className={`h-8 w-8 rounded-full text-xs font-bold transition-all
                                                  ${isSelected ? "bg-primary text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground hover:bg-muted/80"}
                                                `}
                                            >
                                                {day.charAt(0)}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Início (Horário)</Label>
                                    <Input type="time" {...form.register("schedule_start_time")} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fim (Horário)</Label>
                                    <Input type="time" {...form.register("schedule_end_time")} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Intervalo Mín (minutos)</Label>
                                    <Input type="number" {...form.register("min_interval_seconds")} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Intervalo Máx (minutos)</Label>
                                    <Input type="number" {...form.register("max_interval_seconds")} />
                                </div>
                            </div>

                            <SheetFooter>
                                <Button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 font-bold tracking-wide">
                                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {campaignToEdit ? "SALVAR ALTERAÇÕES" : "CRIAR CAMPANHA"}
                                </Button>
                            </SheetFooter>
                        </form>
                    </div>
                </div>

                <LeadSelector
                    open={isSelectorOpen}
                    onOpenChange={setIsSelectorOpen}
                    onConfirm={handleLeadsSelected}
                    initialFolder={form.getValues("folder_name") || "Todas"}
                    initialSelectedIds={selectedLeadIds}
                    lockedIds={lockedLeadIds}
                />
            </SheetContent>
        </Sheet>
    )
}
