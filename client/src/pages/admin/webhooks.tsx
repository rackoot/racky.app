import { useEffect, useState } from "react"
import { adminApi } from '@/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Link2,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff
} from "lucide-react"
import type { WebhookUrl } from "@/api/types/webhook"

export function AdminWebhooks() {
  const [webhooks, setWebhooks] = useState<WebhookUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingWebhook, setEditingWebhook] = useState<WebhookUrl | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [webhookToDelete, setWebhookToDelete] = useState<WebhookUrl | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    url: '',
    isActive: true
  })

  useEffect(() => {
    loadWebhooks()
  }, [])

  const loadWebhooks = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminApi.getWebhooks()
      setWebhooks(response.webhooks)
    } catch (err: any) {
      console.error('Error loading webhooks:', err)
      setError(err.message || 'Failed to load webhooks')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      await adminApi.createWebhook(formData)
      setIsCreateDialogOpen(false)
      resetForm()
      loadWebhooks()
    } catch (err: any) {
      alert(err.message || 'Failed to create webhook')
    }
  }

  const handleUpdate = async () => {
    if (!editingWebhook) return

    try {
      await adminApi.updateWebhook(editingWebhook._id, formData)
      setEditingWebhook(null)
      resetForm()
      loadWebhooks()
    } catch (err: any) {
      alert(err.message || 'Failed to update webhook')
    }
  }

  const handleDelete = async () => {
    if (!webhookToDelete) return

    try {
      await adminApi.deleteWebhook(webhookToDelete._id)
      setIsDeleteDialogOpen(false)
      setWebhookToDelete(null)
      loadWebhooks()
    } catch (err: any) {
      alert(err.message || 'Failed to delete webhook')
    }
  }

  const handleToggleStatus = async (webhook: WebhookUrl) => {
    try {
      await adminApi.toggleWebhookStatus(webhook._id)
      loadWebhooks()
    } catch (err: any) {
      alert(err.message || 'Failed to toggle webhook status')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      url: '',
      isActive: true
    })
  }

  const openEditDialog = (webhook: WebhookUrl) => {
    setFormData({
      name: webhook.name,
      description: webhook.description,
      url: webhook.url,
      isActive: webhook.isActive
    })
    setEditingWebhook(webhook)
  }

  const openDeleteDialog = (webhook: WebhookUrl) => {
    setWebhookToDelete(webhook)
    setIsDeleteDialogOpen(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-500 py-8">
              <p>Error: {error}</p>
              <Button onClick={loadWebhooks} className="mt-4">Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhook URLs</h1>
          <p className="text-muted-foreground mt-1">
            Manage webhook URLs for video generation events
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setIsCreateDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Webhook
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook URLs</CardTitle>
          <CardDescription>
            External services will send video generation events to these URLs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No webhooks configured yet</p>
              <p className="text-sm mt-2">Add your first webhook URL to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">URL</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Created</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map((webhook) => (
                    <tr key={webhook._id} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{webhook.name}</div>
                          {webhook.description && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {webhook.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {webhook.url}
                        </code>
                      </td>
                      <td className="p-3">
                        <Badge variant={webhook.isActive ? "default" : "secondary"}>
                          {webhook.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {formatDate(webhook.createdAt)}
                      </td>
                      <td className="p-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(webhook)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(webhook)}>
                              {webhook.isActive ? (
                                <>
                                  <PowerOff className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <Power className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(webhook)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen || !!editingWebhook} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false)
          setEditingWebhook(null)
          resetForm()
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingWebhook ? 'Edit Webhook' : 'Add Webhook'}
            </DialogTitle>
            <DialogDescription>
              {editingWebhook
                ? 'Update the webhook URL configuration'
                : 'Add a new webhook URL for receiving video events'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Production Video Webhook"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">URL *</Label>
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://example.com/api/video-events"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Webhook for video generation completion events"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false)
                setEditingWebhook(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingWebhook ? handleUpdate : handleCreate}>
              {editingWebhook ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this webhook URL? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {webhookToDelete && (
            <div className="py-4">
              <div className="font-medium">{webhookToDelete.name}</div>
              <code className="text-sm bg-muted px-2 py-1 rounded mt-2 inline-block">
                {webhookToDelete.url}
              </code>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setWebhookToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
