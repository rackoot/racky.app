import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, ExternalLink, Save, TestTube } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { marketplacesApi } from "@/api"
import type { Marketplace, MarketplaceCredentials } from "@/types/marketplace"

interface ConnectionFormProps {
  marketplace: Marketplace
  onSuccess: () => void
  onCancel: () => void
}

const credentialLabels: Record<string, string> = {
  shop_url: "Shop URL",
  access_token: "Access Token", 
  account_name: "Account Name",
  app_key: "App Key",
  app_token: "App Token",
  client_id: "Client ID",
  client_secret: "Client Secret",
  user_id: "User ID",
  seller_id: "Seller ID",
  marketplace_id: "Marketplace ID",
  access_key: "Access Key",
  secret_key: "Secret Key", 
  region: "Region",
  page_id: "Page ID",
  merchant_id: "Merchant ID",
  client_email: "Client Email",
  private_key: "Private Key",
  site_url: "Site URL",
  consumer_key: "Consumer Key",
  consumer_secret: "Consumer Secret",
}

const credentialPlaceholders: Record<string, string> = {
  shop_url: "mystore.myshopify.com",
  access_token: "shpat_xxxxx",
  account_name: "your-account",
  app_key: "vtexappkey-xxx",
  app_token: "xxxx",
  client_id: "1234567890",
  client_secret: "xxxxxxxxxxxx",
  user_id: "123456789",
  seller_id: "A1234567890",
  marketplace_id: "ATVPDKIKX0DER",
  access_key: "AKIAI...",
  secret_key: "xxxx",
  region: "us-east-1",
  page_id: "123456789",
  merchant_id: "123456789",
  client_email: "service@project.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  site_url: "https://mystore.com",
  consumer_key: "ck_xxxxx",
  consumer_secret: "cs_xxxxx",
}

export function ConnectionForm({ marketplace, onSuccess, onCancel }: ConnectionFormProps) {
  const [credentials, setCredentials] = useState<MarketplaceCredentials>({})
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; data?: any } | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    // Initialize empty credentials
    const initialCredentials: MarketplaceCredentials = {}
    marketplace.requiredCredentials.forEach(cred => {
      initialCredentials[cred] = ""
    })
    setCredentials(initialCredentials)
  }, [marketplace])

  const handleCredentialChange = (key: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [key]: value
    }))
    setTestResult(null)
    setError("")
  }

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    setError("")
    setTestResult(null)

    try {
      const result = await marketplacesApi.testConnection(marketplace.id, credentials)
      setTestResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed")
    } finally {
      setIsTestingConnection(false)
    }
  }

  const generateStoreName = () => {
    // Try to extract a meaningful name from test result or credentials
    if (testResult?.data?.shop_name) {
      return testResult.data.shop_name
    }
    if (testResult?.data?.domain) {
      return testResult.data.domain
    }
    
    // Fall back to credential-based naming
    if (credentials.shop_url) {
      // For Shopify, extract store name from URL
      const shopUrl = credentials.shop_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
      return shopUrl.replace('.myshopify.com', '')
    }
    if (credentials.site_url) {
      // For WooCommerce, extract from site URL
      try {
        const url = new URL(credentials.site_url.startsWith('http') ? credentials.site_url : `https://${credentials.site_url}`)
        return url.hostname.replace('www.', '')
      } catch {
        return credentials.site_url
      }
    }
    if (credentials.account_name) {
      // For VTEX
      return credentials.account_name
    }
    
    // Generic fallback
    return `${marketplace.name} Store`
  }

  const handleSave = async () => {
    if (!testResult?.success) {
      setError("Please test the connection successfully before saving")
      return
    }

    setIsSaving(true)
    setError("")

    try {
      const storeName = generateStoreName()
      await marketplacesApi.createStoreWithMarketplace({
        storeName,
        type: marketplace.id,
        credentials
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save connection")
    } finally {
      setIsSaving(false)
    }
  }

  const isFormValid = marketplace.requiredCredentials.every(cred => credentials[cred]?.trim())

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-lg">
            {marketplace.id === 'shopify' ? '🛍️' : 
             marketplace.id === 'amazon' ? '📦' :
             marketplace.id === 'vtex' ? '🏪' :
             marketplace.id === 'mercadolibre' ? '🛒' :
             marketplace.id === 'facebook_shop' ? '👥' :
             marketplace.id === 'google_shopping' ? '🔍' : '🌟'}
          </div>
          <CardTitle className="text-xl">{marketplace.name} Connection</CardTitle>
        </div>
        <CardDescription>
          {marketplace.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            Getting Started
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(marketplace.documentationUrl, '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
              View Documentation
            </Button>
          </h4>
          <p className="text-sm text-muted-foreground">
            {marketplace.id === 'shopify' && "To connect VTEX, create an application key and token in your VTEX admin panel."}
            {marketplace.id === 'vtex' && "To connect VTEX, create an application key and token in your VTEX admin panel."}
            {marketplace.id === 'amazon' && "To connect Amazon, you'll need your Seller Central credentials and SP-API access."}
            {marketplace.id === 'woocommerce' && "To connect WooCommerce, generate REST API keys in your WordPress admin."}
            {marketplace.id === 'mercadolibre' && "To connect MercadoLibre, create an application in the MercadoLibre Developers site."}
            {marketplace.id === 'facebook_shop' && "To connect Facebook Shop, get your page access token from Facebook Developer Console."}
            {marketplace.id === 'google_shopping' && "To connect Google Shopping, create a service account in Google Cloud Console."}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-4">
            <h4 className="font-medium">Connection Settings</h4>
            {marketplace.requiredCredentials.map((credKey) => (
              <div key={credKey}>
                <Label htmlFor={credKey}>
                  {credentialLabels[credKey] || credKey} *
                </Label>
                <Input
                  id={credKey}
                  type={credKey.includes('key') || credKey.includes('secret') || credKey.includes('token') ? "password" : "text"}
                  placeholder={credentialPlaceholders[credKey] || `Enter ${credentialLabels[credKey] || credKey}`}
                  value={credentials[credKey] || ""}
                  onChange={(e) => handleCredentialChange(credKey, e.target.value)}
                  className="mt-1"
                />
                {credKey === 'private_key' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste the entire private key including the BEGIN and END lines
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {testResult.message}
              {testResult.success && (
                <div className="mt-2 space-y-1">
                  <div><strong>Store name:</strong> {generateStoreName()}</div>
                  {testResult.data?.shop_name && <div>Connected to: {testResult.data.shop_name}</div>}
                  {testResult.data?.domain && <div>Domain: {testResult.data.domain}</div>}
                  {testResult.data?.plan && <div>Plan: {testResult.data.plan}</div>}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleTestConnection}
            disabled={!isFormValid || isTestingConnection}
          >
            <TestTube className="w-4 h-4 mr-2" />
            {isTestingConnection ? "Testing..." : "Test Connection"}
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!testResult?.success || isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Connection"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}