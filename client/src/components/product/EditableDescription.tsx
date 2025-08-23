import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Edit3, Save, X, Upload, AlertTriangle, CheckCircle } from "lucide-react"

interface EditableDescriptionProps {
  description: string
  productId: string
  marketplace: string
  storeConnectionId?: string
  onDescriptionUpdate: (newDescription: string) => void
}

export function EditableDescription({ 
  description, 
  productId, 
  marketplace, 
  storeConnectionId,
  onDescriptionUpdate 
}: EditableDescriptionProps) { 
  const [isEditing, setIsEditing] = useState(false)
  const [editedDescription, setEditedDescription] = useState(description)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateResult, setUpdateResult] = useState<{
    success: boolean
    message: string
    localOnly?: boolean
  } | null>(null)

  const handleStartEdit = () => {
    setIsEditing(true)
    setEditedDescription(description)
    setUpdateResult(null)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedDescription(description)
    setUpdateResult(null)
  }

  const handleSave = async () => {
    if (editedDescription.trim() === description.trim()) {
      setIsEditing(false)
      return
    }

    setIsUpdating(true)
    setUpdateResult(null)

    try {
      // First update the local product description
      const updateResponse = await fetch(`/api/products/${productId}/description`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: editedDescription.trim() }),
      })

      if (!updateResponse.ok) {
        throw new Error('Failed to update product description')
      }

      // Then try to apply to marketplace if connected
      let marketplaceResult = null
      if (storeConnectionId) {
        try {
          const marketplaceResponse = await fetch(`/api/products/${productId}/description/apply-to-marketplace`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              description: editedDescription.trim(),
              marketplace 
            }),
          })

          if (marketplaceResponse.ok) {
            const result = await marketplaceResponse.json()
            marketplaceResult = result.data
          }
        } catch (error) {
          console.error('Marketplace update failed:', error)
        }
      }

      // Update parent component
      onDescriptionUpdate(editedDescription.trim())
      setIsEditing(false)

      // Set result message
      if (marketplaceResult?.success) {
        setUpdateResult({
          success: true,
          message: `Description updated successfully in both local database and ${marketplace}`
        })
      } else if (storeConnectionId) {
        setUpdateResult({
          success: true,
          message: `Description updated locally. Marketplace update failed: ${marketplaceResult?.message || 'Unknown error'}`,
          localOnly: true
        })
      } else {
        setUpdateResult({
          success: true,
          message: 'Description updated successfully (no marketplace connection)'
        })
      }

    } catch (error) {
      setUpdateResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update description'
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Product Description
            {storeConnectionId && (
              <span className="text-sm font-normal text-muted-foreground">
                (synced with {marketplace})
              </span>
            )}
          </CardTitle>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartEdit}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Enter product description..."
              className="min-h-[120px]"
              disabled={isUpdating}
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                disabled={isUpdating || editedDescription.trim() === description.trim()}
                size="sm"
              >
                {isUpdating ? (
                  <>
                    <Upload className="w-4 h-4 mr-2 animate-pulse" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isUpdating}
                size="sm"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
            {storeConnectionId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Changes will be applied to both the local database and your connected {marketplace} store.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {description ? (
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{description}</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">No description available</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartEdit}
                  className="mt-2"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Add Description
                </Button>
              </div>
            )}
          </div>
        )}

        {updateResult && (
          <Alert variant={updateResult.success ? "default" : "destructive"} className="mt-4">
            {updateResult.success ? (
              updateResult.localOnly ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertDescription>{updateResult.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}