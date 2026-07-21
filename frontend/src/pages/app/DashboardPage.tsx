import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"

import { getCase, listCases, type CaseTask } from "@/api/cases"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StageTimeline } from "@/components/case/StageTimeline"
import { TaskInbox, actionNeededTasks } from "@/components/case/TaskInbox"
import { TaskSheet } from "@/components/case/TaskSheet"
import { DocumentCenter } from "@/components/case/DocumentCenter"
import { MessageThread } from "@/components/case/MessageThread"
import { StatusChip } from "@/components/case/StatusChip"

function EmptyState() {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>Ready to launch your business?</CardTitle>
        <CardDescription>
          Answer a few questions, get an instant quote, and we'll handle every government office for you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button render={<Link to="/app/start">Start a new business</Link>} nativeButton={false} />
      </CardContent>
    </Card>
  )
}

function caseStatusDisplay(status: string): string {
  switch (status) {
    case "completed":
      return "Done"
    case "blocked":
      return "Blocked"
    case "active":
      return "With government"
    default:
      return "Not started"
  }
}

export default function DashboardPage() {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<CaseTask | null>(null)

  const { data: cases, isLoading: casesLoading } = useQuery({ queryKey: ["cases"], queryFn: listCases })

  const caseId = selectedCaseId ?? cases?.[0]?.id ?? null
  const { data: businessCase, isLoading: caseLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId!),
    enabled: !!caseId,
  })

  if (casesLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!cases || cases.length === 0) {
    return <EmptyState />
  }

  const businessName =
    (businessCase?.onboarding_payload?.business_name as string | undefined) ?? businessCase?.case_number

  const actionCount = businessCase ? actionNeededTasks(businessCase).length : 0

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{businessName ?? "Your case"}</h1>
          {businessCase && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-muted-foreground text-sm">{businessCase.case_number}</span>
              <StatusChip label={caseStatusDisplay(businessCase.status)} />
            </div>
          )}
        </div>
        {cases.length > 1 && (
          <Select
            items={cases.map((c) => ({ value: c.id, label: c.case_number }))}
            value={caseId}
            onValueChange={(v) => setSelectedCaseId(v as string)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Switch case" />
            </SelectTrigger>
            <SelectContent>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.case_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {caseLoading || !businessCase ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">
                Action needed{actionCount > 0 ? ` (${actionCount})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskInbox businessCase={businessCase} onTaskClick={setActiveTask} />
            </CardContent>
          </Card>

          <Tabs defaultValue="progress">
            <TabsList>
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
            </TabsList>
            <TabsContent value="progress" className="pt-4">
              <Card className="border-border">
                <CardContent className="pt-5">
                  <StageTimeline businessCase={businessCase} onTaskClick={setActiveTask} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="documents" className="pt-4">
              <Card className="border-border">
                <CardContent className="pt-5">
                  <DocumentCenter caseId={businessCase.id} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="messages" className="pt-4">
              <Card className="border-border">
                <CardContent className="pt-5">
                  <MessageThread caseId={businessCase.id} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <TaskSheet caseId={businessCase.id} task={activeTask} onClose={() => setActiveTask(null)} />
        </>
      )}
    </div>
  )
}
