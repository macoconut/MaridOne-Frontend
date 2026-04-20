import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useModalState } from './useModalState'

describe('useModalState', () => {
  it('starts closed with null target', () => {
    const { result } = renderHook(() => useModalState<number>())

    expect(result.current.isOpen).toBe(false)
    expect(result.current.target).toBeNull()
  })

  it('open(target) sets both', () => {
    const { result } = renderHook(() => useModalState<number>())

    act(() => result.current.open(42))

    expect(result.current.isOpen).toBe(true)
    expect(result.current.target).toBe(42)
  })

  it('close() resets state', () => {
    const { result } = renderHook(() => useModalState<number>())

    act(() => result.current.open(42))
    act(() => result.current.close())

    expect(result.current.isOpen).toBe(false)
    expect(result.current.target).toBeNull()
  })
})
