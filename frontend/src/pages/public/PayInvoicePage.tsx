import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router-dom"

import { formatMoney, getPublicInvoice } from "@/api/bookkeeping"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Wordmark } from "@/components/Wordmark"

type PublicInvoice = {
  invoice_number: string
  business_name: string
  customer_name: string
  currency: string
  status: string
  issue_date: string
  due_date: string | null
  subtotal_minor: number
  vat_minor: number
  total_minor: number
  line_items: { description: string; quantity_milli: number; unit_price_minor: number; amount_minor: number }[]
}

export default function PayInvoicePage() {
  const { token } = useParams<{ token: string }>()
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-invoice", token],
    queryFn: () => getPublicInvoice(token!) as Promise<PublicInvoice>,
    enabled: !!token,
    retry: false,
  })

  return (
    <div className="bg-background flex min-h-svh items-start justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <p className="mb-4 text-center"><Wordmark size="md" /></p>
        {isLoading ? (
          <Skeleton className="h-80 w-full" />
        ) : isError || !data ? (
          <Card className="border-border">
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              This invoice link is invalid or has expired.
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{data.business_name}</CardTitle>
                  <p className="text-muted-foreground text-sm">Invoice {data.invoice_number}</p>
                </div>
                <span
                  className={
                    data.status === "paid"
                      ? "bg-success/10 text-success rounded-full px-2 py-0.5 text-xs font-medium"
                      : "bg-info/10 text-info rounded-full px-2 py-0.5 text-xs font-medium"
                  }
                >
                  {data.status}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Billed to <span className="font-medium">{data.customer_name}</span></p>
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-border border-b text-left text-xs">
                    <th className="py-1">Description</th>
                    <th className="py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.line_items.map((line, i) => (
                    <tr key={i} className="border-border/60 border-b">
                      <td className="py-1.5">{line.description}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatMoney(data.currency, line.amount_minor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 grid gap-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(data.currency, data.subtotal_minor)}</span></div>
                {data.vat_minor > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{formatMoney(data.currency, data.vat_minor)}</span></div>
                )}
                <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{formatMoney(data.currency, data.total_minor)}</span></div>
              </div>
              {data.due_date && (
                <p className="text-muted-foreground mt-4 text-xs">Due by {data.due_date}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
