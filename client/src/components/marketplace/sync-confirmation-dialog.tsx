import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Package, Trash2, Download } from "lucide-react"

interface SyncConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  marketplaceName: string
  productCount: number
  isLoading?: boolean
}

export function SyncConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  marketplaceName,
  productCount,
  isLoading = false
}: SyncConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            Confirm Product Sync
          </DialogTitle>
          <DialogDescription>
            This will replace all existing {marketplaceName} products with fresh data from your store.
          </DialogDescription>
        </DialogHeader>
        
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> This action will:
            <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
              <li>Delete all {productCount} existing {marketplaceName} products from your local database</li>
              <li>Download fresh product data from your {marketplaceName} store</li>
              <li>Replace product descriptions, prices, inventory, and other data</li>
              <li><strong>Any local changes not saved to {marketplaceName} will be lost</strong></li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">What happens during sync:</h4>
              <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                <li>Remove {productCount} existing products from local database</li>
                <li>Download current products from {marketplaceName}</li>
                <li>Import fresh product data and metadata</li>
                <li>Update local inventory and pricing information</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">
            <strong>Tip:</strong> Make sure any important local changes are already saved to your {marketplaceName} store before proceeding.
          </p>
        </div>
        
        <DialogFooter>
          <Button 
            type="button"
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            type="button"
            variant="destructive" 
            onClick={onConfirm}
            disabled={isLoading}
            className="min-w-[140px]"
          >
            {isLoading ? (
              <>
                <Download className="w-4 h-4 mr-2 animate-pulse" />
                Syncing...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Replace Products
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}