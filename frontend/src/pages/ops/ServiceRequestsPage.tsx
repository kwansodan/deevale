import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { toast } from "sonner"

import { listServiceRequests, transitionServiceRequest } from "@/api/compliance"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export default function ServiceRequestsPage() {
  const queryClient = useQueryClient()
  const { data: requests, isLoading } = useQuery({
    queryKey: ["service-requests"],
    queryFn: listServiceRequests,
  })

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "in_progress" | "done" }) =>
      transitionServiceRequest(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests"] })
      toast.success("Updated.")
    },
    onError: () => toast.error("Couldn't update the request."),
  })

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Service Requests</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          "File it for me" requests from compliance-plan subscribers.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filing</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(requests ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    No open service requests. 🎉
                  </TableCell>
                </TableRow>
              )}
              {(requests ?? []).map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    {request.obligation_title ?? "Compliance filing"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(request.created_at), "d MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-xs font-medium capitalize",
                        request.status === "new" ? "text-warning" : "text-info"
                      )}
                    >
                      {request.status.replaceAll("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {request.status === "new" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={transitionMutation.isPending}
                          onClick={() =>
                            transitionMutation.mutate({ id: request.id, status: "in_progress" })
                          }
                        >
                          Start
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={transitionMutation.isPending}
                        onClick={() => transitionMutation.mutate({ id: request.id, status: "done" })}
                      >
                        Mark filed
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
