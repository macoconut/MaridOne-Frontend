import { useCallback, useState } from 'react'

export type ModalState<T> = {
  isOpen: boolean
  target: T | null
  open: (target?: T) => void
  close: () => void
}

export function useModalState<T>(): ModalState<T> {
  const [isOpen, setIsOpen] = useState(false)
  const [target, setTarget] = useState<T | null>(null)

  const open = useCallback((nextTarget?: T) => {
    setTarget(nextTarget ?? null)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setTarget(null)
  }, [])

  return { isOpen, target, open, close }
}
