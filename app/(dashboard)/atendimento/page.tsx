"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import {
  Send, MessageSquare, Search, Loader2, CheckCheck, Check, Clock,
  ArrowLeft, Phone, Circle, Plus, X, UserPlus, Paperclip, Bot, BotOff, PenTool,
  ChevronRight, DollarSign, FileText, User, Trash2, ChevronDown, Mic, Zap, Filter, CalendarClock,
  UserX, UserCheck, Power, Sparkles, Copy, RefreshCw, Wand2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Label as KanbanLabel } from "@/types/kanban"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// =============================================
// Types
// =============================================
interface QuickReply {
  id: string
  user_id: string
  title: string
  content: string
}

interface Conversation {
  id: string
  contact_phone: string
  contact_name: string
  last_message: string
  last_message_at: string
  unread_count: number
  is_open: boolean
  labels?: KanbanLabel[]
  lead_id?: string
  lead_pausado?: boolean | null
  profile_pic_url?: string
}

interface Message {
  id: string
  conversation_id: string
  content: string
  from_me: boolean
  status: string
  created_at: string
  whatsapp_message_id?: string
  media_url?: string
  media_type?: string
}

export interface ChatInputBarHandle {
  setText: (text: string) => void
  focus: () => void
  clear: () => void
}

// =============================================
// Helpers
// =============================================
function formatTime(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 1) return "Ontem"
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-red-500", "bg-indigo-500",
]

function getAvatarColor(phone: string) {
  const sum = phone.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

const ContactAvatar = React.memo(function ContactAvatar({ name, phone, size = "md", picUrl }: { name: string; phone: string; size?: "sm" | "md" | "lg", picUrl?: string }) {
  const sizeClass = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-12 w-12 text-base" }[size]
  if (picUrl) {
    return <img src={picUrl} alt={name} className={cn("rounded-full object-cover flex-shrink-0", sizeClass)} />
  }
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold text-white flex-shrink-0", sizeClass, getAvatarColor(phone))}>
      {getInitials(name || phone)}
    </div>
  )
})

