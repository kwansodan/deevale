import { useCallback, useRef, useState } from "react"
import { UploadCloud } from "lucide-react"
import { toast } from "sonner"

import { validateFile } from "@/api/documents"
import { cn } from "@/lib/utils"

export function FileDropzone({
  onFile,
  disabled,
  label = "Drag & drop a file here, or tap to browse",
}: {
  onFile: (file: File) => void
  disabled?: boolean
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return
      const error = validateFile(file)
      if (error) {
        toast.error(error)
        return
      }
      onFile(file)
    },
    [onFile]
  )

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        if (!disabled) handleFile(e.dataTransfer.files[0])
      }}
      className={cn(
        "border-border text-muted-foreground flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-sm transition-colors",
        isDragging && "border-accent bg-accent-50 dark:bg-accent/10",
        !disabled && "hover:border-accent/60 hover:bg-muted/50",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <UploadCloud className="size-6" />
      <span>{label}</span>
      <span className="text-xs">PDF, JPG or PNG — max 10 MB</span>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ""
        }}
      />
    </button>
  )
}
