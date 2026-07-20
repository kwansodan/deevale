import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { verifyOtp } from "@/api/auth"
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

const otpSchema = z.object({
  code: z.string().length(6, "Enter the 6-digit code"),
})

type OtpFormValues = z.infer<typeof otpSchema>

export default function VerifyOtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const identifier = (location.state as { identifier?: string } | null)?.identifier ?? ""
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  })

  async function onSubmit(values: OtpFormValues) {
    if (!identifier) {
      toast.error("Missing phone number -- please sign up again.")
      return
    }
    setIsSubmitting(true)
    try {
      await verifyOtp(identifier, values.code)
      toast.success("Account verified! You can now log in.")
      navigate("/login", { replace: true })
    } catch {
      toast.error("Incorrect or expired code.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-background flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm border-border">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <span className="text-primary text-2xl font-bold">LaunchGH</span>
          </div>
          <CardTitle className="text-xl">Verify your account</CardTitle>
          <CardDescription>
            {identifier
              ? `We sent a 6-digit code to ${identifier}.`
              : "Enter the 6-digit code we sent you."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification code</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        className="text-center text-lg tracking-[0.5em]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
                {isSubmitting ? "Verifying..." : "Verify"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
