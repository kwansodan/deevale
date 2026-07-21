import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { isValidPhoneNumber } from "libphonenumber-js/min"
import { toast } from "sonner"

import { signup } from "@/api/auth"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { PhoneField } from "@/components/PhoneField"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Wordmark } from "@/components/Wordmark"

// PhoneField hands us E.164, so validation is real per-country metadata rather
// than a shape regex: this rejects a number that is the wrong length for its
// country, or in an unassigned range.
const INVALID_MOBILE = "Enter a valid mobile number for the country you selected"

const signupSchema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().refine((v) => isValidPhoneNumber(v), INVALID_MOBILE),
  secondary_phone: z.string().refine((v) => v === "" || isValidPhoneNumber(v), INVALID_MOBILE),
  is_whatsapp_reachable: z.boolean(),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type SignupFormValues = z.infer<typeof signupSchema>

export default function SignupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const referralCode = params.get("ref") ?? undefined
  const inviteToken = params.get("invite")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      secondary_phone: "",
      is_whatsapp_reachable: false,
      password: "",
    },
  })

  async function onSubmit(values: SignupFormValues) {
    setIsSubmitting(true)
    try {
      await signup({
        ...values,
        // The column is nullable; an empty string would store a blank number.
        secondary_phone: values.secondary_phone || undefined,
        referral_code: referralCode,
      })
      toast.success("Account created! Check your email for a verification code.")
      // The signup OTP is emailed, so email is the identifier to verify against.
      // Preserve a co-founder invite token so the flow resumes after verify+login.
      navigate("/verify-otp", {
        state: { identifier: values.email, email: values.email, inviteToken },
      })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Something went wrong. Please try again."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-background flex min-h-svh items-center justify-center px-4 py-8">
      <Card className="w-full max-w-sm border-border">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <Wordmark size="lg" />
          </div>
          <CardTitle className="text-xl">Start your business journey</CardTitle>
          <CardDescription>Register in minutes, we'll guide you the rest of the way.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Ama Owusu" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile number</FormLabel>
                    <FormControl>
                      <PhoneField
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="24 000 0000"
                        ariaLabel="Mobile number"
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
                  <FormItem className="-mt-1 flex flex-row items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormLabel className="text-muted-foreground font-normal">
                      This number is on WhatsApp
                    </FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secondary_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Secondary mobile number{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <PhoneField
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="Another number for you"
                        ariaLabel="Secondary mobile number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="At least 8 characters"
                          className="pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex items-center rounded-r-md px-3 focus-visible:ring-2 focus-visible:outline-none"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </Form>
          <p className="text-muted-foreground mt-6 text-center text-sm">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