const MessageBubble = React.memo(function MessageBubble({ message, onDelete, onEdit }: { message: Message; onDelete?: (msg: Message) => void; onEdit?: (msg: Message) => void }) {
  const isMe = message.from_me
  const isDeleted = message.content === '[Mensagem apagada]' || message.content === '🚫 Mensagem apagada' || message.status === 'deleted'
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className={cn("group flex gap-2 max-w-[75%]", isMe ? "ml-auto flex-row-reverse" : "mr-auto")}
      onMouseLeave={() => setMenuOpen(false)}
    >
      <div className={cn(
        "relative rounded-2xl px-4 py-2.5 text-sm shadow-sm",
        isMe ? "bg-[#00A3FF] text-white rounded-tr-sm" : "bg-card dark:bg-[#1A1A23] text-foreground dark:text-gray-100 border border-border dark:border-white/5 rounded-tl-sm",
        isDeleted && "opacity-50 italic"
      )}>

        {/* Botão ⌄ no canto superior direito DA BOLHA */}
        {isMe && !isDeleted && !message.id.startsWith('temp-') && (
          <div className={cn(
            "absolute top-1 right-1 z-20 transition-opacity",
            menuOpen ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
          )}>
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="flex items-center justify-center h-5 w-5 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-all"
              title="Opções da mensagem"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-6 w-44 bg-popover dark:bg-[#1C1D22] border border-border dark:border-white/10 rounded-lg shadow-2xl overflow-hidden z-50">
                {(!message.media_url) && (
                  <button
                    onClick={() => { setMenuOpen(false); onEdit?.(message) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    <PenTool className="h-3.5 w-3.5" />
                    Editar mensagem
                  </button>
                )}
                <button
                  onClick={() => { setMenuOpen(false); onDelete?.(message) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Apagar mensagem
                </button>
              </div>
            )}
          </div>
        )}

        {isDeleted ? (
          <p className="leading-relaxed text-xs flex items-center gap-1.5">
            <Trash2 className="h-3 w-3" /> Você apagou esta mensagem
          </p>
        ) : (
          <>
            {message.media_url && message.media_type === 'image' && (
              <div className="mb-2 -mx-2 -mt-1 rounded-xl overflow-hidden max-w-[240px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={message.media_url} alt="Mídia" className="w-full h-auto object-cover" />
              </div>
            )}
            {message.media_url && (message.media_type === 'audio' || message.media_type === 'ptt') && (
              <div className="mb-2 -mx-2 -mt-1 min-w-[200px] max-w-[260px]">
                <audio controls src={message.media_url} className="w-full" style={{ height: '45px' }} />
              </div>
            )}
            {message.media_url && message.media_type === 'video' && (
              <div className="mb-2 -mx-2 -mt-1 rounded-xl overflow-hidden max-w-[240px]">
                <video controls src={message.media_url} className="w-full h-auto object-cover" />
              </div>
            )}
            {message.media_url && !['image', 'audio', 'ptt', 'video'].includes(message.media_type || '') && (
              <a href={message.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mb-2 p-2 bg-black/20 rounded-lg text-xs hover:bg-black/30 transition-colors">
                <Paperclip className="h-4 w-4" /> Baixar Anexo
              </a>
            )}
            <p className="leading-relaxed break-words whitespace-pre-wrap pr-4">
              {message.content?.split(/(\*[^*]+\*)/g).map((part, i) =>
                part.startsWith('*') && part.endsWith('*') ? (
                  <strong key={i}>{part.slice(1, -1)}</strong>
                ) : (
                  part
                )
              )}
            </p>
          </>
        )}
        <div className={cn("flex items-center gap-1 mt-1", isMe ? "justify-end" : "justify-start")}>
          <span className={cn("text-[10px]", isMe ? "text-blue-100/70" : "text-gray-500")}>
            {formatTime(message.created_at)}
          </span>
          {isMe && !isDeleted && (
            message.status === "read" ? <CheckCheck className="h-4 w-4 text-[#53bdeb]" /> :
            message.status === "delivered" ? <CheckCheck className="h-4 w-4 text-gray-400" /> :
            message.status === "sending" ? <Clock className="h-3 w-3 text-gray-400" /> :
            <Check className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>
    </div>
  )
})

const ConversationItem = React.memo(function ConversationItem({
  conv,
  isSelected,
  onSelect,
}: {
  conv: Conversation
  isSelected: boolean
  onSelect: (conv: Conversation) => void
}) {
  return (
    <button
      onClick={() => onSelect(conv)}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent dark:hover:bg-white/[0.03] border-b border-border dark:border-white/[0.03]",
        isSelected && "bg-[#00A3FF]/5 border-l-2 border-l-[#00A3FF]"
      )}
    >
      <div className="relative">
        <ContactAvatar name={conv.contact_name || conv.contact_phone} phone={conv.contact_phone} picUrl={conv.profile_pic_url} />
        <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-emerald-500 text-emerald-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-sm font-semibold text-foreground dark:text-gray-100 truncate">
            {conv.contact_name || conv.contact_phone}
          </span>
          <span className="text-[10px] text-gray-600 flex-shrink-0">{formatTime(conv.last_message_at)}</span>
        </div>
        
        {/* Renderização das Badges/Etiquetas */}
        {conv.labels && conv.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {conv.labels.map(label => (
              <div 
                key={label.id} 
                style={{ backgroundColor: label.color }} 
                className="text-[9px] uppercase font-bold text-white px-1.5 py-0.5 rounded-sm line-clamp-1 truncate max-w-[80px]"
                title={label.title}
              >
                {label.title}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 truncate">{conv.last_message || "..."}</p>
          {conv.unread_count > 0 && (
            <span className="flex-shrink-0 min-w-[18px] bg-[#00A3FF] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-1 h-4">
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
})

interface ChatInputBarProps {
  onSend: (text: string) => Promise<void> | void
  isSending: boolean
  editingMessage: Message | null
  onCancelEdit: () => void
  activeSignature?: string
  isRecording: boolean
  recordingTime: number
  startRecording: () => void
  stopAndSendRecording: () => void
  cancelRecording: () => void
  isUploading: boolean
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  quickReplies: QuickReply[]
  isManageQuickRepliesOpen: boolean
  setIsManageQuickRepliesOpen: (open: boolean) => void
  newQuickReplyTitle: string
  setNewQuickReplyTitle: (title: string) => void
  newQuickReplyContent: string
  setNewQuickReplyContent: (content: string) => void
  editingQuickReply: QuickReply | null
  setEditingQuickReply: (qr: QuickReply | null) => void
  isSavingQuickReply: boolean
  handleSaveQuickReply: () => void
  handleDeleteQuickReply: (id: string) => void
}

const ChatInputBar = React.memo(
  forwardRef<ChatInputBarHandle, ChatInputBarProps>(function ChatInputBar(
    {
      onSend,
      isSending,
      editingMessage,
      onCancelEdit,
      activeSignature,
      isRecording,
      recordingTime,
      startRecording,
      stopAndSendRecording,
      cancelRecording,
      isUploading,
      handleFileUpload,
      quickReplies,
      isManageQuickRepliesOpen,
      setIsManageQuickRepliesOpen,
      newQuickReplyTitle,
      setNewQuickReplyTitle,
      newQuickReplyContent,
      setNewQuickReplyContent,
      editingQuickReply,
      setEditingQuickReply,
      isSavingQuickReply,
      handleSaveQuickReply,
      handleDeleteQuickReply,
    },
    ref
  ) {
    const [text, setText] = useState("")
    const [isQuickRepliesMenuOpen, setIsQuickRepliesMenuOpen] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      setText: (newText: string) => {
        setText(newText)
        if (textareaRef.current) {
          textareaRef.current.style.height = "32px"
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
            }
          }, 0)
        }
      },
      focus: () => {
        textareaRef.current?.focus()
      },
      clear: () => {
        setText("")
        if (textareaRef.current) {
          textareaRef.current.style.height = "32px"
        }
      },
    }))

    useEffect(() => {
      if (editingMessage) {
        setText(editingMessage.content || "")
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus()
            textareaRef.current.style.height = "32px"
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
          }
        }, 50)
      }
    }, [editingMessage])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleTriggerSend()
      }
    }

    const handleTriggerSend = () => {
      if (!text.trim() || isSending) return
      const toSend = text
      setText("")
      if (textareaRef.current) {
        textareaRef.current.style.height = "32px"
      }
      onSend(toSend)
    }

    const formatTimeSeconds = (totalSeconds: number) => {
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }

    return (
      <div className="p-3 pb-safe border-t border-border dark:border-white/5 bg-card dark:bg-[#0D0D12]">
        {editingMessage && (
          <div className="mb-2 px-3 py-1.5 bg-[#00A3FF]/10 text-[#00A3FF] text-xs rounded-lg flex items-center justify-between border border-[#00A3FF]/20">
            <span className="flex items-center gap-2">
              <PenTool className="h-3.5 w-3.5" />
              Editando mensagem...
            </span>
            <button
              onClick={() => {
                onCancelEdit()
                setText("")
                if (textareaRef.current) {
                  textareaRef.current.style.height = "32px"
                }
              }}
              className="hover:bg-white/10 rounded-full p-1 transition-colors"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        )}
        {activeSignature && (
          <div className="mb-2 px-1 text-[10px] text-gray-500 flex items-center gap-1.5">
            <PenTool className="h-3 w-3 text-purple-400" />
            Enviando mensagem como: <strong className="text-gray-300 font-medium">{activeSignature}</strong>
          </div>
        )}
        <div className="flex items-center gap-2 bg-accent/50 dark:bg-white/5 rounded-xl border border-border dark:border-white/5 px-4 py-2 focus-within:border-[#00A3FF]/40 transition-colors">
          {isRecording ? (
            <div className="flex items-center justify-between w-full h-8">
              <Button
                variant="ghost"
                size="icon"
                onClick={cancelRecording}
                className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10 flex-shrink-0"
                title="Cancelar gravação"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-mono text-red-400 font-medium">
                  {formatTimeSeconds(recordingTime)}
                </span>
              </div>
              <Button
                size="icon"
                onClick={stopAndSendRecording}
                className="h-8 w-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 flex-shrink-0 transition-all"
                title="Enviar áudio"
              >
                <Send className="h-4 w-4 text-white" />
              </Button>
            </div>
          ) : (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isSending}
                className="h-8 w-8 text-gray-400 hover:text-white flex-shrink-0"
                title="Anexar arquivo"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </Button>

              {/* Botão Respostas Rápidas */}
              <Popover open={isQuickRepliesMenuOpen} onOpenChange={setIsQuickRepliesMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isSending || isUploading}
                    className="h-8 w-8 text-gray-400 hover:text-[#00A3FF] hover:bg-[#00A3FF]/10 flex-shrink-0"
                    title="Respostas Rápidas"
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-80 p-0 border-border dark:border-white/10 bg-popover dark:bg-[#12121A] shadow-2xl mb-2">
                  {!isManageQuickRepliesOpen ? (
                    <>
                      <div className="flex items-center justify-between p-3 border-b border-white/5">
                        <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                          <Zap className="h-4 w-4 text-[#00A3FF]" />
                          Respostas Rápidas
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsManageQuickRepliesOpen(true)}
                          className="h-7 text-xs text-[#00A3FF] hover:text-[#00A3FF] hover:bg-[#00A3FF]/10"
                        >
                          Gerenciar
                        </Button>
                      </div>
                      <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                        {quickReplies.length === 0 ? (
                          <div className="text-center p-4 text-xs text-gray-500">
                            Nenhuma resposta rápida cadastrada.
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {quickReplies.map(qr => (
                              <button
                                key={qr.id}
                                onClick={() => {
                                  setIsQuickRepliesMenuOpen(false)
                                  setText(qr.content)
                                  setTimeout(() => {
                                    if (textareaRef.current) {
                                      textareaRef.current.focus()
                                      textareaRef.current.style.height = "32px"
                                      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
                                    }
                                  }, 50)
                                }}
                                className="text-left p-2.5 rounded-lg hover:bg-white/5 transition-colors group flex flex-col gap-1"
                              >
                                <span className="font-medium text-foreground dark:text-gray-200 text-sm group-hover:text-[#00A3FF] transition-colors line-clamp-1">{qr.title}</span>
                                <span className="text-xs text-gray-500 line-clamp-2">{qr.content}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-3 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setIsManageQuickRepliesOpen(false); setEditingQuickReply(null); setNewQuickReplyTitle(""); setNewQuickReplyContent(""); }}
                            className="h-6 w-6 hover:bg-white/10 -ml-1"
                          >
                            <ArrowLeft className="h-3 w-3" />
                          </Button>
                          <h4 className="font-semibold text-white text-sm">
                            {editingQuickReply ? 'Editar Resposta' : 'Nova Resposta'}
                          </h4>
                        </div>
                      </div>
                      <div className="p-3 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-400">Título (ex: Boas vindas)</Label>
                          <Input
                            value={newQuickReplyTitle}
                            onChange={e => setNewQuickReplyTitle(e.target.value)}
                            placeholder="Digite um título..."
                            className="h-8 text-sm bg-white/5 border-white/10"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-400">Mensagem</Label>
                          <Textarea
                            value={newQuickReplyContent}
                            onChange={e => setNewQuickReplyContent(e.target.value)}
                            placeholder="Digite o texto da mensagem..."
                            className="min-h-[80px] text-sm bg-white/5 border-white/10 resize-none custom-scrollbar"
                          />
                        </div>
                        <div className="pt-2">
                          <Button
                            onClick={handleSaveQuickReply}
                            disabled={!newQuickReplyTitle.trim() || !newQuickReplyContent.trim() || isSavingQuickReply}
                            className="w-full bg-[#00A3FF] hover:bg-[#00A3FF]/80 text-white h-8 text-xs"
                          >
                            {isSavingQuickReply ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-40 overflow-y-auto border-t border-white/5 custom-scrollbar p-2">
                        {quickReplies.map(qr => (
                          <div key={qr.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 group">
                            <span className="text-sm text-gray-300 font-medium truncate flex-1 pr-2">{qr.title}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingQuickReply(qr);
                                  setNewQuickReplyTitle(qr.title);
                                  setNewQuickReplyContent(qr.content);
                                }}
                                className="h-6 w-6 text-gray-400 hover:text-white"
                              >
                                <PenTool className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteQuickReply(qr.id)}
                                className="h-6 w-6 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </PopoverContent>
              </Popover>

              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite uma mensagem..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none pt-[6px] custom-scrollbar overflow-y-auto"
                style={{ minHeight: '32px', maxHeight: '120px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = '32px';
                  target.style.height = `${target.scrollHeight}px`;
                }}
                disabled={isSending}
              />
              {(!text.trim() && !isUploading) ? (
                <Button
                  size="icon"
                  onClick={startRecording}
                  disabled={isSending}
                  className="h-8 w-8 rounded-lg bg-transparent hover:bg-accent dark:hover:bg-white/10 text-muted-foreground dark:text-gray-400 hover:text-[#00A3FF] flex-shrink-0 transition-all"
                  title="Gravar áudio"
                >
                  <Mic className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={handleTriggerSend}
                  disabled={isSending || !text.trim()}
                  className="h-8 w-8 rounded-lg bg-[#00A3FF] hover:bg-[#00A3FF]/80 flex-shrink-0 transition-all disabled:opacity-30"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingMessage ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />)}
                </Button>
              )}
            </>
          )}
        </div>
        <p className="hidden sm:block text-[10px] text-muted-foreground mt-1.5 text-center">Enter para enviar · Shift+Enter para nova linha</p>
      </div>
    )
  })
)

// =============================================
// Main Component
// =============================================
export default function AtendimentoPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConvs, setFilteredConvs] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isLoadingConvs, setIsLoadingConvs] = useState(true)
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [search, setSearch] = useState("")
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string | null>(null)
  const [isMobileView, setIsMobileView] = useState(false)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [availableLabels, setAvailableLabels] = useState<KanbanLabel[]>([])

  // Quick Replies
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [isQuickRepliesMenuOpen, setIsQuickRepliesMenuOpen] = useState(false)
  const [isManageQuickRepliesOpen, setIsManageQuickRepliesOpen] = useState(false)
  const [newQuickReplyTitle, setNewQuickReplyTitle] = useState("")
  const [newQuickReplyContent, setNewQuickReplyContent] = useState("")
  const [editingQuickReply, setEditingQuickReply] = useState<QuickReply | null>(null)
  const [isSavingQuickReply, setIsSavingQuickReply] = useState(false)

  // Agendamento
  const [isAgendamentoOpen, setIsAgendamentoOpen] = useState(false)
  const [agendamentoText, setAgendamentoText] = useState("")
  const [agendamentoDate, setAgendamentoDate] = useState("")
  const [isSavingAgendamento, setIsSavingAgendamento] = useState(false)

  // Nova Conversa Dialog
  const [isNewConvOpen, setIsNewConvOpen] = useState(false)
  const [newConvPhone, setNewConvPhone] = useState("")
  const [newConvName, setNewConvName] = useState("")
  const [newConvMsg, setNewConvMsg] = useState("")
  const [isCreatingConv, setIsCreatingConv] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<ChatInputBarHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const processedUrlRef = useRef(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Signatures
  const [availableSignatures, setAvailableSignatures] = useState<string[]>([])
  const [activeSignature, setActiveSignature] = useState<string>("")
  const [newSignature, setNewSignature] = useState("")

  // RMK State
  const [rmkEnabled, setRmkEnabled] = useState(true)
  const [isRmkLoading, setIsRmkLoading] = useState(false)

  // Sidebar do Contato
  const [isContactSidebarOpen, setIsContactSidebarOpen] = useState(false)
  const [leadDetails, setLeadDetails] = useState<{
    id?: string;
    full_name: string;
    detalhes: string;
    valor: string;
  } | null>(null)
  const [isSavingLead, setIsSavingLead] = useState(false)
  const [isLoadingLead, setIsLoadingLead] = useState(false)
  const [isDeletingContact, setIsDeletingContact] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  // ---- Load User ----
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: any } }) => {
      if (user) {
        setUserId(user.id)
        if (user.user_metadata?.signatures) {
          setAvailableSignatures(user.user_metadata.signatures)
        }
      }
    })
    
    const savedSignature = localStorage.getItem('chat_active_signature')
    if (savedSignature) {
      setActiveSignature(savedSignature)
    }
  }, [])

  // ---- Auto-open from CRM (?phone=...&name=...) ----
  useEffect(() => {
    if (isLoadingConvs) return;
    if (processedUrlRef.current) return;

    const phone = searchParams.get('phone')
    const name = searchParams.get('name')
    if (phone) {
      processedUrlRef.current = true;
      const cleanPhone = phone.replace(/\D/g, "")
      const existingConv = conversations.find(c => c.contact_phone === cleanPhone)

      if (existingConv) {
        setSelectedConv(existingConv)
        setMessages([])
        setIsMobileView(true)
      } else {
        setNewConvPhone(phone)
        setNewConvName(name || '')
        setIsNewConvOpen(true)
      }
      
      router.replace('/atendimento')
    }
  }, [searchParams, conversations, isLoadingConvs, router])

  // ---- Load Conversations ----
  const loadConversations = useCallback(async () => {
    if (!userId) return
    setIsLoadingConvs(true)
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        *,
        leads!leads_conversation_id_fkey (
          id,
          lead_pausado,
          lead_labels (
            labels (
              id,
              title,
              color
            )
          )
        )
      `)
      .eq("user_id", userId)
      .order("last_message_at", { ascending: false })
      
    if (!error && data) {
      const formatted = data.map((conv: any) => {
        // Como o relacionamento é OneToMany pela ótica do DB, 'leads' vem como array. Pegamos o primeiro.
        const firstLead = (Array.isArray(conv.leads) ? conv.leads[0] : conv.leads) || null
        const flatLabels = firstLead?.lead_labels?.map((ll: any) => ll.labels).filter(Boolean) || []
        return { 
            ...conv, 
            lead_id: firstLead?.id || conv.lead_id, 
            lead_pausado: firstLead?.lead_pausado || false,
            labels: flatLabels 
        }
      })
      setConversations(formatted)
      setFilteredConvs(formatted)
    }
    setIsLoadingConvs(false)
  }, [userId])

  // Assistente de Mensagem State
  const [assistenteConfig, setAssistenteConfig] = useState<{ is_active: boolean; prompt?: string } | null>(null)

  const loadLabels = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('labels').select('*').eq('user_id', userId)
    if (data) setAvailableLabels(data)
  }, [userId])

  const loadQuickReplies = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('quick_replies').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (data) setQuickReplies(data)
  }, [userId])

  const loadAssistenteConfig = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('agents_assist')
      .select('is_active, prompt')
      .eq('user_id', userId)
      .maybeSingle()

    if (!error && data) {
      setAssistenteConfig({
        is_active: data.is_active || false,
        prompt: data.prompt || ''
      })
    } else {
      setAssistenteConfig(null)
    }
  }, [userId])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => { loadLabels() }, [loadLabels])
  useEffect(() => { loadQuickReplies() }, [loadQuickReplies])

  // Realtime: Assistente de Mensagem
  useEffect(() => {
    if (!userId) return
    loadAssistenteConfig()

    const channel = supabase
      .channel("agents_assist_realtime")
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agents_assist', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          if (payload.new) {
            setAssistenteConfig({
              is_active: payload.new.is_active || false,
              prompt: payload.new.prompt || ''
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, loadAssistenteConfig])

  // Assistente de Mensagem: Geração de Sugestões via N8N
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isSuggestionsDialogOpen, setIsSuggestionsDialogOpen] = useState(false)

  const handleGenerateSuggestions = async () => {
    if (!selectedConv) return

    let finalLeadId = selectedConv.lead_id

    // Fallback: se o lead_id não estiver no objeto local, busca no Supabase
    if (!finalLeadId) {
      const { data: leadData } = await supabase
        .from('leads')
        .select('id')
        .eq('conversation_id', selectedConv.id)
        .maybeSingle()

      if (leadData) {
        finalLeadId = leadData.id
      } else {
        const { data: leadDataPhone } = await supabase
          .from('leads')
          .select('id')
          .eq('whatsapp', selectedConv.contact_phone)
          .maybeSingle()
        if (leadDataPhone) finalLeadId = leadDataPhone.id
      }
    }

    if (!finalLeadId) {
      toast.warning("Este contato ainda não possui registro de Lead no CRM.")
      return
    }

    setIsGeneratingSuggestions(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.")
        return
      }

      const res = await fetch('/api/inbox/assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          lead_id: finalLeadId,
          conversation_id: selectedConv.id,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Erro ao obter sugestões da IA.")
        return
      }

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions)
        setIsSuggestionsDialogOpen(true)
      } else {
        toast.warning("Nenhuma sugestão foi retornada pelo Assistente.")
      }
    } catch (err: any) {
      console.error("Erro ao gerar sugestões:", err)
      toast.error("Falha de conexão com o Assistente de IA.")
    } finally {
      setIsGeneratingSuggestions(false)
    }
  }

  const handleApplySuggestion = (text: string) => {
    chatInputRef.current?.setText(text)
    setIsSuggestionsDialogOpen(false)
    toast.success("Sugestão inserida no campo de mensagem!")
    setTimeout(() => {
      chatInputRef.current?.focus()
    }, 150)
  }

  const handleCopySuggestion = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Mensagem copiada para a área de transferência!")
  }

  const handleSaveQuickReply = async () => {
    if (!userId || !newQuickReplyTitle.trim() || !newQuickReplyContent.trim()) return
    setIsSavingQuickReply(true)
    try {
      if (editingQuickReply) {
        const { error } = await supabase.from('quick_replies').update({
          title: newQuickReplyTitle,
          content: newQuickReplyContent
        }).eq('id', editingQuickReply.id)
        if (error) throw error
        toast.success("Resposta rápida atualizada!")
      } else {
        const { error } = await supabase.from('quick_replies').insert({
          user_id: userId,
          title: newQuickReplyTitle,
          content: newQuickReplyContent
        })
        if (error) throw error
        toast.success("Resposta rápida criada!")
      }
      setNewQuickReplyTitle("")
      setNewQuickReplyContent("")
      setEditingQuickReply(null)
      loadQuickReplies()
    } catch (err) {
      toast.error("Erro ao salvar resposta rápida")
    } finally {
      setIsSavingQuickReply(false)
    }
  }

  const handleDeleteQuickReply = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar?")) return
    const { error } = await supabase.from('quick_replies').delete().eq('id', id)
    if (error) toast.error("Erro ao apagar")
    else {
      toast.success("Resposta apagada!")
      loadQuickReplies()
    }
  }

  const handleSaveAgendamento = async () => {
    if (!userId || !agendamentoText.trim() || !agendamentoDate || !selectedConv) {
      toast.warning("Preencha todos os campos para agendar.")
      return
    }
    setIsSavingAgendamento(true)
    try {
      let finalLeadId = selectedConv.lead_id
      
      // Fallback: se o lead_id não estiver no estado (ex: recém criado), busca no banco
      if (!finalLeadId) {
        const { data: leadData } = await supabase
          .from('leads')
          .select('id')
          .eq('conversation_id', selectedConv.id)
          .maybeSingle()
        
        if (leadData) {
          finalLeadId = leadData.id
        } else {
          const { data: leadDataPhone } = await supabase
            .from('leads')
            .select('id')
            .eq('whatsapp', selectedConv.contact_phone)
            .maybeSingle()
          if (leadDataPhone) finalLeadId = leadDataPhone.id
        }
      }

      const scheduledAt = new Date(agendamentoDate).toISOString()
      const { error } = await supabase.from('agendamentos').insert({
        user_id: userId,
        lead_id: finalLeadId || null,
        conversation_id: selectedConv.id,
        contact_phone: selectedConv.contact_phone,
        content: agendamentoText,
        scheduled_at: scheduledAt
      })
      if (error) throw error
      toast.success("Mensagem agendada com sucesso!")
      setIsAgendamentoOpen(false)
      setAgendamentoText("")
      setAgendamentoDate("")
    } catch (err) {
      console.error(err)
      toast.error("Erro ao agendar mensagem.")
    } finally {
      setIsSavingAgendamento(false)
    }
  }

  // ---- Search Filter ----
  useEffect(() => {
    let filtered = conversations;
    
    if (selectedLabelFilter) {
      filtered = filtered.filter(c => c.labels?.some(l => l.id === selectedLabelFilter))
    }
    
    const q = search.toLowerCase()
    if (q) {
      // Normaliza dígitos para comparação de telefone (cobre com e sem prefixo 55)
      const qDigits = q.replace(/\D/g, '')
      filtered = filtered.filter(c => {
        const phoneDigits = c.contact_phone.replace(/\D/g, '')
        const phoneMatch = qDigits.length >= 6 && (
          phoneDigits.includes(qDigits) ||
          phoneDigits.includes(qDigits.replace(/^55/, '')) ||
          (`55${phoneDigits}`).includes(qDigits)
        )
        return (
          c.contact_name?.toLowerCase().includes(q) ||
          phoneMatch ||
          c.last_message?.toLowerCase().includes(q)
        )
      })
    }
    
    setFilteredConvs(filtered)
  }, [search, conversations, selectedLabelFilter])

  // ---- Realtime: Conversations ----
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel("convs-realtime")
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newConv = payload.new as Conversation
            setConversations(prev => {
              if (prev.find(c => c.id === newConv.id)) return prev
              return [newConv, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updatedConv = payload.new as Conversation
            setConversations(prev => {
                const updatedList = prev.map(c => {
                    if (c.id === updatedConv.id) {
                        return { 
                            ...c, 
                            ...updatedConv,
                            lead_id: c.lead_id || updatedConv.lead_id,
                            lead_pausado: c.lead_pausado,
                            labels: c.labels
                        }
                    }
                    return c
                })
                return updatedList.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
            })
            setSelectedConv(prev => {
                if (prev?.id === updatedConv.id) {
                    return { 
                        ...prev, 
                        ...updatedConv,
                        lead_id: prev.lead_id || updatedConv.lead_id,
                        lead_pausado: prev.lead_pausado,
                        labels: prev.labels
                    }
                }
                return prev
            })
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ---- Load Messages ----
  const loadMessages = useCallback(async (convId: string) => {
    setIsLoadingMsgs(true)
    const { data, error } = await supabase
      .from("messages").select("*").eq("conversation_id", convId).order("created_at", { ascending: true })
    if (!error && data) {
      const validMessages = data.filter((m: any) => m.content?.trim() || m.media_url)
      setMessages(validMessages)
    }
    setIsLoadingMsgs(false)
    if (userId) {
      await supabase.from("conversations").update({ unread_count: 0 }).eq("id", convId).eq("user_id", userId)
    }
  }, [userId])

  // ---- Realtime: Messages ----
  useEffect(() => {
    if (!selectedConv) return
    loadMessages(selectedConv.id)
    const channel = supabase
      .channel(`msgs-${selectedConv.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedConv.id}` },
        (payload: { new: Message }) => {
          if (!payload.new.content?.trim() && !payload.new.media_url) return
          setMessages(prev => prev.find(m => m.id === payload.new.id || (m.whatsapp_message_id && m.whatsapp_message_id === payload.new.whatsapp_message_id)) ? prev : [...prev, payload.new as Message])
          
          // Se a conversa está aberta e recebemos uma mensagem do lead, zera o contador no banco
          if (!payload.new.from_me && selectedConv) {
            supabase.from("conversations").update({ unread_count: 0 }).eq("id", selectedConv.id).then()
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedConv?.id, loadMessages])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])
  useEffect(() => { if (selectedConv) setTimeout(() => chatInputRef.current?.focus(), 100) }, [selectedConv])

  // ---- RMK Functions ----
  useEffect(() => {
    if (!selectedConv?.lead_id) {
        setRmkEnabled(true)
        return
    }
    const fetchRmkState = async () => {
        setIsRmkLoading(true)
        try {
            const { data, error } = await supabase
                .from('remarketing_leads')
                .select('rmk_enabled')
                .eq('lead_id', selectedConv.lead_id)
                .maybeSingle()
            if (!error && data) {
                setRmkEnabled(data.rmk_enabled !== false)
            } else {
                setRmkEnabled(true)
            }
        } catch (err) {
            console.error("Erro ao buscar RMK:", err)
        } finally {
            setIsRmkLoading(false)
        }
    }
    fetchRmkState()
  }, [selectedConv?.lead_id])

  const handleToggleRmk = async () => {
    if (!selectedConv?.lead_id) return
    setIsLoadingLead(false)
    setIsRmkLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error("Não autenticado")
      
      const newEnabled = !rmkEnabled
      const rmkPayload: any = {
        lead_id: selectedConv.lead_id,
        user_id: session.user.id,
        rmk_enabled: newEnabled,
      }
      if (newEnabled) {
        rmkPayload.remarketing_status = "none"
        rmkPayload.remarketing_attempts = 0
        rmkPayload.last_remarketing_at = new Date().toISOString()
      }
      
      const { error } = await supabase.from('remarketing_leads').upsert(rmkPayload, { onConflict: "lead_id" })
      if (error) throw error
      
      setRmkEnabled(newEnabled)
      toast.success(newEnabled ? "RMK ativado para o lead" : "RMK desativado para o lead")
    } catch (err: any) {
      console.error(err)
      toast.error("Erro ao alterar RMK")
    } finally {
      setIsRmkLoading(false)
    }
  }

  // ---- Lead Sidebar Functions ----
  const fetchLeadDetails = useCallback(async () => {
    if (!selectedConv?.lead_id) return
    setIsLoadingLead(true)
    const { data, error } = await supabase
      .from('leads')
      .select('id, full_name, detalhes, valor')
      .eq('id', selectedConv.lead_id)
      .single()
    if (!error && data) {
      setLeadDetails({
        id: data.id,
        full_name: data.full_name || '',
        detalhes: data.detalhes || '',
        valor: data.valor?.toString() || ''
      })
    }
    setIsLoadingLead(false)
  }, [selectedConv?.lead_id])

  useEffect(() => {
    if (isContactSidebarOpen && selectedConv?.lead_id) {
      fetchLeadDetails()
    } else {
      setLeadDetails(null)
    }
  }, [isContactSidebarOpen, selectedConv?.lead_id, fetchLeadDetails])

  const handleUpdateLead = async () => {
    if (!selectedConv?.lead_id || !leadDetails) return
    setIsSavingLead(true)
    
    // Preparar valor numerico seguro
    let safeValor: number | null = null
    if (leadDetails.valor) {
        const parsed = parseFloat(leadDetails.valor.replace(',', '.'))
        if (!isNaN(parsed)) safeValor = parsed
    }

    const { error } = await supabase
      .from('leads')
      .update({
        full_name: leadDetails.full_name,
        detalhes: leadDetails.detalhes,
        valor: safeValor
      })
      .eq('id', selectedConv.lead_id)

    if (error) {
      toast.error("Erro ao salvar dados do contato.")
    } else {
      // Atualiza também na tabela de conversations para persistir o nome na barra lateral e topo
      const { error: convError } = await supabase
        .from('conversations')
        .update({ contact_name: leadDetails.full_name })
        .eq('id', selectedConv.id)

      if (convError) {
        console.error("Erro ao atualizar nome na conversa:", convError)
      }

      toast.success("Dados atualizados com sucesso!")
      // Atualizar o nome no selectedConv e conversations locais para refletir a mudanca instantaneamente
      setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, contact_name: leadDetails.full_name } : c))
      setSelectedConv(prev => prev ? { ...prev, contact_name: leadDetails.full_name } : prev)
    }
    setIsSavingLead(false)
  }

  const handleDeleteContact = async () => {
    if (!selectedConv) return
    setIsDeletingContact(true)
    const convId = selectedConv.id
    try {
      // Chama a API server-side que usa service role (bypassa RLS) - Lógica do usuário
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/api/contacts/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ conversation_id: convId }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Erro ao apagar o contato.")
        return
      }

      toast.success("Contato e histórico apagados com sucesso!")

      // Atualizar UI
      setConversations(prev => prev.filter(c => c.id !== convId))
      setFilteredConvs(prev => prev.filter(c => c.id !== convId))
      setSelectedConv(null)
      setIsContactSidebarOpen(false)
      setIsDeleteConfirmOpen(false)
      setIsMobileView(false)
    } catch (err: any) {
      console.error("Erro ao apagar contato:", err)
      toast.error(`Falha ao excluir contato: ${err.message || err}`)
    } finally {
      setIsDeletingContact(false)
    }
  }


  // ---- Send Message ----
  const handleSend = async (mediaUrl?: string, mediaType?: string, overrideText?: string) => {
    const textToSend = overrideText !== undefined ? overrideText : ""
    if ((!textToSend.trim() && !mediaUrl) || !selectedConv || isSending) return

    if (editingMessage) {
      setIsSending(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/inbox/edit', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            message_id: editingMessage.id,
            whatsapp_message_id: editingMessage.whatsapp_message_id,
            contact_phone: selectedConv.contact_phone,
            content: textToSend,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          toast.error(data.error || 'Erro ao editar mensagem')
          chatInputRef.current?.setText(textToSend)
          return
        }

        setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, content: textToSend } : m))
        setEditingMessage(null)
        toast.success("Mensagem editada com sucesso!")
      } catch (err) {
        toast.error("Erro ao editar mensagem")
        chatInputRef.current?.setText(textToSend)
      } finally {
        setIsSending(false)
      }
      return
    }

    let content = textToSend.trim()
    if (content && activeSignature) {
      content = `*${activeSignature}:*\n${content}`
    }
    content = content || "[Mídia]"
    setIsSending(true)

    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConv.id,
      content,
      from_me: true,
      status: "sending",
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      // Pega o token JWT da sessão atual para autenticar a rota do servidor
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ conversation_id: selectedConv.id, contact_phone: selectedConv.contact_phone, content, media_url: mediaUrl, media_type: mediaType }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Erro ao enviar mensagem")
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id))
        chatInputRef.current?.setText(textToSend)
        return
      }
      setMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempMsg.id)
        if (!withoutTemp.find(m => m.id === data.message.id || (m.whatsapp_message_id && m.whatsapp_message_id === data.message.whatsapp_message_id))) {
          return [...withoutTemp, data.message]
        }
        return withoutTemp
      })
    } catch {
      toast.error("Erro de conexão ao enviar mensagem")
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id))
      chatInputRef.current?.setText(textToSend)
    } finally {
      setIsSending(false)
    }
  }

  // ---- Audio Recording ----
  const formatTimeSeconds = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Gravação de áudio não suportada (requer HTTPS ou localhost).")
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error("Erro ao acessar microfone:", err)
      toast.error("Permissão de microfone negada ou indisponível")
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      audioChunksRef.current = []
    }
    setIsRecording(false)
    setRecordingTime(0)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' })
        const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm;codecs=opus' })
        
        setIsUploading(true)
        try {
          const fileName = `${selectedConv?.id}/audio_${Math.random().toString(36).substring(2)}.webm`
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('chat_media')
            .upload(fileName, file, { upsert: false })
            
          if (uploadError) {
             toast.error("Erro ao enviar áudio. Tente novamente.")
             throw uploadError
          }

          const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName)
          await handleSend(publicUrl, 'ptt') // Send as Push-To-Talk
        } catch (err: any) {
          console.error("Audio upload error:", err)
        } finally {
          setIsUploading(false)
        }
      }

      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
    
    setIsRecording(false)
    setRecordingTime(0)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedConv) return
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 5MB")
      return
    }

    // Validação rígida de extensões permitidas (Allowlist de segurança)
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'avi', 'mp3', 'ogg', 'wav', 'm4a', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip']
    const rawExt = file.name.split('.').pop()?.toLowerCase() || ''
    const cleanExt = rawExt.replace(/[^a-z0-9]/g, '')

    if (!allowedExtensions.includes(cleanExt)) {
      toast.error("Tipo de arquivo não permitido. Envie apenas imagens, vídeos, áudios ou documentos padrão.")
      return
    }

    setIsUploading(true)
    try {
      const fileName = `${selectedConv.id}/${Math.random().toString(36).substring(2)}.${cleanExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat_media')
        .upload(fileName, file, { upsert: false })
        
      if (uploadError) {
          // Verify if bucket exists
          if (uploadError.message.includes('Bucket not found')) {
              toast.error("Bucket 'chat_media' não foi criado no Supabase.")
              return
          }
          throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName)
      
      let mediaType = 'document'
      if (file.type.startsWith('image/')) mediaType = 'image'
      else if (file.type.startsWith('video/')) mediaType = 'video'
      else if (file.type.startsWith('audio/')) mediaType = 'audio'

      await handleSend(publicUrl, mediaType)
    } catch (err: any) {
      toast.error(`Erro ao enviar arquivo: ${err.message}`)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }


  // ---- Nova Conversa ----
  const handleCreateConversation = async () => {
    let phone = newConvPhone.replace(/\D/g, "")
    let firstMsg = newConvMsg.trim()
    if (firstMsg && activeSignature) {
      firstMsg = `*${activeSignature}:*\n${firstMsg}`
    }

    if (!phone || phone.length < 10) {
      toast.warning("Digite um número de WhatsApp válido")
      return
    }

    // Remove o prefixo 55 (DDI Brasil) para salvar no padrão do sistema
    // O webhook e n8n salvam sem o 55, então mantemos consistência
    if (phone.length === 13 && phone.startsWith('55')) {
      phone = phone.slice(2)
    } else if (phone.length === 12 && phone.startsWith('55')) {
      phone = phone.slice(2)
    }

    setIsCreatingConv(true)
    try {
      // 1. Upsert conversation no Supabase
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .upsert({
          user_id: userId,
          contact_phone: phone,
          contact_name: newConvName.trim() || phone,
          last_message: firstMsg || "[Contato Criado]",
          last_message_at: new Date().toISOString(),
          unread_count: 0,
          is_open: true,
        }, { onConflict: "user_id,contact_phone" })
        .select()
        .single()

      if (convErr || !conv) {
        toast.error("Erro ao criar conversa")
        return
      }

      // 2. Upsert do lead no CRM/Kanban — mantém tudo sincronizado
      try {
        // Busca o lead nos dois formatos possíveis (com e sem DDI 55)
        // para evitar duplicatas e perda de etiquetas por inconsistência de formato
        const phoneWith55 = phone.startsWith('55') ? phone : `55${phone}`
        const phoneWithout55 = phone.startsWith('55') ? phone.slice(2) : phone

        const { data: existingLead } = await supabase
          .from("leads")
          .select("id")
          .eq("user_id", userId)
          .or(`whatsapp.eq.${phoneWith55},whatsapp.eq.${phoneWithout55}`)
          .maybeSingle()

        let leadIdToUse = existingLead?.id

        if (!existingLead) {
          // Busca a primeira coluna (position 0) para colocar o lead
          const { data: firstCol, error: colErr } = await supabase
            .from("kanban_columns")
            .select("id")
            .eq("user_id", userId)
            .order("position", { ascending: true })
            .limit(1)
            .maybeSingle()

          if (colErr) console.warn("CRM: erro ao buscar primeira coluna:", colErr)
          if (!firstCol) console.warn("CRM: nenhuma coluna encontrada para user_id:", userId)

          const { data: newLead, error: leadInsertErr } = await supabase.from("leads").insert({
            user_id: userId,
            full_name: newConvName.trim() || phone,
            whatsapp: phone,
            origin: "WhatsApp",
            column_id: firstCol?.id || null,
            last_message: firstMsg || "[Contato Criado]",
            last_message_at: new Date().toISOString(),
            conversation_id: conv.id,
          }).select("id").single()

          if (leadInsertErr) console.warn("CRM: erro ao inserir lead:", leadInsertErr)
          else {
            console.log(`CRM: Lead criado para ${phone} na coluna ${firstCol?.id ?? 'sem coluna'}`)
            if (newLead) leadIdToUse = newLead.id
          }
        } else {
          // Lead já existe — apenas atualiza last_message e vincula conversa
          await supabase.from("leads").update({
            last_message: firstMsg || "[Contato Criado]",
            last_message_at: new Date().toISOString(),
            conversation_id: conv.id,
          }).eq("id", existingLead.id)
        }

        // Vincular lead_id de volta na conversa e no objeto local
        if (leadIdToUse) {
          await supabase.from("conversations").update({ lead_id: leadIdToUse }).eq('id', conv.id)
          conv.lead_id = leadIdToUse
        }
      } catch (leadErr) {
        console.warn("Aviso: não foi possível sincronizar lead no CRM:", leadErr)
        // Não bloqueia o fluxo — a conversa já foi criada
      }

      if (firstMsg) {
        // 2. Envia a primeira mensagem via UazAPI
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch("/api/inbox/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({ conversation_id: conv.id, contact_phone: phone, content: firstMsg }),
        })
        const data = await res.json()

        if (!res.ok) {
          toast.error(data.error || "Conversa criada, mas falha ao enviar a mensagem")
        } else {
          toast.success("Conversa iniciada e mensagem enviada!")
        }
      } else {
        toast.success("Contato criado com sucesso!")
      }

      // 3. Abre a conversa
      setSelectedConv(conv)
      setMessages([])
      setIsMobileView(true)
      setIsNewConvOpen(false)
      setNewConvPhone("")
      setNewConvName("")
      setNewConvMsg("")

      // Atualiza lista
      loadConversations()
    } catch (err) {
      toast.error("Erro inesperado ao criar conversa")
    } finally {
      setIsCreatingConv(false)
    }
  }

  const handleRemoveLabel = async (leadId: string | undefined | null, labelId: string) => {
    if (!leadId) {
        toast.warning("Sem registro de CRM para remover a etiqueta.")
        return
    }
    
    try {
        const { error } = await supabase
            .from('lead_labels')
            .delete()
            .eq('lead_id', leadId)
            .eq('label_id', labelId)

        if (error) throw error

        // Atualiza UI instantaneamente retirando a tag
        setConversations(prev => prev.map(c => {
            if (c.lead_id === leadId) {
                return { ...c, labels: c.labels?.filter(l => l.id !== labelId) }
            }
            return c
        }))
        
        setSelectedConv(prev => {
            if (prev && prev.lead_id === leadId) {
                return { ...prev, labels: prev.labels?.filter(l => l.id !== labelId) }
            }
            return prev
        })
        
    } catch (err) {
        toast.error("Erro ao remover etiqueta")
    }
  }

  const handleAddLabel = async (leadId: string | undefined | null, labelId: string) => {
    if (!leadId) {
        toast.warning("Sem registro correspondente do CRM (Lead ID Null).")
        return
    }
    try {
        const { error } = await supabase.from('lead_labels').insert({ lead_id: leadId, label_id: labelId })
        if (error) {
            toast.error(`Erro: ${error.message}`)
            throw error
        }
        
        const labelToAdd = availableLabels.find(l => l.id === labelId)
        if (!labelToAdd) return

        // Tentar atualizar o React
        setConversations(prev => prev.map(c => {
            if (c.lead_id === leadId) {
                const currentLabels = c.labels || []
                if (!currentLabels.find(l => l.id === labelToAdd.id)) {
                    return { ...c, labels: [...currentLabels, labelToAdd] }
                }
            }
            return c
        }))
        
        setSelectedConv(prev => {
            if (prev && prev.lead_id === leadId) {
                const currentLabels = prev.labels || []
                if (!currentLabels.find(l => l.id === labelToAdd.id)) {
                    return { ...prev, labels: [...currentLabels, labelToAdd] }
                }
            }
            return prev
        })
        
    } catch (err: any) {
        console.error("Adicionar Etiqueta Error:", err)
    }
  }

  // ---- Delete Message ----
  const handleDeleteMessage = useCallback((message: Message) => {
    if (!selectedConv || deletingMessageId) return
    setConfirmDeleteMsg(message)
  }, [selectedConv, deletingMessageId])

  const handleEditMessage = useCallback((msg: Message) => {
    setEditingMessage(msg)
  }, [])

  const confirmDeleteMessage = async () => {
    const message = confirmDeleteMsg
    if (!message || !selectedConv) return
    setConfirmDeleteMsg(null)
    setDeletingMessageId(message.id)

    // Optimistic UI: marca como apagada imediatamente
    setMessages(prev => prev.map(m =>
      m.id === message.id ? { ...m, content: '[Mensagem apagada]', media_url: undefined, media_type: undefined } : m
    ))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/inbox/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          message_id: message.id,
          whatsapp_message_id: message.whatsapp_message_id,
          contact_phone: selectedConv.contact_phone,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Reverte se falhar
        toast.error(data.error || 'Erro ao apagar mensagem')
        setMessages(prev => prev.map(m => m.id === message.id ? message : m))
      } else {
        if (!data.deleted_from_whatsapp) {
          toast.warning('Mensagem apagada localmente. Não foi possível apagar no WhatsApp.')
        } else {
          toast.success('Mensagem apagada para todos ✓')
        }
        // Remove da lista local após confirmação do banco
        setMessages(prev => prev.filter(m => m.id !== message.id))
      }
    } catch {
      toast.error('Erro de conexão ao apagar mensagem')
      setMessages(prev => prev.map(m => m.id === message.id ? message : m))
    } finally {
      setDeletingMessageId(null)
    }
  }

  const handleSelectConv = useCallback((conv: Conversation) => {
    setSelectedConv(conv)
    setMessages([])
    setIsMobileView(true)
  }, [])

  const handleToggleIAPause = async () => {
    if (!selectedConv?.lead_id) {
        toast.error("Este contato ainda não está vinculado ao CRM.");
        return;
    }
    const newValue = !selectedConv.lead_pausado;
    
    // UI optimistic update
    setSelectedConv(prev => prev ? { ...prev, lead_pausado: newValue } : prev);
    setConversations(prev => prev.map(c => c.id === selectedConv?.id ? { ...c, lead_pausado: newValue } : c));
    
    try {
        const { error } = await supabase.from('leads').update({ lead_pausado: newValue }).eq('id', selectedConv.lead_id);
        if (error) throw error;
        toast.success(newValue ? "IA silenciada para este contato 🤫" : "IA ativada para este contato 🤖");
    } catch (err: any) {
        console.error("Erro ao pausar IA:", err);
        toast.error("Erro ao alterar o status da IA");
        // Revert on error
        setSelectedConv(prev => prev ? { ...prev, lead_pausado: !newValue } : prev);
        setConversations(prev => prev.map(c => c.id === selectedConv?.id ? { ...c, lead_pausado: !newValue } : c));
    }
  }

  // ---- Signatures ----
  const handleAddSignature = async () => {
    if (!newSignature.trim()) return
    const updated = [...availableSignatures, newSignature.trim()]
    setAvailableSignatures(updated)
    setNewSignature("")
    toast.success("Assinatura adicionada")
    
    await supabase.auth.updateUser({
      data: { signatures: updated }
    })
  }

  const handleDeleteSignature = async (sig: string) => {
    const updated = availableSignatures.filter(s => s !== sig)
    setAvailableSignatures(updated)
    if (activeSignature === sig) handleSelectSignature("")
    toast.success("Assinatura removida")

    await supabase.auth.updateUser({
      data: { signatures: updated }
    })
  }

  const handleSelectSignature = (sig: string) => {
    setActiveSignature(sig)
    if (sig) {
      localStorage.setItem('chat_active_signature', sig)
      toast.success(`Escrevendo como: ${sig}`)
    } else {
      localStorage.removeItem('chat_active_signature')
      toast.success("Assinatura desativada")
    }
  }

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  return (
    <>
      <div className="relative flex h-full rounded-xl overflow-hidden border border-border dark:border-white/5 bg-background dark:bg-[#0A0A0E]">

        {/* ===== SIDEBAR ===== */}
        <div className={cn(
          "flex flex-col border-r border-border dark:border-white/5 bg-card dark:bg-[#0D0D12] transition-all duration-300",
          "w-full md:w-[340px] md:flex-shrink-0",
          isMobileView && selectedConv ? "hidden md:flex" : "flex"
        )}>
          {/* Header */}
          <div className="p-4 border-b border-border dark:border-white/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-foreground dark:text-white">Atendimento</h1>
                {totalUnread > 0 && (
                  <Badge className="bg-[#00A3FF] text-white text-[10px] h-5 min-w-5 flex items-center justify-center px-1.5">
                    {totalUnread}
                  </Badge>
                )}
              </div>
              {/* Botão Nova Conversa */}
              <Button
                size="icon"
                onClick={() => setIsNewConvOpen(true)}
                className="h-8 w-8 rounded-lg bg-[#00A3FF]/10 hover:bg-[#00A3FF]/20 border border-[#00A3FF]/20 text-[#00A3FF]"
                title="Nova Conversa"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 relative">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar conversa..."
                  className="pl-9 h-9 bg-accent/50 border-border text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-[#00A3FF]/30"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className={cn("h-9 w-9 flex-shrink-0 border", selectedLabelFilter ? "bg-[#00A3FF]/10 text-[#00A3FF] border-[#00A3FF]/20" : "bg-accent/50 border-border text-gray-500 hover:text-white")}>
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                  <DropdownMenuItem onClick={() => setSelectedLabelFilter(null)} className={cn("text-xs cursor-pointer", !selectedLabelFilter && "font-bold text-[#00A3FF]")}>
                    Todas as conversas
                  </DropdownMenuItem>
                  {availableLabels.map(label => (
                    <DropdownMenuItem key={label.id} onClick={() => setSelectedLabelFilter(label.id)} className={cn("text-xs cursor-pointer flex items-center gap-2", selectedLabelFilter === label.id && "font-bold bg-accent")}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: label.color }}></span>
                      {label.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isLoadingConvs ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-[#00A3FF]" />
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                <div className="h-14 w-14 rounded-full bg-accent dark:bg-white/5 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-gray-600" />
                </div>
                <p className="text-sm text-gray-500">Nenhuma conversa ainda</p>
                <p className="text-xs text-gray-600 mb-2">
                  Clique no <strong className="text-gray-400">+</strong> acima para iniciar uma nova conversa com qualquer número.
                </p>
                <Button
                  size="sm"
                  onClick={() => setIsNewConvOpen(true)}
                  className="bg-[#00A3FF]/10 hover:bg-[#00A3FF]/20 text-[#00A3FF] border border-[#00A3FF]/20 gap-2"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Nova Conversa
                </Button>
              </div>
            ) : (
              filteredConvs.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  isSelected={selectedConv?.id === conv.id}
                  onSelect={handleSelectConv}
                />
              ))
            )}
          </div>
        </div>

        {/* ===== CHAT PANEL ===== */}
        <div className={cn(
          "relative flex-1 flex flex-col min-w-0",
          !isMobileView && !selectedConv ? "hidden md:flex" : "flex",
          isMobileView && !selectedConv ? "hidden" : ""
        )}>
          {selectedConv ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border dark:border-white/5 bg-card dark:bg-[#0D0D12]">
                <button
                  onClick={() => { setSelectedConv(null); setIsMobileView(false) }}
                  className="md:hidden text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div 
                  onClick={() => setIsContactSidebarOpen(prev => !prev)}
                  className="flex items-center gap-3 hover:bg-accent dark:hover:bg-white/5 p-1.5 -ml-1.5 rounded-lg transition-colors text-left flex-1 cursor-pointer"
                  title="Ver dados do contato"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsContactSidebarOpen(prev => !prev);
                    }
                  }}
                >
                  <ContactAvatar name={selectedConv.contact_name || selectedConv.contact_phone} phone={selectedConv.contact_phone} size="md" picUrl={selectedConv.profile_pic_url} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground dark:text-white truncate">{selectedConv.contact_name || selectedConv.contact_phone}</p>
                        <p className="text-[11px] text-gray-500 font-mono hidden sm:block flex-shrink-0">{selectedConv.contact_phone}</p>
                    </div>
                  {/* Etiquetas no Cabeçalho do Chat */}
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                      {selectedConv.labels && selectedConv.labels.map(label => (
                          <div 
                            key={label.id} 
                            style={{ backgroundColor: label.color }} 
                            className="flex items-center gap-1 text-[9px] uppercase font-bold text-white pl-1.5 pr-0.5 py-0.5 rounded-sm"
                          >
                            <span>{label.title}</span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRemoveLabel(selectedConv.lead_id, label.id); }} 
                                className="hover:bg-black/20 rounded-sm p-[1px] transition-colors"
                                title="Remover etiqueta"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                      ))}
                      
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <button 
                                onClick={(e) => e.stopPropagation()} // Prevent sidebar toggle when clicking plus
                                className="flex items-center justify-center h-4 w-4 rounded-sm border border-dashed border-gray-600 hover:border-gray-400 hover:bg-white/5 transition-colors text-gray-400 hover:text-white" 
                                title="Adicionar etiqueta ao lead"
                              >
                                  <Plus className="h-3 w-3" />
                              </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48 bg-popover dark:bg-[#1A1A23] border-border dark:border-white/10" onClick={(e) => e.stopPropagation()}>
                              {availableLabels.length === 0 ? (
                                  <div className="px-2 py-2 text-xs text-gray-500 text-center">Nenhuma etiqueta criada no CRM</div>
                              ) : (
                                  availableLabels.map(lbl => {
                                      const hasLabel = selectedConv.labels?.some(l => l.id === lbl.id)
                                      return (
                                        <DropdownMenuItem 
                                            key={lbl.id}
                                            disabled={hasLabel}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleAddLabel(selectedConv.lead_id, lbl.id)
                                            }}
                                            className="text-xs text-foreground dark:text-gray-200 cursor-pointer flex items-center gap-2 hover:bg-accent dark:hover:bg-white/5 data-[highlighted]:bg-accent dark:data-[highlighted]:bg-white/10 outline-none"
                                        >
                                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lbl.color }} />
                                            <span className="truncate">{lbl.title}</span>
                                            {hasLabel && <Check className="h-3 w-3 ml-auto opacity-50 flex-shrink-0" />}
                                        </DropdownMenuItem>
                                      )
                                  })
                              )}
                          </DropdownMenuContent>
                      </DropdownMenu>
                  </div>
                </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Botão Agendamento */}
                  <Popover open={isAgendamentoOpen} onOpenChange={setIsAgendamentoOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="flex items-center gap-1.5 text-xs font-medium transition-colors px-2 md:px-3 py-1.5 rounded-lg border bg-[#00A3FF]/10 text-[#00A3FF] border-[#00A3FF]/20 hover:bg-[#00A3FF]/20"
                        title="Agendar Mensagem"
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Agendamento</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 border-border dark:border-white/10 bg-popover dark:bg-[#12121A] shadow-2xl" align="end">
                      <div className="flex items-center justify-between p-3 border-b border-white/5">
                        <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-[#00A3FF]" />
                          Agendar Mensagem
                        </h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsAgendamentoOpen(false)}
                          className="h-6 w-6 hover:bg-white/10"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="p-3 space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-400">Data e Hora do Envio</Label>
                          <Input
                            type="datetime-local"
                            value={agendamentoDate}
                            onChange={(e) => setAgendamentoDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className="h-9 text-sm bg-white/5 border-white/10 [color-scheme:dark]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-400">Mensagem</Label>
                          <Textarea
                            value={agendamentoText}
                            onChange={(e) => setAgendamentoText(e.target.value)}
                            placeholder="Digite o texto da mensagem que será agendada..."
                            className="min-h-[100px] text-sm bg-white/5 border-white/10 resize-none custom-scrollbar"
                          />
                        </div>
                        <div className="pt-1">
                          <Button
                            onClick={handleSaveAgendamento}
                            disabled={!agendamentoText.trim() || !agendamentoDate || isSavingAgendamento}
                            className="w-full bg-[#00A3FF] hover:bg-[#00A3FF]/80 text-white h-9"
                          >
                            {isSavingAgendamento ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Agendar'}
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {selectedConv.lead_id && (
                    <button
                      onClick={handleToggleRmk}
                      disabled={isRmkLoading}
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-medium transition-colors px-2 md:px-3 py-1.5 rounded-lg border",
                        !rmkEnabled
                          ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
                        isRmkLoading && "opacity-50 cursor-not-allowed"
                      )}
                      title={rmkEnabled ? "Desativar Remarketing Automático" : "Ativar Remarketing Automático"}
                    >
                      {isRmkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (!rmkEnabled ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />)}
                      <span className="hidden sm:inline">{!rmkEnabled ? "RMK Pausado" : "RMK Ativo"}</span>
                    </button>
                  )}

                  <button
                    onClick={handleToggleIAPause}
                    className={cn(
                        "flex items-center gap-1.5 text-xs font-medium transition-colors px-2 md:px-3 py-1.5 rounded-lg border",
                        selectedConv.lead_pausado 
                            ? "bg-[#D4A373]/10 text-[#D4A373] border-[#D4A373]/20 hover:bg-[#D4A373]/20" 
                            : "bg-[#00A3FF]/10 text-[#00A3FF] border-[#00A3FF]/20 hover:bg-[#00A3FF]/20"
                    )}
                    title={selectedConv.lead_pausado ? "Retomar respostas automáticas da IA" : "Pausar respostas automáticas da IA"}
                  >
                    {selectedConv.lead_pausado ? <BotOff className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{selectedConv.lead_pausado ? "IA Pausada" : "Pausar IA"}</span>
                  </button>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-medium transition-colors px-3 py-1.5 rounded-lg border",
                          activeSignature
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20"
                            : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10"
                        )}
                        title="Assinatura de Atendente"
                      >
                        <PenTool className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{activeSignature || "Assinatura"}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3 border-border dark:border-[#2A2D35] bg-popover dark:bg-[#1C1D22] text-sm" align="end">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-white mb-2 text-xs uppercase tracking-wider text-gray-400">Assinatura Ativa</h4>
                          {availableSignatures.length === 0 ? (
                            <p className="text-gray-500 text-xs">Nenhuma assinatura criada.</p>
                          ) : (
                            <div className="space-y-1">
                              <button
                                onClick={() => handleSelectSignature("")}
                                className={cn(
                                  "w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors",
                                  activeSignature === "" ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5"
                                )}
                              >
                                Nenhum
                                {activeSignature === "" && <Check className="h-3 w-3" />}
                              </button>
                              {availableSignatures.map(sig => (
                                <div key={sig} className="flex items-center group">
                                  <button
                                    onClick={() => handleSelectSignature(sig)}
                                    className={cn(
                                      "flex-1 flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors",
                                      activeSignature === sig ? "bg-purple-500/20 text-purple-400" : "text-gray-300 hover:bg-white/5"
                                    )}
                                  >
                                    {sig}
                                    {activeSignature === sig && <Check className="h-3 w-3" />}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteSignature(sig); }}
                                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-red-400 text-gray-500 transition-all rounded-md hover:bg-red-500/10"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="pt-3 border-t border-white/5">
                          <label className="text-xs text-gray-400 mb-1.5 block">Nova Assinatura</label>
                          <div className="flex gap-2">
                            <Input 
                              value={newSignature}
                              onChange={e => setNewSignature(e.target.value)}
                              placeholder="Ex: Ana"
                              className="h-7 text-xs bg-black/20 border-white/10"
                              onKeyDown={e => { if (e.key === 'Enter') handleAddSignature() }}
                            />
                            <Button onClick={handleAddSignature} size="sm" variant="secondary" className="h-7 px-2 bg-white/10 hover:bg-white/20">
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <a
                    href={`https://wa.me/${selectedConv.contact_phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-green-500/10 border border-white/5"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-background dark:bg-[#080810]">
                {isLoadingMsgs ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-[#00A3FF]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                    <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-gray-600" />
                    </div>
                    <p className="text-sm text-gray-500">Conversa vazia</p>
                    <p className="text-xs text-gray-600">Envie uma mensagem para iniciar o atendimento.</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        onDelete={handleDeleteMessage}
                        onEdit={handleEditMessage}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Chat Input Bar */}
              <ChatInputBar
                ref={chatInputRef}
                onSend={(text) => handleSend(undefined, undefined, text)}
                isSending={isSending}
                editingMessage={editingMessage}
                onCancelEdit={() => setEditingMessage(null)}
                activeSignature={activeSignature}
                isRecording={isRecording}
                recordingTime={recordingTime}
                startRecording={startRecording}
                stopAndSendRecording={stopAndSendRecording}
                cancelRecording={cancelRecording}
                isUploading={isUploading}
                handleFileUpload={handleFileUpload}
                quickReplies={quickReplies}
                isManageQuickRepliesOpen={isManageQuickRepliesOpen}
                setIsManageQuickRepliesOpen={setIsManageQuickRepliesOpen}
                newQuickReplyTitle={newQuickReplyTitle}
                setNewQuickReplyTitle={setNewQuickReplyTitle}
                newQuickReplyContent={newQuickReplyContent}
                setNewQuickReplyContent={setNewQuickReplyContent}
                editingQuickReply={editingQuickReply}
                setEditingQuickReply={setEditingQuickReply}
                isSavingQuickReply={isSavingQuickReply}
                handleSaveQuickReply={handleSaveQuickReply}
                handleDeleteQuickReply={handleDeleteQuickReply}
              />

              {/* ===== FLOATING ICON: ASSISTENTE DE MENSAGEM ===== */}
              {assistenteConfig?.is_active && (
                <div className="absolute bottom-20 right-6 z-30 group">
                  <button
                    onClick={handleGenerateSuggestions}
                    disabled={isGeneratingSuggestions}
                    className={cn(
                      "relative flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-110 active:scale-95 transition-all duration-300 border border-white/20 backdrop-blur-md cursor-pointer",
                      isGeneratingSuggestions && "opacity-80 scale-105 cursor-wait"
                    )}
                    title={isGeneratingSuggestions ? "Gerando sugestões..." : "Pedir sugestões ao Assistente de IA"}
                  >
                    {isGeneratingSuggestions ? (
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    ) : (
                      <>
                        <Sparkles className="h-6 w-6 animate-pulse" />
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#0A0A0E]"></span>
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            // Empty State
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="relative">
                <div className="h-20 w-20 rounded-2xl bg-[#00A3FF]/10 border border-[#00A3FF]/20 flex items-center justify-center">
                  <MessageSquare className="h-9 w-9 text-[#00A3FF]" />
                </div>
                {totalUnread > 0 && (
                  <div className="absolute -top-1 -right-1 h-5 w-5 bg-emerald-500 rounded-full border-2 border-background dark:border-[#0A0A0E] flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">{totalUnread}</span>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold text-white mb-1">Selecione uma conversa</h3>
                <p className="text-sm text-gray-500 max-w-xs">
                  Escolha um contato na lista ou inicie uma nova conversa.
                </p>
              </div>
              <Button
                onClick={() => setIsNewConvOpen(true)}
                className="bg-[#00A3FF] hover:bg-[#00A3FF]/80 text-white gap-2 mt-1"
              >
                <UserPlus className="h-4 w-4" />
                Nova Conversa
              </Button>
            </div>
          )}
        </div>

        {/* ===== CONTACT SIDEBAR (RIGHT) ===== */}
        {isContactSidebarOpen && selectedConv && (
          <div className="
            absolute inset-0 z-30 md:relative md:inset-auto
            md:w-72 md:flex-shrink-0
            border-l border-border dark:border-white/5 bg-card dark:bg-[#0D0D12] flex flex-col overflow-hidden
          ">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Dados do Contato</span>
              <button
                onClick={() => setIsContactSidebarOpen(false)}
                className="text-gray-500 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Avatar + Phone */}
            <div className="flex flex-col items-center py-5 px-4 border-b border-white/5 gap-2">
              <ContactAvatar
                name={selectedConv.contact_name || selectedConv.contact_phone}
                phone={selectedConv.contact_phone}
                size="lg"
                picUrl={selectedConv.profile_pic_url}
              />
              <p className="text-sm font-semibold text-white mt-1">{selectedConv.contact_name || selectedConv.contact_phone}</p>
              <p className="text-xs font-mono text-gray-500">{selectedConv.contact_phone}</p>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {isLoadingLead ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-5 w-5 animate-spin text-[#00A3FF]" />
                </div>
              ) : leadDetails ? (
                <>
                  {/* Nome */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <User className="h-3 w-3" /> Nome
                    </Label>
                    <Input
                      value={leadDetails.full_name}
                      onChange={(e) => setLeadDetails(prev => prev ? { ...prev, full_name: e.target.value } : prev)}
                      placeholder="Nome do lead"
                      className="h-8 text-sm bg-background dark:bg-white/5 border-border dark:border-white/10 text-foreground dark:text-gray-100 focus-visible:ring-[#00A3FF]/40"
                    />
                  </div>

                  {/* Valor do Orçamento */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <DollarSign className="h-3 w-3" /> Valor do Orçamento
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">R$</span>
                      <Input
                        value={leadDetails.valor}
                        onChange={(e) => setLeadDetails(prev => prev ? { ...prev, valor: e.target.value } : prev)}
                        placeholder="0,00"
                        className="h-8 text-sm pl-8 bg-background dark:bg-white/5 border-border dark:border-white/10 text-foreground dark:text-gray-100 focus-visible:ring-[#00A3FF]/40"
                        type="text"
                        inputMode="decimal"
                      />
                    </div>
                  </div>

                  {/* Detalhes / Notas */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <FileText className="h-3 w-3" /> Detalhes / Anotações
                    </Label>
                    <Textarea
                      value={leadDetails.detalhes}
                      onChange={(e) => setLeadDetails(prev => prev ? { ...prev, detalhes: e.target.value } : prev)}
                      placeholder="Resumo da conversa, observações, lembretes..."
                      rows={6}
                      className="text-sm bg-background dark:bg-white/5 border-border dark:border-white/10 text-foreground dark:text-gray-100 resize-none focus-visible:ring-[#00A3FF]/40 placeholder:text-muted-foreground dark:placeholder:text-gray-600"
                    />
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-600 text-center pt-4">Este contato não possui um lead vinculado.</p>
              )}
            </div>

            {/* Action Buttons (Save & Delete) */}
            <div className="p-4 border-t border-white/5 space-y-2">
              {leadDetails && (
                <Button
                  onClick={handleUpdateLead}
                  disabled={isSavingLead || isDeletingContact}
                  className="w-full bg-[#00A3FF] hover:bg-[#00A3FF]/80 text-white h-8 text-sm gap-2"
                >
                  {isSavingLead ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {isSavingLead ? "Salvando..." : "Salvar Dados"}
                </Button>
              )}
              
              <Button
                variant="destructive"
                onClick={() => setIsDeleteConfirmOpen(true)}
                disabled={isDeletingContact || isSavingLead}
                className="w-full h-8 text-sm gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/20 transition-colors"
              >
                {isDeletingContact ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {isDeletingContact ? "Apagando..." : "Apagar Contato"}
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* ===== DIALOG: Confirmar Deleção de Mensagem ===== */}
      <Dialog open={!!confirmDeleteMsg} onOpenChange={(open) => { if (!open) setConfirmDeleteMsg(null) }}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="h-4 w-4" />
              Apagar mensagem?
            </DialogTitle>
            <DialogDescription>
              A mensagem será apagada <strong>para todos</strong> no WhatsApp (se estiver dentro do prazo do WhatsApp) e removida do sistema.
            </DialogDescription>
          </DialogHeader>
          {confirmDeleteMsg && (
            <div className="my-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 italic max-h-20 overflow-hidden">
              {confirmDeleteMsg.content || '[Mídia]'}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeleteMsg(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmDeleteMessage}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 gap-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Apagar para todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG: Nova Conversa ===== */}
      <Dialog open={isNewConvOpen} onOpenChange={setIsNewConvOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Nova Conversa</DialogTitle>
            <DialogDescription>
              Inicie um atendimento com qualquer número de WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="nc-phone">Número WhatsApp <span className="text-red-400">*</span></Label>
              <Input
                id="nc-phone"
                value={newConvPhone}
                onChange={(e) => setNewConvPhone(e.target.value)}
                placeholder="Ex: 11999998888 ou +5511999998888"
                className="font-mono"
              />
              <p className="text-[11px] text-gray-500">Código do país + DDD + número. Ex: 5511999998888</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nc-name">Nome do Contato <span className="text-gray-500 text-xs">(opcional)</span></Label>
              <Input
                id="nc-name"
                value={newConvName}
                onChange={(e) => setNewConvName(e.target.value)}
                placeholder="Ex: João da Silva"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nc-msg">Primeira Mensagem <span className="text-gray-500 text-xs">(opcional)</span></Label>
              <textarea
                id="nc-msg"
                value={newConvMsg}
                onChange={(e) => setNewConvMsg(e.target.value)}
                placeholder="Ex: Olá! Preciso de ajuda com... (Se deixar em branco, o contato será criado sem enviar mensagem)"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-100 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00A3FF]/50 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsNewConvOpen(false)} disabled={isCreatingConv}>
              Cancelar
            </Button>
            <Button onClick={handleCreateConversation} disabled={isCreatingConv} className="bg-[#00A3FF] hover:bg-[#00A3FF]/80 gap-2">
              {isCreatingConv ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                newConvMsg.trim() ? <Send className="h-4 w-4" /> : <Plus className="h-4 w-4" />
              )}
              {isCreatingConv ? (
                newConvMsg.trim() ? "Enviando..." : "Criando..."
              ) : (
                newConvMsg.trim() ? "Iniciar Conversa" : "Criar Contato"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ALERT DIALOG: Confirmação de Exclusão de Contato ===== */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="bg-popover dark:bg-[#1A1A23] border-border dark:border-white/10 text-foreground dark:text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Excluir Contato Permanentemente?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Esta ação é <strong className="text-red-400">irreversível</strong>. Ela excluirá:
              <br />
              • Todas as mensagens deste chat
              <br />
              • A conversa ativa do atendimento
              {selectedConv?.lead_id && (
                <>
                  <br />
                  • O lead correspondente no CRM (Kanban)
                </>
              )}
              <br /><br />
              Deseja realmente continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-gray-300">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteContact()
              }}
              className="bg-red-600 hover:bg-red-700 text-white border-none"
              disabled={isDeletingContact}
            >
              {isDeletingContact ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== DIALOG: Sugestões do Assistente de Mensagem ===== */}
      <Dialog open={isSuggestionsDialogOpen} onOpenChange={setIsSuggestionsDialogOpen}>
        <DialogContent className="sm:max-w-[620px] bg-card dark:bg-[#12121A] border-border dark:border-white/10 text-foreground dark:text-white p-6 shadow-2xl">
          <DialogHeader className="space-y-1.5 pb-3 border-b border-border dark:border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-md shadow-emerald-500/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  Sugestões do Assistente
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-normal">
                    IA
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Escolha uma das sugestões geradas para carregar na caixa de mensagem e editar antes de enviar.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="group relative rounded-xl border border-border dark:border-white/10 bg-accent/30 dark:bg-white/[0.03] p-4 transition-all duration-200 hover:border-emerald-500/40 hover:bg-accent/60 dark:hover:bg-white/[0.06] hover:shadow-lg hover:shadow-emerald-500/5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Wand2 className="h-3 w-3" /> Opção {index + 1}
                  </span>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopySuggestion(suggestion)}
                      className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1 hover:bg-white/10"
                      title="Copiar texto"
                    >
                      <Copy className="h-3 w-3" />
                      <span className="text-[11px]">Copiar</span>
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-foreground dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {suggestion}
                </p>

                <div className="pt-1 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => handleApplySuggestion(suggestion)}
                    className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 gap-1.5 font-medium transition-all"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Usar no Campo de Mensagem
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-3 border-t border-border dark:border-white/5 flex items-center justify-between sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateSuggestions}
              disabled={isGeneratingSuggestions}
              className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 gap-1.5"
            >
              {isGeneratingSuggestions ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {isGeneratingSuggestions ? "Gerando novas..." : "Gerar Novamente"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSuggestionsDialogOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
