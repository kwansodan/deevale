import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2 } from "lucide-react"

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
import { OWNER_ROLES } from "../constants"
import type { WizardData } from "../types"

const ownerSchema = z
  .object({
    full_name: z.string().min(2, "Enter a name"),
    role: z.string().min(1, "Select a role"),
    nationality: z.enum(["ghanaian", "foreign"], { message: "Select nationality" }),
    passport_number: z.string().optional(),
    passport_country: z.string().optional(),
  })
  .superRefine((owner, ctx) => {
    // Foreign parties need a non-citizen TIN issued against a passport.
    if (owner.nationality === "foreign" && !owner.passport_number?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passport_number"],
        message: "Passport number is required for non-Ghanaian parties",
      })
    }
    if (owner.nationality === "foreign" && !owner.passport_country?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passport_country"],
        message: "Issuing country is required",
      })
    }
  })

const schema = z.object({
  owners: z.array(ownerSchema).min(1, "Add at least one owner or director"),
})

type Values = z.infer<typeof schema>

const ROLE_ITEMS = OWNER_ROLES.map((r) => ({ value: r.value, label: r.label }))
const NATIONALITY_ITEMS = [
  { value: "ghanaian", label: "Ghanaian" },
  { value: "foreign", label: "Non-Ghanaian" },
]

export function StepOwnership({
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
      owners:
        data.owners.length > 0
          ? data.owners
          : [{ full_name: "", role: "director_shareholder", nationality: "ghanaian" as const }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "owners" })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => onNext(values))} className="grid gap-5">
        <div>
          <h3 className="text-sm font-medium">Owners & directors</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            A company limited by shares needs at least one director and one shareholder (can be the same
            person). Include yourself if you're an owner.
          </p>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="border-border grid gap-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Person {index + 1}
              </span>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove person ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="text-muted-foreground size-4" />
                </Button>
              )}
            </div>
            <FormField
              control={form.control}
              name={`owners.${index}.full_name`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Full legal name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name={`owners.${index}.role`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select items={ROLE_ITEMS} value={field.value || null} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROLE_ITEMS.map((item) => (
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
                name={`owners.${index}.nationality`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nationality</FormLabel>
                    <Select
                      items={NATIONALITY_ITEMS}
                      value={field.value ?? null}
                      onValueChange={field.onChange}
                    >
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
            </div>
            {form.watch(`owners.${index}.nationality`) === "foreign" && (
              <div className="border-info/30 bg-info/5 grid gap-3 rounded-md border p-3">
                <p className="text-info text-xs font-medium">
                  Non-Ghanaian parties need a non-citizen TIN — we'll obtain it from GRA using these
                  passport details.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`owners.${index}.passport_number`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Passport number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. A1234567" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`owners.${index}.passport_country`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issuing country</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. United Kingdom" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          onClick={() => append({ full_name: "", role: "shareholder", nationality: "ghanaian" })}
        >
          <Plus data-icon="inline-start" className="size-4" />
          Add another person
        </Button>
        <FormDescription>You can refine shareholding percentages with your case officer later.</FormDescription>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button type="submit">Continue</Button>
        </div>
      </form>
    </Form>
  )
}
