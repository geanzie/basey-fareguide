import { redirect } from 'next/navigation'

export default function DashboardIncidentsRedirectPage() {
  redirect('/history?filter=reports')
}
