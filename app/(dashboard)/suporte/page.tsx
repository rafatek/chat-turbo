import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MessageCircle, Headphones, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function SuportePage() {
  const suporteUrl = process.env.NEXT_PUBLIC_SUPORTE_URL || "https://wa.me/5511913393797"

  return (
    <div className="flex items-center justify-center h-[calc(100vh-120px)] p-4 animate-in fade-in-50 duration-500">
      <div className="w-full max-w-md flex flex-col gap-4">
        <Card className="border-primary/20 bg-black/40 backdrop-blur-md relative group overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
          
          <CardContent className="p-8 space-y-8 relative flex flex-col items-center text-center">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(37,99,235,0.4)] mb-2">
              <Headphones className="h-10 w-10 text-white" />
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-bold">Suporte Humano</h2>
              <p className="text-muted-foreground">
                Questões complexas? Fale diretamente com o nosso especialista. Nossa equipe está online para te ajudar.
              </p>
            </div>

            <Link href={suporteUrl} target="_blank" className="w-full">
              <Button className="w-full h-14 font-bold text-lg bg-[#25D366] hover:bg-[#128C7E] text-white shadow-[0_0_15px_rgba(37,211,102,0.2)] hover:shadow-[0_0_25px_rgba(37,211,102,0.4)] transition-all duration-300 group">
                <MessageCircle className="mr-3 h-6 w-6" />
                Falar no WhatsApp
                <ArrowRight className="ml-3 h-5 w-5 opacity-50 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
