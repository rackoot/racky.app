import { MetricsCard } from "@/components/dashboard/metrics-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Store, DollarSign, TrendingUp, PieChart, LineChart } from "lucide-react"
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

const pieData = [
  { name: 'Shopify', value: 45, color: '#8BC34A' },
  { name: 'Amazon', value: 25, color: '#FF9800' },
  { name: 'MercadoLibre', value: 15, color: '#FFEB3B' },
  { name: 'WooCommerce', value: 10, color: '#9C27B0' },
  { name: 'VTEX', value: 5, color: '#F44336' },
]

const revenueData = [
  { month: 'Jan', revenue: 45000 },
  { month: 'Feb', revenue: 52000 },
  { month: 'Mar', revenue: 48000 },
  { month: 'Apr', revenue: 61000 },
  { month: 'May', revenue: 55000 },
  { month: 'Jun', revenue: 67000 },
]

export function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricsCard
          title="Total Products"
          value="3,043"
          change="+12% from last month"
          changeType="positive"
          icon={Package}
        />
        <MetricsCard
          title="Connected Stores"
          value="8"
          change="+2 new this month"
          changeType="positive"
          icon={Store}
        />
        <MetricsCard
          title="Monthly Revenue"
          value="$67,000"
          change="+21.8% from last month"
          changeType="positive"
          icon={DollarSign}
        />
        <MetricsCard
          title="Avg. Order Value"
          value="$89.50"
          change="+5.2% from last month"
          changeType="positive"
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-normal">Product Distribution by Platform</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-normal">Revenue Trend</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`$${value?.toLocaleString()}`, 'Revenue']} />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}