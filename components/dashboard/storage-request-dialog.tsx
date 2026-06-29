'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { submitStorageRequest } from '@/app/actions/storage'
import { toast } from 'sonner'

export function StorageRequestDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [age, setAge] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !reason || !firstName || !lastName || !age) return
    const ageNum = parseInt(age, 10)
    if (isNaN(ageNum) || ageNum < 1) return
    setLoading(true)
    try {
      await submitStorageRequest(reason, amount, ageNum, firstName, lastName)
      toast.success('Request sent')
      setOpen(false)
      setAmount('')
      setReason('')
      setFirstName('')
      setLastName('')
      setAge('')
    } catch {
      toast.error('Failed to send request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="link" className="text-xs text-muted-foreground hover:text-foreground px-0 h-auto font-normal">
            Need more storage? Apply.
          </Button>
        }
      />
      <AlertDialogContent>
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle>Request more storage</AlertDialogTitle>
            <AlertDialogDescription>
              Provide your identity details and tell us how much storage you need.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                min={1}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="18"
                className="w-24"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">How much do you need?</Label>
              <Input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50GB"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">Why do you need it?</Label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe your use case..."
                required
                rows={4}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
