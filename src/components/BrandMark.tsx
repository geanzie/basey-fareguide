import { LogoMark } from '@/components/Logo'

// The Banig Ticket mark from the brand kit. Use tone="dark" on the dark
// auth screens so the ticket reads as straw on ink instead of green on ink.
export default function BrandMark({
  size = 'md',
  tone = 'light',
}: {
  size?: 'sm' | 'md' | 'lg'
  tone?: 'light' | 'dark'
}) {
  const px = size === 'sm' ? 36 : size === 'lg' ? 64 : 44
  return <LogoMark size={px} tone={tone} />
}
