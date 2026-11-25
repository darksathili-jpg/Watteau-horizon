import type { ReactNode } from 'react'

const icons = {
  brand: 'M 4 18 L 9 6 L 14 15 L 18 8 L 22 18 M 3 21 H 22',
  compass: 'M 12 2.5 A 9.5 9.5 0 1 0 12.01 2.5 M 15.5 8.5 L 13.5 13.5 L 8.5 15.5 L 10.5 10.5 Z',
  book: 'M 5 4 H 18 V 20 H 5 Q 3 20 3 18 V 6 Q 3 4 5 4 M 6 16 H 18 M 8 8 H 14 M 8 11 H 13',
  compare: 'M 2 7 H 21 M 5 4 L 2 7 L 5 10 M 22 17 H 3 M 19 14 L 22 17 L 19 20',
  controller: 'M 7 6 H 17 Q 20 6 21 9 L 22 15 Q 22.5 18 20 18 L 16 15 H 8 L 4 18 Q 1.5 18 2 15 L 3 9 Q 4 6 7 6 M 6 10 V 14 M 4 12 H 8 M 16 11 H 16.1 M 19 13 H 19.1',
  list: 'M 8 6 H 21 M 8 12 H 21 M 8 18 H 21 M 3 6 H 3.1 M 3 12 H 3.1 M 3 18 H 3.1',
  pin: 'M 19 10 C 19 4 16 2 12 2 C 8 2 5 5 5 10 C 5 14 12 22 12 22 C 12 22 19 14 19 10 Z M 12 7 A 2.5 2.5 0 1 0 12.01 7',
  flag: 'M 5 22 V 3 M 5 4 Q 9 1 13 4 T 21 4 V 15 Q 17 18 13 15 T 5 15',
  check: 'M 4 12 L 9 17 L 20 6',
  lock: 'M 5 11 H 19 V 21 H 5 Z M 8 11 V 7 A 4 4 0 0 1 16 7 V 11',
  info: 'M 12 2.5 A 9.5 9.5 0 1 0 12.01 2.5 M 12 11 V 17 M 12 7 H 12.1',
  motion: 'M 3 7 H 15 M 6 12 H 21 M 3 17 H 15',
  download: 'M 12 3 V 15 M 7 10 L 12 15 L 17 10 M 4 17 V 21 H 20 V 17',
  close: 'M 5 5 L 19 19 M 19 5 L 5 19',
  keyboard: 'M 2 5 H 22 V 19 H 2 Z M 6 9 H 6.1 M 10 9 H 10.1 M 14 9 H 14.1 M 18 9 H 18.1 M 6 14 H 6.1 M 10 14 H 18',
} as const

export function Icon({ name, size = 20 }: { name: keyof typeof icons; size?: number }): ReactNode {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg>
}
