import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('Utils', () => {
  describe('cn function', () => {
    it('combines class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2')
    })

    it('handles conditional classes', () => {
      expect(cn('base', true && 'conditional', false && 'ignored')).toBe('base conditional')
    })

    it('handles undefined and null values', () => {
      expect(cn('base', undefined, null, 'end')).toBe('base end')
    })

    it('merges Tailwind classes correctly', () => {
      expect(cn('p-2', 'p-4')).toBe('p-4') // p-4 should override p-2
    })

    it('handles empty input', () => {
      expect(cn()).toBe('')
    })
  })
})