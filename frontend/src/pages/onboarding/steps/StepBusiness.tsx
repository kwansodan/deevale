import { useForm } from "react-hook-form"
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
const VENTURE_ITEMS = [
  { value: "for_profit", label: "A new business (for profit)" },
  { value: "ngo", label: "An NGO / non-profit" },
  { value: "branch", label: "A branch of an existing foreign company" },
]

export function StepBusiness({
  data,
  onNext,
  onBack,
}: {
  data: WizardData
  onNext: (values: Partial<WizardData>) => void
  onBack: () => void
}) {
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
              <FormLabel>What are you setting up?</FormLabel>
              <Select items={VENTURE_ITEMS} value={field.value ?? null} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select one" />
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
              <FormLabel>Preferred business name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Accra Tech Solutions" {...field} />
              </FormControl>
              <FormDescription>We'll check availability with the ORC before reserving it.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sector"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What will the business do?</FormLabel>
              <Select items={SECTOR_ITEMS} value={field.value || null} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a sector" />
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
              <p className="font-medium">This sector is reserved for Ghanaian citizens.</p>
              <p className="text-error/90 mt-1">
                Under Ghana's investment law (GIPC Act), {selectedSector?.label.toLowerCase()} is not open
                to foreign participation. Please choose a different sector, or continue with wholly
                Ghanaian ownership.
              </p>
            </div>
          </div>
        )}
        <FormField
          control={form.control}
          name="planned_employees"
          render={({ field }) => (
            <FormItem>
              <FormLabel>How many employees do you plan to hire in year one?</FormLabel>
              <FormControl>
                <Input type="number" min={0} {...field} />
              </FormControl>
              <FormDescription>Used to plan your SSNIT employer registration. 0 is fine.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="region"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Region of operation</FormLabel>
              <Select items={REGION_ITEMS} value={field.value || null} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a region" />
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
            Back
          </Button>
          <Button type="submit" disabled={reservedBlocked}>
            Continue
          </Button>
        </div>
      </form>
    </Form>
  )
}
