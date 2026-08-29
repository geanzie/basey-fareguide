import Link from 'next/link'
import { MapPinOff } from 'lucide-react'
import Button from '@/ui/Button'
import EmptyState from '@/ui/EmptyState'

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4">
      <EmptyState
        icon={MapPinOff}
        title="Page not found"
        message="The page you are looking for does not exist or has moved."
        action={
          <Link href="/">
            <Button>Go home</Button>
          </Link>
        }
      />
    </div>
  )
}
