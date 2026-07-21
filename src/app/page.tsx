import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import POSPage from '@/components/pos/POSPage'
import LoginPage from '@/components/pos/LoginPage'

export default async function Home() {
  const user = await getCurrentUser()
  if (!user) {
    return <LoginPage />
  }
  return <POSPage />
}
