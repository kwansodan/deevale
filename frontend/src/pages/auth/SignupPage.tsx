import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { signup } from "@/api/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const signupSchema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(9, "Enter a valid Ghana phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type SignupFormValues = z.infer<typeof signupSchema>

export default function SignupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const referralCode = params.get("ref") ?? undefined
  const inviteToken = params.get("invite")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { full_name: "", email: "", phone: "", password: "" },
  })

  async function onSubmit(values: SignupFormValues) {
    setIsSubmitting(true)
    try {
      await signup({ ...values, referral_code: referralCode })
      toast.success("Account created! Check your phone for a verification code.")
      // Preserve a co-founder invite token so the flow resumes after verify+login.
      navigate("/verify-otp", {
        state: { identifier: values.phone, email: values.email, inviteToken },
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
            <span className="text-primary text-2xl font-bold">LaunchGH</span>
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
                    <FormLabel>Ghana phone number</FormLabel>
                    <FormControl>
                      <Input placeholder="024 000 0000" {...field} />
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
                      <Input type="password" placeholder="At least 8 characters" {...field} />
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
