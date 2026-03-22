import { Building2, CircleParking, CreditCard, TriangleAlert, Users, UserRoundCheck } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

const iconMap = {
  flats: Building2,
  residents: Users,
  overdue_payments: CreditCard,
  active_complaints: TriangleAlert,
  active_visitors: UserRoundCheck,
  slots: CircleParking,
}

function StatsGrid({ stats, parkingSlots }) {
  const cards = [
    { key: 'flats', label: 'Total Flats', value: stats.flats },
    { key: 'residents', label: 'Residents', value: stats.residents },
    { key: 'overdue_payments', label: 'Overdue Payments', value: stats.overdue_payments },
    { key: 'active_complaints', label: 'Active Complaints', value: stats.active_complaints },
    { key: 'active_visitors', label: 'Visitors Inside', value: stats.active_visitors },
    { key: 'slots', label: 'Parking Slots Used', value: parkingSlots },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((item) => {
        const Icon = iconMap[item.key]
        return (
          <Card key={item.key} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{item.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <p className="text-3xl font-bold text-slate-900">{item.value ?? 0}</p>
              <div className="rounded-lg bg-teal-100 p-2 text-teal-700">
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export default StatsGrid
