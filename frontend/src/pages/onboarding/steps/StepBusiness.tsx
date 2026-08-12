import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormDescription,
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
import { GHANA_REGIONS, SECTORS } from "../constants"
import { hasForeignParticipation, type WizardData } from "../types"

const schema = z.object({
  venture_type: z.enum(["for_profit", "ngo", "branch"], { message: "Select what you're setting up" }),
  business_name: z.string().min(2, "Enter your preferred business name"),
  sector: z.string().min(1, "Select a sector"),
  planned_employees: z.string().regex(/^\d+$/, "Enter a whole number (0 is fine)"),
  region: z.string().min(1, "Select a region"),
})

type Values = z.infer<typeof schema>

const SECTOR_ITEMS = SECTORS.map((s) => ({ value: s.value, label: s.label }))
const REGION_ITEMS = GHANA_REGIONS.map((r) => ({ value: r, label: r }))

export function StepBusiness({
  data,
  onNext,
  onBack,
}: {
  data: WizardData
  onNext: (values: Partial<WizardData>) => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const VENTURE_ITEMS = [
    { value: "for_profit", label: t("wizard.business.forProfit") },
    { value: "ngo", label: t("wizard.business.ngo") },
    { value: "branch", label: t("wizard.business.branch") },
  ]
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      venture_type: (data.venture_type || undefined) as Values["venture_type"],
      business_name: data.business_name,
      sector: data.sector,
      planned_employees: String(data.planned_employees),
      region: data.region,
    },
  })

  const selectedSector = SECTORS.find((s) => s.value === form.watch("sector"))
  const isForeign = hasForeignParticipation(data)
  const reservedBlocked = Boolean(isForeign && selectedSector?.reserved)

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => {
          if (reservedBlocked) return
          onNext({ ...values, planned_employees: Number(values.planned_employees) })
        })}
        className="grid gap-5"
      >
        <FormField
          control={form.control}
          name="venture_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("wizard.business.ventureLabel")}</FormLabel>
              <Select items={VENTURE_ITEMS} value={field.value ?? null} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("wizard.business.selectOne")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {VENTURE_ITEMS.map((item) => (
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
          name="business_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("wizard.business.nameLabel")}</FormLabel>
              <FormControl>
                <Input placeholder={t("wizard.business.namePlaceholder")} {...field} />
              </FormControl>
              <FormDescription>{t("wizard.business.nameHint")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sector"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("wizard.business.sectorLabel")}</FormLabel>
              <Select items={SECTOR_ITEMS} value={field.value || null} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("wizard.business.selectSector")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SECTOR_ITEMS.map((item) => (
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
        {reservedBlocked && (
          <div
            role="alert"
            className="border-error/40 bg-error/5 text-error flex gap-2 rounded-lg border p-3 text-sm"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">{t("wizard.business.reservedTitle")}</p>
              <p className="text-error/90 mt-1">
                {t("wizard.business.reservedBody", {
                  sector: selectedSector?.label.toLowerCase() ?? "",
                })}
              </p>
            </div>
          </div>
        )}
        <FormField
          control={form.control}
          name="planned_employees"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("wizard.business.employeesLabel")}</FormLabel>
              <FormControl>
                <Input type="number" min={0} {...field} />
              </FormControl>
              <FormDescription>{t("wizard.business.employeesHint")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="region"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("wizard.business.regionLabel")}</FormLabel>
              <Select items={REGION_ITEMS} value={field.value || null} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("wizard.business.selectRegion")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {REGION_ITEMS.map((item) => (
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
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            {t("wizard.common.back")}
          </Button>
          <Button type="submit" disabled={reservedBlocked}>
            {t("wizard.common.continue")}
          </Button>
        </div>
      </form>
    </Form>
  )
}
