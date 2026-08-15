import { useState } from "react"
import { useForm, type ControllerRenderProps } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AlertTriangle, Download, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { changePassword, requestAccountDeletion, updateProfile } from "@/api/account"
import {
  getReceiptUrl,
  getSubscription,
  listMyInvoices,
  subscribe,
  type PlatformInvoice,
} from "@/api/billing"
import { fetchCurrentUser } from "@/api/auth"
import { formatGhs, initializeTransaction } from "@/api/cases"
import { PhoneField } from "@/components/PhoneField"
import { NotificationPreferences, PreferenceToggle } from "@/components/account/NotificationPreferences"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthStore } from "@/stores/auth"

const LOCALE_ITEMS = [
  { value: "en", label: "English" },
  { value: "tw", label: "Twi" },
  { value: "fr", label: "French" },
]

/** Pull a human message off an axios error, falling back to a default. */
function errorMessage(err: unknown, fallback: string): string {
  const maybe = err as { response?: { data?: { message?: string } } }
  return maybe?.response?.data?.message ?? fallback
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
const profileSchema = z.object({
  full_name: z.string().min(2, "Enter your full name").max(255),
  secondary_phone: z.string().optional(),
  is_whatsapp_reachable: z.boolean(),
  locale: z.enum(["en", "tw", "fr"]),
})
type ProfileValues = z.infer<typeof profileSchema>

function ProfileTab() {
  // Guard before the form so useForm always initialises from a real user (a
  // deep-link load can render this while auth is still bootstrapping).
  const user = useAuthStore((s) => s.user)
  if (!user) return <Skeleton className="h-64 w-full" />
  return <ProfileForm user={user} />
}

function ProfileForm({ user }: { user: NonNullable<ReturnType<typeof useAuthStore.getState>["user"]> }) {
  const setUser = useAuthStore((s) => s.setUser)

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user.full_name,
      secondary_phone: user.secondary_phone ?? "",
      is_whatsapp_reachable: user.is_whatsapp_reachable,
      locale: (user.locale as ProfileValues["locale"]) ?? "en",
    },
  })

  const mutation = useMutation({
    mutationFn: (values: ProfileValues) =>
      updateProfile({
        full_name: values.full_name,
        secondary_phone: values.secondary_phone?.trim() ? values.secondary_phone : null,
        is_whatsapp_reachable: values.is_whatsapp_reachable,
        locale: values.locale,
      }),
    onSuccess: (updated) => {
      setUser(updated)
      form.reset({
        full_name: updated.full_name,
        secondary_phone: updated.secondary_phone ?? "",
        is_whatsapp_reachable: updated.is_whatsapp_reachable,
        locale: (updated.locale as ProfileValues["locale"]) ?? "en",
      })
      toast.success("Profile updated.")
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't update your profile.")),
  })

  return (
    <div className="grid gap-6">
      {/* Read-only identity. Email + primary phone are the login/recovery identity
          and can't be self-edited yet. */}
      <div className="border-border grid gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Email</p>
            <p className="truncate text-sm font-medium">{user.email}</p>
          </div>
          <Badge variant={user.is_email_verified ? "default" : "secondary"} className="shrink-0">
            {user.is_email_verified ? "Verified" : "Unverified"}
          </Badge>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Primary phone</p>
            <p className="truncate text-sm font-medium">{user.phone}</p>
          </div>
          <Badge variant={user.is_phone_verified ? "default" : "secondary"} className="shrink-0">
            {user.is_phone_verified ? "Verified" : "Unverified"}
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs">
          To change your email or primary phone number, contact support.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid gap-4">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="secondary_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Secondary phone (optional)</FormLabel>
                <FormControl>
                  <PhoneField
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    ariaLabel="Secondary phone"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="is_whatsapp_reachable"
            render={({ field }) => (
              <FormItem>
                <div className="border-border flex items-center justify-between rounded-lg border px-3 py-2.5">
                  <div>
                    <FormLabel>Reachable on WhatsApp</FormLabel>
                    <p className="text-muted-foreground text-xs">
                      Lets us deliver updates over WhatsApp when you opt a category in.
                    </p>
                  </div>
                  <PreferenceToggle
                    checked={field.value}
                    onChange={field.onChange}
                    label="Reachable on WhatsApp"
                  />
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="locale"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Language</FormLabel>
                <Select items={LOCALE_ITEMS} value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {LOCALE_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="text-muted-foreground text-xs">
            Member since {new Date(user.created_at).toLocaleDateString("en-GH")}
          </div>
          <Button
            type="submit"
            className="justify-self-start"
            disabled={mutation.isPending || !form.formState.isDirty}
          >
            Save changes
          </Button>
        </form>
      </Form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------
const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z.string().min(8, "At least 8 characters").max(128),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  })
type PasswordValues = z.infer<typeof passwordSchema>

function PasswordField({
  field,
  label,
  autoComplete,
}: {
  field: ControllerRenderProps<PasswordValues, keyof PasswordValues>
  label: string
  autoComplete: string
}) {
  const [show, setShow] = useState(false)
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <div className="relative">
          <Input {...field} type={show ? "text" : "password"} autoComplete={autoComplete} className="pr-10" />
          <button
            type="button"
            aria-label={show ? "Hide password" : "Show password"}
            onClick={() => setShow((s) => !s)}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}

function SecurityTab() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [requested, setRequested] = useState(false)

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  })

  const pwMutation = useMutation({
    mutationFn: (v: PasswordValues) =>
      changePassword({ current_password: v.current_password, new_password: v.new_password }),
    onSuccess: () => {
      form.reset()
      toast.success("Password updated.")
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't change your password.")),
  })

  const deleteMutation = useMutation({
    mutationFn: requestAccountDeletion,
    onSuccess: () => {
      setConfirmOpen(false)
      setRequested(true)
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't submit your request.")),
  })

  return (
    <div className="grid gap-6">
      <div>
        <h3 className="text-sm font-semibold">Change password</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => pwMutation.mutate(v))} className="mt-3 grid max-w-md gap-4">
            <FormField
              control={form.control}
              name="current_password"
              render={({ field }) => (
                <PasswordField field={field} label="Current password" autoComplete="current-password" />
              )}
            />
            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <PasswordField field={field} label="New password" autoComplete="new-password" />
              )}
            />
            <FormField
              control={form.control}
              name="confirm_password"
              render={({ field }) => (
                <PasswordField field={field} label="Confirm new password" autoComplete="new-password" />
              )}
            />
            <Button type="submit" className="justify-self-start" disabled={pwMutation.isPending}>
              Update password
            </Button>
          </form>
        </Form>
      </div>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2 text-base">
            <AlertTriangle className="size-4" /> Danger zone
          </CardTitle>
          <CardDescription>
            Close your account. Your open cases and paid invoices are kept on record where the law
            requires; our team reviews every request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requested ? (
            <p className="text-muted-foreground text-sm">
              We&apos;ve received your request to close your account. Our team will be in touch.
            </p>
          ) : (
            <Button variant="outline" className="text-destructive border-destructive/40" onClick={() => setConfirmOpen(true)}>
              Request account deletion
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request account deletion?</DialogTitle>
            <DialogDescription>
              This flags your account for closure and notifies our team. It is not immediate — we&apos;ll
              contact you to confirm and to settle anything outstanding on your cases.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Yes, request deletion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------
const INVOICE_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "default",
  sent: "secondary",
  draft: "secondary",
  overdue: "destructive",
}

