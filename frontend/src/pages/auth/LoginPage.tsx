import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { login, fetchCurrentUser } from "@/api/auth"
import { useAuthStore } from "@/stores/auth"
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
import { LanguageSwitcher } from "@/components/LanguageSwitcher"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setTokens = useAuthStore((s) => s.setTokens)
  const setUser = useAuthStore((s) => s.setUser)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginFormValues) {
    setIsSubmitting(true)
    try {
      const tokens = await login(values)
      setTokens(tokens.access_token, tokens.refresh_token)
      const user = await fetchCurrentUser()
      setUser(user)
      toast.success(`Welcome back, ${user.full_name.split(" ")[0]}!`)
      const isStaff = user.roles.some((r) => r !== "client")
      navigate(isStaff ? "/ops" : "/app", { replace: true })
    } catch {
      toast.error(t("auth.incorrectCredentials"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-background relative flex min-h-svh items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-sm border-border">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <span className="text-primary text-2xl font-bold">Deevale GH</span>
          </div>
          <CardTitle className="text-xl">{t("auth.welcomeBack")}</CardTitle>
          <CardDescription>{t("auth.loginSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.email")}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
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
                    <FormLabel>{t("auth.password")}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
                {isSubmitting ? t("auth.loggingIn") : t("auth.login")}
              </Button>
            </form>
          </Form>
          <p className="text-muted-foreground mt-6 text-center text-sm">
            {t("auth.newHere")}{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              {t("auth.createAccount")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
