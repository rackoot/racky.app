import React from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle } from "lucide-react"

interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message: string
  description?: string
}

export function SuccessModal({
  isOpen,
  onClose,
  title = "Success!",
  message,
  description
}: SuccessModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <DialogTitle className="text-xl font-semibold text-green-900">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-center text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4 text-center">
          <p className="text-sm leading-relaxed text-gray-700">
            {message}
          </p>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button onClick={onClose} className="px-8">
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}