/** " · paid 3 Aug 2026" / " · sent …", or "" when the invoice has no date yet
 *  (guards against rendering "Invalid Date" for drafts). */
function invoiceWhen(inv: PlatformInvoice): string {
  const raw = inv.paid_at ?? inv.sent_at
  if (!raw) return ""
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ""
  const label = inv.paid_at ? "paid" : "sent"
  return ` · ${label} ${d.toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}`
}

function BillingTab() {
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["my-invoices"],
    queryFn: listMyInvoices,
  })
  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
  })

  const payMutation = useMutation({
    mutationFn: (invoice: PlatformInvoice) =>
      initializeTransaction(
        invoice.id,
        `${window.location.origin}/app/payment/callback?case_id=${invoice.business_case_id}`
      ),
    onSuccess: ({ authorization_url }) => {
      window.location.href = authorization_url
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't start the payment.")),
  })

  const subscribeMutation = useMutation({
    mutationFn: (plan: "monthly" | "annual") =>
      subscribe(plan, `${window.location.origin}/app/payment/callback`),
    onSuccess: ({ authorization_url }) => {
      window.location.href = authorization_url
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't start the subscription.")),
  })

  async function openReceipt(invoiceId: string) {
    try {
      const { download_url } = await getReceiptUrl(invoiceId)
      window.open(download_url, "_blank", "noopener")
    } catch (err) {
      toast.error(errorMessage(err, "Receipt isn't available yet."))
    }
  }

  return (
    <div className="grid gap-8">
      {/* Bills */}
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold">Your bills</h3>
        {invoicesLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !invoices || invoices.length === 0 ? (
          <p className="text-muted-foreground text-sm">You have no invoices yet.</p>
        ) : (
          <ul className="grid gap-2">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{inv.invoice_number}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatGhs(inv.total_minor)}
                    {invoiceWhen(inv)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={INVOICE_STATUS_VARIANT[inv.status] ?? "secondary"} className="capitalize">
                    {inv.status}
                  </Badge>
                  {inv.status === "paid" && inv.receipt_s3_key && (
                    <Button variant="ghost" size="sm" onClick={() => openReceipt(inv.id)}>
                      <Download className="size-4" /> Receipt
                    </Button>
                  )}
                  {inv.status !== "paid" && (
                    <Button size="sm" disabled={payMutation.isPending} onClick={() => payMutation.mutate(inv)}>
                      Pay now
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Subscription */}
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold">Compliance subscription</h3>
        {subLoading || !sub ? (
          <Skeleton className="h-24 w-full" />
        ) : sub.active && sub.subscription ? (
          <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium capitalize">{sub.subscription.plan} plan</p>
              <p className="text-muted-foreground text-xs">
                {sub.subscription.status}
                {sub.subscription.current_period_end
                  ? ` · renews ${new Date(sub.subscription.current_period_end).toLocaleDateString("en-GH")}`
                  : ""}
              </p>
            </div>
            <Badge>Active</Badge>
          </div>
        ) : (
          <div className="border-border grid gap-3 rounded-lg border p-4">
            <p className="text-muted-foreground text-sm">
              Stay compliant automatically — we track your filing deadlines and remind you.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={subscribeMutation.isPending}
                onClick={() => subscribeMutation.mutate("monthly")}
              >
                Monthly — {formatGhs(sub.monthly_price_minor)}
              </Button>
              <Button
                disabled={subscribeMutation.isPending}
                onClick={() => subscribeMutation.mutate("annual")}
              >
                Annual — {formatGhs(sub.annual_price_minor)}
              </Button>
            </div>
          </div>
        )}
      </section>

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <ShieldCheck className="size-3.5 shrink-0" />
        Payments are processed securely by Paystack. We don&apos;t store your card details.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
export default function AccountPage() {
  // Re-fetch /auth/me so the page has the latest secondary_phone/locale/etc.
  // even if the in-store user predates those fields.
  const setUser = useAuthStore((s) => s.setUser)
  useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const u = await fetchCurrentUser()
      setUser(u)
      return u
    },
    staleTime: 60_000,
  })

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your profile, billing, security and notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="profile">
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>
            <TabsContent value="profile" className="pt-4">
              <ProfileTab />
            </TabsContent>
            <TabsContent value="billing" className="pt-4">
              <BillingTab />
            </TabsContent>
            <TabsContent value="security" className="pt-4">
              <SecurityTab />
            </TabsContent>
            <TabsContent value="notifications" className="pt-4">
              <NotificationPreferences />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
