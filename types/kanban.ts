export type Label = {
    id: string
    title: string
    color: string
}

export type Lead = {
    id: string
    full_name: string
    value?: number
    price?: number // Handling potential variations, assuming 'value' based on context but schema check might reveal price
    valor?: number
    column_id: string
    whatsapp: string
    message_sent: boolean
    origin: string
    labels?: Label[]
}

export type Column = {
    id: string
    title: string
    position: number
    leads: Lead[]
    linked_label_id?: string
}
