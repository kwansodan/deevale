import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WizardData } from "../types"

const schema = z.object({
  nationality: z.enum(["ghanaian", "foreign"], { message: "Select your nationality" }),
  residency: z.enum(["resident", "non_resident"], { message: "Select your residency status" }),
  id_type: z.enum(["ghana_card", "passport"], { message: "Select an ID type" }),
  id_number: z.string().min(4, "Enter your ID number"),
})

type Values = z.infer<typeof schema>

export function StepAboutYou({
  data,
  onNext,
}: {
  data: WizardData
  onNext: (values: Partial<WizardData>) => void
}) {
  const { t } = useTranslation()
  const NATIONALITY_ITEMS = [
    { value: "ghanaian", label: t("wizard.about.ghanaian") },
    { value: "foreign", label: t("wizard.about.nonGhanaian") },
  ]
  const RESIDENCY_ITEMS = [
    { value: "resident", label: t("wizard.about.resident") },
    { value: "non_resident", label: t("wizard.about.nonResident") },
  ]
  const ID_TYPE_ITEMS = [
    { value: "ghana_card", label: t("wizard.about.ghanaCard") },
    { value: "passport", label: t("wizard.about.passport") },
  ]
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      nationality: (data.nationality || undefined) as Values["nationality"],
      residency: (data.residency || undefined) as Values["residency"],
      id_type: (data.id_type || undefined) as Values["id_type"],
      id_number: data.id_number,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => onNext(values))} className="grid gap-5">
        <FormField
          control={form.control}
          name="nationality"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("wizard.about.nationality")}</FormLabel>
              <Select items={NATIONALITY_ITEMS} value={field.value ?? null} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("wizard.about.selectNationality")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {NATIONALITY_ITEMS.map((item) => (
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
        <FormField
          control={form.control}
          name="residency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("wizard.about.residency")}</FormLabel>
              <Select items={RESIDENCY_ITEMS} value={field.value ?? null} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("wizard.about.selectResidency")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {RESIDENCY_ITEMS.map((item) => (
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
        <FormField
          control={form.control}
          name="id_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("wizard.about.idType")}</FormLabel>
              <Select items={ID_TYPE_ITEMS} value={field.value ?? null} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("wizard.about.selectIdType")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ID_TYPE_ITEMS.map((item) => (
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
        <FormField
          control={form.control}
          name="id_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("wizard.about.idNumber")}</FormLabel>
              <FormControl>
                <Input placeholder={t("wizard.about.idNumberPlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit">{t("wizard.common.continue")}</Button>
        </div>
      </form>
    </Form>
  )
}
