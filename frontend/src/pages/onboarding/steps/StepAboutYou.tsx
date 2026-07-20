import { useForm } from "react-hook-form"
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

const NATIONALITY_ITEMS = [
  { value: "ghanaian", label: "Ghanaian" },
  { value: "foreign", label: "Non-Ghanaian" },
]
const RESIDENCY_ITEMS = [
  { value: "resident", label: "Resident in Ghana" },
  { value: "non_resident", label: "Living outside Ghana" },
]
const ID_TYPE_ITEMS = [
  { value: "ghana_card", label: "Ghana Card" },
  { value: "passport", label: "Passport" },
]

export function StepAboutYou({
  data,
  onNext,
}: {
  data: WizardData
  onNext: (values: Partial<WizardData>) => void
}) {
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
              <FormLabel>Nationality</FormLabel>
              <Select items={NATIONALITY_ITEMS} value={field.value ?? null} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select nationality" />
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
              <FormLabel>Where do you live?</FormLabel>
              <Select items={RESIDENCY_ITEMS} value={field.value ?? null} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select residency" />
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
              <FormLabel>ID document</FormLabel>
              <Select items={ID_TYPE_ITEMS} value={field.value ?? null} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select ID type" />
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
              <FormLabel>ID number</FormLabel>
              <FormControl>
                <Input placeholder="GHA-000000000-0 or passport number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit">Continue</Button>
        </div>
      </form>
    </Form>
  )
}
